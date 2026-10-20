import assert from 'node:assert/strict';
import test from 'node:test';
import { histoiresDuMonde, listerMondes, mondeIndisponible, paquetMonde, racesDuMonde, titreLoreDe } from '../src/mondes';
import { donneesMonde } from '../src/mondes/donnees';
import { ETAPES_CREATION, parcoursCreation } from '../src/mondes/creation';
import { promptTourType } from './promptElyndorTours';
import { preparerTour } from '../src/engine/ficheScene';
import { construireContexteNoyau, assurerNoyau } from '../src/engine/noyauNarratif';
import { detecterRacePnj, racePnjDepuisId } from '../src/engine/racePnj';
import { CONSIGNE_SCENARIO_GENERIQUE, ficheDuLieu, genererScenarioDepart, personnagesFixesDuLieu } from '../src/engine/scenarioGenerator';
import { mettreAJourLoreEmergent } from '../src/engine/emergentLore';
import { optionsDeltaEtatSepare } from '../src/engine/deltaEtatSepare';
import { creerNouvelleHistoire } from '../src/engine/story';
import type { AppSettings } from '../src/types';

// Phase 5 du chantier multi-mondes : un second paquet minimal, sans module de
// races ni de rôles canon, en départ libre, prouve que le mécanisme ne dépend
// pas d'Elyndor.

const REGLAGES = {
  creativite: 'moyenne', longueur: 'moyenne', ton: 'sombre_realiste', violence: 'modere',
  romance: 'aucun', humour: 'faible', liberteJoueur: 'elevee', rythme: 'normal',
} as const;

const APP: AppSettings = {
  openRouterApiKey: 'cle-test', model: 'fiction/modele:free',
  moteurInference: 'serveur', fournisseurNarration: 'openrouter', profilContenu: 'grand_public',
};

function histoireTest() {
  return creerNouvelleHistoire({
    personnageNom: 'Ael', personnageDescription: 'Voyageuse', pointDeDepart: 'Ael arrive à Port-Essai.',
    contexte: { lieu: 'Port-Essai', ambiance: 'Test', dateChronique: '', objectifs: '' },
    settings: { ...REGLAGES },
    mondeId: 'monde-test',
  });
}

/** Capture les messages envoyés au modèle par fn, sans réseau. */
async function capturerAppel(reponse: string, fn: () => Promise<unknown>): Promise<Array<{ role: string; content: string }>> {
  const sauvegarde = globalThis.fetch;
  let messages: Array<{ role: string; content: string }> = [];
  globalThis.fetch = async (_input, init) => {
    messages = JSON.parse(String(init?.body)).messages;
    return Response.json({ choices: [{ message: { content: reponse } }] });
  };
  try { await fn(); } finally { globalThis.fetch = sauvegarde; }
  return messages;
}

test('le monde de test est enregistré à côté d’Elyndor, sans aucun module de races ni de rôles canon', () => {
  assert.deepEqual(listerMondes().map((p) => p.id), ['elyndor', 'cendres-du-monde', 'gardiens-de-la-galaxie', 'monde-test']);
  const paquet = paquetMonde('monde-test');
  assert.equal(paquet.carte.nom, 'Monde de test');
  assert.equal(paquet.carte.genre, 'Test');
  assert.equal(racesDuMonde(paquet).length, 0);
  assert.equal(paquet.modules?.rolesCanon, undefined);
  assert.equal(titreLoreDe(paquet), 'LORE MONDE DE TEST PERTINENT');
  const donnees = donneesMonde('monde-test');
  assert.equal(donnees.lore.length, 10);
  assert.ok(donnees.lore.every((e) => /^monde-test-\d+$/.test(e.id)));
  assert.deepEqual(donnees.rolesCanon, []);
  assert.deepEqual(donnees.capitales, []);
});

test('les entrées du monde de test suivent les règles de préparation du lorebook', () => {
  for (const entree of paquetMonde('monde-test').lorebook.entries) {
    assert.match(entree.title, /^[^—]+ — .+/, `titre « Nom — descriptif » : ${entree.title}`);
    for (const paragraphe of entree.content.split('\n\n')) assert.ok(paragraphe.length <= 600, entree.title);
    assert.ok((entree.primary_keys ?? []).length >= 6 && (entree.primary_keys ?? []).length <= 12, entree.title);
  }
});

test('création dans le monde de test : 4 étapes, pas d’étape de race, départ libre', () => {
  assert.deepEqual([...ETAPES_CREATION], ['Personnage', 'Départ', 'Style', 'Résumé']);
  assert.deepEqual(parcoursCreation(paquetMonde('monde-test')), { choixRace: false, departListe: false });
  assert.deepEqual(parcoursCreation(paquetMonde('elyndor')), { choixRace: true, departListe: true });
});

