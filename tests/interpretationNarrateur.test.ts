import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CLES_STYLES, NOMS_STYLES, comparerStyles, defautsAventure,
  instructionStyle, stylesNarratifsDefaut, validerDefautsAventure, validerStylesNarratifs,
} from '../src/concepteur/interpretationNarrative';
import { reglagesNarrateurDefaut, samplersPourRequete, validerReglagesNarrateur } from '../src/concepteur/reglagesNarrateur';
import { creerConfigurationAtelier, modifierEtatAtelier, validerConfigurationAtelier } from '../src/concepteur/configuration';
import { construireSystemPrompt } from '../src/engine/promptBuilder';
import { controlerLongueurNarration } from '../src/engine/controleLongueurNarration';
import { analyserSeriesContexte, percentile } from '../src/concepteur/statistiquesContexte';
import type { StoryState } from '../src/types';

test('les 4 styles existants produisent réellement 4 instructions distinctes', () => {
  const styles = stylesNarratifsDefaut();
  assert.equal(CLES_STYLES.length, 4);
  assert.deepEqual(CLES_STYLES.map(k => NOMS_STYLES[k]), ['Cinématique', 'Immersif', 'Libre', 'Aventure']);
  const preview = comparerStyles(styles);
  assert.equal(new Set(preview.map(x => x.texte)).size, 4);
  assert.match(instructionStyle('mysterieux_intrigant', styles), /mystères/i);
});

