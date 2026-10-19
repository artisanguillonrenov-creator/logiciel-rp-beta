import assert from 'node:assert/strict';
import test from 'node:test';
import { complementDe, deNomMonde, paquetMonde, racesDuMonde, titreLoreDe } from '../src/mondes';
import { donneesMonde } from '../src/mondes/donnees';
import { parcoursCreation } from '../src/mondes/creation';
import { creerEtatLore, ficheOrigine, idFicheLoreValide, listerFichesLore, validerEtatLore } from '../src/concepteur/lorebookModele';
import { mettreAJourLoreEmergent } from '../src/engine/emergentLore';
import { genererScenarioDepart } from '../src/engine/scenarioGenerator';
import { selectionTourType } from './promptElyndorTours';

// Second monde réel : « Les Cendres du Monde ». Lore Core et 34 entrées
// fournis tels quels ; ces tests vérifient le branchement, pas le contenu.

const ID = 'cendres-du-monde';

function tour(message: string) {
  return selectionTourType({ nom: 'cendres', mondeId: ID, lieu: 'une ferme isolée', profil: 'grand_public', message });
}

test('Cendres du Monde : paquet déclaré avec les valeurs prévues, sans races ni rôles canon', () => {
  const paquet = paquetMonde(ID);
  assert.equal(paquet.id, ID);
  assert.equal(paquet.carte.nom, 'Les Cendres du Monde');
  assert.equal(paquet.carte.genre, 'Survie post-apocalyptique réaliste');
  assert.deepEqual(paquet.carte.tags, ['Post-apocalyptique', 'Réaliste', 'Survie']);
  assert.equal(paquet.marque.titre, 'LES CENDRES DU MONDE');
  assert.equal(paquet.synopsis.length, 3);
  assert.equal(paquet.nomPourExtractionLore, 'Les Cendres du Monde');
  assert.equal(paquet.titreLore, undefined);
  assert.equal(paquet.consigneScenario, undefined);
  assert.equal(paquet.entreesAdulteUniquement, undefined);
  assert.deepEqual(paquet.modules, { depart: { mode: 'libre' } });
  assert.equal(titreLoreDe(paquet), 'LORE LES CENDRES DU MONDE PERTINENT');
  assert.ok(paquet.core.startsWith('[LORE CORE — CANON GARANTI]'));
  assert.ok(paquet.core.length >= 2000 && paquet.core.length <= 4000, `${paquet.core.length} caractères`);
  const donnees = donneesMonde(ID);
  assert.deepEqual(donnees.rolesCanon, []);
  assert.deepEqual(donnees.capitales, []);
});

test('Cendres du Monde : 34 entrées valides pour l’Atelier, identifiants cendres-du-monde-<n> sans doublon', () => {
  const lore = donneesMonde(ID).lore;
  assert.equal(lore.length, 34);
  const ids = lore.map((e) => e.id);
  assert.equal(new Set(ids).size, 34);
  for (const id of ids) {
    assert.match(id, /^cendres-du-monde-\d+$/);
    assert.ok(idFicheLoreValide(id, ID), id);
  }
  // Chaque fiche passe la validation de l'Atelier et peut être éditée puis relue.
  const changements = Object.fromEntries(lore.map((e) => [e.id, ficheOrigine(e)]));
  assert.doesNotThrow(() => validerEtatLore({ ...creerEtatLore(), changements }, ID));
  assert.equal(listerFichesLore(lore, creerEtatLore()).length, 34);
});

test('Cendres du Monde : création sans étape de race, départ en texte libre', () => {
  assert.equal(racesDuMonde(paquetMonde(ID)).length, 0);
  assert.deepEqual(parcoursCreation(paquetMonde(ID)), { choixRace: false, departListe: false });
});

const CAS_RECUPERATION: { message: string; attendues: number[]; echecConnu?: string }[] = [
  { message: 'Il m’a mordu au bras, est-ce que je vais devenir un zombie ?', attendues: [23, 21] },
  {
    message: 'Je veux ouvrir un cabinet comme médecin d’avant.', attendues: [45, 41],
    echecConnu: 'entrée 45 à 0,21 sous le seuil 0,30 : « médecin d’avant » ne correspond qu’en partie à la clé « ancien médecin »',
  },
  { message: 'Combien de jours à pied de Lyon à Marseille ?', attendues: [62] },
  { message: 'Je troque du sel contre des munitions.', attendues: [44] },
  {
    message: 'Je tire avec mon fusil sur le pillard.', attendues: [42, 32],
    echecConnu: 'entrée 42 à 0,28 sous le seuil 0,30 : la clé « fusil » correspond, mais le mot n’apparaît pas dans le texte (« armes à feu »)',
  },
  { message: 'On a trouvé trente infectés dans la cave de la ferme.', attendues: [24] },
];

