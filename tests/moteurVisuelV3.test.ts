import assert from 'node:assert/strict';
import test from 'node:test';
import { creerNouvelleHistoire } from '../src/engine/story';
import {
  analyserExtraction,
  consoliderContratScene,
  contratDepuisStructureHeritee,
  contratLibre,
  contratPortrait,
  extractionVide,
  type ContratVisuel,
  type ExtractionMotsCles,
} from '../src/engine/contratVisuel';
import { extractionDeRepli, consigneExtraction, CONSIGNE_EXTRACTION_PAR_DEFAUT, messagesExtraction } from '../src/engine/extracteurVisuel';
import {
  preparerRequeteImage,
  selectionnerReferences,
  construireTrace,
  type ReferenceCandidate,
} from '../src/engine/moteurVisuel';
import { capacitesElyndorCloud, capacitesOpenAI, capacitesOpenRouter, adaptateurSelonReglages, type CapacitesGenerateur } from '../src/engine/fournisseursImages';
import { construireCorpsRequeteImage } from '../src/engine/elyndorCloudImages';
import { construireCorpsImageOpenAI } from '../src/engine/openAiImages';
import { reglagesVisuelsInitiaux, type ReglagesVisuels } from '../src/concepteur/reglagesVisuels';
import { contratRegeneration, integrerChangementsVisuels, nouvelleSceneIllustree } from '../src/engine/sceneVisuelle';
import { ajouterSceneIllustree, etatVisuelVide, projeterEtatVisuel, sceneDansChronologie, type SceneIllustree } from '../src/engine/visualState';
import { candidatsLorePourContrat } from '../src/engine/referencesVisuelles';
import { ajouterLienAsset, etatAssetsLoreVide, validerEtatAssetsLore } from '../src/concepteur/assetsLore';
import { creerEtatLore, creerExportLore } from '../src/concepteur/lorebookModele';
import { definirDependancesServiceVisuel, executerImage } from '../src/engine/serviceVisuel';
import { definirPuitsJournal, type EntreeJournal } from '../src/engine/journalDiagnostic';
import type { ElyndorEntryChargee } from '../src/engine/loreLoader';
import type { AppSettings, StoryState } from '../src/types';

const REGLAGES = reglagesVisuelsInitiaux();
const AVEC_PERSONNAGES: ReglagesVisuels = { ...REGLAGES, references: { ...REGLAGES.references, personnages: true } };
const ELYNDOR = capacitesElyndorCloud();
/** Générateur hypothétique acceptant plusieurs références générales. */
const ELYNDOR_MULTIPLE: CapacitesGenerateur = { ...ELYNDOR, references: { ...ELYNDOR.references, referenceGeneraleUnique: false } };
const OPENAI = capacitesOpenAI('gpt-image-1-mini');
const SANS_REFERENCES: CapacitesGenerateur = { ...ELYNDOR, nom: 'Générateur texte seul', references: { supportees: false, max: 0, maxVisages: 0, roles: [] } };
const MARQUEURS_MODELE = /sdxl|lustify|chroma|flux|\blora\b|years old\)\d|\)\s*1\.\d|elyndor style/i;

function histoire(dernier = 'Sous les halles couvertes de Paris, Sylvana Nocturne marchande près des estrades de bois. La foule se presse dans les allées.'): StoryState {
  const story = creerNouvelleHistoire({
    personnageNom: 'William',
    personnageDescription: 'Humain balafré, manteau de cuir noir, épée bâtarde.',
    pointDeDepart: 'Paris.',
    contexte: { lieu: 'Paris', ambiance: 'Sombre', dateChronique: '', objectifs: '' },
    settings: {
      creativite: 'moyenne', longueur: 'moyenne', ton: 'sombre_realiste', violence: 'modere',
      romance: 'aucun', humour: 'faible', liberteJoueur: 'elevee', rythme: 'normal',
    },
  });
  story.meta.id = 'story-v3';
  story.meta.raceOrigineId = 'humains';
  story.meta.sexe = 'Homme';
  story.messages = [
    { id: 'u1', role: 'user', content: 'Je vais au marché.', timestamp: 1 },
    { id: 'a1', role: 'assistant', content: dernier, timestamp: 2 },
  ];
  story.loreEmergent = [
    { id: 'pnj-sylvana', categorie: 'pnj', titre: 'Sylvana Nocturne', contenu: 'Elfe noire, cheveux argentés tressés, marchande.', statut: 'permanent', premiereMention: 1, dernierAcces: 2 },
    { id: 'pnj-kael', categorie: 'pnj', titre: 'Maître Kael', contenu: 'Humain, chef de guilde en robe noire.', statut: 'provisoire', premiereMention: 1, dernierAcces: 2 },
  ];
  return story;
}

