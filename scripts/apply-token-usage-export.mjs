import fs from 'node:fs';

function lire(path) { return fs.readFileSync(path, 'utf8'); }
function ecrire(path, contenu) { fs.writeFileSync(path, contenu); }
function remplacer(contenu, ancien, nouveau, etiquette) {
  if (!contenu.includes(ancien)) throw new Error(`Patch V7 tokens impossible (${etiquette}) : marqueur introuvable.`);
  return contenu.replace(ancien, nouveau);
}

// 1) Persistance : chaque réponse narrateur garde la consommation de tout son tour.
{
  const path = 'src/types/index.ts';
  let s = lire(path);
  s = remplacer(
    s,
    `  dureeGenerationMs?: number;\n}`,
    `  dureeGenerationMs?: number;\n  // Télémétrie de consommation de tout le tour ayant produit cette réponse :\n  // narration + validation + éventuelle réparation/régénération.\n  usageTokens?: {\n    inputTokens: number;\n    cachedInputTokens: number;\n    outputTokens: number;\n    reasoningTokens: number;\n    totalTokens: number;\n    apiCalls: number;\n    complete: boolean;\n  };\n}`,
    'type Message usageTokens',
  );
  ecrire(path, s);
}

// 2) OpenRouter / Infermatic : lire le bloc usage OpenAI-compatible sans changer les signatures publiques.
{
  const path = 'src/engine/openrouter.ts';
  let s = lire(path);
  s = remplacer(
    s,
    `import { ajouterInstructionsOutilsJson, extraireAppelsOutilsJson } from './toolCallingJson';`,
    `import { ajouterInstructionsOutilsJson, extraireAppelsOutilsJson } from './toolCallingJson';\nimport { enregistrerAppelSansUsage, enregistrerUsageAppel } from './tokenUsageTelemetry';`,
    'import télémétrie provider',
  );
  s = remplacer(
    s,
    `  if (moteurInference === 'local') return genererTexteLocal(messages);\n  if (moteurInference === 'chatgpt') return appelerChatGPTAbonnement(messages, model, signal);`,
    `  if (moteurInference === 'local') {\n    enregistrerAppelSansUsage();\n    return genererTexteLocal(messages);\n  }\n  if (moteurInference === 'chatgpt') return appelerChatGPTAbonnement(messages, model, signal);`,
    'appel local',
  );
  s = remplacer(
    s,
    `    const data = await appelerChatDistant({ fournisseur, apiKey, model, messages, temperature, maxTokens, signal });\n    const contenu = data?.choices?.[0]?.message?.content;`,
    `    const data = await appelerChatDistant({ fournisseur, apiKey, model, messages, temperature, maxTokens, signal });\n    if (data?.usage) enregistrerUsageAppel(data.usage);\n    else enregistrerAppelSansUsage();\n    const contenu = data?.choices?.[0]?.message?.content;`,
    'usage distant',
  );
  ecrire(path, s);
}

// 3) ChatGPT Plus : la passerelle V7 renvoie désormais usage pour chaque appel Codex.
{
  const path = 'src/engine/chatgptSubscription.ts';
  let s = lire(path);
  s = remplacer(
    s,
    `import type { ChatMessage } from './openrouter';`,
    `import type { ChatMessage } from './openrouter';\nimport { enregistrerAppelSansUsage, enregistrerUsageAppel } from './tokenUsageTelemetry';`,
    'import télémétrie ChatGPT',
  );
  s = remplacer(
    s,
    `  const contenu = data?.choices?.[0]?.message?.content;\n  if (typeof contenu !== 'string' || !contenu.trim())`,
    `  if (data?.usage) enregistrerUsageAppel(data.usage);\n  else enregistrerAppelSansUsage();\n  const contenu = data?.choices?.[0]?.message?.content;\n  if (typeof contenu !== 'string' || !contenu.trim())`,
    'capture usage ChatGPT',
  );
  ecrire(path, s);
}

