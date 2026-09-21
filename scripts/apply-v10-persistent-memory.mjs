import fs from 'node:fs';

function lire(path) { return fs.readFileSync(path, 'utf8'); }
function ecrire(path, contenu) { fs.writeFileSync(path, contenu); }
function remplacer(contenu, ancien, nouveau, etiquette) {
  if (!contenu.includes(ancien)) throw new Error(`Patch V10 mémoire persistante impossible (${etiquette}) : marqueur introuvable.`);
  return contenu.replace(ancien, nouveau);
}

// 1) Types persistés : Event Ledger optionnel, rétrocompatible V9/V9.1.
{
  const path = 'src/types/index.ts';
  let s = lire(path);
  s = remplacer(
    s,
    `export interface SocialState {\n  engagements: Engagement[];\n  relations: RelationPersonnage[];\n}\n\n// Incrémenté à chaque changement de forme des données persistées`,
    `export interface SocialState {\n  engagements: Engagement[];\n  relations: RelationPersonnage[];\n}\n\n// V10 — registre chronologique local, dérivé du transcript sans appel IA.\nexport interface EvenementNarratif {\n  id: string;\n  messageIndex: number;\n  timestamp: number;\n  lieu?: string;\n  dateChronique?: string;\n  participants: string[];\n  actionJoueur: string;\n  resultat: string;\n}\n\nexport interface MemoireNarrativeState {\n  evenements: EvenementNarratif[];\n  dernierMessageIndex: number;\n}\n\n// Incrémenté à chaque changement de forme des données persistées`,
    'types Event Ledger',
  );
  s = remplacer(
    s,
    `  loreEmergentDernierIndex?: number;\n}`,
    `  loreEmergentDernierIndex?: number;\n  // V10 : mémoire narrative hiérarchique. Optionnelle pour que les sauvegardes\n  // V9/V9.1 restent valides sans migration destructive.\n  memoireNarrative?: MemoireNarrativeState;\n}`,
    'StoryState memoireNarrative',
  );
  ecrire(path, s);
}

// 2) Prompt : Context Blocks prioritaires dans le même budget global.
{
  const path = 'src/engine/promptBuilder.ts';
  let s = lire(path);
  s = remplacer(
    s,
    `  engagementsEtRelations?: string;\n  souvenirs?: string;\n}`,
    `  engagementsEtRelations?: string;\n  souvenirs?: string;\n  contextBlocks?: string;\n}`,
    'ContexteConstruction contextBlocks',
  );
  s = remplacer(
    s,
    `    Math.floor(budget * 0.22),\n    520,\n  );\n  const etat = tronquer(\n    [ctx.etatMonde, ctx.engagementsEtRelations, ctx.directionNarrative].filter(Boolean).join('\\n\\n'),\n    Math.floor(budget * 0.14),\n  );\n  const souvenirs = tronquer(ctx.souvenirs ?? '', Math.floor(budget * 0.10));\n  const resume = tronquer(\n    ctx.resume || \"L'histoire commence tout juste, aucun résumé pour l'instant.\",\n    Math.floor(budget * 0.10),\n  );\n  const faits = formaterFaits(ctx.faits, Math.floor(budget * 0.12));`,
    `    Math.floor(budget * 0.18),\n    500,\n  );\n  const etat = tronquer(\n    [ctx.etatMonde, ctx.engagementsEtRelations, ctx.directionNarrative].filter(Boolean).join('\\n\\n'),\n    Math.floor(budget * 0.12),\n  );\n  const contextBlocks = tronquer(ctx.contextBlocks ?? '', Math.floor(budget * 0.16));\n  const souvenirs = tronquer(ctx.souvenirs ?? '', Math.floor(budget * 0.06));\n  const resume = tronquer(\n    ctx.resume || \"L'histoire commence tout juste, aucun résumé pour l'instant.\",\n    Math.floor(budget * 0.08),\n  );\n  const faits = formaterFaits(ctx.faits, Math.floor(budget * 0.10));`,
    'répartition budget V10',
  );
  const ancienRetour = "  return tronquer(`${fixe}${lore}${etat ? `\\n\\n[ÉTAT / CONSÉQUENCES]\\n${etat}` : ''}${souvenirs}${style}`, budget);";
  const nouveauRetour = "  return tronquer(`${fixe}${contextBlocks ? `\\n\\n[MÉMOIRE NARRATIVE PERTINENTE — V10]\\n${contextBlocks}` : ''}${lore}${etat ? `\\n\\n[ÉTAT / CONSÉQUENCES]\\n${etat}` : ''}${souvenirs}${style}`, budget);";
  s = remplacer(s, ancienRetour, nouveauRetour, 'injection Context Blocks');
  ecrire(path, s);
}

