/**
 * Balayage de conformité différentielle : rejoue des parties de référence
 * produites par Prax d'origine (JSONL, éventuellement compressées en .gz) et
 * vérifie que notre moteur les reproduit à l'identique.
 *
 *   node .prax-dist/tools/prax/conformance.js                 corpus intégré (tests/fixtures/prax/reference)
 *   node .prax-dist/tools/prax/conformance.js --prax <dépôt>  + les 3006 parties de <dépôt>/conformance/oracle-baselines
 *   node .prax-dist/tools/prax/conformance.js <fichiers…>     des fichiers précis
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CompareResult, compareFile } from './compare';

function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p));
    else if (/\.jsonl(\.gz)?$/.test(e.name)) out.push(p);
  }
  return out.sort();
}

function main(args: string[]): void {
  const racine = path.join(__dirname, '..', '..', '..');
  const files: string[] = [];
  const i = args.indexOf('--prax');
  if (i >= 0) {
    files.push(...listFiles(path.join(args[i + 1], 'conformance', 'oracle-baselines')));
    args.splice(i, 2);
  }
  files.push(...args);
  if (files.length === 0 || i >= 0) files.push(...listFiles(path.join(racine, 'tests', 'fixtures', 'prax', 'reference')));
  const t0 = Date.now();
  const failures: CompareResult[] = [];
  let ok = 0;
  for (const f of files) {
    let r: CompareResult;
    try {
      r = compareFile(f);
    } catch (e) {
      r = { file: f, ok: false, records: 0, firstDivergence: { index: -1, diffs: [String(e instanceof Error ? e.stack : e)] } };
    }
    if (r.ok) ok++;
    else failures.push(r);
  }
  for (const r of failures.slice(0, 10)) console.log(`DIVERGENT ${r.file} @${r.firstDivergence?.index}\n  ${r.firstDivergence?.diffs.join('\n  ')}`);
  console.log(`conformité Prax : ${ok}/${files.length} parties identiques (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  if (failures.length > 0) process.exitCode = 1;
}

main(process.argv.slice(2));
