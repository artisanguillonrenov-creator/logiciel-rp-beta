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
  ordonnerReferences,
  resoudrePersonnagesVisibles,
  type ReferenceVisuelle,
  type SceneIllustree,
} from '../src/engine/visualState';
import {
  SECTIONS_PROMPT_IMAGE,
  appliquerModeRegeneration,
  consoliderAvecEtatVisuel,
  formaterPromptImage,
  structureDeRepli,
  personnageSceneVide,
} from '../src/engine/visualBible';
import {
  analyserReponseDirection,
  directionDeRepli,
  textesNarratifsEtablis,
} from '../src/engine/directionArtistique';
import {
  DIMENSIONS_FORMAT,
  construireCorpsRequeteImage,
  extraireImageReponse,
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
    structure: structureDeRepli({ profil: 'combat', personnages: [], texteScene: 'Combat.', lieu: 'Taverne' }),
    regenerations: 0,
    ...overrides,
  };
}

test('historique glissant : au plus les 2 dernières scènes, la plus ancienne évincée', () => {
  let scenes: SceneIllustree[] = [];
  let r = ajouterSceneIllustree(scenes, scene('A'));
  assert.deepEqual(r.scenes.map((s) => s.revision), ['A']);
  r = ajouterSceneIllustree(r.scenes, scene('B'));
  assert.deepEqual(r.scenes.map((s) => s.revision), ['A', 'B']);
  r = ajouterSceneIllustree(r.scenes, scene('C'));
  assert.deepEqual(r.scenes.map((s) => s.revision), ['B', 'C']);
  assert.deepEqual(r.evincees.map((s) => s.revision), ['A']);
  r = ajouterSceneIllustree(r.scenes, scene('D'));
  assert.deepEqual(r.scenes.map((s) => s.revision), ['C', 'D']);
  assert.deepEqual(r.evincees.map((s) => s.revision), ['B']);
  scenes = r.scenes;

  // Régénération de la même révision : remplacement en place, pas de rotation.
  const regen = ajouterSceneIllustree(scenes, scene('D', { regenerations: 1 }));
  assert.deepEqual(regen.scenes.map((s) => s.revision), ['C', 'D']);
  assert.equal(regen.scenes[1].regenerations, 1);
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

test('les références priorisent les personnages visibles avant les scènes précédentes', () => {
  const refs: ReferenceVisuelle[] = [
    { type: 'scene-avant-derniere', uri: 'data:s2', libelle: 's2' },
    { type: 'scene-precedente', uri: 'data:s1', libelle: 's1' },
    { type: 'pnj-secondaire', uri: 'data:sylvana', libelle: 'sylvana' },
    { type: 'joueur-avatar', uri: 'data:avatar', libelle: 'avatar' },
    { type: 'pnj-principal', uri: 'data:orsk', libelle: 'orsk' },
    { type: 'joueur-portrait', uri: 'data:portrait', libelle: 'portrait' },
    { type: 'pnj-secondaire', uri: 'data:sylvana', libelle: 'doublon' },
  ];
  assert.deepEqual(ordonnerReferences(refs, 10).map((r) => r.uri), [
    'data:portrait', 'data:avatar', 'data:orsk', 'data:sylvana', 'data:s1', 'data:s2',
  ]);
  // Limite du fournisseur : ce sont les scènes qui sautent, jamais un visage.
  assert.deepEqual(ordonnerReferences(refs, 4).map((r) => r.type), [
    'joueur-portrait', 'joueur-avatar', 'pnj-principal', 'pnj-secondaire',
  ]);
});

test('la direction artistique est validée : visibles explicites, noms canoniques, profil', () => {
  const story = histoire();
  const sortie = `Voici : {"profil":"combat",
    "personnagesVisibles":[{"nom":"William","posture":"fente avant","action":"frappe"},{"nom":"Sylvana","expression":"rage","action":"recule"},{"nom":"Garde n°1","action":"accourt"}],
    "horsCadre":["Capitaine Orsk"],
    "action":"la lame touche la joue",
    "decor":{"lieu":"Taverne du Corbeau","premierPlan":"chope renversée"},
    "camera":{"angle":"contre-plongée"},
    "changementsVisuels":[{"cible":"personnage","nom":"Sylvana","champ":"blessures","operation":"ajouter","valeur":"coupure","evenement":"La lame de William entaille la joue gauche de Sylvana."}]}`;
  const direction = analyserReponseDirection(sortie, story);
  assert.ok(direction);
  assert.equal(direction.structure.profil, 'combat');
  assert.deepEqual(direction.visibles.map((v) => v.nom), ['William', 'Sylvana Nocturne', 'Garde n°1']);
  assert.deepEqual(direction.structure.personnages.map((p) => p.nom), ['William', 'Sylvana Nocturne', 'Garde n°1']);
  assert.deepEqual(direction.structure.horsCadre, ['Capitaine Orsk']);
  assert.equal(direction.structure.camera.angle, 'contre-plongée');
  assert.ok(direction.structure.camera.typePlan, 'les champs caméra manquants viennent du profil');
  assert.equal(direction.changements.length, 1);
  // Nom court canonicalisé : l'état visuel et le prompt visent la même entrée.
  assert.equal(direction.changements[0].nom, 'Sylvana Nocturne');

  const sansProfil = analyserReponseDirection('{"profil":"inconnu","personnagesVisibles":[{"nom":"A"},{"nom":"B"},{"nom":"C"}]}', story);
  assert.equal(sansProfil?.structure.profil, 'groupe');
  assert.equal(analyserReponseDirection('pas de json', story), null);
});

test('le repli local détecte encore les PNJ nommés quand le modèle est indisponible', () => {
  const direction = directionDeRepli(histoire());
  assert.equal(direction.parModele, false);
  assert.deepEqual(direction.visibles.map((v) => v.nom), ['William', 'Sylvana Nocturne']);
});

test('les messages du joueur ne peuvent pas établir un changement visuel', () => {
  const textes = textesNarratifsEtablis(histoire(), 0);
  assert.equal(textes.some((t) => t.includes('Je dégaine')), false);
  assert.equal(textes.some((t) => t.includes('entaille la joue')), true);
});

test('le prompt image contient toutes les sections structurées, dans l’ordre', () => {
  const structure = structureDeRepli({
    profil: 'combat',
    personnages: [{ ...personnageSceneVide('William'), tenue: 'manteau', action: 'frappe' }],
    texteScene: 'La lame entaille la joue.',
    lieu: 'Taverne',
  });
  const prompt = formaterPromptImage(structure, [{ type: 'joueur-portrait', uri: 'data:x', libelle: 'visage de William' }]);
  let position = -1;
  for (const section of SECTIONS_PROMPT_IMAGE) {
    const index = prompt.indexOf(section);
    assert.ok(index > position, `section ${section} absente ou mal ordonnée`);
    position = index;
  }
  assert.match(prompt, /Tarantino/);
  assert.match(prompt, /16:9/);
  assert.match(prompt, /watermark/);
  assert.match(prompt, /mains aberrantes/);
  assert.match(prompt, /image de référence 1 : visage de William/);
});

test('l’état visuel persistant fait autorité sur la proposition du modèle', () => {
  const story = histoire();
  const etat = appliquerChangementsVisuels(etatVisuelVide(), [
    { cible: 'personnage', nom: 'Sylvana Nocturne', champ: 'blessures', operation: 'ajouter', valeur: 'coupure à la joue gauche', evenement: 'La lame de William entaille la joue gauche de Sylvana.' },
    { cible: 'personnage', nom: 'Sylvana Nocturne', champ: 'tenue', operation: 'definir', valeur: 'robe de soie noire', evenement: 'Un filet de sang coule sur sa peau' },
  ], textesNarratifsEtablis(story, 0), 2).etat;
  const structure = structureDeRepli({
    profil: 'dialogue',
    personnages: [{ ...personnageSceneVide('Sylvana Nocturne'), tenue: 'armure inventée', blessures: '' }],
    texteScene: '',
    lieu: '',
  });
  const consolide = consoliderAvecEtatVisuel(structure, etat);
  assert.equal(consolide.personnages[0].tenue, 'robe de soie noire');

  // Le décor et la lumière persistants priment aussi sur une proposition divergente.
  const avecDecor = appliquerChangementsVisuels(etat, [
    { cible: 'decor', champ: 'lieu', operation: 'definir', valeur: 'Taverne du Corbeau', evenement: 'la porte de la taverne claque et reste ouverte' },
    { cible: 'decor', champ: 'meteo', operation: 'definir', valeur: 'pluie', evenement: 'la porte de la taverne claque et reste ouverte sur la pluie' },
    { cible: 'decor', champ: 'architecture', operation: 'definir', valeur: 'poutres noircies', evenement: 'la porte de la taverne claque et reste ouverte' },
  ], textesNarratifsEtablis(story, 0), 2).etat;
  const divergente = consoliderAvecEtatVisuel({
    ...structure,
    decor: { ...structure.decor, lieu: 'Palais de marbre', architecture: 'colonnes dorées' },
    lumiere: { ...structure.lumiere, meteo: 'grand soleil' },
  }, avecDecor);
  assert.equal(divergente.decor.lieu, 'Taverne du Corbeau');
  assert.equal(divergente.decor.architecture, 'poutres noircies');
  assert.equal(divergente.lumiere.meteo, 'pluie');
  assert.match(consolide.personnages[0].blessures, /coupure à la joue gauche/);
});

test('une régénération ne change que la mise en scène, jamais le canon visuel', () => {
  const base = consoliderAvecEtatVisuel(structureDeRepli({
    profil: 'combat',
    personnages: [{ ...personnageSceneVide('William'), tenue: 'manteau de cuir', blessures: 'arcade ouverte', action: 'frappe' }],
    texteScene: 'La lame entaille la joue.',
    lieu: 'Taverne du Corbeau',
  }), etatVisuelVide());
  for (const mode of ['regenerer', 'autre-cadrage', 'autre-angle', 'autre-composition'] as const) {
    const variante = appliquerModeRegeneration(base, mode, 1);
    assert.deepEqual(variante.personnages, base.personnages, mode);
    assert.deepEqual(variante.decor, base.decor, mode);
    assert.equal(variante.action, base.action, mode);
    assert.deepEqual(variante.lumiere, base.lumiere, mode);
    assert.equal(variante.profil, base.profil, mode);
  }
  assert.notEqual(appliquerModeRegeneration(base, 'autre-cadrage', 1).camera.typePlan, base.camera.typePlan);
  assert.notEqual(appliquerModeRegeneration(base, 'autre-angle', 1).camera.angle, base.camera.angle);
  assert.notEqual(appliquerModeRegeneration(base, 'autre-composition', 1).camera.composition, base.camera.composition);
});

test('la requête Elyndor Cloud demande le format 16:9 et borne les références', () => {
  const corps = construireCorpsRequeteImage({
    prompt: 'p', negatif: 'n', references: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], format: '16:9',
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

test('sans modèle image Elyndor Cloud publié, images et avatars restent désactivés', () => {
  const caps = calculerCapacites({ openRouterApiKey: '', model: 'x', profilContenu: 'grand_public' });
  assert.equal(caps.images, false);
  assert.equal(caps.avatars, false);
  assert.match(caps.raisons.images ?? '', /Elyndor Cloud/);
});
