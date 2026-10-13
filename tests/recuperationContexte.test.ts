import assert from 'node:assert/strict';
import test from 'node:test';
import elyndorRaw from '../src/data/elyndorLore.json';
import { chargerLoreElyndor, type ElyndorEntryChargee } from '../src/engine/loreLoader';
import {
  construirePassages,
  selectionnerPassagesDetaille,
  viderIndexPassages,
} from '../src/engine/passagesLore';
import { resoudreEntitesScene } from '../src/engine/entitesScene';
import {
  accesEvenement,
  construireBlocsContexte,
  ecarterDoublons,
  synchroniserMemoireNarrative,
  viderCacheEvenements,
} from '../src/engine/memoireNarrative';
import { rechercherSouvenirsLexical } from '../src/engine/rechercheLexicale';
import { preparerTour } from '../src/engine/ficheScene';
import { annulerTour, assurerNoyau, construireContexteNoyau, validerTour } from '../src/engine/noyauNarratif';
import { construireSystemPromptDetaille } from '../src/engine/promptBuilder';
import { creerNouvelleHistoire } from '../src/engine/story';
import type { LoreEntry, Message, StoryState } from '../src/types';

const LORE = chargerLoreElyndor(elyndorRaw as any);
const PASSAGES = construirePassages(LORE);
const REGLAGES = { creativite: 'moyenne', longueur: 'moyenne', ton: 'sombre_realiste', violence: 'modere', romance: 'aucun', humour: 'faible', liberteJoueur: 'elevee', rythme: 'normal' } as const;

function histoire(echanges: [string, string][] = [], lieu = 'Paris'): StoryState {
  const story = creerNouvelleHistoire({
    personnageNom: 'Ael',
    personnageDescription: 'Voyageuse, elfe noire.',
    pointDeDepart: 'La porte nord',
    contexte: { lieu, ambiance: 'Brume', dateChronique: '', objectifs: 'Retrouver la caravane' },
    settings: { ...REGLAGES },
  });
  const messages: Message[] = echanges.flatMap(([joueur, narrateur], i) => [
    { id: `u${i}`, role: 'user' as const, content: joueur, timestamp: 1000 + i * 2 },
    { id: `a${i}`, role: 'assistant' as const, content: narrateur, timestamp: 1001 + i * 2 },
  ]);
  return {
    ...story,
    messages,
    social: {
      engagements: [],
      relations: ['Sylvana', 'Borek'].map((nom, i) => ({ id: `r${i}`, nom, confiance: 0, respect: 0, peur: 0, affection: 0, hostilite: 0 })),
    },
  };
}

/** Intègre un tour au registre V12 (api publique) avec le lieu et les témoins voulus. */
function avecTour(story: StoryState, i: number, delta: unknown): StoryState {
  const u = story.messages[i * 2];
  const a = story.messages[i * 2 + 1];
  return validerTour(story, { messageJoueur: { id: u.id, content: u.content }, messageNarrateur: { id: a.id, content: a.content, timestamp: a.timestamp }, delta });
}

const evt = (summary: string, extra: Record<string, unknown> = {}) => ({
  events: [{ type: 'scene', summary, actors: ['Ael'], targets: [], location: 'Paris', witnesses: [], importance: 0.6, public: false, ...extra }],
});

// --- T01 -----------------------------------------------------------------
test('T01 — « Guilde des Aventuriers de Paris » : institution, ville et responsable canonique', () => {
  const message = 'Je me rends à la Guilde des Aventuriers de Paris.';
  const story = histoire([], 'Paris');
  const prep = preparerTour(story, message);
  assert.equal(prep.ville, 'Paris');
  const requeteMessage = [`Ville : ${prep.ville}`, ...prep.intention.fiches, message].join('\n');
  const resolution = resoudreEntitesScene({
    pool: LORE, messageJoueur: message, ville: prep.ville, destination: prep.intention.lieu?.libelle,
    fichesIntention: prep.intention.fiches, memoire: [], presents: [],
  });
  const { entrees } = selectionnerPassagesDetaille(PASSAGES, 'Ville : Paris', { requeteMessage, ancres: resolution.ancresP0, raisonsAncres: resolution.raisons });
  const p0 = entrees.filter((e) => e.niveau === 'P0').map((e) => e.titre);
  assert.ok(p0.some((t) => t.includes('Guilde des Aventuriers')), `P0 : ${p0.join(' | ')}`);
  assert.ok(p0.some((t) => t.includes('Paris')), `P0 : ${p0.join(' | ')}`);
  // La responsable canonique de la ville est dans la fiche de scène, qui ne se coupe jamais.
  assert.ok(prep.roles.length > 0);
  assert.ok(prep.fiche.includes(prep.roles[0].nom));
});

