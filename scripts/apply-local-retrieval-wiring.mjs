import fs from 'node:fs';

function lire(path) { return fs.readFileSync(path, 'utf8'); }
function ecrire(path, contenu) { fs.writeFileSync(path, contenu); }
function remplacer(contenu, ancien, nouveau, etiquette) {
  if (!contenu.includes(ancien)) throw new Error(`Patch recherche locale impossible (${etiquette}) : marqueur introuvable.`);
  return contenu.replace(ancien, nouveau);
}

{
  const path = 'src/engine/generateTurn.ts';
  let s = lire(path);

  s = remplacer(
    s,
    `} from './searchHistorique';\nimport {\n  ENTREES_ADULTE_UNIQUEMENT,`,
    `} from './searchHistorique';\nimport { searchHistoryLocal } from './narrative/historySearchEngine';\nimport { searchLoreLocal, loreHitsAsEntries } from './narrative/loreSearchEngine';\nimport {\n  ENTREES_ADULTE_UNIQUEMENT,`,
    'imports moteurs locaux',
  );

  s = remplacer(
    s,
    `  if (!embeddingsDisponibles(appSettings)) {\n    return {\n      metamoteursSelectionnes: [],\n      loreElyndor: [],\n      souvenirs: [],\n      debugLore: { metamoteurs: [], loreElyndor: [], souvenirs: [] },\n    };\n  }`,
    `  if (!embeddingsDisponibles(appSettings)) {\n    // Narrative OS : fallback 100 % local, sans embeddings ni appel réseau.\n    // On recherche dans tout le lore autorisé et dans l'historique ancien,\n    // puis on n'injecte que quelques extraits courts et pertinents.\n    const loreHits = searchLoreLocal(poolElyndor, texteRequete);\n    const historyHits = searchHistoryLocal(messagesAnciens, texteRequete, 0);\n    const loreElyndor = loreHitsAsEntries(loreHits);\n    const souvenirs: Souvenir[] = historyHits.map((hit) => ({\n      message: hit.message as Message,\n      score: hit.score,\n    }));\n\n    return {\n      metamoteursSelectionnes: [],\n      loreElyndor,\n      souvenirs,\n      debugLore: {\n        metamoteurs: [],\n        loreElyndor: loreHits.map((hit) => formaterDebug(hit.entry.titre, hit.score)),\n        souvenirs: formaterSouvenirsDebug(souvenirs),\n      },\n    };\n  }`,
    'fallback local sans embeddings',
  );

  ecrire(path, s);
}

{
  const path = 'src/version.ts';
  let s = lire(path);
  s = s.replace(/VERSION_APP = '[^']+'/, "VERSION_APP = '1.30.0-local-retrieval-beta'");
  ecrire(path, s);
}

console.log('Recherche locale History/Lore raccordée au flux RP.');
