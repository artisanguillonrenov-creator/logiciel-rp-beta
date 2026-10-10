'use strict';
// Fabrique un instantané de SOURCES TEXTE à partir des fichiers du dépôt checkout.
// Aucun accès réseau et aucune copie de données personnelles de l'appareil.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const racine = path.resolve(__dirname, '../..');
const destination = path.join(racine, 'src/lab/sourceSnapshot.generated.ts');
const extensions = new Set(['.ts','.tsx','.js','.jsx','.cjs','.mjs','.json','.md','.yml','.yaml','.sh','.py','.kt','.java','.gradle','.xml','.properties','.jinja']);
const ignoreDirs = new Set(['node_modules','.git','.expo','.test-dist','dist','build','artifacts','coverage','.gradle','.next']);
const secretFile = /(^|\/)(\.env($|\.)|id_rsa$|[^/]*\.(pem|p12|pfx|jks|keystore|key)$|secrets?\.json$|credentials?\.json$)/i;
const texte = {};
const binaires = [];
function parcourir(repertoire) {
  for (const entree of fs.readdirSync(repertoire, { withFileTypes:true })) {
    const fichier = path.join(repertoire, entree.name);
    const relatif = path.relative(racine, fichier).replace(/\\/g,'/');
    if (entree.isDirectory()) {
      if (!ignoreDirs.has(entree.name)) parcourir(fichier);
      continue;
    }
    if (!entree.isFile() || relatif === 'src/lab/sourceSnapshot.generated.ts' || secretFile.test(relatif)) continue;
    const extension = path.extname(entree.name).toLowerCase();
    if (extensions.has(extension) || ['.gitignore','.nojekyll','Dockerfile','LICENSE'].includes(entree.name)) {
      const taille = fs.statSync(fichier).size;
      if (taille > 2 * 1024 * 1024) throw new Error('Fichier source trop grand pour l instantané : ' + relatif);
      texte[relatif] = fs.readFileSync(fichier, 'utf8');
    } else if (!relatif.startsWith('.github/') && !relatif.startsWith('art-direction-concepts/')) {
      binaires.push(relatif);
    }
  }
}
parcourir(racine);
let reference = 'copie-locale';
try { reference = execFileSync('git',['rev-parse','HEAD'], { cwd:racine,encoding:'utf8' }).trim(); } catch {}
const sortie = [
  '// Fichier généré par tools/elyndorLab/prepare-sources.cjs. Ne pas éditer.',
  'export const SOURCES_EMBARQUEES: Record<string, string> = ' + JSON.stringify(texte) + ';',
  'export const FICHIERS_BINAIRES_NON_EMBARQUES: string[] = ' + JSON.stringify(binaires.sort()) + ';',
  'export const SOURCE_REFERENCE = ' + JSON.stringify(reference) + ';',
  ''
].join('\n');
fs.mkdirSync(path.dirname(destination), {recursive:true});
fs.writeFileSync(destination, sortie, 'utf8');
console.log('Elyndor Lab : ' + Object.keys(texte).length + ' sources texte embarquées ; ' + binaires.length + ' fichiers binaires référencés.');