for (const cas of CAS_RECUPERATION) {
  // Échec connu : signalé en « todo » sans modifier le contenu, en attendant
  // l'ajustement des clés validé par l'auteur du monde.
  test(`Cendres du Monde : récupération de ${cas.attendues.join(' et ')} pour « ${cas.message} »`, { todo: cas.echecConnu }, () => {
    const retenues = tour(cas.message).entrees.map((e) => e.id);
    for (const n of cas.attendues) assert.ok(retenues.includes(`${ID}-${n}`), `${ID}-${n} absente : ${retenues.join(', ')}`);
  });
}

test('Cendres du Monde : prompt système avec son Core, sans Elyndor, royaume ni Portes Astra', () => {
  for (const cas of CAS_RECUPERATION) {
    const { prompt } = tour(cas.message);
    assert.ok(prompt.includes(paquetMonde(ID).core));
    assert.match(prompt, /\[LORE LES CENDRES DU MONDE PERTINENT\]/);
    assert.doesNotMatch(prompt, /elyndor|royaume|portes astra/i);
  }
});

test('Cendres du Monde : libellés et consigne d’extraction accordés à l’article du nom', async () => {
  assert.equal(deNomMonde(paquetMonde(ID)), 'des Cendres du Monde');
  assert.equal(complementDe('Elyndor'), "d'Elyndor");
  assert.equal(complementDe('Léandre'), 'de Léandre');
  assert.equal(complementDe('Le Val'), 'du Val');
  assert.equal(complementDe("L'Aube"), "de l'Aube");
  const sauvegarde = globalThis.fetch;
  let consigne = '';
  globalThis.fetch = async (_input, init) => {
    consigne = JSON.parse(String(init?.body)).messages[0].content;
    return Response.json({ choices: [{ message: { content: '{"candidats":[]}' } }] });
  };
  try {
    await mettreAJourLoreEmergent({
      appSettings: { openRouterApiKey: 'cle-test', model: 'fiction/modele:free', moteurInference: 'serveur', fournisseurNarration: 'openrouter', profilContenu: 'grand_public' },
      existants: [], depuisIndex: 0, personnageNom: 'Ael', nomMonde: paquetMonde(ID).nomPourExtractionLore,
      messages: [{ id: 'm1', role: 'assistant', content: 'La radio grésille.', timestamp: 1 }],
    });
  } finally { globalThis.fetch = sauvegarde; }
  assert.match(consigne, /^Tu es le job du LORE ÉMERGENT DU MONDE des Cendres du Monde\. /);
});

test('Cendres du Monde : le scénario de départ libre reçoit le Lore Core du monde, Elyndor reste inchangé', async () => {
  const sauvegarde = globalThis.fetch;
  const contextes: string[] = [];
  globalThis.fetch = async (_input, init) => {
    contextes.push(JSON.parse(String(init?.body)).messages[1].content);
    return Response.json({ choices: [{ message: { content: 'Tu arrives à la ferme. VOISIN : « Pose ton sac. »' } }] });
  };
  const appSettings = { openRouterApiKey: 'cle-test', model: 'fiction/modele:free', moteurInference: 'serveur' as const, fournisseurNarration: 'openrouter' as const, profilContenu: 'grand_public' as const };
  try {
    await genererScenarioDepart({ appSettings, mondeId: ID, personnageNom: 'Ael', lieuNom: 'une ferme près de Lyon' });
    await genererScenarioDepart({ appSettings, mondeId: 'elyndor', personnageNom: 'Ael', lieuNom: 'Guilde des Aventuriers', villeDepart: 'Paris' });
  } finally { globalThis.fetch = sauvegarde; }
  assert.ok(contextes[0].includes(`CANON DU MONDE (fait autorité, ne le contredis jamais) :\n${paquetMonde(ID).core}`));
  assert.doesNotMatch(contextes[1], /CANON DU MONDE|LORE CORE/);
});
