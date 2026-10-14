import assert from 'node:assert/strict';
import test from 'node:test';
import { CATALOGUE, faitsActe } from '../src/prax/bibliotheque/catalogue';
import { typeCheck, describe as decrireErreur } from '../src/prax/core/typecheck';
import { insert } from '../src/prax/core/types';
import { genererTourPrax, narrateurPraxActif, regenererAvecPrax } from '../src/engine/praxNarrateur';
import { comprendre } from '../src/engine/praxNarrateur/comprehension';
import { construireDescription, slug } from '../src/engine/praxNarrateur/description';
import { construireMonde, faitsInitiaux, graineDe, lireRelation } from '../src/engine/praxNarrateur/monde';
import { jouerTourPrax, ouvrirAvecPrax, regenererTourPrax } from '../src/engine/praxNarrateur/tour';
import { ID_JOUEUR } from '../src/engine/praxNarrateur/types';
import type { AppSettings, StoryState } from '../src/types';

/** Une partie neuve, au comptoir de la Guilde des Aventuriers de Paris. */
function partie(extra: Partial<StoryState> = {}): StoryState {
  return {
    version: 12,
    meta: {
      id: 'histoire-prax-test',
      personnageNom: 'Arwen',
      personnageDescription: '',
      pointDeDepart: 'Réception d’un contrat à la Guilde des Aventuriers',
      contexte: { lieu: 'Guilde des Aventuriers, Paris', ambiance: '', dateChronique: '', objectifs: '' },
      createdAt: 0,
      updatedAt: 0,
    },
    messages: [],
    memoire: { resume: '', faits: [], dernierMessageIndexMaj: 0 },
    loreEmergent: [],
    settings: { creativite: 'moyenne', longueur: 'moyenne', ton: 'sombre_realiste', violence: 'modere', romance: 'faible', humour: 'faible', liberteJoueur: 'elevee', rythme: 'normal' },
    directeur: { arcActuel: '', tension: 'calme', dernierBeatIndex: 0, beats: [] },
    monde: { zones: [], flags: {}, compteurs: {}, declencheurs: [] },
    social: { engagements: [], relations: [] },
    ...extra,
  };
}

let horloge = 1_000;
const fixe = () => ++horloge;

function jouer(story: StoryState, messages: string[]): StoryState {
  let s = story;
  for (const m of messages) s = jouerTourPrax(s, m, { maintenant: fixe }).story;
  return s;
}

function dernier(story: StoryState): string {
  return story.messages[story.messages.length - 1].content;
}

function mondePret(story: StoryState, relations: Map<string, { confiance?: number }> = new Map()) {
  const { desc, lieuJoueur } = construireDescription(story);
  const st = construireMonde(desc, graineDe(story.meta.id));
  for (const o of faitsInitiaux(desc, lieuJoueur, new Set(desc.pnj.map((p) => p.id)), new Set(desc.lieux.map((l) => l.id)), relations)) st.performOutcome(o);
  return { st, desc, lieuJoueur };
}

// ---- description de la scène ------------------------------------------------------

test('la scène de départ reprend les personnages officiels du lieu et de la ville', () => {
  const { desc, lieuJoueur } = construireDescription(partie());
  assert.equal(desc.ville, 'Paris');
  assert.equal(lieuJoueur, 'guildeaventuriers');
  assert.deepEqual(desc.pnj.map((p) => p.nom).sort(), ['Margaux Fontaine', 'Séraphine Duvall']);
  const margaux = desc.pnj.find((p) => p.nom === 'Margaux Fontaine')!;
  assert.equal(margaux.role, 'receptionniste');
  assert.ok(margaux.sujets.includes('guilde_aventuriers') && margaux.sujets.includes('ville_paris'));
});