// --- T02 / T03 ---------------------------------------------------------------
const fiche = (id: string, titre: string, extra: Partial<ElyndorEntryChargee> = {}): ElyndorEntryChargee => ({
  id, titre, contenu: `${titre}. Description de la fiche ${id}.`, motsClesNegatifs: [], priority: 50, constant: false, category: 'Personnage', scope: 'CHARACTER', ...extra,
});

test('T02 — Sylvana écrite avec une variation typographique : une seule identité', () => {
  const pool = [fiche('syl', '[PNJ] Sylvana', { primaryKeys: ['Sylvana'] })];
  for (const message of ['Je parle à Sylvàna', 'JE PARLE À SYLVANA !', 'Je parle à « Sylvana », près du feu']) {
    const r = resoudreEntitesScene({ pool, messageJoueur: message, fichesIntention: [], memoire: [], presents: [] });
    assert.deepEqual([...r.ancresP0], ['syl'], message);
  }
});

test('T03 — homonymes de deux villes : la ville tranche, sinon aucune ancre', () => {
  const pool = [
    fiche('par', '[PNJ] Séraphine Duvall — Paris', { primaryKeys: ['Séraphine Duvall Paris', 'Séraphine Duvall'] }),
    fiche('zur', '[PNJ] Séraphine Duvall — Zurich', { primaryKeys: ['Séraphine Duvall Zurich', 'Séraphine Duvall'] }),
  ];
  const base = { pool, messageJoueur: 'Je cherche Séraphine Duvall.', fichesIntention: [], memoire: [], presents: [] };
  const aParis = resoudreEntitesScene({ ...base, ville: 'Paris' });
  assert.deepEqual([...aParis.ancresP0], ['par']);
  assert.equal(aParis.ambigus[0]?.resolu, 'par');
  const sansVille = resoudreEntitesScene(base);
  assert.equal(sansVille.ancresP0.size, 0);
  assert.equal(sansVille.ambigus[0]?.resolu, undefined);
  assert.deepEqual(sansVille.ambigus[0]?.candidats.length, 2);
});

test('un nom présent seulement dans le résumé d’un récit passé est évoqué, pas ancré', () => {
  const pool = [fiche('par', '[ROYAUME] Paris — Royaume Humain', { category: 'Royaume', scope: 'CITY', primaryKeys: ['Paris'] })];
  const r = resoudreEntitesScene({ pool, messageJoueur: 'Je regarde la forge.', ville: 'Zurich', fichesIntention: [], memoire: ['Il y a longtemps, à Paris, le joueur a volé une bourse.'], presents: [] });
  assert.equal(r.ancresP0.size, 0);
  assert.deepEqual([...r.evoquees], ['par']);
});

// --- T04 / T05 / T07 / T15 : mémoire ------------------------------------------------
test('T04 — un PNJ absent d’une conversation secrète n’en garde aucun souvenir direct', () => {
  viderCacheEvenements();
  let story = histoire([['Je parle à Sylvana en secret.', 'SYLVANA : « Borek ne doit rien savoir de notre plan. »']], 'Cave');
  story = avecTour(story, 0, evt('Ael et Sylvana préparent un plan secret.', { location: 'Cave', actors: ['Ael'], targets: ['Sylvana'], witnesses: ['Sylvana'] }));
  const [e] = synchroniserMemoireNarrative(story);
  assert.equal(e.fiabilitePresence, 'registre');
  assert.equal(accesEvenement(e, 'Sylvana'), 'present');
  assert.equal(accesEvenement(e, 'Borek'), 'mentionne');
  const { blocs } = construireBlocsContexte(story, 'Je vais voir Borek et Sylvana.');
  const memoires = blocs.filter((b) => b.type === 'npc_memory');
  assert.ok(memoires.some((b) => b.source === 'pnj:Sylvana'));
  assert.ok(!memoires.some((b) => b.source === 'pnj:Borek'), 'Borek n’a aucun souvenir direct');
});

