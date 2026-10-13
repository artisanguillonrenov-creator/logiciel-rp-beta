import assert from 'node:assert/strict';
import test from 'node:test';
import { creerNouvelleHistoire } from '../src/engine/story';
import {
  ajouterSceneIllustree,
  appliquerChangementsVisuels,
  estPnjVisuel,
  etatVisuelLePlusRecent,
  etatVisuelVide,
  evenementEtabli,
  resoudrePersonnagesVisibles,
  type SceneIllustree,
} from '../src/engine/visualState';
import { contratLibre } from '../src/engine/contratVisuel';
import { textesNarratifsEtablis } from '../src/engine/extracteurVisuel';
import {
  DIMENSIONS_FORMAT,
  construireCorpsRequeteImage,
  extraireImageReponse,
  imagesElyndorCloudDisponibles,
} from '../src/engine/elyndorCloudImages';
import { conserverEtatVisuelRecent, serialiserHistoire } from '../src/storage/storySerialization';
import { listerIdsPnjVisuels } from '../src/automation/visualPlanning';
import { calculerCapacites } from '../src/automation/capabilities';

function histoire() {
  const story = creerNouvelleHistoire({
    personnageNom: 'William',
    personnageDescription: 'Humain balafré, manteau de cuir noir, épée bâtarde.',
    pointDeDepart: 'Une taverne au bord de la route.',
    contexte: { lieu: 'Taverne du Corbeau', ambiance: 'Sombre', dateChronique: '', objectifs: '' },
    settings: {
      creativite: 'moyenne', longueur: 'moyenne', ton: 'sombre_realiste', violence: 'modere',
      romance: 'aucun', humour: 'faible', liberteJoueur: 'elevee', rythme: 'normal',
    },
  });
  story.meta.id = 'story-v2';
  story.messages = [
    { id: 'u1', role: 'user', content: 'Je dégaine et je frappe Sylvana au visage.', timestamp: 1 },
    { id: 'a1', role: 'assistant', content: 'La lame de William entaille la joue gauche de Sylvana. Un filet de sang coule sur sa peau d’ébène. Derrière eux, la porte de la taverne claque et reste ouverte sur la pluie.', timestamp: 2 },
  ];
  story.loreEmergent = [
    { id: 'pnj-sylvana', categorie: 'pnj', titre: 'Sylvana Nocturne', contenu: 'Elfe noire, cheveux blancs tressés.', statut: 'provisoire', premiereMention: 1, dernierAcces: 2 },
    { id: 'pnj-garde', categorie: 'pnj', titre: 'Capitaine Orsk', contenu: 'Demi-orc en armure de plates.', statut: 'permanent', premiereMention: 1, dernierAcces: 2 },
    { id: 'pnj-joueur', categorie: 'pnj', titre: 'William', contenu: 'Doublon historique.', statut: 'provisoire', premiereMention: 1, dernierAcces: 2 },
    { id: 'lieu-taverne', categorie: 'lieu', titre: 'Taverne du Corbeau', contenu: 'Taverne.', statut: 'permanent', premiereMention: 1, dernierAcces: 2 },
  ];
  return story;
}

function scene(revision: string, overrides: Partial<SceneIllustree> = {}): SceneIllustree {
  return {
    revision,
    messageIndex: 2,
    creeLe: 0,
    profil: 'combat',
    personnagesVisibles: [],
    contrat: contratLibre('combat', '16:9'),
    regenerations: 0,
    ...overrides,
  };
}

test('historique des images conservé sans limite artificielle, régénération en place', () => {
  let scenes: SceneIllustree[] = [];
  let r = ajouterSceneIllustree(scenes, scene('A'));
  assert.deepEqual(r.scenes.map((s) => s.revision), ['A']);
  r = ajouterSceneIllustree(r.scenes, scene('B'));
  assert.deepEqual(r.scenes.map((s) => s.revision), ['A', 'B']);
  r = ajouterSceneIllustree(r.scenes, scene('C'));
  assert.deepEqual(r.scenes.map((s) => s.revision), ['A', 'B', 'C']);
  assert.deepEqual(r.evincees, []);
  r = ajouterSceneIllustree(r.scenes, scene('D'));
  assert.deepEqual(r.scenes.map((s) => s.revision), ['A', 'B', 'C', 'D']);
  assert.deepEqual(r.evincees, []);
  scenes = r.scenes;

  // Régénération de la même révision : remplacement en place, pas de rotation.
  const regen = ajouterSceneIllustree(scenes, scene('D', { regenerations: 1 }));
  assert.deepEqual(regen.scenes.map((s) => s.revision), ['A', 'B', 'C', 'D']);
  assert.equal(regen.scenes[3].regenerations, 1);
  assert.deepEqual(regen.evincees, []);
});

