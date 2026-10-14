/**
 * La vie intime adulte dans le narrateur Prax : réglages, majorité, liberté,
 * accord du PNJ décidé par ses jauges, retrait, récit sans détail.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { deserializeState } from '../src/prax/core/persist';
import { majeurEtabli, niveauIntime, NiveauIntime } from '../src/engine/praxNarrateur/intime';
import { construireMonde, graineDe } from '../src/engine/praxNarrateur/monde';
import { jouerTourPrax, ouvrirAvecPrax } from '../src/engine/praxNarrateur/tour';
import { ID_JOUEUR } from '../src/engine/praxNarrateur/types';
import type { RelationPersonnage, StoryState } from '../src/types';

function partie(relations: RelationPersonnage[] = []): StoryState {
  return {
    version: 12,
    meta: { id: 'histoire-intime', personnageNom: 'Arwen', personnageDescription: '', pointDeDepart: 'Réception d’un contrat à la Guilde des Aventuriers', contexte: { lieu: 'Guilde des Aventuriers, Paris', ambiance: '', dateChronique: '', objectifs: '' }, createdAt: 0, updatedAt: 0 },
    messages: [],
    memoire: { resume: '', faits: [], dernierMessageIndexMaj: 0 },
    loreEmergent: [],
    settings: { creativite: 'moyenne', longueur: 'moyenne', ton: 'sombre_realiste', violence: 'modere', romance: 'eleve', humour: 'faible', liberteJoueur: 'elevee', rythme: 'normal' },
    directeur: { arcActuel: '', tension: 'calme', dernierBeatIndex: 0, beats: [] },
    monde: { zones: [], flags: {}, compteurs: {}, declencheurs: [] },
    social: { engagements: [], relations },
  };
}

const proche = (nom: string, affection: number, confiance: number, peur = 0): RelationPersonnage => ({ id: nom, nom, confiance, respect: 0, peur, affection, hostilite: 0 });

let horloge = 90_000;
const fixe = () => ++horloge;

function jouer(story: StoryState, messages: string[], intime: NiveauIntime = 'complet'): StoryState {
  let s = story;
  for (const m of messages) s = jouerTourPrax(s, m, { maintenant: fixe, intime }).story;
  return s;
}
const dernier = (s: StoryState) => s.messages[s.messages.length - 1];
const evenements = (s: StoryState) => dernier(s).praxCompteRendu!.evenements;
const etat = (s: StoryState) => deserializeState(s.prax!.etat, construireMonde(s.prax!.description, graineDe(s.meta.id)));

/** À la taverne, face à Odette Vinchamps, la tavernière (rôle officiel : majeure). */
function aLaTaverne(relations: RelationPersonnage[] = [], intime: NiveauIntime = 'complet'): StoryState {
  return jouer(ouvrirAvecPrax(partie(relations), { maintenant: fixe }), ['Je vais à la taverne'], intime);
}

test('les réglages décident : rien en grand public ni sans romance, la tendresse seule au niveau faible', () => {
  assert.equal(niveauIntime('grand_public', 'eleve'), 'aucun');
  assert.equal(niveauIntime(undefined, 'eleve'), 'aucun');
  assert.equal(niveauIntime('adulte', 'aucun'), 'aucun');
  assert.equal(niveauIntime('adulte', 'faible'), 'tendresse');
  assert.equal(niveauIntime('adulte', 'eleve'), 'complet');

  let s = jouer(aLaTaverne([], 'aucun'), ['Je t’embrasse'], 'aucun');
  assert.equal(dernier(s).praxCompteRendu!.joueur.compris, false);
  assert.match(dernier(s).content, /désactivées pour ce profil de contenu/);

  s = jouer(aLaTaverne([proche('Odette Vinchamps', 3, 3)], 'tendresse'), ['Je voudrais faire l’amour avec toi'], 'tendresse');
  assert.match(dernier(s).content, /dépasse le niveau de romance/);
});