// 3) Raccord au tour narratif + diagnostic concepteur.
{
  const path = 'src/engine/generateTurn.ts';
  let s = lire(path);
  s = remplacer(
    s,
    `} from './validator';\n`,
    `} from './validator';\nimport { construireContextBlocks, debugContextBlocks, formaterContextBlocks, synchroniserMemoireNarrative } from './narrative/persistentMemory';\n`,
    'import mémoire V10',
  );
  s = remplacer(
    s,
    `export interface DebugLore {\n  metamoteurs: string[];\n  loreElyndor: string[];\n  souvenirs: string[];\n}`,
    `export interface DebugLore {\n  metamoteurs: string[];\n  loreElyndor: string[];\n  souvenirs: string[];\n  contextBlocks?: string[];\n  memoireNarrative?: string;\n}`,
    'DebugLore V10',
  );
  s = remplacer(
    s,
    `export async function calculerDebugLore(story: StoryState, messageJoueur: string, appSettings: AppSettings): Promise<DebugLore> {\n  const { debugLore } = await calculerSelectionLore(story, messageJoueur, appSettings);\n  return debugLore;\n}`,
    `export async function calculerDebugLore(story: StoryState, messageJoueur: string, appSettings: AppSettings): Promise<DebugLore> {\n  const memoireNarrative = synchroniserMemoireNarrative(story);\n  const storyV10: StoryState = { ...story, memoireNarrative };\n  const { debugLore } = await calculerSelectionLore(storyV10, messageJoueur, appSettings);\n  const contexte = construireContextBlocks(storyV10, messageJoueur);\n  return {\n    ...debugLore,\n    contextBlocks: debugContextBlocks(contexte.blocks),\n    memoireNarrative: memoireNarrative.evenements.length + ' événements indexés · ' + contexte.totalChars + ' caractères sélectionnés',\n  };\n}`,
    'calculerDebugLore V10',
  );
  s = remplacer(
    s,
    `  const directionNarrative = formaterDirection(\n    story.directeur,\n    detecterStagnation(story.directeur, story.messages.length),\n  );\n\n  return {`,
    `  const directionNarrative = formaterDirection(\n    story.directeur,\n    detecterStagnation(story.directeur, story.messages.length),\n  );\n  const memoireNarrative = story.memoireNarrative ?? synchroniserMemoireNarrative(story);\n  const contexteV10 = construireContextBlocks({ ...story, memoireNarrative }, messageJoueur);\n\n  return {`,
    'construction Context Blocks',
  );
  s = remplacer(
    s,
    `    engagementsEtRelations: filtrer(formaterEngagementsEtRelations(story.social)),\n    souvenirs: filtrer(formaterSouvenirs(selection.souvenirs, nomPersonnage)),\n  };`,
    `    engagementsEtRelations: filtrer(formaterEngagementsEtRelations(story.social)),\n    souvenirs: filtrer(formaterSouvenirs(selection.souvenirs, nomPersonnage)),\n    contextBlocks: filtrer(formaterContextBlocks(contexteV10.blocks)),\n  };`,
    'ctxBase Context Blocks',
  );
  s = remplacer(
    s,
    `  const debutMs = Date.now();\n  const storyCourante = await rafraichirEtatDeriveAvantTour(story);\n\n  const { metamoteursSelectionnes, loreElyndor, souvenirs, debugLore } = await calculerSelectionLore(`,
    `  const debutMs = Date.now();\n  const storyChargee = await rafraichirEtatDeriveAvantTour(story);\n  const storyCourante: StoryState = { ...storyChargee, memoireNarrative: synchroniserMemoireNarrative(storyChargee) };\n  const contexteV10Debug = construireContextBlocks(storyCourante, messageJoueur);\n\n  const { metamoteursSelectionnes, loreElyndor, souvenirs, debugLore } = await calculerSelectionLore(`,
    'synchronisation avant tour',
  );
  s = remplacer(
    s,
    `  const messages = [...storyCourante.messages, messageUtilisateur, messageAssistant];\n\n  return {\n    story: { ...storyCourante, messages },\n    aEteCorrige,\n    debugLore,\n  };`,
    `  const messages = [...storyCourante.messages, messageUtilisateur, messageAssistant];\n  const storyAvecMessages: StoryState = { ...storyCourante, messages };\n  const memoireNarrative = synchroniserMemoireNarrative(storyAvecMessages);\n\n  return {\n    story: { ...storyAvecMessages, memoireNarrative },\n    aEteCorrige,\n    debugLore: {\n      ...debugLore,\n      contextBlocks: debugContextBlocks(contexteV10Debug.blocks),\n      memoireNarrative: memoireNarrative.evenements.length + ' événements indexés · ' + contexteV10Debug.totalChars + ' caractères envoyés en Context Blocks',\n    },\n  };`,
    'persistance ledger après tour',
  );
  s = remplacer(
    s,
    `  return { ...story, ...maj, ...majLore };\n}`,
    `  const storyMaj: StoryState = { ...story, ...maj, ...majLore };\n  return { ...storyMaj, memoireNarrative: synchroniserMemoireNarrative(storyMaj) };\n}`,
    'mise à jour forcée mémoire V10',
  );
  ecrire(path, s);
}

