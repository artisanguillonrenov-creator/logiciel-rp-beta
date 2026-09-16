import assert from 'node:assert/strict';
import test from 'node:test';
import { indexerLocuteurs } from '../src/engine/speakerIndex';
import { analyserMessage } from '../src/engine/messageFormatter';

test('le nom complet et le prénom unique reconnaissent le même locuteur', () => {
  const pnj = { id: 's', titre: 'Sylvana Salvatore' };
  const index = indexerLocuteurs([pnj]);
  assert.equal(index.get('sylvana'), pnj);
  assert.equal(index.get('sylvana salvatore'), pnj);
  assert.equal(index.get('marchand'), undefined);
});

test('un prénom ambigu n’attribue pas le portrait d’un autre personnage', () => {
  const index = indexerLocuteurs([{ id: 'a', titre: 'Kaelen Doré' }, { id: 'b', titre: 'Kaelen Sombre' }]);
  assert.equal(index.get('kaelen'), undefined);
  assert.equal(index.get('kaelen doré')?.id, 'a');
  assert.equal(index.get('kaelen sombre')?.id, 'b');
});

test('une simple mention dans la narration reste de la narration, pas un locuteur', () => {
  const segments = analyserMessage('*Sylvana observe William.*\nSYLVANA : « Reviens. »\n*Il hoche la tête.*');
  assert.equal(segments.filter((s) => s.type === 'repliquePersonnage').length, 1);
  assert.equal(segments.find((s) => s.type === 'repliquePersonnage')?.locuteur, 'SYLVANA');
  assert.equal(segments[0].type, 'action');
});
