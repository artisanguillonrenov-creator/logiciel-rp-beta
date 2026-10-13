import assert from 'node:assert/strict';
import test from 'node:test';
import { contientExpression, normaliserTexte, positionExpression, racineSimple, termesTexte } from '../src/engine/texteRecherche';
import { calculerScoreHybrideLore, estExclueParClesNegatives, preparerRequeteLore, raisonsScoreLore } from '../src/engine/loreScoring';
import { classerLexical } from '../src/engine/rechercheLexicale';

test('T12 — un nom contenu dans un autre mot ne correspond pas', () => {
  assert.equal(contientExpression('je regarde la porte', 'garde'), false);
  assert.equal(contientExpression('la garde de nuit', 'garde'), true);
  assert.equal(contientExpression('un parisien pressé', 'Paris'), false);
  assert.equal(contientExpression('retour a paris sous la pluie', 'Paris'), true);
  assert.equal(contientExpression('rien', ''), false);
});

test('T02 — variations typographiques d’un même nom : même identité', () => {
  for (const variante of ['Sylvana', 'SYLVANA', 'sylvana', 'Sylvana,', '« Sylvana ! »', 'Sylvàna']) {
    assert.equal(contientExpression(`Je parle à ${variante} près du feu`, 'Sylvana'), true, variante);
  }
  assert.equal(normaliserTexte('Saint-Denis'), normaliserTexte('saint denis'));
  assert.equal(normaliserTexte("L’Elfe"), normaliserTexte("l'elfe"));
});

test('la position renvoyée est celle du premier mot entier', () => {
  assert.ok(positionExpression('le garde regarde la garde', 'garde') >= 0);
  assert.equal(positionExpression('regarder', 'garde'), -1);
});

test('pluriel simple toléré pour le lexical, jamais pour les noms propres', () => {
  assert.equal(racineSimple('marchands'), 'marchand');
  assert.equal(racineSimple('passe'), 'passe');
  assert.deepEqual(termesTexte('Les forges des nains'), ['forges', 'nains']);
  const guilde = { titre: '[GUILDE] Guilde des Marchands', contenu: 'Le marchand vend ses forges.' };
  const lexical = calculerScoreHybrideLore(guilde, 'des marchands et leurs forges').lexical;
  assert.ok(lexical > 0.5, `lexical ${lexical}`);
  // Un nom propre au singulier n'est pas confondu avec un autre mot.
  assert.equal(contientExpression('les parisiens', 'paris'), false);
});

test('clés et clés négatives s’appliquent aux mots entiers', () => {
  const fiche = { titre: '[PNJ] Le Garde', contenu: 'Un garde.', primaryKeys: ['garde'], negativeKeys: ['mort'] };
  assert.ok(calculerScoreHybrideLore(fiche, 'je regarde par la fenêtre').primary < 1);
  assert.equal(calculerScoreHybrideLore(fiche, 'je parle au garde').primary, 1);
  // « mort » ne doit pas exclure la fiche à cause de « amorti » ou « mortier ».
  assert.equal(estExclueParClesNegatives(fiche, 'un mortier amorti'), false);
  assert.equal(estExclueParClesNegatives(fiche, 'il est mort cette nuit'), true);
});

test('T03 — une guilde homonyme d’une autre ville ne remplace pas la guilde locale', () => {
  const guildeParis = { titre: '[GUILDE] Guilde des Aventuriers de Paris', contenu: 'Siège à Paris.', primaryKeys: ['guilde de paris'] };
  const guildeZurich = { titre: '[GUILDE] Guilde des Aventuriers de Zurich', contenu: 'Siège à Zurich.', primaryKeys: ['guilde de zurich'] };
  const requete = preparerRequeteLore('Je me rends à la guilde de Paris');
  const paris = calculerScoreHybrideLore(guildeParis, requete);
  const zurich = calculerScoreHybrideLore(guildeZurich, requete);
  assert.ok(paris.score > zurich.score, `${paris.score} > ${zurich.score}`);
  assert.equal(paris.primary, 1);
  assert.ok(zurich.primary < 1);
});

test('le classement lexical ne confond pas un mot avec une sous-chaîne', () => {
  const items = [
    { id: 'a', texte: 'Le garde surveille la porte de nuit.' },
    { id: 'b', texte: 'Je regarde le marché du matin.' },
  ];
  const r = classerLexical({ requete: 'garde', items, texteDe: (i) => i.texte, budget: { maxResultats: 5, maxCaracteres: 2000, maxCaracteresParResultat: 300 } });
  assert.deepEqual(r.map((x) => x.item.id), ['a']);
});

test('les raisons du score sont lisibles pour le diagnostic', () => {
  const d = calculerScoreHybrideLore({ titre: '[GUILDE] Guilde des Aventuriers', contenu: 'Guilde.', primaryKeys: ['guilde des aventuriers'] }, 'Je vais à la guilde des aventuriers');
  assert.ok(raisonsScoreLore(d).includes('nom exact') || raisonsScoreLore(d).includes('clé primaire'));
});