test('T05 — une promesse honorée n’est plus présentée comme ouverte', () => {
  const story = { ...histoire([['Je rends la dague.', 'Sylvana reprend sa dague.']]), social: {
    ...histoire().social,
    engagements: [
      { id: 'e1', type: 'promesse' as const, description: 'Rendre la dague de Sylvana', partie: 'Sylvana', honore: true, rompu: false },
      { id: 'e2', type: 'promesse' as const, description: 'Escorter Borek jusqu’à Zurich', partie: 'Borek', honore: false, rompu: false },
    ],
  } };
  const { blocs } = construireBlocsContexte(story, 'Je parle à Sylvana et à Borek de la dague et de l’escorte.');
  const texte = blocs.filter((b) => b.type === 'engagement').map((b) => b.texte).join('\n');
  assert.match(texte, /Escorter Borek/);
  assert.doesNotMatch(texte, /Rendre la dague/);
});

test('T07 — l’événement ancien garde son lieu, ou « inconnu » ; jamais le lieu actuel', () => {
  viderCacheEvenements();
  let story = histoire([
    ['Je visite la cathédrale.', 'La nef est vaste.'],
    ['Je traverse le pont.', 'Le pont gronde sous la pluie.'],
    ['Je marche longtemps.', 'La route est longue.'],
    ['J’arrive enfin.', 'Rome apparaît.'],
  ], 'Rome');
  story = avecTour(story, 0, evt('Visite de la cathédrale.', { location: 'Paris' }));
  story = avecTour(story, 1, evt('Traversée du pont.', { location: 'Zurich' }));
  const evenements = synchroniserMemoireNarrative(story);
  assert.equal(evenements.length, 4);
  assert.equal(evenements[0].lieu, 'Paris');
  assert.equal(evenements[1].lieu, 'Zurich');
  assert.equal(evenements[2].lieu, undefined);
  assert.equal(evenements[2].lieuSource, 'inconnu');
  // Seul le dernier échange est daté par la scène en cours.
  assert.equal(evenements[3].lieu, 'Rome');
  assert.equal(evenements[3].lieuSource, 'scene-actuelle');
  assert.ok(!evenements.slice(0, 3).some((e) => e.lieu === 'Rome'));
});

test('T07 — les événements hérités du noyau (« legacy ») ne donnent aucun lieu fiable', () => {
  viderCacheEvenements();
  const story = histoire([['Je parle.', 'Elle répond.'], ['Je pars.', 'Il part.']], 'Rome');
  const avecLegacy = assurerNoyau(story, synchroniserMemoireNarrative(story));
  assert.ok(avecLegacy.narrativeCore.ledger.length > 0);
  for (const e of avecLegacy.narrativeCore.ledger) assert.ok(!e.location || e.source?.kind !== 'legacy_memory' || e.location === 'Rome');
  // Le premier échange n'est pas daté « Rome » par l'import.
  assert.equal(avecLegacy.narrativeCore.ledger[0].location, '');
  const evenements = synchroniserMemoireNarrative(avecLegacy);
  assert.equal(evenements[0].lieu, undefined);
});