// 4) Un tour RP ouvre un compteur avant la narration et le ferme seulement après validation/réparation.
{
  const path = 'src/engine/generateTurn.ts';
  let s = lire(path);
  s = remplacer(
    s,
    `} from './validator';`,
    `} from './validator';\nimport { annulerMesureTokens, commencerMesureTokens, terminerMesureTokens } from './tokenUsageTelemetry';`,
    'import compteur tour',
  );
  s = remplacer(
    s,
    `  let reponse = await appellerModele({`,
    `  commencerMesureTokens();\n  let reponse = await appellerModele({`,
    'début compteur',
  );
  s = remplacer(
    s,
    `  if (!validerProfilContenuHeuristique(reponse, appSettings.profilContenu).ok) {\n    throw new ErreurProfilContenu(`,
    `  if (!validerProfilContenuHeuristique(reponse, appSettings.profilContenu).ok) {\n    annulerMesureTokens();\n    throw new ErreurProfilContenu(`,
    'annulation compteur erreur profil',
  );
  s = remplacer(
    s,
    `  const messageUtilisateur: Message = {`,
    `  const usageTokens = terminerMesureTokens();\n\n  const messageUtilisateur: Message = {`,
    'fin compteur',
  );
  s = remplacer(
    s,
    `    dureeGenerationMs: Date.now() - debutMs,\n  };`,
    `    dureeGenerationMs: Date.now() - debutMs,\n    usageTokens,\n  };`,
    'stockage compteur message',
  );
  ecrire(path, s);
}