test('un événement narratif n’est établi que s’il figure dans le récit', () => {
  const textes = ['La lame de William entaille la joue gauche de Sylvana.'];
  assert.equal(evenementEtabli('la lame de William entaille la joue gauche de Sylvana', textes), true);
  assert.equal(evenementEtabli('William entaille la joue de Sylvana', textes), true);
  assert.equal(evenementEtabli('Sylvana perd un bras dans l’explosion', textes), false);
  assert.equal(evenementEtabli('', textes), false);
});

test('l’état visuel ne change que par des événements établis, sans muter l’état d’entrée', () => {
  const story = histoire();
  const initial = etatVisuelVide();
  const textes = textesNarratifsEtablis(story, 0);
  const { etat, acceptes, rejetes } = appliquerChangementsVisuels(initial, [
    { cible: 'personnage', nom: 'Sylvana Nocturne', champ: 'blessures', operation: 'ajouter', valeur: 'coupure à la joue gauche', evenement: 'La lame de William entaille la joue gauche de Sylvana.' },
    { cible: 'personnage', nom: 'Sylvana Nocturne', champ: 'salissures', operation: 'ajouter', valeur: 'sang sur la joue', evenement: 'Un filet de sang coule sur sa peau' },
    { cible: 'decor', champ: 'ouvertures', operation: 'ajouter', valeur: 'porte de la taverne ouverte', evenement: 'la porte de la taverne claque et reste ouverte' },
    // Inventé : aucune trace dans le récit.
    { cible: 'personnage', nom: 'William', champ: 'tenue', operation: 'definir', valeur: 'armure dorée', evenement: 'William enfile une armure dorée étincelante' },
    // Intention du joueur seulement (message utilisateur) : non établie.
    { cible: 'personnage', nom: 'William', champ: 'armesVisibles', operation: 'ajouter', valeur: 'arbalète', evenement: 'Je dégaine et je frappe Sylvana au visage avec une arbalète' },
    { cible: 'personnage', nom: 'Sylvana Nocturne', champ: 'champInconnu', operation: 'definir', valeur: 'x', evenement: 'La lame de William entaille la joue gauche de Sylvana.' },
  ], textes, 2, (nom) => resoudrePersonnagesVisibles(story, [nom])[0]?.assetId);

  assert.equal(acceptes.length, 3);
  assert.equal(rejetes.length, 3);
  assert.deepEqual(initial, etatVisuelVide());
  assert.equal(etat.sequence, 1);
  const sylvana = etat.personnages.find((p) => p.nom === 'Sylvana Nocturne');
  assert.deepEqual(sylvana?.blessures, ['coupure à la joue gauche']);
  assert.equal(sylvana?.assetId, 'pnj-sylvana');
  assert.equal(etat.personnages.some((p) => p.nom === 'William'), false);
  assert.deepEqual(etat.decor?.ouvertures, ['porte de la taverne ouverte']);

  // Guérison établie : la blessure disparaît et devient cicatrice.
  const guerison = appliquerChangementsVisuels(etat, [
    { cible: 'personnage', nom: 'Sylvana Nocturne', champ: 'blessures', operation: 'retirer', valeur: 'coupure à la joue gauche', evenement: 'La plaie de Sylvana se referme en une fine cicatrice' },
    { cible: 'personnage', nom: 'Sylvana Nocturne', champ: 'cicatrices', operation: 'ajouter', valeur: 'fine cicatrice sur la joue gauche', evenement: 'La plaie de Sylvana se referme en une fine cicatrice' },
  ], ['Au matin, la plaie de Sylvana se referme en une fine cicatrice.'], 6);
  const apres = guerison.etat.personnages.find((p) => p.nom === 'Sylvana Nocturne');
  assert.deepEqual(apres?.blessures, []);
  assert.deepEqual(apres?.cicatrices, ['fine cicatrice sur la joue gauche']);

  // Aucun changement accepté : séquence inchangée.
  assert.equal(appliquerChangementsVisuels(etat, [], textes, 3).etat.sequence, etat.sequence);
});

test('un changement de lieu réinitialise l’état propre au lieu, pas l’heure ni la météo', () => {
  const textes = ['Il pleut sur la taverne en ruine. Ils fuient vers la crypte de Valmor sous la pluie.'];
  const base = appliquerChangementsVisuels(etatVisuelVide(), [
    { cible: 'decor', champ: 'lieu', operation: 'definir', valeur: 'Taverne', evenement: 'Il pleut sur la taverne en ruine' },
    { cible: 'decor', champ: 'meteo', operation: 'definir', valeur: 'pluie', evenement: 'Il pleut sur la taverne en ruine' },
    { cible: 'decor', champ: 'degats', operation: 'ajouter', valeur: 'toit effondré', evenement: 'Il pleut sur la taverne en ruine' },
  ], textes, 1).etat;
  const suite = appliquerChangementsVisuels(base, [
    { cible: 'decor', champ: 'lieu', operation: 'definir', valeur: 'Crypte de Valmor', evenement: 'Ils fuient vers la crypte de Valmor' },
  ], textes, 4).etat;
  assert.equal(suite.decor?.lieu, 'Crypte de Valmor');
  assert.equal(suite.decor?.meteo, 'pluie');
  assert.deepEqual(suite.decor?.degats, []);
});

