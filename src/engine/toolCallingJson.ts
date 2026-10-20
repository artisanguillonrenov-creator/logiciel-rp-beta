import type { AppelOutil, ChatMessage, ToolDefinition } from './openrouter';

/** Liste textuelle des outils, pour les modes sans tool calling natif. */
export function decrireOutilsJson(outils: ToolDefinition[]): string {
  return outils.map((o) => {
    const params = Object.entries(o.parametres).map(([nom, def]) => {
      const optionnel = o.requis.includes(nom) ? '' : '?';
      const enumTxt = def.enum ? ` parmi (${def.enum.join('|')})` : '';
      return `${nom}${optionnel}: ${def.type}${enumTxt}`;
    }).join(', ');
    return `- ${o.nom}(${params}) — ${o.description}`;
  }).join('\n');
}

export function ajouterInstructionsOutilsJson(
  messages: ChatMessage[],
  outils: ToolDefinition[],
): ChatMessage[] {
  const liste = decrireOutilsJson(outils);
  return [
    ...messages,
    {
      role: 'system',
      content: `Outils disponibles :\n${liste}\n\nRéponds en terminant par un bloc JSON strict sur sa propre ligne :\n{"appels": [{"outil": "nom_outil", "arguments": {...}}]}\nSi aucun outil n'est nécessaire, utilise exactement {"appels": []}.`,
    },
  ];
}

export function extraireAppelsOutilsJson(brut: string): { contenu: string; appelsOutils: AppelOutil[] } {
  const correspondance = brut.match(/\{[\s\S]*"appels"[\s\S]*\}\s*$/);
  if (!correspondance || correspondance.index === undefined) return { contenu: brut, appelsOutils: [] };
  try {
    const parsed = JSON.parse(correspondance[0]);
    const appelsOutils = appelsOutilsDepuisObjet(parsed) ?? [];
    return { contenu: brut.slice(0, correspondance.index).trim(), appelsOutils };
  } catch {
    return { contenu: brut, appelsOutils: [] };
  }
}

/**
 * Lit un objet {"appels": [...]} déjà parsé. null si la forme est absente
 * (pas d'objet ou pas de liste « appels ») ; les appels mal formés sont
 * ignorés un par un, comme dans le repli JSON du tool calling.
 */
export function appelsOutilsDepuisObjet(valeur: unknown): AppelOutil[] | null {
  if (!valeur || typeof valeur !== 'object' || Array.isArray(valeur)) return null;
  const appels = (valeur as { appels?: unknown }).appels;
  if (!Array.isArray(appels)) return null;
  const appelsOutils: AppelOutil[] = [];
  for (const element of appels) {
    const candidat = element as { outil?: unknown; arguments?: unknown };
    if (typeof candidat?.outil === 'string' && candidat.arguments && typeof candidat.arguments === 'object' && !Array.isArray(candidat.arguments)) {
      appelsOutils.push({ nom: candidat.outil, arguments: candidat.arguments as Record<string, unknown> });
    }
  }
  return appelsOutils;
}