// 5) Exports TXT/PDF/EPUB : consommation après chaque réponse + total de la conversation.
{
  const path = 'src/engine/conversationExport.ts';
  let s = lire(path);
  s = remplacer(
    s,
    `function genererTexteBrut(story: StoryState): string {`,
    `function nombre(n: number): string {\n  return Math.max(0, Math.floor(n || 0)).toLocaleString('fr-FR');\n}\n\nfunction usageTexte(m: Message): string[] {\n  const u = m.usageTokens;\n  if (!u) return [];\n  return [\n    '[CONSOMMATION DU TOUR]',\n    \`Entrée : \${nombre(u.inputTokens)} tokens\`,\n    \`Cache : \${nombre(u.cachedInputTokens)} tokens\`,\n    \`Sortie : \${nombre(u.outputTokens)} tokens\`,\n    \`Raisonnement : \${nombre(u.reasoningTokens)} tokens\`,\n    \`Total : \${nombre(u.totalTokens)} tokens\`,\n    \`Appels IA : \${u.apiCalls}\${u.complete ? '' : ' · données partielles'}\`,\n  ];\n}\n\nfunction usageTotal(story: StoryState) {\n  const usages = story.messages.map((m) => m.usageTokens).filter((u): u is NonNullable<Message['usageTokens']> => !!u);\n  return usages.reduce((a, u) => ({\n    inputTokens: a.inputTokens + u.inputTokens,\n    cachedInputTokens: a.cachedInputTokens + u.cachedInputTokens,\n    outputTokens: a.outputTokens + u.outputTokens,\n    reasoningTokens: a.reasoningTokens + u.reasoningTokens,\n    totalTokens: a.totalTokens + u.totalTokens,\n    apiCalls: a.apiCalls + u.apiCalls,\n    incomplete: a.incomplete + (u.complete ? 0 : 1),\n  }), { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0, apiCalls: 0, incomplete: 0 });\n}\n\nfunction genererTexteBrut(story: StoryState): string {`,
    'helpers export tokens',
  );
  s = remplacer(
    s,
    `    lignes.push(m.content);\n    lignes.push('');\n  }\n  return lignes.join('\\n');`,
    `    lignes.push(m.content);\n    if (m.role === 'assistant' && m.usageTokens) {\n      lignes.push('', ...usageTexte(m));\n    }\n    lignes.push('');\n  }\n  const total = usageTotal(story);\n  if (total.apiCalls > 0) {\n    lignes.push('==============================');\n    lignes.push('STATISTIQUES DE LA CONVERSATION');\n    lignes.push(\`Appels IA : \${total.apiCalls}\`);\n    lignes.push(\`Tokens entrée : \${nombre(total.inputTokens)}\`);\n    lignes.push(\`Tokens cache : \${nombre(total.cachedInputTokens)}\`);\n    lignes.push(\`Tokens sortie : \${nombre(total.outputTokens)}\`);\n    lignes.push(\`Tokens raisonnement : \${nombre(total.reasoningTokens)}\`);\n    lignes.push(\`CONSOMMATION TOTALE : \${nombre(total.totalTokens)} tokens\`);\n    if (total.incomplete) lignes.push(\`Attention : \${total.incomplete} tour(s) ont des données partielles.\`);\n    lignes.push('==============================', '');\n  }\n  return lignes.join('\\n');`,
    'export texte par tour + total',
  );
  s = remplacer(
    s,
    `      return \`<p class="message \${classe}"><span class="auteur">\${auteur}</span><br/>\${segmentsVersHtml(m.content)}</p>\`;`,
    `      const usage = m.role === 'assistant' && m.usageTokens\n        ? \`<div class="usage"><strong>Consommation du tour</strong> · Entrée \${nombre(m.usageTokens.inputTokens)} · Cache \${nombre(m.usageTokens.cachedInputTokens)} · Sortie \${nombre(m.usageTokens.outputTokens)} · Raisonnement \${nombre(m.usageTokens.reasoningTokens)} · <strong>Total \${nombre(m.usageTokens.totalTokens)} tokens</strong> · \${m.usageTokens.apiCalls} appel(s) IA\${m.usageTokens.complete ? '' : ' · données partielles'}</div>\`\n        : '';\n      return \`<div class="bloc-message"><p class="message \${classe}"><span class="auteur">\${auteur}</span><br/>\${segmentsVersHtml(m.content)}</p>\${usage}</div>\`;`,
    'usage html par message',
  );
  s = remplacer(
    s,
    `    .join('\\n');\n  return { titre, messages };`,
    `    .join('\\n');\n  const total = usageTotal(story);\n  const resumeUsage = total.apiCalls > 0\n    ? \`<section class="usage-total"><h2>Statistiques de la conversation</h2><p>Appels IA : \${total.apiCalls}<br/>Entrée : \${nombre(total.inputTokens)} tokens<br/>Cache : \${nombre(total.cachedInputTokens)} tokens<br/>Sortie : \${nombre(total.outputTokens)} tokens<br/>Raisonnement : \${nombre(total.reasoningTokens)} tokens<br/><strong>Consommation totale : \${nombre(total.totalTokens)} tokens</strong>\${total.incomplete ? \`<br/>Données partielles sur \${total.incomplete} tour(s).\` : ''}</p></section>\`\n    : '';\n  return { titre, messages: messages + resumeUsage };`,
    'résumé usage html',
  );
  s = remplacer(
    s,
    `  .locuteur { color: #1a1a1a; }\n`;,
    `  .locuteur { color: #1a1a1a; }\n  .bloc-message { margin-bottom: 18px; }\n  .bloc-message p.message { margin-bottom: 5px; }\n  .usage { font-family: Arial, sans-serif; font-size: 10px; color: #666; border-left: 2px solid #c8a45d; padding: 4px 8px; margin: 0 0 12px 0; }\n  .usage-total { margin-top: 32px; padding-top: 14px; border-top: 1px solid #bbb; font-family: Arial, sans-serif; font-size: 11px; }\n  .usage-total h2 { font-size: 15px; }\n`;,
    'styles usage html',
  );
  ecrire(path, s);
}

// 6) Version V7 visible dans Réglages.
{
  const path = 'src/version.ts';
  let s = lire(path);
  s = s.replace(/VERSION_APP = '[^']+'/, "VERSION_APP = '1.31.0-token-usage-export-beta'");
  ecrire(path, s);
}

console.log('V7 : télémétrie tokens par tour + export détaillé appliqués.');