test('sans affection suffisante, la tavernière refuse ; sa décision est respectée et le refus tient', () => {
  let s = jouer(aLaTaverne(), ['Je t’embrasse']);
  assert.equal(evenements(s)[0].genre, 'intime');
  assert.equal(evenements(s)[0].intime?.phase, 'proposer');
  assert.ok(evenements(s).some((e) => e.acteur === 'odette' && e.intime?.phase === 'refuser'), JSON.stringify(evenements(s)));
  assert.match(dernier(s).content, /refuse\. Sa décision est respectée\./);
  s = jouer(s, ['Je t’embrasse']);
  assert.match(dernier(s).content, /a déjà refusé ; sa décision est respectée/);
});

test('avec de l’affection, elle accepte ; on commence ; puis le joueur retire son accord et tout s’arrête', () => {
  let s = jouer(aLaTaverne([proche('Odette Vinchamps', 3, 2)]), ['Je t’embrasse']);
  assert.ok(evenements(s).some((e) => e.acteur === 'odette' && e.intime?.phase === 'accepter'), JSON.stringify(evenements(s)));
  assert.ok(!etat(s).dbHas(`praxAdult.active.${ID_JOUEUR}.odette.kiss`), 'accepter n’est pas commencer');
  s = jouer(s, ['On commence']);
  assert.equal(evenements(s)[0].intime?.phase, 'commencer');
  assert.match(dernier(s).content, /Le détail vous appartient/);
  assert.ok(etat(s).dbHas(`praxAdult.active.${ID_JOUEUR}.odette.kiss`));
  s = jouer(s, ['Stop, je ne veux plus']);
  assert.equal(evenements(s)[0].intime?.phase, 'retirer');
  assert.ok(!etat(s).dbHas(`praxAdult.active.${ID_JOUEUR}.odette.kiss`));
  assert.ok(!etat(s).dbHas('praxAdult.agree.odette.joueur.kiss'));
});

test('la peur rend tout accord impossible : sous la contrainte, la proposition est refusée d’emblée', () => {
  const s = jouer(aLaTaverne([proche('Odette Vinchamps', 3, 3, 2)]), ['Je t’embrasse']);
  assert.equal(dernier(s).praxCompteRendu!.joueur.compris, false, dernier(s).content);
  assert.match(dernier(s).content, /un accord sous la contrainte n’en est pas un/);
});

test('majorité : établie pour un rôle officiel ou un adulte nommé, jamais devinée, jamais pour un enfant ou un captif', () => {
  const p = (nom: string, role: 'habitant' | 'taverniere' | 'captif') => ({ id: 'x', nom, role, lieu: 'l', sujets: [] });
  assert.equal(majeurEtabli(p('Odette Vinchamps', 'taverniere')), true);
  assert.equal(majeurEtabli(p('Une femme au comptoir', 'habitant')), true);
  assert.equal(majeurEtabli(p('Lise', 'habitant')), false, 'un simple prénom ne dit pas l’âge');
  assert.equal(majeurEtabli(p('Une petite fille', 'habitant')), false);
  assert.equal(majeurEtabli(p('La noble captive', 'captif')), false);
});

test('partir lève les propositions et accords en cours : rien ne reprend sans nouvel accord', () => {
  let s = jouer(aLaTaverne([proche('Odette Vinchamps', 3, 2)]), ['Je t’embrasse']);
  assert.ok(etat(s).dbHas('praxAdult.agree.odette.joueur.kiss'));
  s = jouer(s, ['Je vais à la forge']);
  assert.ok(!etat(s).dbHas('praxAdult.agree.odette.joueur.kiss'));
  assert.ok(!etat(s).dbHas(`praxAdult.agree.${ID_JOUEUR}.odette.kiss`));
});

test('un PNJ ne prend jamais l’initiative, et une hypothèse reste une parole', () => {
  let s = jouer(aLaTaverne([proche('Odette Vinchamps', 3, 3)]), ['continue', 'continue', 'continue']);
  for (const m of s.messages) for (const e of m.praxCompteRendu?.evenements ?? []) assert.ok(!(e.acteur !== ID_JOUEUR && e.intime?.phase === 'proposer'), JSON.stringify(e));
  assert.equal(etat(s).dbChildKeys('praxAdult.offer.odette').length, 0);
  s = jouer(s, ['Si je t’embrassais, que dirais-tu ?']);
  assert.notEqual(dernier(s).praxCompteRendu!.evenements[0].genre, 'intime');
  assert.equal(etat(s).dbChildKeys(`praxAdult.offer.${ID_JOUEUR}`).length, 0);
});