function extraction(partiel: Partial<ExtractionMotsCles>): ExtractionMotsCles {
  return { ...extractionVide(), ...partiel };
}

function personnage(nom: string, autres: Partial<ExtractionMotsCles['personnagesVisibles'][number]> = {}) {
  return { nom, identite: [], apparence: [], tenue: [], action: [], position: [], ...autres };
}

function contratMarche(story = histoire(), partiel: Partial<ExtractionMotsCles> = {}) {
  return consoliderContratScene({
    story,
    extraction: extraction({
      typeScene: 'groupe',
      lieu: ['covered market', 'stone halls'],
      instant: ['daylight'],
      personnagesVisibles: [personnage('Sylvana', { identite: ['35 years old', 'dark elf', 'female', 'merchant'], tenue: ['grey hooded cloak'], action: ['haggling'] })],
      action: ['busy trading'],
      elementsObligatoires: ['wooden platforms', 'crowded aisles', 'stone arches'],
      decor: ['wooden stalls', 'stone paving'],
      ...partiel,
    }),
    etat: etatVisuelVide(),
    texteScene: story.messages[story.messages.length - 1].content,
    parModele: true,
  });
}

function preparer(contrat: ContratVisuel, capacites: CapacitesGenerateur = ELYNDOR, reglages: ReglagesVisuels = REGLAGES, candidats: ReferenceCandidate[] = []) {
  return preparerRequeteImage({ contrat, reglages, capacites, candidats, profilContenu: 'adulte' });
}

test('V01 — tous les faits obligatoires du marché sont dans le prompt réellement transmis', () => {
  const { contrat } = contratMarche();
  const { requete } = preparer(contrat);
  for (const fait of ['covered market', 'stone halls', 'wooden platforms', 'crowded aisles', 'stone arches', 'busy trading', 'dark elf', 'haggling', 'wooden stalls']) {
    assert.ok(requete.prompt.includes(fait), `absent : ${fait}`);
  }
  // Ordre de criticité : lieu, action, personnage, éléments obligatoires, puis style.
  assert.ok(requete.prompt.indexOf('covered market') < requete.prompt.indexOf('dark elf'));
  assert.ok(requete.prompt.indexOf('wooden platforms') < requete.prompt.indexOf('Quentin Tarantino'));
  assert.equal(requete.prompt.split('covered market').length, 2, 'un seul prompt, sans répétition');
});

test('V02 — un personnage hors champ n’est pas dessiné', () => {
  const { contrat } = contratMarche(histoire(), {
    personnagesVisibles: [personnage('William'), personnage('Sylvana')],
    horsCadre: ['Sylvana Nocturne'],
  });
  assert.deepEqual(contrat.personnages.map((p) => p.nom), ['William']);
  assert.ok(contrat.rejets.some((r) => /hors cadre/.test(r)));
  assert.doesNotMatch(preparer(contrat).requete.prompt, /dark elf/);
});

test('V03 — un personnage simplement mentionné ne devient pas visible', () => {
  const story = histoire('William repense aux conseils de Maître Kael, resté à la guilde. Sylvana Nocturne lui tend une bourse.');
  // Mentionné correctement par l'extracteur…
  const bon = consoliderContratScene({ story, extraction: extraction({ personnagesVisibles: [personnage('Sylvana')], mentionnes: ['Maître Kael'] }), etat: etatVisuelVide(), texteScene: story.messages[1].content, parModele: true });
  assert.deepEqual(bon.contrat.personnages.map((p) => p.nom), ['Sylvana Nocturne']);
  // …ou déclaré visible à tort alors qu'il est absent du passage : rétrogradé.
  const autre = histoire('Sylvana Nocturne compte ses pièces.');
  const faux = consoliderContratScene({ story: autre, extraction: extraction({ personnagesVisibles: [personnage('Sylvana'), personnage('Maître Kael')] }), etat: etatVisuelVide(), texteScene: autre.messages[1].content, parModele: true });
  assert.deepEqual(faux.contrat.personnages.map((p) => p.nom), ['Sylvana Nocturne']);
  assert.ok(faux.contrat.mentionnes.includes('Maître Kael'));
  // Le repli local suit l'état de scène : un nom cité mais absent n'est pas dessiné.
  story.scene = { ville: 'Paris', lieu: 'Halles de Paris', presents: ['Sylvana Nocturne'], majMessageIndex: 2 } as StoryState['scene'];
  assert.deepEqual(extractionDeRepli(story).personnagesVisibles.map((p) => p.nom), ['William', 'Sylvana Nocturne']);
});

