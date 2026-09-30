import type { Message, StoryState } from '../../types';

// Le runtime V12 a été récupéré du build V13 validé. Il reste en JavaScript
// volontairement pour préserver son comportement bit-for-bit pendant la
// reconstruction du dépôt ; Metro doit néanmoins l'inclure dans le bundle.
// @ts-ignore -- module JS interne volontairement sans fichier de déclaration.
import './narrativeCoreV12.runtime.js';

export interface NarrativeCoreContextV12 {
  text: string;
  directive: string;
  worldText: string;
  socialText: string;
  rankedIds: string[];
  counts: Record<string, number>;
}

export interface NarrativeEnvelopeV12 {
  text: string;
  delta: unknown | null;
  found: boolean;
  error?: string;
}

interface NarrativeCoreRuntimeV12 {
  VERSION: string;
  MARKER: string;
  END: string;
  createEmptyState(): unknown;
  ensureStory(story: StoryState): StoryState;
  buildContext(story: StoryState, userText: string): NarrativeCoreContextV12;
  extractStateEnvelope(raw: string): NarrativeEnvelopeV12;
  commitTurn(
    story: StoryState,
    options: {
      userMessage: Message;
      assistantMessage: Message;
      delta?: unknown | null;
      wasCorrected?: boolean;
    },
  ): StoryState;
  debugContext(story: StoryState, userText: string): string[];
  reconcileLegacy(story: StoryState): StoryState;
  selfTest(): { ok: boolean; [key: string]: unknown };
}

function runtime(): NarrativeCoreRuntimeV12 {
  const value = (globalThis as typeof globalThis & {
    ElyndorNarrativeCoreV12?: NarrativeCoreRuntimeV12;
  }).ElyndorNarrativeCoreV12;
  if (!value) {
    throw new Error('Narrative Core V12 non chargé.');
  }
  return value;
}

export function creerNarrativeCoreV12(): unknown {
  return runtime().createEmptyState();
}

export function assurerNarrativeCoreV12(story: StoryState): StoryState {
  return runtime().ensureStory(story);
}

export function construireContexteNarratifV12(
  story: StoryState,
  messageJoueur: string,
): NarrativeCoreContextV12 {
  return runtime().buildContext(story, messageJoueur);
}

export function extraireEnveloppeNarrativeV12(raw: string): NarrativeEnvelopeV12 {
  return runtime().extractStateEnvelope(raw);
}

export function committerTourNarratifV12(
  story: StoryState,
  options: {
    userMessage: Message;
    assistantMessage: Message;
    delta?: unknown | null;
    wasCorrected?: boolean;
  },
): StoryState {
  return runtime().commitTurn(story, options);
}

export function debugNarrativeCoreV12(story: StoryState, messageJoueur: string): string[] {
  return runtime().debugContext(story, messageJoueur);
}

export function reconcilierNarrativeCoreV12(story: StoryState): StoryState {
  return runtime().reconcileLegacy(story);
}

/**
 * Reconstruit le core à partir du transcript visible. Cette fonction sert
 * surtout à la régénération : le tour supprimé ne doit laisser ni événement,
 * ni fait canon, ni réputation cachée dans l'état interne.
 *
 * Les anciens tours sont rejoués avec l'extracteur heuristique du runtime
 * V12. On préfère perdre un détail dérivé non visible plutôt que conserver
 * l'état d'une réponse que le joueur vient explicitement de jeter.
 */
export function reconstruireNarrativeCoreDepuisTranscript(story: StoryState): StoryState {
  const core = runtime().createEmptyState() as Record<string, unknown>;
  core.migration = {
    legacyImported: true,
    sourceVersion: story.version,
    at: Date.now(),
  };

  let courant = runtime().ensureStory({ ...story, narrativeCore: core });
  for (let i = 0; i < courant.messages.length - 1; i += 1) {
    const userMessage = courant.messages[i];
    const assistantMessage = courant.messages[i + 1];
    if (userMessage?.role !== 'user' || assistantMessage?.role !== 'assistant') continue;
    courant = runtime().commitTurn(courant, {
      userMessage,
      assistantMessage,
      delta: null,
      wasCorrected: false,
    });
    i += 1;
  }
  return courant;
}

export function selfTestNarrativeCoreV12(): { ok: boolean; [key: string]: unknown } {
  return runtime().selfTest();
}
