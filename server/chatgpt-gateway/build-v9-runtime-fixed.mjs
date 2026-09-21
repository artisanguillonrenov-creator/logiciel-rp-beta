import fs from 'node:fs';

const sourcePath = new URL('./build-v9-runtime.mjs', import.meta.url);
const tempPath = new URL('./build-v9-runtime-exec.mjs', import.meta.url);
let source = fs.readFileSync(sourcePath, 'utf8');

const lignes = source.split('\n');
let corrige = false;
for (let i = 0; i < lignes.length; i++) {
  if (lignes[i].includes('Détail :') && lignes[i].includes('throw new Error')) {
    lignes[i] = "      throw new Error('ChatGPT a terminé sans fichier image exploitable.' + (texteAgent.trim() ? ' Détail : ' + texteAgent.trim().slice(0, 300) : ''));";
    corrige = true;
  }
}
if (!corrige) throw new Error('Ligne de correction du runtime V9 introuvable.');

fs.writeFileSync(tempPath, lignes.join('\n'));
try {
  await import(tempPath.href + `?v=${Date.now()}`);
} finally {
  try { fs.unlinkSync(tempPath); } catch {}
}