test('V04 — paysage seul : aucun personnage ajouté', () => {
  const story = histoire('Le soleil se couche sur les falaises de craie. Aucun bruit, sinon la mer.');
  const { contrat } = consoliderContratScene({ story, extraction: extraction({ lieu: ['white chalk cliffs', 'sea'], instant: ['sunset'] }), etat: etatVisuelVide(), texteScene: story.messages[1].content, parModele: true });
  assert.equal(contrat.personnages.length, 0);
  assert.equal(contrat.typeScene, 'paysage');
  const { requete } = preparer(contrat);
  assert.doesNotMatch(requete.prompt, /years old|characters|portrait/);
  assert.match(requete.prompt, /white chalk cliffs/);
});

test('V05 — le canon et l’état visuel corrigent la carnation et la tenue inventées', () => {
  const story = histoire();
  const etat = integrerChangementsVisuels(story, etatVisuelVide(), {
    changementsVisuels: [{ cible: 'personnage', nom: 'Sylvana', champ: 'tenue', operation: 'definir', valeur: 'grey hooded cloak', evenement: 'Sylvana Nocturne marchande près des estrades de bois' }],
  }).etat;
  const { contrat, negatifCanon } = consoliderContratScene({
    story,
    extraction: extraction({ personnagesVisibles: [personnage('Sylvana', { apparence: ['pale skin', 'blonde hair', 'slender'], tenue: ['golden armor'] })] }),
    etat, texteScene: story.messages[1].content, parModele: true,
  });
  const sylvana = contrat.personnages[0];
  assert.ok(sylvana.apparence.includes('ebony skin'));
  assert.ok(sylvana.apparence.includes('silver white hair'));
  assert.ok(!sylvana.apparence.includes('pale skin'));
  assert.ok(!sylvana.apparence.includes('blonde hair'));
  assert.ok(sylvana.apparence.includes('slender'));
  assert.deepEqual(sylvana.tenue, ['grey hooded cloak']);
  assert.equal(sylvana.sources.tenue, 'etat-visuel');
  assert.ok(contrat.rejets.some((r) => /golden armor/.test(r)));
  assert.match(negatifCanon.join(','), /pale skin/);
});

test('V06 — une tenue changée lors d’un tour sans image est reprise à l’illustration suivante', () => {
  const story = histoire();
  story.messages.push(
    { id: 'u2', role: 'user', content: 'Je me change.', timestamp: 3 },
    { id: 'a2', role: 'assistant', content: 'William enfile un long manteau de cuir rouge avant de sortir.', timestamp: 4 },
    { id: 'u3', role: 'user', content: 'Je retourne au marché.', timestamp: 5 },
    { id: 'a3', role: 'assistant', content: 'William traverse les halles, Sylvana Nocturne le salue.', timestamp: 6 },
  );
  const { etat, acceptes } = integrerChangementsVisuels(story, etatVisuelVide(), {
    changementsVisuels: [{ cible: 'personnage', nom: 'William', champ: 'tenue', operation: 'definir', valeur: 'long red leather coat', evenement: 'William enfile un long manteau de cuir rouge' }],
  });
  assert.equal(acceptes.length, 1);
  assert.deepEqual(etat.journal?.map((e) => e.messageId), ['a2']);
  const { contrat } = consoliderContratScene({ story, extraction: extraction({ personnagesVisibles: [personnage('William', { tenue: ['black coat'] })] }), etat, texteScene: story.messages[4].content, parModele: true });
  assert.deepEqual(contrat.personnages[0].tenue, ['long red leather coat']);
});

test('V07 — passage château → marché : l’ancienne scène n’est pas une référence de décor', () => {
  const { contrat } = contratMarche();
  const candidats: ReferenceCandidate[] = [
    { id: 'scene:chateau', type: 'scene-precedente', role: 'continuite', libelle: 'scène précédente', lieu: 'castle great hall', uri: 'data:chateau' },
  ];
  const { retenues, ecartees } = selectionnerReferences(candidats, contrat, REGLAGES, ELYNDOR);
  assert.equal(retenues.length, 0);
  assert.match(ecartees[0].raison, /autre lieu/);
  // Même lieu : la continuité est gardée.
  const meme = selectionnerReferences([{ ...candidats[0], lieu: 'covered market' }], contrat, REGLAGES, ELYNDOR);
  assert.equal(meme.retenues.length, 1);
  // La projection suit le déplacement relevé par l'état de scène.
  const story = histoire();
  const etat = { ...etatVisuelVide(), decor: { ...etatVisuelVide().decor, lieu: 'Château de Valmor', typeLieu: '', architecture: 'gothic vaults', disposition: '', heure: 'night', meteo: 'rain', lumiere: '', sourcesLumineuses: [], degats: [], incendies: [], ouvertures: [], objetsImportants: [], mobilier: [], traces: [], majAuMessage: 1, lieuScene: 'Château de Valmor' } };
  story.scene = { ville: 'Paris', lieu: 'Halles de Paris', presents: [], majMessageIndex: 2 } as StoryState['scene'];
  const projete = projeterEtatVisuel(etat, story);
  assert.equal(projete.decor?.lieu, 'Halles de Paris');
  assert.equal(projete.decor?.architecture, '');
  assert.equal(projete.decor?.meteo, 'rain');
});

