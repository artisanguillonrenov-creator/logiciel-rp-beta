/**
 * Bibliothèque universelle d'actions apprise à Prax : catalogue dédoublonné,
 * compréhension (expressions, montants, objets), mécaniques natives jouées par
 * le moteur, réactions des PNJ et récit.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { CATALOGUE, couverture, entreeParId, maturite, modeDe } from '../src/prax/bibliotheque/catalogue';
import { deserializeState, serializeState } from '../src/prax/core/persist';
import { del } from '../src/prax/core/types';
import { formaterMontant, lireMontant, reconnaitreActe } from '../src/engine/praxNarrateur/bibliotheque';
import { construireMonde, graineDe } from '../src/engine/praxNarrateur/monde';
import { jouerTourPrax, ouvrirAvecPrax } from '../src/engine/praxNarrateur/tour';
import { ID_JOUEUR } from '../src/engine/praxNarrateur/types';
import type { StoryState } from '../src/types';

function partie(lieu: string, presents?: string[]): StoryState {
  return {
    version: 12,
    meta: { id: 'histoire-bibliotheque', personnageNom: 'Arwen', personnageDescription: '', pointDeDepart: 'Une scène', contexte: { lieu, ambiance: '', dateChronique: '', objectifs: '' }, createdAt: 0, updatedAt: 0 },
    messages: presents ? [{ id: 'u0', role: 'user', content: 'J’arrive.', timestamp: 0 }, { id: 'a0', role: 'assistant', content: '…', timestamp: 1 }] : [],
    memoire: { resume: '', faits: [], dernierMessageIndexMaj: 0 },
    loreEmergent: [],
    settings: { creativite: 'moyenne', longueur: 'moyenne', ton: 'sombre_realiste', violence: 'modere', romance: 'faible', humour: 'faible', liberteJoueur: 'elevee', rythme: 'normal' },
    directeur: { arcActuel: '', tension: 'calme', dernierBeatIndex: 0, beats: [] },
    monde: { zones: [], flags: {}, compteurs: {}, declencheurs: [] },
    social: { engagements: [], relations: [] },
    ...(presents ? { scene: { ville: 'Paris', lieu, presents, majMessageIndex: 2 } } : {}),
  };
}

let horloge = 50_000;
const fixe = () => ++horloge;

function jouer(story: StoryState, messages: string[]): StoryState {
  let s = story;
  for (const m of messages) s = jouerTourPrax(s, m, { maintenant: fixe }).story;
  return s;
}
const dernier = (s: StoryState) => s.messages[s.messages.length - 1];
const texte = (s: StoryState) => dernier(s).content;
const evenements = (s: StoryState) => dernier(s).praxCompteRendu!.evenements;

/** L'état Prax sauvegardé de la partie. */
function etat(s: StoryState) {
  return deserializeState(s.prax!.etat, construireMonde(s.prax!.description, graineDe(s.meta.id)));
}
function bourse(s: StoryState, qui: string): number {
  return Number(etat(s).dbChildKeys(`bourse.${qui}`)[0]);
}

// ---- le catalogue ---------------------------------------------------------------------

test('le catalogue est complet, dédoublonné, et chaque action a sa mécanique', () => {
  assert.equal(CATALOGUE.length + CATALOGUE.reduce((n, e) => n + e.fusionnees.length, 0), 616, 'les 616 actions d’origine, gardées ou fusionnées');
  assert.equal(new Set(CATALOGUE.map((e) => e.id)).size, CATALOGUE.length);
  assert.equal(new Set(CATALOGUE.map((e) => e.slug)).size, CATALOGUE.length);
  // Les doublons d'origine mènent à l'action gardée.
  assert.equal(entreeParId('furtivite.subtiliser')?.id, 'furtivite.voler');
  assert.equal(entreeParId('objets.observer_objet')?.id, 'objets.examiner_objet');
  // Une expression ne sert qu'à une seule action.
  const vues = new Map<string, string>();
  for (const e of CATALOGUE) {
    assert.ok(e.expressions.length > 0, e.id);
    for (const x of e.expressions) {
      assert.ok(!vues.has(x), `« ${x} » : ${vues.get(x)} et ${e.id}`);
      vues.set(x, e.id);
    }
    if (e.famille === 'transaction') assert.ok(e.sens, e.id);
    if (e.famille === 'objet') assert.ok(e.effetObjet, e.id);
    assert.ok(modeDe(e));
    assert.ok(['L1', 'L2', 'L3', 'L4'].includes(maturite(e)), e.id);
  }
  const c = couverture();
  assert.ok(c.expressions > 5000);
});

test('les montants se lisent en cuivres (1 or = 10 argent = 100 cuivre)', () => {
  assert.equal(lireMontant('je l’achète pour 3 pièces d’or et 5 d’argent'), 350);
  assert.equal(lireMontant('deux pièces d’argent'), 20);
  assert.equal(lireMontant('je te donne 7 cuivres'), 7);
  assert.equal(lireMontant('je paie'), undefined);
  assert.equal(formaterMontant(350), '3 pièces d’or et 5 pièces d’argent');
  assert.equal(formaterMontant(1), '1 cuivre');
});

