import { NARRATIVE_IDENTITY } from './behaviorKernel';
import { DEFAULT_CONTEXT_BUDGET, truncateContext } from './tokenBudgetGovernor';

export interface CompactContextInput {
  playerName: string;
  playerDescription?: string;
  currentState?: string;
  historyFacts?: string;
  loreFacts?: string;
  recentMessages?: string;
  playerMessage: string;
  style?: string;
}

export interface CompactPrompt {
  system: string;
  user: string;
}

export function compileCompactContext(input: CompactContextInput): CompactPrompt {
  const b = DEFAULT_CONTEXT_BUDGET;
  const identity = truncateContext(NARRATIVE_IDENTITY, b.identityChars);
  const state = truncateContext(input.currentState, b.stateChars);
  const history = truncateContext(input.historyFacts, b.historyChars);
  const lore = truncateContext(input.loreFacts, b.loreChars);
  const recent = truncateContext(input.recentMessages, b.recentChars);
  const style = truncateContext(input.style, 550);

  const sections = [
    identity,
    `[JOUEUR]\nNom: ${input.playerName}${input.playerDescription ? `\n${truncateContext(input.playerDescription, 500)}` : ''}`,
    state && `[ÉTAT ACTUEL]\n${state}`,
    history && `[HISTOIRE PERTINENTE]\n${history}`,
    lore && `[LORE PERTINENT]\n${lore}`,
    recent && `[SCÈNE IMMÉDIATE]\n${recent}`,
    style && `[STYLE]\n${style}`,
  ].filter(Boolean);

  return {
    system: sections.join('\n\n'),
    user: truncateContext(input.playerMessage, b.playerChars),
  };
}