// 4) Reprendre le ledger persistant quand le transcript n'a pas changé.
{
  const path = 'src/engine/derivedState.ts';
  let s = lire(path);
  s = remplacer(
    s,
    `    loreEmergentDernierIndex: persistee.loreEmergentDernierIndex,\n  };`,
    `    loreEmergentDernierIndex: persistee.loreEmergentDernierIndex,\n    memoireNarrative: persistee.memoireNarrative ?? courante.memoireNarrative,\n  };`,
    'fusion état dérivé V10',
  );
  ecrire(path, s);
}

// 5) Context Inspector visible uniquement en mode concepteur.
{
  const path = 'src/screens/ConversationScreen.tsx';
  let s = lire(path);
  s = remplacer(
    s,
    `              {debugOuvert ? '▾' : '▸'} Diagnostic narratif ({debugLore.metamoteurs.length} métamoteurs,{' '}\n              {debugLore.loreElyndor.length} entrées Elyndor, {debugLore.souvenirs.length} souvenirs)`,
    `              {debugOuvert ? '▾' : '▸'} Diagnostic narratif ({debugLore.metamoteurs.length} métamoteurs,{' '}\n              {debugLore.loreElyndor.length} entrées Elyndor, {debugLore.souvenirs.length} souvenirs,{' '}\n              {debugLore.contextBlocks?.length ?? 0} blocs V10)`,
    'compteur Context Blocks UI',
  );
  s = remplacer(
    s,
    `            {debugLore.souvenirs.length === 0 ? (\n              <Text style={styles.ligneDebug}>Aucun — rien d'assez pertinent hors des échanges récents.</Text>\n            ) : (\n              debugLore.souvenirs.map((extrait) => (\n                <Text key={extrait} style={styles.ligneDebug}>• {extrait}</Text>\n              ))\n            )}\n          </ScrollView>`,
    `            {debugLore.souvenirs.length === 0 ? (\n              <Text style={styles.ligneDebug}>Aucun — rien d'assez pertinent hors des échanges récents.</Text>\n            ) : (\n              debugLore.souvenirs.map((extrait) => (\n                <Text key={extrait} style={styles.ligneDebug}>• {extrait}</Text>\n              ))\n            )}\n            <Text style={[styles.titreDebug, { marginTop: espacement.sm }]}>Context Blocks V10 réellement injectés</Text>\n            {!!debugLore.memoireNarrative && <Text style={styles.ligneDebug}>{debugLore.memoireNarrative}</Text>}\n            {(debugLore.contextBlocks?.length ?? 0) === 0 ? (\n              <Text style={styles.ligneDebug}>Aucun bloc supplémentaire pour ce tour.</Text>\n            ) : (\n              debugLore.contextBlocks!.map((bloc, index) => (\n                <Text key={String(index) + ':' + bloc} style={styles.ligneDebug}>• {bloc}</Text>\n              ))\n            )}\n          </ScrollView>`,
    'panneau Context Inspector',
  );
  ecrire(path, s);
}

// 6) Version visible explicite.
{
  const path = 'src/version.ts';
  let s = lire(path);
  s = s.replace(/VERSION_APP = '[^']+'/, "VERSION_APP = '1.40.0-v10-persistent-narrative-memory-beta'");
  ecrire(path, s);
}

console.log('V10 : Event Ledger, mémoire PNJ/relationnelle, Context Blocks et Context Inspector appliqués.');