test('la compréhension reconnaît les tournures du joueur, pronoms et conjugaisons compris', () => {
  const cas: Array<[string, string]> = [
    ['Je crochète la serrure', 'furtivite.crocheter'],
    ['je lui demande son nom', 'social.demander_nom'],
    ['je le console', 'social.consoler'],
    ['je te vends mon épée pour 3 pièces d’or', 'commerce.vendre'],
    ['je me repose un moment', 'survie.se_reposer'],
    ['je lance un sort de lumière', 'magie.lancer_sort'],
    ['je rejoins la guilde', 'guilde.rejoindre_guilde'],
  ];
  for (const [phrase, id] of cas) assert.equal(reconnaitreActe(phrase)?.entree.id, id, phrase);
  assert.equal(reconnaitreActe('Il fait beau aujourd’hui'), null);
});

// ---- le marché : offre, contre-offre, paiement exact ------------------------------------------

test('marché complet : offre trop basse, contre-offre du marchand, accord, l’argent et l’objet changent de mains', () => {
  let s = partie('Marché de Paris', ['Le marchand']);
  s = jouer(s, ['J’achète la lanterne pour 2 pièces d’argent']);
  assert.deepEqual(evenements(s)[0].acte?.issue, 'offre');
  const contre = evenements(s).find((e) => e.acteur === 'marchand');
  assert.equal(contre?.acte?.issue, 'contreOffre', JSON.stringify(evenements(s)));
  assert.equal(contre?.acte?.montant, 30, 'la lanterne vaut 3 pièces d’argent');
  assert.match(texte(s), /Pour 3 pièces d’argent, c’est d’accord/);
  assert.equal(bourse(s, ID_JOUEUR), 500, 'rien n’a encore été payé');

  s = jouer(s, ['J’accepte ta contre-offre']);
  assert.equal(evenements(s)[0].acte?.issue, 'accepteContre');
  assert.equal(bourse(s, ID_JOUEUR), 470);
  assert.equal(bourse(s, 'marchand'), 5030);
  assert.ok(etat(s).dbHas(`possede.${ID_JOUEUR}.lanterne`));
  assert.ok(evenements(s).some((e) => e.acteur === 'marchand' && e.genre === 'conclure'));

  // Revendre ce qu'on possède, au juste prix : le marchand achète.
  s = jouer(s, ['Je te vends ma lanterne pour 2 pièces d’argent']);
  assert.ok(evenements(s).some((e) => e.acteur === 'marchand' && e.acte?.issue === 'achete'), JSON.stringify(evenements(s)));
  assert.equal(bourse(s, ID_JOUEUR), 490);
  assert.ok(!etat(s).dbHas(`possede.${ID_JOUEUR}.lanterne`));
});

test('une offre sous le plancher est refusée, une bourse trop légère aussi', () => {
  let s = jouer(partie('Marché de Paris', ['Le marchand']), ['J’achète une épée pour 2 pièces d’argent']);
  assert.ok(evenements(s).some((e) => e.acteur === 'marchand' && e.acte?.issue === 'refuseOffre'), JSON.stringify(evenements(s)));
  assert.equal(bourse(s, ID_JOUEUR), 500);
  // Offrir plus qu'on n'a : le marchand le voit.
  s = jouer(s, ['J’achète une épée pour 15 pièces d’or']);
  assert.ok(evenements(s).some((e) => e.acteur === 'marchand' && e.acte?.issue === 'insolvable'), JSON.stringify(evenements(s)));
  assert.equal(bourse(s, ID_JOUEUR), 500);
  // Verser plus qu'on n'a : impossible, et Prax dit pourquoi.
  s = jouer(s, ['Je donne 9 pièces d’or au marchand']);
  assert.equal(dernier(s).praxCompteRendu!.joueur.compris, false);
  assert.match(texte(s), /Ta bourse ne suffit pas : tu as 5 pièces d’or, il en faudrait 9 pièces d’or/);
});

test('un acte au prix du lore se propose de lui-même (une chambre, une pièce d’argent la nuit)', () => {
  const s = jouer(partie('la taverne', ['Odette']), ['Je loue une chambre']);
  assert.equal(evenements(s)[0].acte?.issue, 'offre');
  assert.equal(evenements(s)[0].acte?.montant, 10);
});

// ---- objets, loi et ordre public -----------------------------------------------------------------

test('prendre le bien d’autrui devant la garde : arrestation, puis l’amende libère', () => {
  let s = jouer(partie('Marché de Paris', ['Le marchand', 'Une garde']), ['Je prends le panier']);
  assert.equal(evenements(s)[0].acte?.issue, 'objet');
  assert.ok(etat(s).dbHas(`possede.${ID_JOUEUR}.panier`));
  assert.ok(evenements(s).some((e) => e.acte?.issue === 'arrete' && e.cible === ID_JOUEUR), JSON.stringify(evenements(s)));
  assert.match(texte(s), /t’arrête au nom de la loi/);

  s = jouer(s, ['Je crochète la serrure']);
  assert.match(texte(s), /Tu es aux arrêts/);

  s = jouer(s, ['Je paie mon amende']);
  assert.equal(evenements(s)[0].acte?.issue, 'amende');
  assert.equal(bourse(s, ID_JOUEUR), 450);
  assert.ok(!etat(s).dbHas(`statut.${ID_JOUEUR}.arrete`));
});