test('critère PNJ unique : provisoire comme permanent, jamais le joueur ni un lieu', () => {
  const story = histoire();
  const [sylvana, orsk, doublon, lieu] = story.loreEmergent;
  assert.equal(estPnjVisuel(sylvana, 'William'), true);
  assert.equal(estPnjVisuel(orsk, 'William'), true);
  assert.equal(estPnjVisuel(doublon, 'William'), false);
  assert.equal(estPnjVisuel(lieu, 'William'), false);
  assert.deepEqual(listerIdsPnjVisuels(story), ['pnj-sylvana', 'pnj-garde']);
});

test('les personnages visibles sont résolus en joueur, PNJ ou figurant, sans doublon', () => {
  const story = histoire();
  const visibles = resoudrePersonnagesVisibles(story, ['William', 'Sylvana', 'Capitaine Orsk', 'Garde n°1', 'william', 'Sylvana Nocturne']);
  assert.deepEqual(visibles.map((v) => [v.nom, v.type, v.assetId ?? null, v.principal]), [
    ['William', 'joueur', '__joueur__', true],
    ['Sylvana Nocturne', 'pnj', 'pnj-sylvana', false],
    ['Capitaine Orsk', 'pnj', 'pnj-garde', true],
    ['Garde n°1', 'figurant', null, false],
  ]);
});

test('les messages du joueur ne peuvent pas établir un changement visuel', () => {
  const textes = textesNarratifsEtablis(histoire(), 0);
  assert.equal(textes.some((t) => t.includes('Je dégaine')), false);
  assert.equal(textes.some((t) => t.includes('entaille la joue')), true);
});

test('la requête Elyndor Cloud demande le format 16:9 et borne les références', () => {
  const corps = construireCorpsRequeteImage({
    prompt: 'p', negatif: 'n', format: '16:9',
    references: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((image) => ({ role: 'personnage' as const, image })),
  }, 'modele-image');
  assert.equal(corps.aspect_ratio, '16:9');
  assert.equal(corps.size, '1344x768');
  assert.equal(DIMENSIONS_FORMAT['16:9'].width / DIMENSIONS_FORMAT['16:9'].height > 1.7, true);
  assert.equal((corps.reference_images as string[]).length, 6);
  assert.equal(corps.negative_prompt, 'n');

  assert.equal(extraireImageReponse({ data: [{ b64_json: 'QUJD' }] }), 'data:image/png;base64,QUJD');
  assert.equal(extraireImageReponse({ data: [{ url: 'https://exemple/image.png' }] }), null);
  assert.equal(extraireImageReponse({}), null);
});

test('une sauvegarde de l’écran ne peut pas écraser un état visuel plus récent', () => {
  const ancienne = histoire();
  const recente = histoire();
  recente.etatVisuel = { ...etatVisuelVide(), sequence: 4, scenesIllustrees: [scene('B')] };
  ancienne.etatVisuel = { ...etatVisuelVide(), sequence: 2 };

  const resultat = conserverEtatVisuelRecent(serialiserHistoire(ancienne), serialiserHistoire(recente));
  assert.equal(JSON.parse(resultat.etat).etatVisuel.sequence, 4);

  const sansEtat = histoire();
  const conserve = conserverEtatVisuelRecent(serialiserHistoire(sansEtat), serialiserHistoire(recente));
  assert.equal(JSON.parse(conserve.etat).etatVisuel.sequence, 4);

  assert.equal(etatVisuelLePlusRecent({ ...etatVisuelVide(), sequence: 5 }, { ...etatVisuelVide(), sequence: 3 })?.sequence, 5);
});

test('les images et avatars suivent uniquement le fournisseur explicitement sélectionné', () => {
  const base = { openRouterApiKey: '', model: 'x', profilContenu: 'grand_public' as const };
  const desactives = calculerCapacites({...base,fournisseurImages:'desactive'});
  assert.equal(desactives.images,false);
  assert.equal(desactives.avatars,false);
  const runpod=calculerCapacites({...base,fournisseurImages:'runpod'});
  assert.equal(runpod.images,imagesElyndorCloudDisponibles());
  assert.equal(runpod.avatars,runpod.images);
});