test('une partie déjà commencée reprend les présents et les relations relevés par l’application', () => {
  const story = partie({
    scene: { ville: 'Paris', lieu: 'la taverne', presents: ['Odette', 'Un ivrogne'], majMessageIndex: 4 },
    social: { engagements: [], relations: [{ id: 'r1', nom: 'Odette', confiance: -2, respect: 0, peur: 0, affection: 0, hostilite: 1 }] },
  });
  const { desc } = construireDescription(story);
  const odette = desc.pnj.find((p) => p.nom === 'Odette Vinchamps');
  assert.ok(odette, 'Odette est reconnue comme la tavernière officielle de Paris');
  assert.equal(odette!.role, 'taverniere');
  assert.ok(desc.pnj.some((p) => p.nom === 'un ivrogne' && p.role === 'habitant'));
});

test('sans ville citée, la scène se place dans la capitale de la race du personnage', () => {
  const base = partie();
  const story = partie({ meta: { ...base.meta, raceOrigineId: 'hauts-elfes', contexte: { ...base.meta.contexte, lieu: 'Guilde des Aventuriers' } } });
  const { desc } = construireDescription(story);
  assert.equal(desc.ville, 'Tokyo');
  assert.deepEqual(desc.pnj.map((p) => p.nom).sort(), ['Sachi Moonwhisper', 'Yui Frostveil']);
});

test('les identifiants Prax sont des segments sûrs', () => {
  assert.equal(slug('Séraphine Duvall'), 'seraphineduvall');
  assert.equal(slug('  '), 'pnj');
  assert.equal(slug('7 Lames'), 'p7lames');
  assert.equal(slug('Joueur'), 'joueur2');
});

// ---- le monde ---------------------------------------------------------------------

test('le monde d’Elyndor et toute la bibliothèque universelle passent le vérificateur statique de Prax', () => {
  const { st, desc } = mondePret(partie());
  // Toutes les actions du catalogue installées, plus ce que le narrateur pose en jeu (saisie, garde, compétence).
  for (const e of CATALOGUE) for (const o of faitsActe(e)) st.performOutcome(o);
  for (const f of ['saisie.montant!10', 'saisie.objet!chandelle', 'saisie.valeur!10', 'saisie.plancher!5', `role.${desc.pnj[0].id}.garde`, `competence.${ID_JOUEUR}.forge`]) st.performOutcome(insert(f));
  const erreurs = typeCheck(st);
  assert.deepEqual(erreurs.map(decrireErreur), []);
});

// ---- compréhension ------------------------------------------------------------------

test('les messages du joueur sont rapprochés des actions de Prax', () => {
  const { st, desc, lieuJoueur } = mondePret(partie());
  const cas: Array<[string, string | null, string | undefined, string | undefined]> = [
    ['Bonjour Margaux !', 'saluer', 'margaux', undefined],
    ['Je cherche un contrat, tu as du travail ?', 'interroger', 'margaux', 'guilde_aventuriers'],
    ['Séraphine, que sais-tu des zones corrompues ?', 'interroger', 'seraphine', 'zones_corrompues'],
    ['Espèce d’imbécile !', 'insulter', 'margaux', undefined],
    ['Je la menace de mon épée', 'menacer', 'margaux', undefined],
    ['Je frappe Séraphine', 'attaquer', 'seraphine', undefined],
    ['Je lui fais les poches', 'voler', 'margaux', undefined],
    ['Je te demande pardon', 's_excuser', 'margaux', undefined],
    ['Je glisse trois pièces d’argent à Margaux', 'payer', 'margaux', undefined],
    ['Je peux t’aider ?', 'aider', 'margaux', undefined],
    ['continue', 'attendre', undefined, undefined],
    ['Il fait beau aujourd’hui', 'converser', 'margaux', undefined],
  ];
  for (const [message, genre, cible, sujet] of cas) {
    const c = comprendre(message, st, desc, lieuJoueur, { dernierInterlocuteur: 'margaux' });
    assert.equal(c.genre, genre, message);
    assert.ok(c.action, `une action Prax pour « ${message} »`);
    if (cible) assert.equal(c.cible, cible, message);
    if (sujet) assert.equal(c.sujet, sujet, message);
  }
});