test('T15 — annuler puis régénérer : aucun événement fantôme', () => {
  viderCacheEvenements();
  let story = histoire([['Je parle.', 'Elle répond.'], ['Je vole la bourse.', 'Le marchand hurle au voleur.']]);
  story = avecTour(story, 0, evt('Conversation.', { location: 'Paris' }));
  story = avecTour(story, 1, evt('Vol de la bourse.', { location: 'Paris' }));
  assert.equal(story.narrativeCore!.ledger.length, 2);
  // Annulation du dernier tour : registre et messages.
  const annule = annulerTour(story, 'a1');
  const sansDernier = { ...annule, messages: annule.messages.slice(0, 2) };
  assert.equal(sansDernier.narrativeCore!.ledger.length, 1);
  assert.equal(synchroniserMemoireNarrative(sansDernier).length, 1);
  const { blocs } = construireBlocsContexte(sansDernier, 'Je cherche la bourse du marchand.');
  assert.ok(!blocs.some((b) => /voleur|bourse/.test(b.texte) && b.source.startsWith('ledger')));
  // Régénération : nouvelle réponse, nouvel identifiant, sans trace de l'ancienne.
  const regenere = { ...sansDernier, messages: [...sansDernier.messages, { id: 'u1', role: 'user' as const, content: 'Je vole la bourse.', timestamp: 5 }, { id: 'a1b', role: 'assistant' as const, content: 'Le marchand ne remarque rien.', timestamp: 6 }] };
  const evenements = synchroniserMemoireNarrative(regenere);
  assert.equal(evenements.length, 2);
  assert.match(evenements[1].resultat, /ne remarque rien/);
  assert.ok(!evenements.some((e) => /voleur/.test(e.resultat)));
});

// --- T06 / T18 : noyau V12 -------------------------------------------------------------
test('T06 — réputation négative auprès d’une faction : la conséquence est récupérée', () => {
  let story = histoire([['Je vole le coffre de la Guilde de Paris.', 'Les gardes jurent de te retrouver.']]);
  story = avecTour(story, 0, {
    ...evt('Ael vole le coffre de la Guilde de Paris.', { public: true, witnesses: ['Sylvana'] }),
    reputationSignals: [{ subject: 'Ael', faction: 'Guilde de Paris', delta: -30, reason: 'vol du coffre', knownByPublic: true }],
  });
  const ctx = construireContexteNoyau(story as any, 'Je retourne à la Guilde de Paris, Ael.');
  assert.match(ctx.texteSocial, /Réputation: Ael \/ Guilde de Paris/);
  assert.match(ctx.texte, /réputation de Ael auprès de Guilde de Paris \(négative\)/i);
});