test('V08 — même PNJ, avatar existant : identité réutilisée si possible, sinon texte + avertissement', () => {
  const { contrat } = contratMarche();
  const avatar: ReferenceCandidate = { id: 'avatar:pnj-sylvana', type: 'pnj-avatar', role: 'identite', entite: 'pnj-sylvana', libelle: 'avatar de Sylvana', uri: 'data:sylvana' };
  const avec = preparer(contrat, ELYNDOR, AVEC_PERSONNAGES, [avatar]);
  assert.deepEqual(avec.requete.references, [{ role: 'personnage', image: 'data:sylvana' }]);
  const sans = preparer(contrat, SANS_REFERENCES, AVEC_PERSONNAGES, [avatar]);
  assert.deepEqual(sans.requete.references, []);
  assert.match(sans.references.ecartees[0].raison, /non prises en charge/);
  assert.ok(sans.avertissements.some((a) => /texte seul.*Sylvana/.test(a)));
});

test('V09 — générateur sans images de référence : aucun champ de référence transmis', () => {
  const { contrat } = contratMarche();
  const p = preparer(contrat, SANS_REFERENCES, AVEC_PERSONNAGES, [
    { id: 'avatar:pnj-sylvana', type: 'pnj-avatar', role: 'identite', entite: 'pnj-sylvana', libelle: 'avatar', uri: 'data:x' },
  ]);
  const corps = construireCorpsRequeteImage(p.requete, 'elyndor-image');
  assert.equal(corps.reference_images, undefined);
  assert.match(p.requete.prompt, /dark elf/, 'la description canonique reste valable');
});

test('V10 — plusieurs visages : sélection ordonnée et plafonnée, sans suppression silencieuse', () => {
  const story = histoire('Sylvana Nocturne, Maître Kael, Bram, Orla, Tess et Ulric entourent la table.');
  const noms = ['Sylvana', 'Maître Kael', 'Bram', 'Orla', 'Tess', 'Ulric'];
  const { contrat } = consoliderContratScene({ story, extraction: extraction({ personnagesVisibles: noms.map((n) => personnage(n)) }), etat: etatVisuelVide(), texteScene: story.messages[1].content, parModele: true });
  assert.equal(contrat.personnages.length, 6);
  const candidats: ReferenceCandidate[] = contrat.personnages.map((p, i) => ({ id: `avatar:${i}`, type: 'pnj-avatar', role: 'identite', entite: p.cle, libelle: `avatar ${p.nom}`, uri: `data:${i}` }));
  const { retenues, ecartees } = selectionnerReferences([...candidats].reverse(), contrat, AVEC_PERSONNAGES, ELYNDOR);
  assert.deepEqual(retenues.map((r) => r.uri), ['data:0', 'data:1', 'data:2', 'data:3']);
  assert.equal(ecartees.length, 2);
  assert.ok(ecartees.every((e) => /plafond de 4 visages/.test(e.raison)));
});

test('V11 — négatif, graine, étapes et modules non pris en charge : exclus avec diagnostic', () => {
  const reglages: ReglagesVisuels = { ...REGLAGES, modules: { cinema: 0.5 }, scene: { ...REGLAGES.scene, graine: 42, pas: 30, guidance: 6 } };
  const p = preparer(contratMarche().contrat, OPENAI, reglages);
  assert.equal(p.requete.negatif, undefined);
  assert.equal(p.requete.seed, undefined);
  assert.equal(p.requete.steps, undefined);
  assert.equal(p.requete.modules, undefined);
  const parametres = p.ecartes.map((e) => e.parametre).join(' | ');
  for (const attendu of ['prompt négatif', 'graine', 'étapes', 'guidance', 'modules (cinema)', 'taille']) assert.ok(parametres.includes(attendu), attendu);
});

test('V12 — deux fournisseurs : même contrat et même style, protocoles natifs différents', () => {
  const { contrat } = contratMarche();
  const a = preparer(contrat, ELYNDOR);
  const b = preparer(contrat, OPENAI);
  assert.equal(a.requete.prompt, b.requete.prompt);
  const corpsPod = construireCorpsRequeteImage(a.requete, 'elyndor-image');
  const corpsOpenAI = construireCorpsImageOpenAI(b.requete, 'gpt-image-1-mini');
  assert.ok('negative_prompt' in corpsPod);
  assert.deepEqual(corpsPod.modules, {});
  assert.equal('negative_prompt' in corpsOpenAI, false);
  assert.equal(corpsOpenAI.prompt, corpsPod.prompt);
  const routeur = capacitesOpenRouter('x/y', ['seed', 'aspect_ratio']);
  assert.equal(routeur.graine, true);
  assert.equal(routeur.negatif, false);
  assert.equal(routeur.references.supportees, false);
});