test('une cible absente ou une action impossible n’est jamais devinée', () => {
  const { st, desc, lieuJoueur } = mondePret(partie());
  // « merci » sans rien à remercier devient une simple réplique.
  assert.equal(comprendre('Merci', st, desc, lieuJoueur).genre, 'converser');
  const vide = mondePret(partie({ meta: { ...partie().meta, contexte: { lieu: 'Porte Astra, Zurich', ambiance: '', dateChronique: '', objectifs: '' }, pointDeDepart: 'Porte Astra' } }));
  assert.ok(vide.desc.pnj.length >= 1);
});

// ---- tours complets -------------------------------------------------------------------

test('l’ouverture installe la scène et l’accueil de la réceptionniste', () => {
  const s = ouvrirAvecPrax(partie(), { maintenant: fixe });
  assert.equal(s.messages.length, 1);
  const texte = s.messages[0].content;
  assert.match(texte, /^Tu te trouves au comptoir de la Guilde des Aventuriers de Paris\./);
  assert.match(texte, /Margaux : « /);
  assert.ok(s.prax && s.prax.etat.length > 0);
  assert.equal(s.scene?.lieu, 'le comptoir de la Guilde des Aventuriers');
  assert.equal(s.messages[0].praxCompteRendu?.evenements[0].genre, 'accueillir');
});

test('une conversation : salut, question, insulte — chaque PNJ décide selon ses motivations', () => {
  let s = ouvrirAvecPrax(partie(), { maintenant: fixe });
  s = jouer(s, ['Bonjour Margaux']);
  assert.match(dernier(s), /^Tu salues Margaux\./);
  assert.match(dernier(s), /Margaux (te rend ton salut|te salue à son tour)/);

  s = jouer(s, ['Je cherche un contrat, qu’est-ce que tu proposes ?']);
  assert.match(dernier(s), /Tu interroges Margaux au sujet de la Guilde des Aventuriers\./);
  assert.match(dernier(s), /Margaux : « .*(contrat|rang|Guilde)/);

  s = jouer(s, ['Espèce d’ordure !']);
  const cr = s.messages[s.messages.length - 1].praxCompteRendu!;
  assert.equal(cr.evenements[0].genre, 'insulter');
  assert.ok(cr.evenements.some((e) => e.acteur === 'margaux' && e.genre === 'rendreInsulte'), 'Margaux rend l’insulte');
  assert.ok(cr.relations.some((r) => r.pnj === 'Margaux' && r.axe === 'hostilite' && r.apres > r.avant));
  // Les jauges de l'application suivent (échelle -3..3).
  const rel = s.social.relations.find((r) => r.nom === 'Margaux Fontaine')!;
  assert.equal(rel.hostilite, 1);
  assert.equal(rel.affection, -1);
  // Séraphine a tout vu : la menace d'après la rendra méfiante.
  s = jouer(s, ['Je te menace, donne-moi le meilleur contrat ou tu le regretteras']);
  const cr2 = s.messages[s.messages.length - 1].praxCompteRendu!;
  assert.ok(cr2.evenements[0].temoins.includes('seraphine'));
  assert.ok(cr2.evenements.some((e) => e.acteur === 'seraphine' && e.genre === 'se_mefier'), 'Séraphine se méfie de toi');
});

test('se déplacer change la scène et fait entrer les personnages officiels du lieu', () => {
  let s = ouvrirAvecPrax(partie(), { maintenant: fixe });
  s = jouer(s, ['Je vais à la taverne']);
  assert.match(dernier(s), /^Tu te rends à la taverne\. Odette Vinchamps, la tavernière, est là\./);
  assert.match(dernier(s), /Odette : « /);
  assert.equal(s.scene?.lieu, 'la taverne');
  assert.deepEqual(s.scene?.presents, ['Odette Vinchamps']);
  s = jouer(s, ['Bonsoir, tu as une chambre pour la nuit ?']);
  assert.match(dernier(s), /chambre/);
});

