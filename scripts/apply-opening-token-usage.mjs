import fs from 'node:fs';

function lire(path) { return fs.readFileSync(path, 'utf8'); }
function ecrire(path, contenu) { fs.writeFileSync(path, contenu); }
function remplacer(contenu, ancien, nouveau, etiquette) {
  if (!contenu.includes(ancien)) throw new Error(`Patch tokens ouverture impossible (${etiquette}) : marqueur introuvable.`);
  return contenu.replace(ancien, nouveau);
}

const path = 'src/engine/openingGenerator.ts';
let s = lire(path);

s = remplacer(
  s,
  `import { ErreurProfilContenu, validerProfilContenuHeuristique } from './contenuAdulte';`,
  `import { ErreurProfilContenu, validerProfilContenuHeuristique } from './contenuAdulte';\nimport { annulerMesureTokens, commencerMesureTokens, terminerMesureTokens } from './tokenUsageTelemetry';`,
  'import télémétrie',
);

s = remplacer(
  s,
  `  const contenu = await appellerModele({`,
  `  commencerMesureTokens();\n  const contenu = await appellerModele({`,
  'début mesure ouverture',
);

s = remplacer(
  s,
  `  if (!validerProfilContenuHeuristique(contenu, appSettings.profilContenu).ok) {\n    throw new ErreurProfilContenu(`,
  `  if (!validerProfilContenuHeuristique(contenu, appSettings.profilContenu).ok) {\n    annulerMesureTokens();\n    throw new ErreurProfilContenu(`,
  'annulation ouverture invalide',
);

s = remplacer(
  s,
  `  return {\n    id: genererId(),`,
  `  const usageTokens = terminerMesureTokens();\n\n  return {\n    id: genererId(),`,
  'fin mesure ouverture',
);

s = remplacer(
  s,
  `    dureeGenerationMs: Date.now() - debutMs,\n  };`,
  `    dureeGenerationMs: Date.now() - debutMs,\n    usageTokens,\n  };`,
  'stockage usage ouverture',
);

ecrire(path, s);
console.log('Télémétrie tokens ajoutée au message automatique d’ouverture.');
