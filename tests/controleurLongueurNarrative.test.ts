import assert from 'node:assert/strict';
import test from 'node:test';
import { controlerLongueurNarration } from '../src/engine/controleLongueurNarration';

const controler = (texte: string, min = 10, max = 100, compter = async (t: string): Promise<number | null> => t.length) =>
  controlerLongueurNarration({
    texte, plage: { min, max }, temperature: 0.7, compter,
  });

test('supprime la phrase coupée, sans relance du modèle, puis recompte le texte réellement conservé', async () => {
  const mesures: string[] = [];
  const sortie = await controler(
    'La porte grince. Sylvana regarde derrière',
    10, 100,
    async texte => { mesures.push(texte); return texte.length; },
  );
  assert.equal(sortie.texte, 'La porte grince.');
  assert.equal(sortie.tokens, 'La porte grince.'.length);
  assert.equal(sortie.corrige, true);
  assert.equal(mesures.at(-1), sortie.texte);
});

test('une narration trop courte avec phrase complète reste jouable', async () => {
  const sortie = await controler('La porte grince.', 100, 200);
  assert.equal(sortie.texte, 'La porte grince.');
  assert.equal(sortie.corrige, false);
  assert.equal(sortie.conforme, false);
});

test('le texte terminé proprement dans la plage reste intact', async () => {
  const texte = 'Le ciel s’assombrit. La garde se rapproche.';
  const sortie = await controler(texte, 10, 100);
  assert.equal(sortie.texte, texte);
  assert.equal(sortie.corrige, false);
  assert.equal(sortie.conforme, true);
});

test('le plafond configuré peut entraîner le retrait de la dernière phrase, même complète', async () => {
  const texte = 'La pluie tombe. Le vent souffle très fort.';
  const strict = await controler(texte, 10, 22);
  const ample = await controler(texte, 10, 100);
  assert.equal(strict.texte, 'La pluie tombe.');
  assert.equal(strict.corrige, true);
  assert.equal(strict.conforme, true);
  assert.equal(ample.texte, texte);
});

test('une citation non refermée ne devient pas une fausse fin de phrase', async () => {
  const sortie = await controler('La porte claque. KAELEN : « Tu crois vraiment.', 10, 100);
  assert.equal(sortie.texte, 'La porte claque.');
});

test('une réplique close sans point final est considérée comme achevée', async () => {
  const texte = 'KAELEN : « Entre »';
  const sortie = await controler(texte, 5, 100);
  assert.equal(sortie.texte, texte);
  assert.equal(sortie.corrige, false);
});

test('un compteur indisponible ne bloque pas et permet de retirer une fin incomplète', async () => {
  const sortie = await controler('Il entre. Elle lève les yeux vers', 10, 100,
    async () => { throw new Error('Tokeniseur indisponible'); });
  assert.equal(sortie.texte, 'Il entre.');
  assert.equal(sortie.tokens, null);
  assert.equal(sortie.verification, 'indisponible');
});

test('sans aucune phrase terminée, ne publie jamais un message vide', async () => {
  const sortie = await controler('La route devant la taverne', 10, 100);
  assert.equal(sortie.texte, 'La route devant la taverne');
  assert.equal(sortie.corrige, false);
});
