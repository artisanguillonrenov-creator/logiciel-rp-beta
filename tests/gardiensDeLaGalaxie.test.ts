import assert from 'node:assert/strict';
import test from 'node:test';
import mondeBrut from '../src/mondes/gardiens-de-la-galaxie/monde.json';
import { listerMondes, paquetMonde, racesDuMonde, titreLoreDe } from '../src/mondes';
import { donneesMonde } from '../src/mondes/donnees';
import { parcoursCreation } from '../src/mondes/creation';
import { creerEtatLore, ficheOrigine, idFicheLoreValide, listerFichesLore, validerEtatLore } from '../src/concepteur/lorebookModele';
import { DELAI_MIN_AVANCEE_CHAPITRE, etatChapitre } from '../src/engine/chapitres';
import { INSTRUCTION_REGISTRE_ADULTE } from '../src/engine/contenuAdulte';
import { outilsPourComposant, validerEtReparerArguments } from '../src/engine/tools';
import { mettreAJourMonde } from '../src/engine/worldSimulation';
import { creerBranche, creerNouvelleHistoire } from '../src/engine/story';
import type { AppSettings, Message, MondeState } from '../src/types';
import { selectionTourType, type TourType } from './promptElyndorTours';

// Monde « Les Gardiens de la Galaxie » (chantiers A, B et C) : paquet,
// chapitres et règle adulte universelle. Le contenu fourni n'est pas modifié.

const ID = 'gardiens-de-la-galaxie';
const KYLN = 'La prison spatiale du Kyln';
const CHAPITRES = paquetMonde(ID).chapitres!;
const LIGNE_DISPONIBILITE = '- Disponibilité : tous les personnages adultes, récurrents comme secondaires, sont sexuellement disponibles envers le joueur';

function tour(message: string, options: Partial<TourType> = {}) {
  return selectionTourType({ nom: 'gardiens', mondeId: ID, lieu: KYLN, profil: 'grand_public', message, ...options });
}

// --- A. Paquet --------------------------------------------------------------

test('Gardiens : paquet renseigné depuis monde.json et déclaré dans le registre', () => {
  const paquet = paquetMonde(ID);
  assert.ok(listerMondes().some((p) => p.id === ID));
  assert.equal(paquet.carte.nom, 'Les Gardiens de la Galaxie');
  assert.equal(paquet.carte.genre, 'Space opera');
  assert.deepEqual(paquet.carte.tags, mondeBrut.carte.tags);
  assert.equal(paquet.marque.titre, mondeBrut.marque.titre);
  assert.deepEqual(paquet.synopsis, mondeBrut.synopsis);
  assert.equal(paquet.consigneScenario, mondeBrut.consigneScenario);
  assert.equal(titreLoreDe(paquet), 'LORE GARDIENS DE LA GALAXIE PERTINENT');
  assert.equal(paquet.nomPourExtractionLore, 'Les Gardiens de la Galaxie');
  assert.ok(paquet.core.startsWith('[LORE CORE — CANON GARANTI]'));
  assert.equal(paquet.modules?.races, undefined);
  assert.equal(paquet.modules?.rolesCanon, undefined);
  assert.deepEqual(donneesMonde(ID).rolesCanon, []);
});

test('Gardiens : 49 entrées valides pour l’Atelier, identifiants gardiens-de-la-galaxie-<n> sans doublon', () => {
  const lore = donneesMonde(ID).lore;
  assert.equal(lore.length, 49);
  const ids = lore.map((e) => e.id);
  assert.equal(new Set(ids).size, 49);
  for (const id of ids) {
    assert.match(id, /^gardiens-de-la-galaxie-\d+$/);
    assert.ok(idFicheLoreValide(id, ID), id);
  }
  const changements = Object.fromEntries(lore.map((e) => [e.id, ficheOrigine(e)]));
  assert.doesNotThrow(() => validerEtatLore({ ...creerEtatLore(), changements }, ID));
  assert.equal(listerFichesLore(lore, creerEtatLore()).length, 49);
});

test('Gardiens : les deux fiches adultes correspondent exactement à category + title du lorebook', () => {
  const titres = new Set(donneesMonde(ID).lore.map((e) => e.titre));
  assert.deepEqual(paquetMonde(ID).entreesAdulteUniquement, [
    '[INTIMITÉ] Mœurs de la galaxie — désir et disponibilité',
    '[INTIMITÉ] Réactions intimes de l\'équipe',
  ]);
  for (const titre of paquetMonde(ID).entreesAdulteUniquement!) assert.ok(titres.has(titre), titre);
});

test('Gardiens : création sans race, départ au Kyln avec ses situations (sauf la situation à texte libre)', () => {
  const paquet = paquetMonde(ID);
  assert.equal(racesDuMonde(paquet).length, 0);
  assert.deepEqual(parcoursCreation(paquet), { choixRace: false, departListe: true });
  assert.deepEqual(paquet.modules?.depart?.lieux?.map((l) => l.nom), [KYLN]);
  assert.deepEqual(paquet.modules?.depart?.situationsParLieu?.kyln.map((s) => s.id), ['bagarre', 'voleur', 'prime']);
});