test('un message incompréhensible ne fait pas avancer le monde', () => {
  let s = ouvrirAvecPrax({ ...partie(), meta: { ...partie().meta, contexte: { lieu: 'les rues de Paris', ambiance: '', dateChronique: '', objectifs: '' }, pointDeDepart: 'Une ruelle' } }, { maintenant: fixe });
  const avant = s.prax!.etat;
  s = jouer(s, ['...']);
  assert.match(dernier(s), /Tu observes les lieux|Tu attends/);
  const rien = jouerTourPrax(s, '!!!', { maintenant: fixe }).story;
  assert.match(dernier(rien), /\(Narrateur Prax\)/);
  assert.equal(rien.prax!.tours, s.prax!.tours);
  assert.notEqual(avant.length, 0);
});

test('Prax est déterministe : même partie, mêmes messages, même texte', () => {
  const messages = ['Bonjour', 'Que sais-tu des Voiles ?', 'Je vais à la forge', 'Bonjour, tu peux réparer mon épée ?'];
  const a = jouer(ouvrirAvecPrax(partie(), { maintenant: fixe }), messages);
  const b = jouer(ouvrirAvecPrax(partie(), { maintenant: fixe }), messages);
  assert.deepEqual(a.messages.map((m) => m.content), b.messages.map((m) => m.content));
});

test('la sauvegarde JSON de la partie suffit pour continuer à l’identique', () => {
  const debut = jouer(ouvrirAvecPrax(partie(), { maintenant: fixe }), ['Bonjour', 'Espèce d’idiote !']);
  const relue: StoryState = JSON.parse(JSON.stringify(debut));
  const suiteA = jouer(debut, ['Je te demande pardon', 'Parle-moi des Portes Astra']);
  const suiteB = jouer(relue, ['Je te demande pardon', 'Parle-moi des Portes Astra']);
  assert.deepEqual(suiteA.messages.map((m) => m.content), suiteB.messages.map((m) => m.content));
});

test('régénérer rejoue les mêmes décisions avec une autre formulation possible', () => {
  const s = jouer(ouvrirAvecPrax(partie(), { maintenant: fixe }), ['Bonjour', 'Que sais-tu des Voiles ?']);
  const avant = s.messages[s.messages.length - 1].praxCompteRendu!;
  const r = regenererTourPrax(s, { maintenant: fixe }).story;
  const apres = r.messages[r.messages.length - 1].praxCompteRendu!;
  assert.equal(r.messages.length, s.messages.length);
  assert.deepEqual(apres.evenements.map((e) => [e.acteur, e.genre, e.sujet]), avant.evenements.map((e) => [e.acteur, e.genre, e.sujet]));
  assert.equal(r.prax!.tours, s.prax!.tours);
});

test('les jauges de l’application amorcent l’attitude des PNJ : une tavernière qui se méfie élude', () => {
  const story = partie({
    meta: { ...partie().meta, contexte: { lieu: 'la taverne du Sanglier Doré, Paris', ambiance: '', dateChronique: '', objectifs: '' }, pointDeDepart: 'Une taverne' },
    social: { engagements: [], relations: [{ id: 'r1', nom: 'Odette Vinchamps', confiance: -2, respect: 0, peur: 0, affection: 0, hostilite: 0 }] },
  });
  const s = jouer(ouvrirAvecPrax(story, { maintenant: fixe }), ['Odette, que sais-tu de la Guilde des Ombres ?']);
  const cr = s.messages[s.messages.length - 1].praxCompteRendu!;
  assert.ok(cr.evenements.some((e) => e.acteur === 'odette' && e.genre === 'eluder'), JSON.stringify(cr.evenements.map((e) => e.genre)));
  // Échelle de l'application (-3..3) × 10 dans Prax.
  const { st } = mondePret(story, new Map([['odette', { confiance: -2 }]]));
  assert.equal(lireRelation(st, 'odette', 'confiance'), -20);
  // Et la jauge relue dans la partie après le tour reste celle de départ.
  assert.equal(s.social.relations.find((r) => r.nom === 'Odette Vinchamps')?.confiance, -2);
});