test('T18 — une rumeur n’est jamais présentée comme un fait établi', () => {
  let story = histoire([['Je tue le garde devant la foule.', 'La foule murmure.']]);
  story = avecTour(story, 0, {
    ...evt('Ael aurait tué le garde du pont.', { public: true, importance: 0.8, witnesses: ['Sylvana'] }),
    stateChanges: [{ subject: 'Garde du pont', predicate: 'etat', from: null, to: 'mort', confidence: 0.95 }],
  });
  const { texte } = construireContexteNoyau(story as any, 'Que dit-on du garde du pont ?');
  const iCanon = texte.indexOf('État canonique actuel');
  const iRumeur = texte.indexOf('Une rumeur circule');
  assert.ok(iCanon >= 0 && iRumeur > iCanon, 'canon d’abord, rumeur ensuite');
  assert.match(texte, /Elle n'est pas forcément vraie et doit rester distinguée du canon/);
  assert.match(texte, /Garde du pont\.etat = mort/);
});

// --- T08 / T11 : budget et sémantique ---------------------------------------------
test('T08 — vingt détails secondaires et un lieu canonique : le canonique passe d’abord, l’enrichissement s’efface', () => {
  const requeteMessage = 'Ville : Paris\nJe me promène à Paris : pluie, pavés, étals, corbeaux, enseignes, lanternes, cordes, tonneaux, barques, forge, marché, fontaine, pigeons, mendiants, bateleurs, chiens, charrettes, volets, linge, cloches.';
  const ancre = LORE.find((e) => e.titre.includes('Paris — Royaume Humain'))!;
  const budget = 900;
  const { entrees, rapport } = selectionnerPassagesDetaille(PASSAGES, 'Ville : Paris', { requeteMessage, ancres: new Set([ancre.id]), budget });
  const p0 = entrees.filter((e) => e.niveau === 'P0');
  assert.deepEqual(p0.map((e) => e.id), [ancre.id]);
  assert.ok(rapport.utilise <= budget, `${rapport.utilise} <= ${budget}`);
  assert.deepEqual(rapport.manques, []);
  assert.equal(entrees[0].id, ancre.id);
  assert.ok(rapport.rejetes.length > 0 || entrees.length < 8, 'le superflu est sacrifié et tracé');
});

test('T08 — quand même le P0 ne tient pas, il est raccourci ; si vraiment rien ne tient, le manque est déclaré', () => {
  const ancre = LORE.find((e) => e.titre.includes('Paris — Royaume Humain'))!;
  const raccourci = selectionnerPassagesDetaille(PASSAGES, 'Ville : Paris', { requeteMessage: 'Paris', ancres: new Set([ancre.id]), budget: 260 });
  const p0 = raccourci.entrees.find((e) => e.id === ancre.id)!;
  assert.equal(p0.niveau, 'P0');
  assert.ok(raccourci.rapport.retenus[0].raccourci);
  assert.ok(raccourci.rapport.utilise <= 260);
  const rien = selectionnerPassagesDetaille(PASSAGES, 'Ville : Paris', { requeteMessage: 'Paris', ancres: new Set([ancre.id]), budget: 120 });
  assert.equal(rien.entrees.find((e) => e.id === ancre.id), undefined);
  assert.match(rien.rapport.manques[0], /Paris — Royaume Humain.*absente/);
});

test('T10 — sans embeddings, le lore et l’historique sont retrouvés par les mots', () => {
  const { entrees } = selectionnerPassagesDetaille(PASSAGES, 'Ville : Paris\nJe cherche la guilde des aventuriers.', { requeteMessage: 'Je cherche la guilde des aventuriers.' });
  assert.ok(entrees.some((e) => e.titre.includes('Guilde')));
  const anciens: Message[] = [
    { id: 'm1', role: 'assistant', content: 'Sylvana jure de garder le secret du trésor sous la cathédrale.', timestamp: 1 },
    { id: 'm2', role: 'assistant', content: 'La pluie tombe sur le marché.', timestamp: 2 },
  ];
  const souvenirs = rechercherSouvenirsLexical(anciens, 'Que sait Sylvana du trésor ?');
  assert.equal(souvenirs[0].message.id, 'm1');
});

test('T11 — avec embeddings, la sémantique complète sans pouvoir annuler le canon', () => {
  const ancre = LORE.find((e) => e.titre.includes('Paris — Royaume Humain'))!;
  const vecteursPassages: Record<string, number[]> = {};
  for (const p of PASSAGES) vecteursPassages[p.id] = p.entreeId === ancre.id ? [0, 1] : [1, 0];
  const { entrees } = selectionnerPassagesDetaille(PASSAGES, 'Ville : Paris', {
    vecteurRequete: [1, 0], vecteurMessage: [1, 0], requeteMessage: 'Je regarde la forge.', vecteursPassages, ancres: new Set([ancre.id]),
  });
  assert.ok(entrees.length > 1, 'la sémantique ramène d’autres fiches');
  assert.equal(entrees.find((e) => e.id === ancre.id)?.niveau, 'P0');
  assert.equal(entrees[0].id, ancre.id);
});

// --- T09 -----------------------------------------------------------------------------
test('T09 — un même échange rappelé par plusieurs sources n’apparaît qu’une fois', () => {
  const story = histoire([['Je vole la bourse.', 'Le marchand hurle.'], ['Je fuis.', 'Tu cours dans les ruelles.'], ['Je me cache.', 'Une porte se referme.']]);
  const evenements = synchroniserMemoireNarrative(story);
  const blocs = construireBlocsContexte(story, 'Qui a vu le vol de la bourse ?', evenements, {}).blocs;
  const idsNoyau = new Set(['a0']);
  const souvenirs = [{ message: { id: 'a0' } }, { message: { id: 'ancien' } }];
  const { blocsUtiles, souvenirsUtiles, doublonsEcartes } = ecarterDoublons({ blocs, idsNoyau, souvenirs });
  assert.ok(!blocsUtiles.some((b) => b.type === 'event' && b.messageIds?.includes('a0')));
  assert.deepEqual(souvenirsUtiles.map((s) => s.message.id), ['ancien']);
  assert.ok(doublonsEcartes >= 1);
  // Directement dans la mémoire : l'échange déjà fourni par le noyau est exclu.
  const sansNoyau = construireBlocsContexte(story, 'Qui a vu le vol de la bourse ?', evenements, { exclureMessageIds: idsNoyau }).blocs;
  assert.ok(!sansNoyau.some((b) => b.type === 'event' && b.messageIds?.includes('a0')));
});

// --- T13 : longue histoire ----------------------------------------------------------
test('T13 — 1 300 tours : événements bornés, résultats pertinents, cache efficace', () => {
  viderCacheEvenements();
  const echanges: [string, string][] = Array.from({ length: 1300 }, (_, i) => [`Je parle à Sylvana du marché ${i}.`, `SYLVANA : « Le marché ${i} est calme. » La pluie tombe sur Paris.`]);
  echanges[400] = ['Je cache la clé d’argent sous la dalle.', 'SYLVANA : « Personne ne saura pour la clé d’argent. »'];
  const story = histoire(echanges);
  const t0 = Date.now();
  const premier = synchroniserMemoireNarrative(story);
  const t1 = Date.now();
  const second = synchroniserMemoireNarrative(story);
  const t2 = Date.now();
  assert.equal(premier.length, 1200);
  assert.equal(second.length, 1200);
  assert.equal(second[0], premier[0], 'événements repris du cache');
  assert.ok(t2 - t1 <= Math.max(25, t1 - t0), `cache : ${t2 - t1} ms contre ${t1 - t0} ms`);
  const { blocs, totalCaracteres } = construireBlocsContexte(story, 'Où ai-je caché la clé d’argent ?', second);
  assert.ok(totalCaracteres <= 1900);
  assert.ok(blocs.some((b) => /clé d’argent/.test(b.texte)), 'l’événement ancien pertinent est retrouvé');
  assert.equal(blocs[0].type, 'scene');
});

// --- T14 : lore édité ----------------------------------------------------------------
test('T14 — une fiche éditée reconstruit ses seuls passages', () => {
  viderIndexPassages();
  const copie = (liste: ElyndorEntryChargee[]) => liste.map((e) => ({ ...e }));
  const avant = construirePassages(copie(LORE));
  const cible = LORE.find((e) => e.titre.includes('Zurich'))!;
  // Fiche éditée (contenu modifié) ; toutes les autres sont de nouveaux objets au même contenu.
  const apres = construirePassages(copie(LORE).map((e) => (e.id === cible.id ? { ...e, contenu: `${e.contenu}\n\nNouvelle règle du royaume.` } : e)));
  const parId = (liste: typeof avant, id: string) => liste.filter((p) => p.entreeId === id);
  const autre = LORE.find((e) => e.id !== cible.id && parId(avant, e.id).length > 0)!;
  assert.deepEqual(parId(apres, autre.id).map((p) => p.contenu), parId(avant, autre.id).map((p) => p.contenu));
  assert.ok(parId(apres, autre.id).every((p, i) => p === parId(avant, autre.id)[i]), 'passage inchangé : repris de l’index');
  assert.ok(parId(apres, cible.id).some((p) => p.contenu.includes('Nouvelle règle')), 'passage édité : reconstruit');
  assert.ok(!parId(avant, cible.id).some((p) => p.contenu.includes('Nouvelle règle')));
});

// --- T16 / T17 -------------------------------------------------------------------------
function ctxPrompt(extra: Record<string, unknown> = {}) {
  const story = histoire();
  const lore: LoreEntry[] = [
    { id: 'p0', titre: '[ROYAUME] Paris — Royaume Humain', contenu: 'Capitale des humains. '.repeat(25), score: 2, niveau: 'P0' },
    { id: 'p1', titre: '[MONDE] Infrastructure Urbaine', contenu: 'Égouts, ponts, aqueducs. '.repeat(25), score: 0.6, niveau: 'P1' },
    ...Array.from({ length: 10 }, (_, i) => ({ id: `x${i}`, titre: `[MONDE] Détail ${i}`, contenu: `Détail anecdotique ${i}. `.repeat(80), score: 0.4, niveau: 'P2' as const })),
  ];
  return {
    meta: story.meta, settings: story.settings, resume: 'Résumé de l’histoire. '.repeat(100), faits: [], loreElyndor: lore,
    messagesRecents: [], messageJoueur: 'Je me promène.',
    contexteP0: '- [scene | scene | P100] Lieu actuel: Paris.',
    blocsContexte: '- [event | ledger:3 | P80] Un événement important a eu lieu.',
    ...extra,
  };
}

test('T16 — budget serré : P0 et P1 restent présents, le superflu s’efface, rien n’est coupé en silence', () => {
  const base = construireSystemPromptDetaille(ctxPrompt(), { budgetSysteme: 100000 });
  const serre = construireSystemPromptDetaille(ctxPrompt(), { budgetSysteme: base.rapport.fixe + 3200 });
  assert.ok(serre.texte.length <= base.rapport.fixe + 3200);
  assert.match(serre.texte, /### \[ROYAUME\] Paris — Royaume Humain/);
  assert.match(serre.texte, /### \[MONDE\] Infrastructure Urbaine/);
  assert.match(serre.texte, /Lieu actuel: Paris/);
  assert.match(serre.texte, /Un événement important a eu lieu/);
  const p2 = serre.rapport.sections.find((s) => s.nom === 'lore P2')!;
  assert.ok(p2.transmis < p2.demande, 'le lore P2 est sacrifié le premier');
  assert.deepEqual(serre.rapport.manques, []);
  assert.deepEqual(serre.rapport.avertissements, []);
});

test('T16 — quand les parties fixes saturent déjà le budget, le manque est déclaré et la limite tenue', () => {
  const base = construireSystemPromptDetaille(ctxPrompt(), { budgetSysteme: 100000 });
  const budget = base.rapport.fixe + 200;
  const r = construireSystemPromptDetaille(ctxPrompt(), { budgetSysteme: budget });
  assert.ok(r.texte.length <= budget + 1500, 'seul le plancher de la fiche du personnage peut dépasser');
  assert.ok(r.rapport.manques.some((m) => /lore P0/.test(m)), r.rapport.manques.join(' | '));
  assert.ok(r.rapport.avertissements.length > 0);
  assert.match(r.texte, /AUTONOMIE DU JOUEUR STRICTE/);
});

test('les consignes du tour (correction, état machine) ne sont jamais coupées', () => {
  const base = construireSystemPromptDetaille(ctxPrompt(), { budgetSysteme: 100000 });
  const r = construireSystemPromptDetaille(ctxPrompt({ noteCorrection: 'Corrige la longueur.', directiveEtat: '[STATE DELTA V12 — MACHINE]' }), { budgetSysteme: base.rapport.fixe + 100 });
  assert.match(r.texte, /\[CORRECTION REQUISE\]\nCorrige la longueur\./);
  assert.match(r.texte, /\[STATE DELTA V12 — MACHINE\]/);
});

test('T17 — profil tout public : une fiche filtrée en amont ne revient ni par l’index ni par un alias', () => {
  const adulte = fiche('adulte', '[MONDE] Mœurs Sexuelles d’Elyndor', { primaryKeys: ['mœurs sexuelles'], scope: 'GLOBAL' });
  const publique = fiche('pub', '[MONDE] Mœurs Vestimentaires', { primaryKeys: ['mœurs'], scope: 'GLOBAL' });
  const poolToutPublic = [publique];
  const message = 'Parle-moi des mœurs sexuelles d’Elyndor.';
  const r = resoudreEntitesScene({ pool: poolToutPublic, messageJoueur: message, fichesIntention: [], memoire: [], presents: [] });
  assert.ok(!r.ancresP0.has(adulte.id));
  const passages = construirePassages(poolToutPublic);
  const { entrees } = selectionnerPassagesDetaille(passages, message, { requeteMessage: message, ancres: new Set([adulte.id]) });
  assert.ok(!entrees.some((e) => e.id === adulte.id), 'seules les fiches du pool filtré existent');
  // Une clé négative annule aussi l'ancre.
  const exclue = fiche('exc', '[PNJ] Le Garde', { primaryKeys: ['garde'], negativeKeys: ['mort'] });
  const sel = selectionnerPassagesDetaille(construirePassages([exclue]), 'Le garde est mort.', { requeteMessage: 'Le garde est mort.', ancres: new Set(['exc']) });
  assert.equal(sel.entrees.length, 0);
});
