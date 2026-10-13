/**
 * Conformité différentielle de notre Prax : chaque partie de référence du
 * corpus intégré (produite par le Prax d'origine — Rust/Haskell, BSD-3-Clause)
 * est rejouée par notre moteur et doit être reproduite À L'IDENTIQUE :
 * acteurs, actions, candidates dans l'ordre natif, faits de base et vue
 * fermée, calendrier, expirations, dé, et — pour les traces « localisées » —
 * notes du planificateur au bit près, intentions, identités, journaux.
 *
 * Les traces les plus coûteuses (planificateur du village) ne sont rejouées que
 * si PRAX_LONG=1 (ou via `npm run prax:conformance`).
 */
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { compareFile } from '../tools/prax/compare';

const RACINE = process.env.PRAX_RACINE ?? join(__dirname, '..', '..');
const DOSSIER = join(RACINE, 'tests', 'fixtures', 'prax', 'reference');
const LONGUES = new Set(['base-village-trace.jsonl.gz', 'gen-trace-village-12-all.jsonl.gz', 'gen-trace-village-12-loc.jsonl.gz']);

for (const nom of readdirSync(DOSSIER).sort()) {
  const longue = LONGUES.has(nom);
  test(`référence ${nom}`, { skip: longue && process.env.PRAX_LONG !== '1' ? 'trace longue : PRAX_LONG=1' : false }, () => {
    const r = compareFile(join(DOSSIER, nom));
    assert.ok(r.ok, `divergence @${r.firstDivergence?.index} :\n${r.firstDivergence?.diffs.join('\n')}`);
  });
}