test('V13 — aperçu libre : style global appliqué par le même moteur', () => {
  const p = preparer(contratLibre('a lone lighthouse on a cliff', '16:9'));
  assert.ok(p.requete.prompt.startsWith('a lone lighthouse on a cliff'));
  assert.match(p.requete.prompt, /Quentin Tarantino style cinematography/);
});

test('V15 — portrait, PNJ, décor : un seul style, formats adaptés', () => {
  const story = histoire();
  const portrait = contratPortrait({ story, sujet: { nom: 'Sylvana Nocturne', type: 'pnj', assetId: 'pnj-sylvana', principal: true }, extraction: null, parModele: false, etat: etatVisuelVide() }).contrat;
  const scene = contratMarche().contrat;
  const decor = consoliderContratScene({ story, extraction: extraction({ lieu: ['ruined chapel'] }), etat: etatVisuelVide(), texteScene: 'La chapelle en ruine.', parModele: true }).contrat;
  const styles = [portrait, scene, decor].map((c) => preparer(c).groupes.find((g) => g.cle === 'style')?.texte);
  assert.ok(styles[0]);
  assert.equal(new Set(styles).size, 1);
  assert.equal(preparer(portrait).requete.format, '3:4');
  assert.equal(preparer(portrait).requete.size, '896x1152');
  assert.equal(preparer(scene).requete.size, '1344x768');
  assert.match(preparer(portrait).requete.prompt, /head and shoulders portrait/);
  assert.doesNotMatch(preparer(scene).requete.prompt, /head and shoulders/);
});

test('V16 — changer le style global change toutes les prochaines images', () => {
  const nouveau: ReglagesVisuels = { ...REGLAGES, style: { nom: 'Gravure', motsCles: 'ink engraving, cross hatching', description: '' } };
  for (const contrat of [contratMarche().contrat, contratLibre('a fortress', '3:4')]) {
    const prompt = preparer(contrat, ELYNDOR, nouveau).requete.prompt;
    assert.match(prompt, /ink engraving, cross hatching/);
    assert.doesNotMatch(prompt, /Tarantino/);
  }
});

test('V19 — ancienne scène (format V2) : relue et régénérable, historique conservé', () => {
  const story = histoire();
  const ancienne: SceneIllustree = {
    revision: 'r-old', messageIndex: 2, creeLe: 0, profil: 'combat', personnagesVisibles: [{ nom: 'Sylvana Nocturne', type: 'pnj', assetId: 'pnj-sylvana', principal: true }],
    structure: { profil: 'combat', personnages: [{ nom: 'Sylvana Nocturne', tenue: 'cape' }], action: 'combat', decor: { lieu: 'Taverne' },
      promptSdxl: 'elyndor style, (35 years old)1.2 dark elf female, (ebony skin)1.3, fighting in a tavern, film grain' },
    regenerations: 0,
  };
  const contrat = contratRegeneration(ancienne, story, 'autre-angle');
  assert.equal(contrat.texteLibre, '35 years old dark elf female, ebony skin, fighting in a tavern');
  assert.equal(contrat.personnages[0].assetId, 'pnj-sylvana');
  assert.doesNotMatch(preparer(contrat).requete.prompt, MARQUEURS_MODELE);
  const historique = ajouterSceneIllustree([ancienne], nouvelleSceneIllustree(story, 'r-new', contrat)).scenes;
  assert.deepEqual(historique.map((s) => s.revision), ['r-old', 'r-new']);
});

test('V20 — tour édité / autre branche : aucun changement visuel étranger ne s’infiltre', () => {
  const story = histoire();
  story.messages.push({ id: 'a2', role: 'assistant', content: 'Une flèche entaille le bras de William.', timestamp: 4 });
  const { etat } = integrerChangementsVisuels(story, etatVisuelVide(), {
    changementsVisuels: [{ cible: 'personnage', nom: 'William', champ: 'blessures', operation: 'ajouter', valeur: 'cut on the arm', evenement: 'Une flèche entaille le bras de William' }],
  });
  assert.deepEqual(etat.personnages[0].blessures, ['cut on the arm']);
  const scene = nouvelleSceneIllustree(story, 'r2', contratMarche(story).contrat);
  // Le joueur édite le tour : a2 est remplacé.
  const editee = { ...story, messages: [...story.messages.slice(0, 2), { id: 'a2-bis', role: 'assistant' as const, content: 'La flèche manque William de peu.', timestamp: 5 }] };
  const projete = projeterEtatVisuel({ ...etat, scenesIllustrees: [scene] }, editee);
  assert.equal(projete.personnages.find((p) => p.nom === 'William')?.blessures.length ?? 0, 0);
  assert.deepEqual(projete.journal, []);
  assert.equal(sceneDansChronologie(scene, editee), false);
  assert.ok(projete.derniereAnalyseIndex <= editee.messages.length);
});