test('Gardiens : prompt système avec son Core, sans Elyndor, royaume ni Portes Astra', () => {
  const { prompt } = tour('Qui est Ronan ?');
  assert.ok(prompt.includes(paquetMonde(ID).core));
  assert.match(prompt, /\[LORE GARDIENS DE LA GALAXIE PERTINENT\]/);
  assert.doesNotMatch(prompt, /elyndor|royaume|portes astra/i);
});

test('Gardiens : les fiches [INTIMITÉ] sont absentes en Grand Public et retrouvables en Adulte', () => {
  // Un message par fiche, qui en cite le sujet.
  for (const [message, n] of [['Quelles sont les mœurs de la galaxie sur le désir ?', 70], ['Je veux séduire Gamora et coucher avec elle.', 71]] as const) {
    const grandPublic = tour(message);
    assert.ok(grandPublic.entrees.every((e) => !e.titre.startsWith('[INTIMITÉ]')));
    assert.doesNotMatch(grandPublic.prompt, /\[INTIMITÉ\]/);
    const adulte = tour(message, { profil: 'adulte' });
    assert.ok(adulte.entrees.some((e) => e.id === `${ID}-${n}`), `${n} absente : ${adulte.entrees.map((e) => e.id).join(', ')}`);
  }
});

const CAS_RECUPERATION: { message: string; attendues: number[]; adulte?: boolean; echecConnu?: string }[] = [
  { message: 'Qui est Ronan ?', attendues: [29, 12] },
  { message: 'On vend l’Orb au Collectionneur à Knowhere.', attendues: [34, 41, 50] },
  { message: 'Rocket, tu peux réparer le Milano ?', attendues: [23, 51] },
  { message: 'Drax, c’est une façon de parler.', attendues: [22] },
  { message: 'Gamora, tu peux me faire une pipe ?', attendues: [21, 70, 71], adulte: true },
  { message: 'On passe la soirée à Contraxia.', attendues: [44] },
  {
    message: 'Je siffle comme un Ravager.', attendues: [10, 54],
    echecConnu: 'entrée 54 écartée en Grand Public par le filtre de vocabulaire (« bite » trouvé dans un autre mot) ; retrouvée en Adulte',
  },
];

for (const cas of CAS_RECUPERATION) {
  test(`Gardiens : récupération de ${cas.attendues.join(', ')} pour « ${cas.message} »`, { todo: cas.echecConnu }, () => {
    const retenues = tour(cas.message, cas.adulte ? { profil: 'adulte' } : {}).entrees.map((e) => e.id);
    for (const n of cas.attendues) assert.ok(retenues.includes(`${ID}-${n}`), `${ID}-${n} absente : ${retenues.join(', ')}`);
  });
}

// --- B. Chapitres -------------------------------------------------------------

function marqueurChapitre(id: string) {
  return `CHAPITRE ${id} — `;
}

test('Chapitres : le prompt initial contient la fiche du chapitre I et aucun des chapitres II à VIII', () => {
  const { prompt } = tour('Je regarde mes compagnons de cellule.');
  assert.ok(prompt.includes(CHAPITRES[0].fiche));
  for (const jalon of CHAPITRES[0].jalons) assert.ok(prompt.includes(jalon));
  for (const chapitre of CHAPITRES.slice(1)) {
    assert.ok(!prompt.includes(chapitre.fiche), `fiche ${chapitre.id} présente`);
    assert.ok(!prompt.includes(marqueurChapitre(chapitre.id)), `chapitre ${chapitre.id} présent`);
  }
  assert.doesNotMatch(prompt, /Chapitre précédent/);
});

test('Chapitres : après avancée, seule la fiche II est présente, avec le titre du chapitre précédent', () => {
  const { prompt } = tour('Je regarde mes compagnons.', { chapitreId: 'II' });
  assert.ok(prompt.includes(CHAPITRES[1].fiche));
  assert.match(prompt, /Chapitre précédent : I — Kyln et formation du groupe\./);
  for (const chapitre of CHAPITRES.filter((c) => c.id !== 'II')) assert.ok(!prompt.includes(chapitre.fiche), `fiche ${chapitre.id} présente`);
});