test('un réglage de style modifie une unique consigne Ton, sans changer le canon', () => {
  const base = stylesNarratifsDefaut();
  const modifie = { ...base, sombre_realiste: { ...base.sombre_realiste, densite: 'sobre' as const } };
  const contexte = {
    meta: { id: 'scene-test', createdAt: 1, updatedAt: 1, personnageNom: 'Joueur', personnageDescription: '', pointDeDepart: '', contexte: { lieu: '', ambiance: '', dateChronique: '', objectifs: '' } },
    settings: { ...defautsAventure(), ton: 'sombre_realiste' },
    faits: [], resume: '', loreElyndor: [], messagesRecents: [], messageJoueur: 'Je regarde autour de moi.',
    stylesNarratifs: base,
  } as Parameters<typeof construireSystemPrompt>[0];
  const avant = construireSystemPrompt(contexte);
  const apres = construireSystemPrompt({ ...contexte, stylesNarratifs: modifie });
  assert.notEqual(avant, apres);
  assert.match(avant, /Détails sensoriels et matériels riches/);
  assert.match(apres, /Descriptions concentrées/);
  assert.equal((apres.match(/\[RÈGLES IMMUABLES/g) ?? []).length, 1);
  assert.match(apres, /AUTONOMIE DU JOUEUR STRICTE/);
});

test('les paramètres aventure sont validés et ne changent pas lors d’une migration ancienne', () => {
  const vieux = reglagesNarrateurDefaut();
  const { styles: _styles, aventureDefaut: _defaults, ...sansNouveautes } = vieux;
  const migre = validerReglagesNarrateur(sansNouveautes);
  assert.deepEqual(migre.styles, stylesNarratifsDefaut());
  assert.deepEqual(migre.aventureDefaut, defautsAventure());
  assert.deepEqual(migre.longueurs.courte, { min: 140, max: 160 });
  assert.throws(() => validerDefautsAventure({ ...defautsAventure(), ton: 'mode_interdit' }));
  assert.throws(() => validerStylesNarratifs({ ...stylesNarratifsDefaut(), heroique_epique: { accent: 'nulle part' } }));
});

test('sauvegarde versionnée et restauration des profils interprètent les nouveaux champs', () => {
  const v1 = creerConfigurationAtelier(1000);
  const v2 = modifierEtatAtelier(v1, {
    profilActif: 'test',
    profils: {
      ...v1.profils,
      test: { ...v1.profils.test, narrateur: { ...v1.profils.test.narrateur,
        aventureDefaut: { ...defautsAventure(), romance: 'aucun' },
      } },
    },
  }, 'Préférences test', 1001);
  assert.equal(v2.numero, 2);
  assert.equal(v2.profils.test.narrateur.aventureDefaut.romance, 'aucun');
  const imported = validerConfigurationAtelier(JSON.parse(JSON.stringify(v2)));
  assert.equal(imported.profils.production.narrateur.aventureDefaut.romance, 'modere');
  const old = JSON.parse(JSON.stringify(v1));
  for (const p of ['production','test','benchmark']) {
    delete old.profils[p].narrateur.styles;
    delete old.profils[p].narrateur.aventureDefaut;
  }
  assert.deepEqual(validerConfigurationAtelier(old).profils.production.narrateur.styles, stylesNarratifsDefaut());
});

test('120 tours mock : les trois plages restent strictement distinctes sans allongement progressif', async () => {
  const limites = reglagesNarrateurDefaut().longueurs;
  const valeurs = [['courte', limites.courte], ['moyenne', limites.moyenne], ['longue', limites.longue]] as const;
  for (let tour = 0; tour < 120; tour++) {
    const [nom, plage] = valeurs[tour % 3];
    const cible = Math.round((plage.min + plage.max) / 2);
    // Mock : pas un véritable tokenizer ni une évaluation de la qualité RP.
    const texte = 'PNJ : « ' + 'a'.repeat(cible - 9) + ' »';
    const retour = await controlerLongueurNarration({
      texte, plage, temperature: 0.7, compter: async t => t.length,
      reformuler: async () => { throw Error('Régénération inutile en simulation'); },
    });
    assert.equal(retour.verification, 'exacte', 'profil ' + nom + ', tour ' + tour);
    assert.equal(retour.conforme, true);
    assert.equal(retour.corrige, false);
  }
});

test('samplers individuels : clés neutralisées volontairement et Mirostat sans conflit', () => {
  const defaults = reglagesNarrateurDefaut();
  assert.deepEqual(samplersPourRequete(defaults), {});
  const actifs = { ...defaults, samplersActifs: true };
  assert.equal(Object.keys(samplersPourRequete(actifs)).length, 19);
  const selec = { ...actifs, samplersEnvoyes: { ...actifs.samplersEnvoyes, xtc_probability: false } };
  assert.equal('xtc_probability' in samplersPourRequete(selec), false);
  const mirostat = { ...selec, samplers: { ...selec.samplers, mirostat: 2 } };
  const valeurs = samplersPourRequete(mirostat);
  assert.equal(valeurs.mirostat, 2);
  for (const exclue of ['top_p','top_k','min_p','typical_p']) assert.equal(exclue in valeurs, false);
  const historique = JSON.parse(JSON.stringify(defaults));
  delete historique.samplersEnvoyes;
  assert.equal(validerReglagesNarrateur(historique).samplersEnvoyes.top_p, true);
  assert.throws(() => validerReglagesNarrateur({
    ...defaults, samplersEnvoyes: { ...defaults.samplersEnvoyes, top_p: 'non' },
  }), /sampler invalide/);
});

test('statistiques P50/P95 issues des diagnostics, sans inventer de tokens manquants', () => {
  assert.equal(percentile([], 0.95), null);
  assert.equal(percentile([100, 200, 300, 400], 0.5), 200);
  assert.equal(percentile([100, 200, 300, 400], 0.95), 400);
  const diag = (dureeTotaleMs: number, exact: boolean) => ({
    id: String(dureeTotaleMs), startedAt: 10,
    dureeTotaleMs, embeddings: [],
    etapes: [{ nom: 'Contrôle final des longueurs', categorie: 'validation',
      statut: exact ? 'ok' : 'repli', raison: exact ? '150 tokens exacts' : 'non mesuré' }],
    appelsIA: [{ composant: 'Narration RP', modele: 'test', maxTokens: 200,
      dureeMs: dureeTotaleMs, inputTokens: 10, cachedInputTokens: 0,
      outputTokens: 150, reasoningTokens: 0, totalTokens: 160,
      usageComplet: true, statut: 'ok' }],
  });
  const story = { messages: [
    { role: 'assistant', diagnosticTour: diag(100, true) },
    { role: 'assistant', diagnosticTour: diag(200, false) },
    { role: 'assistant', diagnosticTour: diag(300, true) },
  ] } as unknown as StoryState;
  const r = analyserSeriesContexte(story);
  assert.equal(r.echantillon, 3);
  assert.equal(r.p50Ms, 200);
  assert.equal(r.p95Ms, 300);
  assert.equal(r.toursAvecComptageExact, 2);
  assert.equal(r.toursNonVerifies, 1);
  assert.equal(r.appelsIA, 3);
});