test('V21 — régénération « autre angle » : identités, lieu et événement fixés', () => {
  const story = histoire();
  const { contrat } = contratMarche(story);
  const scene = nouvelleSceneIllustree(story, 'r1', contrat);
  const angle = contratRegeneration(scene, story, 'autre-angle');
  assert.deepEqual(angle.personnages, contrat.personnages);
  assert.deepEqual(angle.lieu, contrat.lieu);
  assert.deepEqual(angle.action, contrat.action);
  assert.deepEqual(angle.elementsObligatoires, contrat.elementsObligatoires);
  assert.equal(angle.cadrage.plan, contrat.cadrage.plan);
  assert.notEqual(angle.cadrage.angle, contrat.cadrage.angle);
});

test('V22/V28 — côté application : aucun module ni style implicite demandé au serveur', () => {
  const p = preparer(contratMarche().contrat, ELYNDOR);
  const corps = construireCorpsRequeteImage(p.requete, 'elyndor-image');
  assert.deepEqual(corps.modules, {}, 'objet vide explicite : pas de modules par défaut du serveur');
  assert.equal('prompt_sdxl' in corps, false, 'un seul prompt, plus de prompt court prioritaire');
  // Tout le contenu artistique vient de l'Atelier.
  const sansStyle = preparer(contratMarche().contrat, ELYNDOR, { ...REGLAGES, style: { nom: 'Neutre', motsCles: 'plain', description: '' }, negatif: '', eviterPortraitScene: false });
  assert.doesNotMatch(sansStyle.requete.prompt, /Tarantino|film grain/);
  assert.equal(sansStyle.requete.negatif, undefined);
});

