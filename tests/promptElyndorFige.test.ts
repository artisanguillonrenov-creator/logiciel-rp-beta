import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { instantaneElyndor } from './promptElyndorTours';

// Chantier multi-mondes : le prompt système d'Elyndor doit rester identique,
// octet pour octet, à celui d'avant le chantier. L'instantané de référence a
// été produit avant toute modification (phase 0). Pour le régénérer après un
// changement VOULU du prompt : MAJ_INSTANTANES=1 npm test.
const FICHIER = path.resolve(__dirname, '../../tests/fixtures/promptElyndor.json');

test('le prompt système d’Elyndor est identique à l’instantané d’avant le chantier multi-mondes', () => {
  const actuel = instantaneElyndor();
  if (process.env.MAJ_INSTANTANES === '1' || !fs.existsSync(FICHIER)) {
    fs.mkdirSync(path.dirname(FICHIER), { recursive: true });
    fs.writeFileSync(FICHIER, `${JSON.stringify(actuel, null, 2)}\n`, 'utf8');
  }
  const reference = JSON.parse(fs.readFileSync(FICHIER, 'utf8')) as Record<string, string>;
  assert.deepEqual(Object.keys(actuel), Object.keys(reference));
  for (const cle of Object.keys(reference)) assert.equal(actuel[cle], reference[cle], `prompt « ${cle} » modifié`);
});

test('les tours types d’Elyndor contiennent bien le Lore Core, le titre du lore et des rôles canon', () => {
  const actuel = instantaneElyndor();
  for (const cle of ['guilde-paris', 'taverne-tokyo', 'forge-historique', 'adulte-istanbul']) {
    assert.match(actuel[cle], /\[LORE CORE — CANON GARANTI\]/);
    assert.match(actuel[cle], /\[LORE ELYNDOR PERTINENT\]/);
  }
  assert.match(actuel['guilde-paris'], /Rôles fixés par le lore pour cette scène/);
});
