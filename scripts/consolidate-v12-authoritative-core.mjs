import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceOnce(source, from, to, label) {
  const first = source.indexOf(from);
  if (first < 0) throw new Error(`Patch introuvable: ${label}`);
  if (source.indexOf(from, first + from.length) >= 0) throw new Error(`Patch ambigu: ${label}`);
  return source.slice(0, first) + to + source.slice(first + from.length);
}

// ---------------------------------------------------------------------------
// Types : le schéma persistant devient V12 et le core reste optionnel pour
// laisser les anciennes sauvegardes passer par la migration.
// ---------------------------------------------------------------------------
{
  const path = 'src/types/index.ts';
  let s = read(path);
  s = replaceOnce(s, 'export const VERSION_SCHEMA_HISTOIRE = 9;', 'export const VERSION_SCHEMA_HISTOIRE = 12;', 'schema histoire 9 -> 12');
  const needle = '  memoireNarrative?: MemoireNarrativeState;\n}';
  const repl = '  memoireNarrative?: MemoireNarrativeState;\n  // V12 : Event Ledger, Temporal Canon, croyances, rumeurs, réputation,\n  // dettes narratives et état BDI. Optionnel uniquement pour la migration\n  // des sauvegardes antérieures ; toute histoire chargée est normalisée.\n  narrativeCore?: unknown;\n}';
  s = replaceOnce(s, needle, repl, 'StoryState narrativeCore');
  write(path, s);
}

// ---------------------------------------------------------------------------
// Migration : reproduit la migration observée dans le build V13 validé.
// V9 -> V10 initialise le core, puis V10 -> V11 -> V12 sont des bumps de
// compatibilité. ensureStory importe ensuite le legacy de façon contrôlée.
// ---------------------------------------------------------------------------
{
  const path = 'src/storage/storyMigration.ts';
  let s = read(path);
  s = replaceOnce(
    s,
    "import { VERSION_SCHEMA_HISTOIRE } from '../types';\n",
    "import { VERSION_SCHEMA_HISTOIRE } from '../types';\nimport { assurerNarrativeCoreV12, creerNarrativeCoreV12 } from '../engine/narrative/narrativeCoreV12';\n",
    'storyMigration import core',
  );
  const end = "  return { ...migree, version: VERSION_SCHEMA_HISTOIRE };\n}";
  const migrated = `  if (migree.version < 10) {\n    // v9 -> v10 : première apparition du Narrative Core structuré.\n    migree = {\n      ...migree,\n      version: 10,\n      narrativeCore: migree.narrativeCore ?? creerNarrativeCoreV12(),\n    };\n  }\n  if (migree.version < 11) {\n    // v10 -> v11 : compatibilité des builds intermédiaires Narrative OS.\n    migree = { ...migree, version: 11 };\n  }\n  if (migree.version < 12) {\n    // v11 -> v12 : Event Ledger / Temporal Canon deviennent autoritatifs.\n    migree = { ...migree, version: 12 };\n  }\n\n  const normalisee = assurerNarrativeCoreV12({ ...migree, version: VERSION_SCHEMA_HISTOIRE } as StoryState);\n  return { ...normalisee, version: VERSION_SCHEMA_HISTOIRE };\n}`;
  s = replaceOnce(s, end, migrated, 'storyMigration v9-v12');
  write(path, s);
}

// ---------------------------------------------------------------------------
// Nouvelle histoire : le core existe dès la création, pas au premier tour.
// ---------------------------------------------------------------------------
{
  const path = 'src/engine/story.ts';
  let s = read(path);
  s = replaceOnce(
    s,
    "import { VERSION_SCHEMA_HISTOIRE } from '../types';\n",
    "import { VERSION_SCHEMA_HISTOIRE } from '../types';\nimport { creerNarrativeCoreV12 } from './narrative/narrativeCoreV12';\n",
    'story import core',
  );
  s = replaceOnce(
    s,
    '    social: { engagements: [], relations: [] },\n  };',
    '    social: { engagements: [], relations: [] },\n    narrativeCore: creerNarrativeCoreV12(),\n  };',
    'story init core',
  );
  write(path, s);
}