test('V23 — aucun marqueur de modèle dans les prompts métier', () => {
  const story = histoire();
  const portrait = contratPortrait({ story, sujet: { nom: 'William', type: 'joueur', assetId: '__joueur__', principal: true }, extraction: null, parModele: false, etat: etatVisuelVide() }).contrat;
  for (const contrat of [contratMarche().contrat, portrait, contratLibre('a city at night', '16:9')]) {
    assert.doesNotMatch(preparer(contrat).requete.prompt, MARQUEURS_MODELE);
  }
  // Le narrateur ne peut pas réintroduire style ou pondérations.
  const lu = analyserExtraction('{"lieu":["(covered market)1.3","masterpiece, best quality"],"personnagesVisibles":[{"nom":"Sylvana","apparence":["(ebony skin:1.4)","cinematic lighting"]}]}');
  assert.ok(lu);
  assert.deepEqual(lu.extraction.lieu, ['covered market']);
  assert.deepEqual(lu.extraction.personnagesVisibles[0].apparence, ['ebony skin']);
  assert.ok(lu.rejets.some((r) => /style vient de l'Atelier/.test(r)));
  assert.doesNotMatch(consigneExtraction(null), /Lustify|SDXL|CLIP|years old\)1\.2|directeur artistique/i);
});

test('V24 — extraction invalide ou réseau en panne : repli factuel, erreur diagnostiquée, pas d’image inventée', async () => {
  assert.equal(analyserExtraction('Je ne peux pas.'), null);
  const repli = extractionDeRepli(histoire());
  assert.deepEqual(repli.personnagesVisibles.map((p) => p.nom), ['William', 'Sylvana Nocturne']);
  assert.ok(repli.personnagesVisibles[1].apparence.length > 0);
  const journal: EntreeJournal[] = [];
  definirPuitsJournal((_id, e) => journal.push(e));
  definirDependancesServiceVisuel({
    lireReglages: async () => REGLAGES,
    lireSettings: async () => ({ profilContenu: 'adulte' } as AppSettings),
    adaptateur: () => ({ id: 'test', nom: 'Test', capacites: async () => ELYNDOR, executer: async () => { throw new Error('réseau coupé'); } }),
  });
  try {
    await assert.rejects(executerImage({ contrat: contratMarche().contrat, storyId: 'story-v3' }), /réseau coupé/);
    assert.equal(journal.length, 1);
    assert.equal(journal[0].statut, 'erreur');
    assert.equal(journal[0].erreur, 'réseau coupé');
  } finally {
    definirDependancesServiceVisuel(null);
    definirPuitsJournal(null);
  }
});

test('V26 — aucune génération implicite : la simulation n’appelle pas le générateur, le payant reste bloqué', async () => {
  let appels = 0;
  definirDependancesServiceVisuel({
    lireReglages: async () => REGLAGES,
    lireSettings: async () => ({ profilContenu: 'adulte' } as AppSettings),
    adaptateur: () => ({ id: 'test', nom: 'Test', capacites: async () => ELYNDOR, executer: async () => { appels++; return 'data:image/png;base64,AA'; } }),
  });
  try {
    const r = await executerImage({ contrat: contratMarche().contrat, simulation: true });
    assert.equal(appels, 0);
    assert.equal(r.image, undefined);
    assert.equal(r.trace.statut, 'simulation');
  } finally {
    definirDependancesServiceVisuel(null);
  }
  const payant = { openRouterApiKey: 'k', model: 'm', fournisseurImages: 'openai', openAiApiKey: 'sk', modeleImagesOpenAI: 'gpt-image-1-mini', autoriserImagesPayantes: false } as AppSettings;
  assert.throws(() => adaptateurSelonReglages(payant), /payante/);
  assert.throws(() => adaptateurSelonReglages({ ...payant, fournisseurImages: 'desactive' }), /désactivées/);
});

test('V29 — références du lorebook : asset manquant signalé, aucune image dans les liens ni dans l’export', () => {
  assert.throws(() => validerEtatAssetsLore({ schema: 1, liens: { f: [{ assetId: 'data:image/png;base64,AAAA', role: 'decor', libelle: 'x' }] } }), /aucune image intégrée/);
  const etat = ajouterLienAsset(etatAssetsLoreVide(), 'lieu-halles', { assetId: 'asset-abc123def', role: 'architecture', libelle: 'Halles', ajouteLe: 1 });
  const pool = [
    { id: 'lieu-halles', titre: 'Halles de Paris', contenu: '', primaryKeys: ['covered market'] },
  ] as unknown as ElyndorEntryChargee[];
  const { contrat } = contratMarche();
  const candidats = candidatsLorePourContrat(contrat, pool, etat);
  assert.equal(candidats.length, 1);
  const { ecartees } = selectionnerReferences([{ ...candidats[0], uri: null }], contrat, REGLAGES, ELYNDOR);
  assert.match(ecartees[0].raison, /introuvable/);
  assert.doesNotMatch(creerExportLore(creerEtatLore()), /asset-|base64/);
});

test('V30 — plusieurs personnages et lieu complexe : les obligations passent avant le contexte secondaire', () => {
  const story = histoire('Sylvana Nocturne, Maître Kael et William se disputent sous les arches.');
  const { contrat } = consoliderContratScene({
    story,
    extraction: extraction({
      lieu: ['gothic covered market', 'vaulted stone arches'],
      personnagesVisibles: [personnage('Sylvana', { identite: ['dark elf'] }), personnage('Maître Kael', { identite: ['50 years old', 'human'] }), personnage('William', { identite: ['40 years old', 'human'] })],
      elementsObligatoires: ['broken crate', 'spilled apples'],
      decor: ['hanging lanterns', 'banners', 'puddles', 'pigeons'],
      instant: ['dusk'], eclairage: ['lantern light'],
    }),
    etat: etatVisuelVide(), texteScene: story.messages[1].content, parModele: true,
  });
  const court: CapacitesGenerateur = { ...ELYNDOR, longueurMaxPrompt: 420 };
  const p = preparer(contrat, court);
  for (const fait of ['gothic covered market', 'dark elf', '50 years old', '40 years old', 'broken crate', 'spilled apples', '3 characters']) assert.ok(p.requete.prompt.includes(fait), fait);
  assert.doesNotMatch(p.requete.prompt, /pigeons/);
  assert.ok(p.avertissements.some((a) => /« decor » retiré/.test(a)));
});

test('V31/V33 — aperçu libre : référence choisie transmise (ou refusée et expliquée), le reste identique', () => {
  const contrat = contratLibre('a merchant in a covered market', '16:9');
  const choisie: ReferenceCandidate = { id: 'avatar:story:pnj-sylvana', type: 'pnj-avatar', role: 'identite', libelle: 'Sylvana — avatar', uri: 'data:sylvana', imposee: true };
  const sans = preparer(contrat, ELYNDOR);
  const avec = preparer(contrat, ELYNDOR, REGLAGES, [choisie]);
  assert.deepEqual(avec.requete.references, [{ role: 'personnage', image: 'data:sylvana' }]);
  assert.deepEqual({ ...avec.requete, references: [] }, { ...sans.requete, references: [] });
  const refusee = preparer(contrat, SANS_REFERENCES, REGLAGES, [choisie]);
  assert.equal(refusee.requete.references.length, 0);
  assert.match(refusee.references.ecartees[0].raison, /non prises en charge/);
  const trace = construireTrace(avec, { operation: 'op', statut: 'simulation' }, REGLAGES);
  assert.deepEqual(trace.references.retenues.map((r) => r.id), ['avatar:story:pnj-sylvana']);
  assert.doesNotMatch(JSON.stringify(trace), /data:sylvana/, 'aucune image dans la trace');
});

test('V32 — scène avec PNJ, race et lieu référencés : propositions filtrées, sans contamination', () => {
  const { contrat } = contratMarche();
  const candidats: ReferenceCandidate[] = [
    { id: 'avatar:pnj-sylvana', type: 'pnj-avatar', role: 'identite', entite: 'pnj-sylvana', libelle: 'avatar Sylvana', uri: 'data:s' },
    { id: 'race:elfes-noirs-Femme', type: 'race', role: 'race', entite: 'pnj-sylvana', libelle: 'race', uri: 'data:r' },
    { id: 'avatar:pnj-kael', type: 'pnj-avatar', role: 'identite', entite: 'pnj-kael', libelle: 'avatar Kael (absent)', uri: 'data:k' },
    { id: 'lore:halles', type: 'lieu', role: 'decor', lieu: 'covered market', libelle: 'Halles', uri: 'data:h' },
    { id: 'lore:chateau', type: 'lieu', role: 'decor', lieu: 'castle', libelle: 'Château', uri: 'data:c' },
  ];
  const { retenues, ecartees } = selectionnerReferences(candidats, contrat, AVEC_PERSONNAGES, ELYNDOR_MULTIPLE);
  assert.deepEqual(retenues.map((r) => r.id), ['avatar:pnj-sylvana', 'race:elfes-noirs-Femme', 'lore:halles']);
  assert.deepEqual(retenues.map((r) => r.roleGenerateur), ['personnage', 'race', 'scene']);
  assert.ok(ecartees.find((e) => e.id === 'avatar:pnj-kael')?.raison.includes('non visible'));
  assert.ok(ecartees.find((e) => e.id === 'lore:chateau')?.raison.includes('autre lieu'));
});

test('serveur à référence générale unique : une seule image de race ou de décor en plus des visages', () => {
  const { contrat } = contratMarche();
  const candidats: ReferenceCandidate[] = [
    { id: 'race:elfes-noirs', type: 'race', role: 'race', entite: 'pnj-sylvana', libelle: 'race elfe', uri: 'data:r1' },
    { id: 'race:orcs', type: 'race', role: 'race', entite: 'pnj-sylvana', libelle: 'race orc', uri: 'data:r2' },
    { id: 'lore:halles', type: 'lieu', role: 'decor', lieu: 'covered market', libelle: 'Halles', uri: 'data:h' },
    { id: 'scene:avant', type: 'scene-precedente', role: 'continuite', lieu: 'covered market', libelle: 'scène', uri: 'data:s' },
  ];
  const scene = selectionnerReferences(candidats, contrat, REGLAGES, ELYNDOR);
  assert.deepEqual(scene.retenues.map((r) => r.id), ['lore:halles']);
  assert.equal(scene.ecartees.filter((e) => /une référence générale/.test(e.raison)).length, 3);
  // Portrait : la race est la référence générale utile.
  const portrait = contratPortrait({ story: histoire(), sujet: { nom: 'Sylvana Nocturne', type: 'pnj', assetId: 'pnj-sylvana', principal: true }, extraction: null, parModele: false, etat: etatVisuelVide() }).contrat;
  assert.deepEqual(selectionnerReferences(candidats.slice(0, 2), portrait, REGLAGES, ELYNDOR).retenues.map((r) => r.id), ['race:elfes-noirs']);
});

test('consigne universelle unique, éditable, format JSON fixe ; contexte du narrateur conservé', () => {
  const story = histoire();
  const messages = messagesExtraction(story, { profilContenu: 'adulte' } as AppSettings, etatVisuelVide(), 'CONTEXTE', 'Ma consigne');
  assert.equal(messages[0].content, 'CONTEXTE');
  assert.match(messages[1].content, /Ma consigne/);
  assert.match(messages[1].content, /Réponds UNIQUEMENT avec ce JSON strict/);
  assert.doesNotMatch(messages[1].content, new RegExp(CONSIGNE_EXTRACTION_PAR_DEFAUT.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(messages[2].role, 'assistant');
  assert.match(consigneExtraction(null), /Tu ne choisis aucun style/);
});
