import assert from 'node:assert/strict';
import test from 'node:test';
import { analyserCheminImageGeree, rattachementImageLocal } from '../src/storage/imagePreviewPaths';

test('images : uniquement les PNG des deux dossiers Elyndor ouvrables', () => {
  assert.deepEqual(analyserCheminImageGeree('interne/files/scene-images/story123_rev42.png'),
    { dossier: 'scene-images', nom: 'story123_rev42.png' });
  assert.deepEqual(analyserCheminImageGeree('interne/files/pnj-avatars/story123_pnj-3.PNG'),
    { dossier: 'pnj-avatars', nom: 'story123_pnj-3.PNG' });
  for (const invalide of [
    '', 'interne/files/diagnostics/a.jsonl', 'externe/files/scene-images/a.png',
    'interne/files/scene-images/../a.png', 'interne/files/scene-images/a.jpg',
    'interne/files/scene-images/dossier/a.png', 'interne/files/scene-images/a%2Fb.png',
    'interne/files/scene-images/../../databases/elyndor.png',
    'interne/files/pnj-avatars/a.png?x=y',
  ]) assert.equal(analyserCheminImageGeree(invalide), null, invalide);
});

test('images : le marquage orphelin compare les préfixes exacts des histoires locales', () => {
  assert.equal(rattachementImageLocal('abc123_rev1.png', ['abc123']), 'histoire_presente');
  assert.equal(rattachementImageLocal('abc123_pnj9.png', ['abc123']), 'histoire_presente');
  assert.equal(rattachementImageLocal('abc1234_rev1.png', ['abc123']), 'histoire_introuvable');
  assert.equal(rattachementImageLocal('ancien_rev1.png', ['nouveau']), 'histoire_introuvable');
  assert.equal(rattachementImageLocal('histoire_1_portrait.png', ['histoire:1']), 'histoire_presente');
  assert.equal(rattachementImageLocal('sans_histoire.png', []), 'histoire_introuvable');
});