// ---------------------------------------------------------------------------
// Prompt builder : le State Delta V12 est une instruction machine cachée.
// ---------------------------------------------------------------------------
{
  const path = 'src/engine/promptBuilder.ts';
  let s = read(path);
  s = replaceOnce(
    s,
    '  contextBlocks?: string;\n}',
    '  contextBlocks?: string;\n  // Directive machine du Narrative Core V12. Elle demande au modèle un\n  // State Delta JSON qui sera retiré avant tout affichage au joueur.\n  v12Directive?: string;\n}',
    'prompt ctx v12Directive',
  );
  const oldReturn = "  return tronquer(`${fixe}${contextBlocks ? `\\n\\n[MÉMOIRE NARRATIVE PERTINENTE — V10]\\n${contextBlocks}` : ''}${lore}${etat ? `\\n\\n[ÉTAT / CONSÉQUENCES]\\n${etat}` : ''}${souvenirs}${style}`, budget);";
  const newReturn = "  return tronquer(`${fixe}${contextBlocks ? `\\n\\n[MÉMOIRE / CANON PERTINENTS]\\n${contextBlocks}` : ''}${lore}${etat ? `\\n\\n[ÉTAT / CONSÉQUENCES]\\n${etat}` : ''}${souvenirs}${style}${ctx.v12Directive ? `\\n\\n${ctx.v12Directive}` : ''}`, budget);";
  s = replaceOnce(s, oldReturn, newReturn, 'prompt append V12 directive');
  write(path, s);
}

