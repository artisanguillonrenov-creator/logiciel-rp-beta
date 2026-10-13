import assert from 'node:assert/strict';
import test from 'node:test';
import { contientExpression, distanceEdition, racineFrancaise } from '../src/engine/texteRecherche';
import { calculerScoreHybrideLore, preparerRequeteLore, raisonsScoreLore, statsCorpusLore } from '../src/engine/loreScoring';
import { classerLexical } from '../src/engine/rechercheLexicale';
import { extraireAncresDetaillees, type ElyndorEntryChargee } from '../src/engine/loreLoader';
import { resoudreEntitesScene } from '../src/engine/entitesScene';
import {
  definirSynonymesPersonnalises,
  ecrireGroupesSynonymes,
  lireGroupesSynonymes,
  synonymesDe,
  validerGroupesSynonymes,
} from '../src/engine/synonymesLexicaux';

const fiche = (id: string, titre: string, extra: Partial<ElyndorEntryChargee> = {}): ElyndorEntryChargee => ({
  id, titre, contenu: `${titre}. Description de la fiche ${id}.`, motsClesNegatifs: [], priority: 50, constant: false,
  category: 'Personnage', scope: 'CHARACTER', ...extra,
});

const budget = { maxResultats: 5, maxCaracteres: 5000, maxCaracteresParResultat: 400 };

test('racines françaises : formes d’un même mot rapprochées, noms propres intacts', () => {
  const memes = [
    ['chevaux', 'cheval'], ['forgeronne', 'forgeron'], ['forgerons', 'forgeron'], ['combattait', 'combat'],
    ['gardait', 'garde'], ['gardee', 'gardes'], ['princesse', 'prince'], ['maitresse', 'maitre'], ['guerriere', 'guerrier'],
  ];
  for (const [a, b] of memes) assert.equal(racineFrancaise(a), racineFrancaise(b), `${a} / ${b}`);
  assert.notEqual(racineFrancaise('marchand'), racineFrancaise('marchant'));
  // Mots courts et nombres : intacts.
  assert.equal(racineFrancaise('roi'), 'roi');
  assert.equal(racineFrancaise('1200'), '1200');
  // Les noms se comparent toujours mot pour mot.
  assert.equal(contientExpression('les parisiens', 'paris'), false);
  // Effet sur le lore : « forgeronne » retrouve la fiche du forgeron.
  const forge = { titre: '[PNJ] Bram', contenu: 'Bram est le forgeron du quartier, il combat parfois.' };
  assert.ok(calculerScoreHybrideLore(forge, 'la forgeronne qui combattait').lexical >= 0.99);
});

test('distance d’édition : fautes, inversions et plafond', () => {
  assert.equal(distanceEdition('seraphin', 'seraphine'), 1);
  assert.equal(distanceEdition('sylvanna', 'sylvana'), 1);
  assert.equal(distanceEdition('slyvana', 'sylvana'), 1, 'inversion de deux lettres');
  assert.equal(distanceEdition('kael', 'kael'), 0);
  assert.equal(distanceEdition('marchand', 'sylvana', 2), 3, 'arrêt au-delà du plafond');
});

test('nom mal écrit par le joueur : la fiche canonique est reconnue (P0), avec la raison', () => {
  const pool = [
    fiche('ser', '[PNJ] Séraphine Duvall', { primaryKeys: ['Séraphine Duvall', 'Séraphine'], contenu: 'Maîtresse de la guilde, chignon brun, corsage de cuir noir.' }),
    fiche('syl', '[PNJ] Sylvana', { primaryKeys: ['Sylvana'], contenu: 'Elfe noire, rôdeuse.' }),
    fiche('kai', '[PNJ] Kai', { primaryKeys: ['Kai'] }),
  ];
  const res = resoudreEntitesScene({ pool, messageJoueur: 'Je vais voir Seraphin et Sylvanna à la guilde', fichesIntention: [], memoire: [], presents: [] });
  assert.ok(res.ancresP0.has('ser'));
  assert.ok(res.ancresP0.has('syl'));
  assert.match(res.raisons.get('ser') ?? '', /nom proche : « seraphin » lu « seraphine »/);
  assert.deepEqual(res.approches.map((a) => a.ecrit).sort(), ['seraphin', 'sylvanna']);
  // Un nom de moins de cinq lettres n'est jamais approché (« Kay » ≠ Kai).
  assert.equal(resoudreEntitesScene({ pool, messageJoueur: 'Je parle à Kay', fichesIntention: [], memoire: [], presents: [] }).ancresP0.has('kai'), false);
  // Écrit correctement : ancre exacte, sans mention de faute.
  const exacte = resoudreEntitesScene({ pool, messageJoueur: 'Je vais voir Séraphine', fichesIntention: [], memoire: [], presents: [] });
  assert.match(exacte.raisons.get('ser') ?? '', /^nom cité/);
  assert.deepEqual(exacte.approches, []);
});

test('tolérance limitée : un mot courant du lore n’est jamais pris pour un nom, le texte du narrateur reste exact', () => {
  const pool = [
    fiche('porta', '[VILLE] Porta', { scope: 'CITY', category: 'Ville', primaryKeys: ['Porta'], contenu: 'Porta, cité marchande. On franchit sa porte nord à l’aube.' }),
    fiche('ser', '[PNJ] Séraphine Duvall', { primaryKeys: ['Séraphine'] }),
  ];
  assert.equal(resoudreEntitesScene({ pool, messageJoueur: 'Je pousse la porte', fichesIntention: [], memoire: [], presents: [] }).ancresP0.has('porta'), false);
  // Une faute dans la réponse du narrateur ne crée pas d'ancre : seul le message du joueur est toléré.
  const narrateur = resoudreEntitesScene({ pool, messageJoueur: 'Je regarde autour de moi', derniereReponse: 'Seraphin vous observe.', fichesIntention: [], memoire: [], presents: [] });
  assert.equal(narrateur.ancresP0.has('ser'), false);
  // Sans l'option, l'extraction reste exacte.
  assert.deepEqual(extraireAncresDetaillees('voir Seraphin', pool), []);
});