test('poser, examiner : les objets du lieu se manipulent', () => {
  let s = jouer(partie('les rues de Paris', ['Un passant']), ['Je prends la chandelle']);
  assert.ok(etat(s).dbHas(`possede.${ID_JOUEUR}.chandelle`));
  s = jouer(s, ['J’examine la chandelle']);
  assert.equal(evenements(s)[0].acte?.issue, 'objet');
  s = jouer(s, ['Je pose la chandelle']);
  assert.ok(!etat(s).dbHas(`possede.${ID_JOUEUR}.chandelle`));
  s = jouer(s, ['Je pose la chandelle']);
  assert.match(texte(s), /Tu n’as pas la chandelle sur toi/);
});

// ---- refus motivés --------------------------------------------------------------------------

test('Prax dit pourquoi un acte est impossible : autorité, lieu, meneur de jeu', () => {
  let s = jouer(partie('Marché de Paris', ['Le marchand']), ['Je juge le marchand']);
  assert.match(texte(s), /c’est le rôle d’un juge/);
  s = jouer(s, ['Je forge une épée']);
  assert.match(texte(s), /il faut être dans un lieu adapté \(forge\)/);
  s = jouer(s, ['Plante le décor']);
  assert.match(texte(s), /relève du meneur de jeu/);
});

test('à la forge, forger se tente : le dé décide, la fatigue se paie', () => {
  let s = ouvrirAvecPrax(partie('Guilde des Aventuriers, Paris'), { maintenant: fixe });
  s = jouer(s, ['Je vais à la forge', 'Je forge une épée']);
  const e = evenements(s)[0];
  assert.equal(e.acte?.issue, 'tentative', JSON.stringify(evenements(s)));
  assert.equal(typeof e.acte?.reussi, 'boolean');
  if (e.acte?.reussi) assert.ok(etat(s).dbHas(`possede.${ID_JOUEUR}`));
});

// ---- paroles, requêtes, informations, influence ----------------------------------------------------

test('une parole touche la relation, une question obtient une réaction, une requête est accordée, monnayée ou renvoyée', () => {
  let s = jouer(partie('la taverne', ['Odette']), ['Je la console']);
  assert.equal(evenements(s)[0].acte?.issue, 'parole');
  assert.ok(evenements(s).some((e) => e.acteur !== ID_JOUEUR && ['favorable', 'froid'].includes(e.acte?.issue ?? '')), JSON.stringify(evenements(s)));
  s = jouer(s, ['Je lui demande son nom']);
  assert.equal(evenements(s)[0].acte?.issue, 'information');
  assert.ok(evenements(s).some((e) => ['renseigne', 'derobe'].includes(e.acte?.issue ?? '')));
  s = jouer(s, ['Je veux apprendre un métier']);
  assert.equal(evenements(s)[0].acte?.issue, 'requete');
  assert.ok(evenements(s).some((e) => ['condition', 'refuse', 'renvoie', 'accorde'].includes(e.acte?.issue ?? '')), JSON.stringify(evenements(s)));
});

test('les actes de la bibliothèque restent déterministes et se reprennent depuis la sauvegarde', () => {
  const msgs = ['J’achète la lanterne pour 2 pièces d’argent', 'J’accepte ta contre-offre', 'Je la console', 'Je me repose'];
  const a = jouer(partie('Marché de Paris', ['Le marchand']), msgs);
  const b = jouer(partie('Marché de Paris', ['Le marchand']), msgs);
  assert.deepEqual(a.messages.map((m) => m.content), b.messages.map((m) => m.content));
  // Pas de saisie résiduelle dans la sauvegarde.
  assert.ok(!etat(a).dbHas('saisie'));
});

test('une partie Prax sauvegardée avant la bibliothèque reprend avec ses tables et ses bourses', () => {
  const s = jouer(partie('Marché de Paris', ['Le marchand']), ['Bonjour']);
  // Sauvegarde « ancienne » : sans tables de rôles, sans bourses, sans « tous ».
  const st = etat(s);
  for (const f of ['fonction', `bourse`, `role.${ID_JOUEUR}.tous`, 'role.marchand.tous']) st.performOutcome(del(f));
  const ancienne: StoryState = { ...s, prax: { ...s.prax!, etat: serializeState(st) } };
  const suite = jouer(ancienne, ['J’achète la lanterne pour 3 pièces d’argent']);
  assert.ok(evenements(suite).some((e) => e.acteur === 'marchand' && e.acte?.issue === 'vend'), JSON.stringify(evenements(suite)));
  assert.equal(bourse(suite, ID_JOUEUR), 470);
});