// ---- partie déjà commencée, commerce, relances ------------------------------------------

/** Une partie jouée par le narrateur IA au Marché aux esclaves, puis passée à Prax. */
function partieMarche(presents: string[]): StoryState {
  const base = partie();
  return partie({
    meta: { ...base.meta, pointDeDepart: 'Enchère publique', contexte: { ...base.meta.contexte, lieu: 'Marchés aux esclaves' } },
    messages: [
      { id: 'u0', role: 'user', content: 'Je m’approche de l’estrade.', timestamp: 0 },
      { id: 'a0', role: 'assistant', content: 'Le marchand recule d’un pas.', timestamp: 1 },
    ],
    scene: { ville: 'Paris', lieu: 'Marchés aux esclaves', presents, majMessageIndex: 2 },
  });
}

test('une partie reprise garde les personnages relevés par l’application, sans figurants', () => {
  const { desc } = construireDescription(partieMarche(['Le marchand', 'La noble captive']));
  assert.deepEqual(desc.pnj.map((p) => [p.nom, p.role]), [['le marchand', 'marchand'], ['la noble captive', 'captif']]);
  // Sans présents connus, le lieu reçoit sa distribution générique.
  assert.ok(construireDescription(partieMarche([])).desc.pnj.some((p) => p.nom === 'Gaspard Morvan'));
});

test('demander, marchander, payer : le vendeur présent répond et l’affaire se conclut', () => {
  const demande = 'Je cherche une guerrière elfe noire qui a l’air d’avoir 50 ans. Est-ce que vous avez ça ?';
  let s = jouer(partieMarche(['Le marchand', 'La noble captive']), [demande]);
  const cr = s.messages[s.messages.length - 1].praxCompteRendu!;
  assert.equal(cr.evenements[0].genre, 'demander');
  assert.equal(cr.evenements[0].cible, 'marchand');
  assert.equal(cr.evenements[0].precision, demande, 'la demande exacte est transmise pour le futur modèle IA');
  assert.ok(cr.evenements.some((e) => e.acteur === 'marchand' && e.genre === 'proposer'));
  assert.match(dernier(s), /^Tu (exposes ta demande|fais part de ce que tu cherches) au marchand\./);
  assert.match(dernier(s), /\nLe marchand : « /);
  assert.ok(!/accueille|Approche\. Ici/.test(dernier(s)), 'pas d’accueil : la partie était déjà commencée');

  s = jouer(s, ['C’est trop cher']);
  const cr2 = s.messages[s.messages.length - 1].praxCompteRendu!;
  assert.equal(cr2.evenements[0].genre, 'marchander');
  assert.ok(cr2.evenements.some((e) => e.acteur === 'marchand' && (e.genre === 'maintenirPrix' || e.genre === 'consentirRabais')));

  s = jouer(s, ['Bon, je paie']);
  const cr3 = s.messages[s.messages.length - 1].praxCompteRendu!;
  assert.equal(cr3.evenements[0].genre, 'payerPrix');
  assert.ok(cr3.evenements.some((e) => e.acteur === 'marchand' && e.genre === 'conclure'));
  assert.match(dernier(s), /Tu paies le marchand le prix convenu\./);
});

test('demander à quelqu’un qui ne vend rien : il renvoie vers un marchand', () => {
  const base = partie();
  const story = partie({ meta: { ...base.meta, contexte: { ...base.meta.contexte, lieu: 'les rues de Paris' }, pointDeDepart: 'Une ruelle' }, scene: { ville: 'Paris', lieu: 'une ruelle', presents: ['Mathis'], majMessageIndex: 0 } });
  const s = jouer(ouvrirAvecPrax(story, { maintenant: fixe }), ['Mathis, je cherche une monture rapide']);
  const cr = s.messages[s.messages.length - 1].praxCompteRendu!;
  assert.equal(cr.evenements[0].genre, 'demander');
  assert.ok(cr.evenements.some((e) => e.acteur === 'mathis' && e.genre === 'renvoyer'), JSON.stringify(cr.evenements.map((e) => e.genre)));
});