test('synonymes : « auberge » trouve la taverne, moins fort qu’un mot exact', () => {
  const taverne = { titre: '[LIEU] Taverne du Corbeau', contenu: 'Une taverne enfumée au bord de la route.' };
  const parSynonyme = calculerScoreHybrideLore(taverne, 'je cherche une auberge pour la nuit');
  const exact = calculerScoreHybrideLore(taverne, 'je cherche une taverne pour la nuit');
  assert.ok(parSynonyme.lexical > 0);
  assert.equal(parSynonyme.synonymes, 1);
  assert.ok(raisonsScoreLore(parSynonyme).some((r) => r.startsWith('synonyme')));
  assert.ok(exact.lexical > parSynonyme.lexical);
  // Le classement lexical (mémoire, souvenirs) suit la même règle.
  const r = classerLexical({ requete: 'auberge', items: [{ t: 'Nuit passée à la taverne du port.' }, { t: 'Le marché du matin.' }], texteDe: (i) => i.t, budget });
  assert.deepEqual(r.map((x) => x.item.t), ['Nuit passée à la taverne du port.']);
});

test('synonymes personnalisés de l’Atelier : lus, validés et appliqués', () => {
  try {
    const groupes = lireGroupesSynonymes('cachette, planque\n\nrepaire ; tanière');
    assert.deepEqual(groupes, [['cachette', 'planque'], ['repaire', 'tanière']]);
    assert.equal(ecrireGroupesSynonymes(groupes), 'cachette, planque\nrepaire, tanière');
    definirSynonymesPersonnalises(groupes);
    assert.ok(synonymesDe(racineFrancaise('planque')).has(racineFrancaise('cachette')));
    const fichePlanque = { titre: '[LIEU] Cave', contenu: 'Une planque sous la boulangerie.' };
    assert.equal(calculerScoreHybrideLore(fichePlanque, 'ma cachette secrète').synonymes, 1);
    assert.throws(() => validerGroupesSynonymes([Array.from({ length: 13 }, (_, i) => `mot${i}`)]), /au plus 12/);
  } finally {
    definirSynonymesPersonnalises([]);
  }
});

test('BM25 : un mot répété ou un texte très long n’écrasent pas un texte court et précis', () => {
  const precis = { id: 'precis', t: 'La clé d’argent est cachée sous l’autel du temple.' };
  const bavard = { id: 'bavard', t: `${'clé clé clé clé clé clé clé clé clé clé. '.repeat(3)}${'Le vent souffle sur la plaine, les nuages passent. '.repeat(30)}` };
  const long = { id: 'long', t: `${'Le marché déborde de monde, les étals ploient sous les fruits. '.repeat(25)} Quelque part, une clé d’argent.` };
  const r = classerLexical({ requete: 'clé argent autel', items: [bavard, long, precis], texteDe: (i) => i.t, budget });
  assert.equal(r[0].item.id, 'precis');
  const r2 = classerLexical({ requete: 'clé argent', items: [long, precis], texteDe: (i) => i.t, budget });
  assert.equal(r2[0].item.id, 'precis', 'à mots égaux, le texte court passe devant');
});

test('rareté des mots dans le lore (IDF) : le mot rare de la question fait la différence', () => {
  const passages = [
    { titre: 'A', contenu: 'Le marché de Paris, ses étals et ses ruelles.' },
    { titre: 'B', contenu: 'Le marché aux poissons près du port.' },
    { titre: 'C', contenu: 'Une clé de bronze perdue au marché.' },
    { titre: 'D', contenu: 'Le marché couvert des tisserands.' },
  ];
  const stats = statsCorpusLore(passages);
  const requete = preparerRequeteLore('je cherche ma clé au marché');
  const [a, , c] = passages.map((p) => calculerScoreHybrideLore(p, requete, undefined, stats));
  assert.ok(c.lexical > a.lexical * 2, `${c.lexical} vs ${a.lexical}`);
  // Sans statistiques, comportement historique : chaque mot compte pareil.
  assert.equal(calculerScoreHybrideLore(passages[0], requete).lexical, 1 / 3);
});

test('proximité : des mots côte à côte valent plus que des mots éparpillés', () => {
  const colles = { titre: '[GUILDE] Siège', contenu: 'Le siège de la Guilde des Aventuriers se dresse sur la place.' };
  const eparpilles = { titre: '[LIEU] Place', contenu: 'Une ancienne guilde de tanneurs occupait la place. Bien plus tard, des marchands et quelques voyageurs, parfois des aventuriers, y firent halte.' };
  const requete = preparerRequeteLore('je vais à la guilde des aventuriers');
  const a = calculerScoreHybrideLore(colles, requete);
  const b = calculerScoreHybrideLore(eparpilles, requete);
  assert.equal(a.proximite, 1);
  assert.equal(b.proximite, 0);
  assert.ok(a.score > b.score);
  assert.ok(raisonsScoreLore(a).includes('mots proches'));
  const r = classerLexical({ requete: 'guilde des aventuriers', items: [{ t: eparpilles.contenu }, { t: colles.contenu }], texteDe: (i) => i.t, budget });
  assert.equal(r[0].item.t, colles.contenu);
});