test('prompt du monde de test : son Lore Core, son lore, aucune mention d’Elyndor ni rôle canon', () => {
  const prompt = promptTourType({
    nom: 'auberge', mondeId: 'monde-test', lieu: 'Port-Essai', profil: 'grand_public',
    message: 'Je pousse la porte de l’Auberge du Pivot et je salue Odile Marsac.',
  });
  assert.doesNotMatch(prompt, /elyndor/i);
  assert.ok(prompt.includes(paquetMonde('monde-test').core));
  assert.match(prompt, /\[LORE MONDE DE TEST PERTINENT\]/);
  assert.match(prompt, /### \[LIEU\] Auberge du Pivot — auberge des quais/);
  assert.match(prompt, /### \[PERSONNAGE\] Odile Marsac — aubergiste du Pivot/);
  assert.doesNotMatch(prompt, /Rôles fixés par le lore/);
});

test('fiche de scène, noyau V12 et races : aucune donnée d’Elyndor dans le monde de test', () => {
  const story = histoireTest();
  const preparation = preparerTour(story, 'Je me rends à la Guilde des Aventuriers de Paris.');
  assert.deepEqual(preparation.roles, []);
  assert.doesNotMatch(preparation.fiche, /Séraphine|elyndor/i);
  const noyau = construireContexteNoyau(assurerNoyau(story), 'Je regarde autour de moi.');
  assert.match(noyau.texte, /^\[MONDE DE TEST V12 — CANON STRUCTURÉ AUTORITAIRE\]/);
  assert.doesNotMatch(noyau.texte, /elyndor/i);
  // Sans module races, aucune race n'est déduite.
  assert.equal(detecterRacePnj('Grom', 'Un orque noble, il commande la garde.', 'monde-test'), null);
  assert.equal(racePnjDepuisId('humains', 'Femme', 'monde-test'), null);
  assert.equal(detecterRacePnj('Grom', 'Un orque noble, il commande la garde.', 'elyndor')?.race.id, 'orques-nobles');
});

test('Elyndor garde son titre de canon V12 (histoire sans mondeId)', () => {
  const story = creerNouvelleHistoire({
    personnageNom: 'Ael', personnageDescription: '', pointDeDepart: '',
    contexte: { lieu: 'Paris', ambiance: '', dateChronique: '', objectifs: '' }, settings: { ...REGLAGES },
  });
  assert.match(construireContexteNoyau(assurerNoyau(story), 'Bonjour').texte, /^\[ELYNDOR V12 — CANON STRUCTURÉ AUTORITAIRE\]/);
});

test('scénario du monde de test : consigne générique, aucune capitale ni personnage fixé', async () => {
  assert.equal(personnagesFixesDuLieu('Auberge du Pivot', 'monde-test'), '');
  const messages = await capturerAppel('Tu arrives à Port-Essai. ODILE : « Entre donc. »', () => genererScenarioDepart({
    appSettings: APP, mondeId: 'monde-test', personnageNom: 'Ael', lieuNom: 'Port-Essai', situationNom: 'Une lettre à retirer',
  }));
  assert.ok(messages[0].content.startsWith(CONSIGNE_SCENARIO_GENERIQUE));
  assert.doesNotMatch(messages[0].content + messages[1].content, /elyndor|capitale/i);
  assert.doesNotMatch(messages[1].content, /PERSONNAGES FIXÉS|VILLE DE DÉPART/);
  assert.match(messages[1].content, /MONDE : Monde de test|LIEU DE DÉPART : Port-Essai/);
});

test('lore émergent et état séparé : le nom du monde vient du paquet, aucun nom sans nomPourExtractionLore', async () => {
  const appel = (nomMonde?: string) => capturerAppel('{"candidats":[]}', () => mettreAJourLoreEmergent({
    appSettings: APP, existants: [], depuisIndex: 0, personnageNom: 'Ael', nomMonde,
    messages: [{ id: 'm1', role: 'assistant', content: 'Le Moulin de la Rive tourne.', timestamp: 1 }],
  }));
  const sansNom = await appel(paquetMonde('monde-test').nomPourExtractionLore);
  assert.match(sansNom[0].content, /^Tu es le job du LORE ÉMERGENT DU MONDE\. /);
  const elyndor = await appel(paquetMonde('elyndor').nomPourExtractionLore);
  assert.match(elyndor[0].content, /^Tu es le job du LORE ÉMERGENT DU MONDE d'Elyndor\. /);

  const entree = { narrationValidee: 'ODILE sourit.', messageJoueur: 'Je souris.', contexteCanonique: '' };
  assert.match(optionsDeltaEtatSepare(entree).messages[0].content, /^Tu es le moteur d'extraction d'état, pas son narrateur\./);
  assert.match(optionsDeltaEtatSepare({ ...entree, nomMonde: 'Elyndor' }).messages[0].content,
    /^Tu es le moteur d'extraction d'état d'Elyndor, pas son narrateur\./);
});

test('extrait du lore pour le lieu de départ : titre sans catégorie ou nom propre avant le tiret long', () => {
  assert.equal(ficheDuLieu(donneesMonde('monde-test').lore, 'port-essai')?.id, 'monde-test-1');
  assert.equal(ficheDuLieu(donneesMonde('monde-test').lore, 'Auberge du Pivot')?.id, 'monde-test-2');
  assert.match(ficheDuLieu(donneesMonde('elyndor').lore, 'Guilde des Aventuriers')?.titre ?? '', /^\[GUILDE\] Guilde des Aventuriers$/);
  assert.equal(ficheDuLieu(donneesMonde('monde-test').lore, 'Lieu inconnu'), undefined);
});

test('packs de contenu : seuls ceux du monde de l’histoire sont retenus, les anciens sont d’Elyndor', () => {
  const packs = [
    { id: 'ancien', nom: 'Ancien', entrees: [], installeLe: 1 },
    { id: 'test', nom: 'Test', entrees: [], installeLe: 1, mondeId: 'monde-test' },
  ];
  assert.deepEqual(histoiresDuMonde(packs, 'elyndor').map((p) => p.id), ['ancien']);
  assert.deepEqual(histoiresDuMonde(packs, 'monde-test').map((p) => p.id), ['test']);
});

test('une histoire d’un monde retiré est signalée indisponible, une ancienne histoire reste d’Elyndor', () => {
  assert.equal(mondeIndisponible({ mondeId: 'monde-retire' }), true);
  assert.equal(mondeIndisponible({ mondeId: 'monde-test' }), false);
  assert.equal(mondeIndisponible({}), false);
});