test('parler sans rien demander deux fois de suite : l’interlocuteur presse d’en venir au fait', () => {
  let s = jouer(ouvrirAvecPrax(partie(), { maintenant: fixe }), ['Il fait beau aujourd’hui']);
  assert.equal(s.messages[s.messages.length - 1].praxCompteRendu!.evenements[0].genre, 'converser');
  s = jouer(s, ['Ah oui, vraiment.']);
  const cr = s.messages[s.messages.length - 1].praxCompteRendu!;
  assert.equal(cr.evenements[0].genre, 'relancer');
  assert.ok(cr.evenements.some((e) => e.acteur === 'margaux' && e.genre === 'presser'));
  assert.notEqual(s.messages[s.messages.length - 1].content, s.messages[s.messages.length - 3].content);
});

test('« merci » sans service rendu se raconte comme un remerciement', () => {
  const s = jouer(ouvrirAvecPrax(partie(), { maintenant: fixe }), ['Merci beaucoup']);
  assert.match(dernier(s), /^Tu remercies Margaux\./);
});

// ---- branchement dans l'application -----------------------------------------------------

test('le narrateur Prax ne s’active que sur demande explicite', () => {
  assert.equal(narrateurPraxActif({ openRouterApiKey: '', model: '', narrateurPrax: true } as AppSettings), true);
  assert.equal(narrateurPraxActif({ openRouterApiKey: '', model: '' } as AppSettings), false);
  assert.equal(narrateurPraxActif(null), false);
});

test('le pont Prax (genererTour / régénérer) ne fait aucun appel réseau', () => {
  const fetchOrigine = globalThis.fetch;
  let appels = 0;
  globalThis.fetch = (async () => {
    appels++;
    throw new Error('aucun appel réseau attendu');
  }) as typeof fetch;
  try {
    const depart = ouvrirAvecPrax(partie(), { maintenant: fixe });
    const r = genererTourPrax(depart, 'Bonjour Margaux');
    assert.equal(r.story.messages.length, 3);
    assert.match(r.story.messages[2].content, /Margaux/);
    assert.equal(r.aEteCorrige, false);
    assert.equal(r.debugLore.diagnosticTour?.appelsIA.length, 0);
    assert.ok((r.debugLore.diagnosticTour?.etapes[0].details ?? []).some((l) => l.includes('Margaux →')), 'les coulisses du planificateur sont dans le diagnostic');
    const regen = regenererAvecPrax(r.story);
    assert.equal(regen.story.messages.length, 3);
    const ouverture = regenererAvecPrax(depart);
    assert.equal(ouverture.story.messages.length, 1);
    assert.equal(appels, 0);
  } finally {
    globalThis.fetch = fetchOrigine;
  }
});

test('une session de 12 tours reste rapide (planificateur à profondeur 2)', () => {
  const messages = ['Bonjour', 'Je cherche un contrat', 'Et les Voiles ?', 'Séraphine, parle-moi des zones corrompues', 'Merci', 'Je vais à la taverne', 'Bonsoir !', 'Tu as une chambre ?', 'Espèce d’ordure', 'Je te demande pardon', 'Je retourne à la guilde', 'continue'];
  const debut = Date.now();
  let s = ouvrirAvecPrax(partie(), { maintenant: fixe });
  for (const m of messages) s = jouerTourPrax(s, m).story;
  const duree = Date.now() - debut;
  assert.ok(duree < 8000, `12 tours en ${duree} ms`);
  assert.equal(s.messages.length, 1 + 2 * messages.length);
  assert.ok(s.messages.every((m) => m.role !== 'assistant' || m.content.trim().length > 0));
  assert.ok(!s.messages.some((m) => m.content.includes(ID_JOUEUR)), 'l’identifiant interne du joueur ne fuit jamais dans le texte');
});
