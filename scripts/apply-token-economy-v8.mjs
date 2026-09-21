import fs from 'node:fs';

function lire(path) { return fs.readFileSync(path, 'utf8'); }
function ecrire(path, contenu) { fs.writeFileSync(path, contenu); }
function remplacer(contenu, ancien, nouveau, etiquette) {
  if (!contenu.includes(ancien)) throw new Error(`Patch V8 économie tokens impossible (${etiquette}) : marqueur introuvable.`);
  return contenu.replace(ancien, nouveau);
}

const path = 'src/engine/generateTurn.ts';
let s = lire(path);

// 1) Le validateur local devient la voie normale. Le validateur LLM ne sert
//    plus que de secours lorsqu'un signal ambigu de retcon/contradiction est
//    détecté. Les violations déterministes (agentivité, contenu, répétition)
//    sont traitées sans appel de vérification supplémentaire.
s = remplacer(
  s,
  `  retirerRepliqueDuJoueur,\n  validerAgentiviteHeuristique,\n  validerReponseLLM,\n} from './validator';`,
  `  retirerRepliqueDuJoueur,\n  rapportOk,\n  validerAgentiviteHeuristique,\n  validerReponseLLM,\n  type RapportValidation,\n} from './validator';`,
  'imports validation locale',
);

const marqueurAvantTour = `export async function genererTour(\n`;
const helpers = `function normaliserPourComparaison(texte: string): string {\n  return texte\n    .toLowerCase()\n    .normalize('NFD')\n    .replace(/[\\u0300-\\u036f]/g, '')\n    .replace(/[^a-z0-9à-ÿ' ]+/gi, ' ')\n    .replace(/\\s+/g, ' ')\n    .trim();\n}\n\nfunction motsSignificatifs(texte: string): Set<string> {\n  const stop = new Set(['avec','dans','pour','mais','plus','comme','tout','elle','elles','leur','leurs','nous','vous','cette','ceci','cela','sans','sous','alors','encore','entre','apres','avant','vers','dont','tres','bien','fait','faire','etre','avait','sont','sera','ses','son','sur','une','des','les','que','qui','aux','par','pas']);\n  return new Set(normaliserPourComparaison(texte).split(' ').filter((mot) => mot.length >= 4 && !stop.has(mot)));\n}\n\nfunction similariteJaccard(a: string, b: string): number {\n  const A = motsSignificatifs(a);\n  const B = motsSignificatifs(b);\n  if (!A.size || !B.size) return 0;\n  let communs = 0;\n  for (const mot of A) if (B.has(mot)) communs++;\n  const union = A.size + B.size - communs;\n  return union ? communs / union : 0;\n}\n\nfunction validerRepetitionLocale(reponse: string, story: StoryState): RapportValidation {\n  const paragraphes = reponse\n    .split(/\\n{2,}/)\n    .map((p) => normaliserPourComparaison(p))\n    .filter((p) => p.length >= 45);\n  const vus = new Set<string>();\n  for (const paragraphe of paragraphes) {\n    if (vus.has(paragraphe)) {\n      return {\n        ok: false,\n        checks: [{\n          nom: 'repetition_contradiction',\n          ok: false,\n          gravite: 'modere',\n          raison: 'Un paragraphe est répété presque à l’identique dans la même réponse.',\n        }],\n      };\n    }\n    vus.add(paragraphe);\n  }\n\n  const derniersNarrateurs = story.messages.filter((m) => m.role === 'assistant').slice(-2);\n  for (const ancien of derniersNarrateurs) {\n    if (ancien.content.length >= 180 && reponse.length >= 180 && similariteJaccard(reponse, ancien.content) >= 0.78) {\n      return {\n        ok: false,\n        checks: [{\n          nom: 'repetition_contradiction',\n          ok: false,\n          gravite: 'modere',\n          raison: 'La nouvelle réponse répète fortement une réponse récente au lieu de faire avancer la scène.',\n        }],\n      };\n    }\n  }\n  return rapportOk();\n}\n\nfunction necessiteAuditLLM(reponse: string, story: StoryState): boolean {\n  // Signaux rares de retcon ou de changement rétroactif : dans ces cas, le\n  // contrôle sémantique LLM reste utile. Tout le reste reste local/gratuit.\n  if (story.memoire.faits.length === 0) return false;\n  const texte = normaliserPourComparaison(reponse);\n  const motifsRetcon = [\n    'en realite il n avait jamais',\n    'en realite elle n avait jamais',\n    'contrairement a ce qui avait ete etabli',\n    'revenu d entre les morts',\n    'revenue d entre les morts',\n    'n etait finalement pas mort',\n    'n etait finalement pas morte',\n    'tout ce qui precedait etait une illusion',\n  ];\n  return motifsRetcon.some((motif) => texte.includes(motif));\n}\n\n`;
s = remplacer(s, marqueurAvantTour, helpers + marqueurAvantTour, 'helpers validation locale');

s = remplacer(
  s,
  `  const heuristique = validerAgentiviteHeuristique(reponse, storyCourante.meta.personnageNom);\n  const profilContenuCheck = validerProfilContenuHeuristique(reponse, appSettings.profilContenu);\n  const llm = await validerReponseLLM({\n    ...configurationLLM(appSettings, modelePourAppel),\n    reponse,\n    faits: ctxBase.faits,\n    meta: ctxBase.meta,\n  });\n  const rapport = fusionnerRapports(heuristique, profilContenuCheck, llm);`,
  `  const heuristique = validerAgentiviteHeuristique(reponse, storyCourante.meta.personnageNom);\n  const profilContenuCheck = validerProfilContenuHeuristique(reponse, appSettings.profilContenu);\n  const repetitionLocale = validerRepetitionLocale(reponse, storyCourante);\n  const rapportLocal = fusionnerRapports(heuristique, profilContenuCheck, repetitionLocale);\n\n  // V8 : 1 seul appel IA par tour dans le cas normal. Le second appel de\n  // validation n'est lancé que pour un signal sémantique rare que les\n  // contrôles déterministes ne peuvent pas trancher correctement.\n  const llm = rapportLocal.ok && necessiteAuditLLM(reponse, storyCourante)\n    ? await validerReponseLLM({\n        ...configurationLLM(appSettings, modelePourAppel),\n        reponse,\n        faits: ctxBase.faits,\n        meta: ctxBase.meta,\n      })\n    : rapportOk();\n  const rapport = fusionnerRapports(rapportLocal, llm);`,
  'validation LLM conditionnelle',
);

ecrire(path, s);

// 2) Version visible.
{
  const versionPath = 'src/version.ts';
  let v = lire(versionPath);
  v = v.replace(/VERSION_APP = '[^']+'/, "VERSION_APP = '1.32.0-token-economy-beta'");
  ecrire(versionPath, v);
}

console.log('V8 : validation locale prioritaire et audit LLM uniquement en secours.');