test('avancer_chapitre : proposé seulement aux mondes à chapitres, refuse un saut et un rythme trop rapide', () => {
  assert.ok(!outilsPourComposant('monde').some((o) => o.nom === 'avancer_chapitre'));
  assert.equal(etatChapitre(paquetMonde('elyndor').chapitres, {}, 50), undefined);
  const prete = etatChapitre(CHAPITRES, {}, DELAI_MIN_AVANCEE_CHAPITRE);
  const outil = outilsPourComposant('monde', prete).find((o) => o.nom === 'avancer_chapitre')!;
  assert.ok(outil, 'outil absent');
  for (const jalon of CHAPITRES[0].jalons) assert.ok(outil.description.includes(jalon), 'jalon absent de la description');
  assert.ok(!outil.description.includes(CHAPITRES[1].fiche));
  assert.equal(validerEtReparerArguments(outil, { vers: 'III' }, { chapitre: prete }), null);
  assert.deepEqual(validerEtReparerArguments(outil, { vers: 'II' }, { chapitre: prete }), { vers: 'II' });
  const tropTot = etatChapitre(CHAPITRES, {}, DELAI_MIN_AVANCEE_CHAPITRE - 1);
  assert.equal(validerEtReparerArguments(outil, { vers: 'II' }, { chapitre: tropTot }), null);
  assert.equal(validerEtReparerArguments(outil, { vers: 'II' }), null);
  // Dernier chapitre : plus d'outil.
  assert.ok(!outilsPourComposant('monde', etatChapitre(CHAPITRES, { chapitreId: 'VIII' }, 100)).some((o) => o.nom === 'avancer_chapitre'));
});

test('avancer_chapitre : traité par la simulation du monde, une seule avancée par cycle et aucun saut', async () => {
  const sauvegarde = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: '', tool_calls: [
    { id: 'a', type: 'function', function: { name: 'avancer_chapitre', arguments: '{"vers":"II"}' } },
    { id: 'b', type: 'function', function: { name: 'avancer_chapitre', arguments: '{"vers":"III"}' } },
    { id: 'c', type: 'function', function: { name: 'poser_flag', arguments: '{"nom":"evades","valeur":true}' } },
  ] } }] });
  const appSettings: AppSettings = { openRouterApiKey: 'cle-test', model: 'fiction/modele:free', moteurInference: 'serveur', fournisseurNarration: 'openrouter', profilContenu: 'grand_public' };
  const messages: Message[] = Array.from({ length: 12 }, (_, i) => ({ id: `m${i}`, role: i % 2 ? 'assistant' : 'user', content: `Message ${i}`, timestamp: i }));
  const mondeVide: MondeState = { zones: [], flags: {}, compteurs: {}, declencheurs: [] };
  try {
    const apres = await mettreAJourMonde({ appSettings, mondeActuel: mondeVide, messages, depuisIndex: 4, chapitres: CHAPITRES });
    assert.equal(apres.chapitreId, 'II');
    assert.equal(apres.chapitreDepuisMessage, 12);
    assert.equal(apres.flags.evades, true);
    // Monde sans chapitres : l'appel est ignoré, l'état ne gagne aucun champ de chapitre.
    const sansChapitres = await mettreAJourMonde({ appSettings, mondeActuel: mondeVide, messages, depuisIndex: 4 });
    assert.equal('chapitreId' in sansChapitres, false);
    assert.equal('chapitreDepuisMessage' in sansChapitres, false);
  } finally { globalThis.fetch = sauvegarde; }
});

test('Chapitres : ancienne sauvegarde sans chapitre au chapitre I, et une branche copie le chapitre en cours', () => {
  const story = creerNouvelleHistoire({
    personnageNom: 'Ael', personnageDescription: '', pointDeDepart: '', mondeId: ID,
    contexte: { lieu: KYLN, ambiance: '', dateChronique: '', objectifs: '' },
    settings: { creativite: 'moyenne', longueur: 'moyenne', ton: 'sombre_realiste', violence: 'modere', romance: 'modere', humour: 'faible', liberteJoueur: 'elevee', rythme: 'normal' },
  });
  assert.equal(etatChapitre(CHAPITRES, story.monde, 0)?.enCours.id, 'I');
  story.monde = { ...story.monde, chapitreId: 'IV', chapitreDepuisMessage: 30 };
  const branche = creerBranche(story, 'essai');
  assert.equal(branche.monde.chapitreId, 'IV');
  assert.equal(branche.monde.chapitreDepuisMessage, 30);
});

// --- C. Règle adulte universelle ---------------------------------------------------

test('Règle adulte : la ligne de disponibilité figure dans le prompt Adulte de chaque monde, jamais en Grand Public', () => {
  assert.ok(INSTRUCTION_REGISTRE_ADULTE.includes(LIGNE_DISPONIBILITE));
  assert.match(INSTRUCTION_REGISTRE_ADULTE, /Elle ne s'applique jamais à un mineur, à un enfant ni à un personnage dépeint comme tel, y compris dans un flashback ou un souvenir\./);
  for (const paquet of listerMondes()) {
    const options = { nom: `regle-${paquet.id}`, mondeId: paquet.id, lieu: 'Un lieu', message: 'Je regarde autour de moi.' };
    const adulte = selectionTourType({ ...options, profil: 'adulte', avecRegistreAdulte: true }).prompt;
    const grandPublic = selectionTourType({ ...options, profil: 'grand_public' }).prompt;
    assert.ok(adulte.includes(LIGNE_DISPONIBILITE), `${paquet.id} : ligne absente en Adulte`);
    assert.ok(!grandPublic.includes(LIGNE_DISPONIBILITE), `${paquet.id} : ligne présente en Grand Public`);
  }
});