// ---------------------------------------------------------------------------
// Génération : hydrate V12 avant le prompt, retire le JSON caché, valide le
// texte visible, puis commit le delta UNIQUEMENT après validation/réparation.
// ---------------------------------------------------------------------------
{
  const path = 'src/engine/generateTurn.ts';
  let s = read(path);
  s = replaceOnce(
    s,
    "import { construireContextBlocks, debugContextBlocks, formaterContextBlocks, synchroniserMemoireNarrative } from './narrative/persistentMemory';\n",
    "import { construireContextBlocks, debugContextBlocks, formaterContextBlocks, synchroniserMemoireNarrative } from './narrative/persistentMemory';\nimport {\n  assurerNarrativeCoreV12,\n  committerTourNarratifV12,\n  construireContexteNarratifV12,\n  debugNarrativeCoreV12,\n  extraireEnveloppeNarrativeV12,\n  reconstruireNarrativeCoreDepuisTranscript,\n} from './narrative/narrativeCoreV12';\n",
    'generateTurn core imports',
  );

  const oldStart = `  const storyChargee = await rafraichirEtatDeriveAvantTour(story);\n  const storyCourante: StoryState = { ...storyChargee, memoireNarrative: synchroniserMemoireNarrative(storyChargee) };\n  const contexteV10Debug = construireContextBlocks(storyCourante, messageJoueur);`;
  const newStart = `  const storyChargee = await rafraichirEtatDeriveAvantTour(story);\n  const storyV10: StoryState = { ...storyChargee, memoireNarrative: synchroniserMemoireNarrative(storyChargee) };\n  const storyCourante = assurerNarrativeCoreV12(storyV10);\n  const contexteV10Debug = construireContextBlocks(storyCourante, messageJoueur);\n  const contexteV12 = construireContexteNarratifV12(storyCourante, messageJoueur);`;
  s = replaceOnce(s, oldStart, newStart, 'generateTurn hydrate V12');

  const oldCtx = `  const ctxBase = construireCtxBase(storyCourante, messageJoueur, appSettings, { metamoteursSelectionnes, loreElyndor, souvenirs });`;
  const newCtx = `  const ctxV10 = construireCtxBase(storyCourante, messageJoueur, appSettings, { metamoteursSelectionnes, loreElyndor, souvenirs });\n  const ctxBase: ContexteConstruction = {\n    ...ctxV10,\n    contextBlocks: [ctxV10.contextBlocks, contexteV12.text].filter(Boolean).join('\\n\\n'),\n    etatMonde: [ctxV10.etatMonde, contexteV12.worldText].filter(Boolean).join('\\n\\n'),\n    engagementsEtRelations: [ctxV10.engagementsEtRelations, contexteV12.socialText].filter(Boolean).join('\\n\\n'),\n    v12Directive: contexteV12.directive,\n  };`;
  s = replaceOnce(s, oldCtx, newCtx, 'generateTurn inject V12 context');

  const oldInitialCall = `  let reponse = await appellerModele({\n    ...configurationLLM(appSettings, modelePourAppel),\n    messages: construireMessages(ctxBase, { budgetSysteme: budgetPrompt }),\n    temperature,\n    maxTokens,\n  });\n\n  const heuristique =`;
  const newInitialCall = `  let reponse = await appellerModele({\n    ...configurationLLM(appSettings, modelePourAppel),\n    messages: construireMessages(ctxBase, { budgetSysteme: budgetPrompt }),\n    temperature,\n    maxTokens,\n  });\n\n  // Le modèle peut produire un State Delta après la narration. Ce JSON n'est\n  // jamais montré ni envoyé aux validateurs comme prose narrative.\n  let enveloppeV12 = extraireEnveloppeNarrativeV12(reponse);\n  let deltaV12 = enveloppeV12.delta;\n  reponse = enveloppeV12.text;\n\n  const heuristique =`;
  s = replaceOnce(s, oldInitialCall, newInitialCall, 'generateTurn strip initial envelope');

  const oldRegen = `      reponse = await appellerModele({\n        ...configurationLLM(appSettings, modelePourAppel),\n        messages: construireMessages({ ...ctxBase, noteCorrection }, { budgetSysteme: budgetPrompt }),\n        temperature,\n        maxTokens,\n      });`;
  const newRegen = `      reponse = await appellerModele({\n        ...configurationLLM(appSettings, modelePourAppel),\n        messages: construireMessages({ ...ctxBase, noteCorrection }, { budgetSysteme: budgetPrompt }),\n        temperature,\n        maxTokens,\n      });\n      enveloppeV12 = extraireEnveloppeNarrativeV12(reponse);\n      deltaV12 = enveloppeV12.delta;\n      reponse = enveloppeV12.text;`;
  s = replaceOnce(s, oldRegen, newRegen, 'generateTurn strip regenerated envelope');

  const beforeFinal = `  if (reponseFaitParlerLeJoueur(reponse, storyCourante.meta.personnageNom)) {`;
  const finalStrip = `  // Une réparation peut elle-même avoir conservé/recréé le marqueur ; on\n  // effectue un dernier nettoyage avant toute persistance ou affichage.\n  const enveloppeFinaleV12 = extraireEnveloppeNarrativeV12(reponse);\n  if (enveloppeFinaleV12.found) {\n    reponse = enveloppeFinaleV12.text;\n    if (enveloppeFinaleV12.delta) deltaV12 = enveloppeFinaleV12.delta;\n  }\n\n  if (reponseFaitParlerLeJoueur(reponse, storyCourante.meta.personnageNom)) {`;
  s = replaceOnce(s, beforeFinal, finalStrip, 'generateTurn final strip');

  const oldCommit = `  const messages = [...storyCourante.messages, messageUtilisateur, messageAssistant];\n  const storyAvecMessages: StoryState = { ...storyCourante, messages };\n  const memoireNarrative = synchroniserMemoireNarrative(storyAvecMessages);\n\n  return {\n    story: { ...storyAvecMessages, memoireNarrative },`;
  const newCommit = `  const messages = [...storyCourante.messages, messageUtilisateur, messageAssistant];\n  const storyAvecMessages: StoryState = { ...storyCourante, messages };\n  const storyAvecCore = committerTourNarratifV12(storyAvecMessages, {\n    userMessage: messageUtilisateur,\n    assistantMessage: messageAssistant,\n    delta: deltaV12,\n    wasCorrected: aEteCorrige,\n  });\n  const memoireNarrative = synchroniserMemoireNarrative(storyAvecCore);\n\n  return {\n    story: { ...storyAvecCore, memoireNarrative },`;
  s = replaceOnce(s, oldCommit, newCommit, 'generateTurn commit after validation');

  const oldDebug = `      contextBlocks: debugContextBlocks(contexteV10Debug.blocks),\n      memoireNarrative: memoireNarrative.evenements.length + ' événements indexés · ' + contexteV10Debug.totalChars + ' caractères envoyés en Context Blocks',`;
  const newDebug = `      contextBlocks: [...debugContextBlocks(contexteV10Debug.blocks), ...debugNarrativeCoreV12(storyAvecCore, messageJoueur)],\n      memoireNarrative: memoireNarrative.evenements.length + ' événements indexés · ' + contexteV10Debug.totalChars + ' caractères V10 · V12 ledger actif',`;
  s = replaceOnce(s, oldDebug, newDebug, 'generateTurn V12 debug');

  const oldRegenReturn = `  return genererTour(storySansDernierEchange, appSettings, avantDernier.content);`;
  const newRegenReturn = `  const storySansMemoireDuTour = {\n    ...storySansDernierEchange,\n    memoireNarrative: synchroniserMemoireNarrative(storySansDernierEchange),\n  };\n  const storyTransactionnel = reconstruireNarrativeCoreDepuisTranscript(storySansMemoireDuTour);\n  return genererTour(storyTransactionnel, appSettings, avantDernier.content);`;
  s = replaceOnce(s, oldRegenReturn, newRegenReturn, 'regeneration transactional V12 rollback');

  write(path, s);
}

console.log('Narrative Core V12 materialisé dans les sources TypeScript.');
