import type { ContexteHistoire, StoryState, StorySettings } from '../types';
import { VERSION_SCHEMA_HISTOIRE } from '../types';

function genererId(): string {
  return `histoire-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function creerNouvelleHistoire(params: {
  personnageNom: string;
  personnageDescription: string;
  pointDeDepart: string;
  contexte: ContexteHistoire;
  settings: StorySettings;
  raceOrigineId?: string;
  sexe?: string;
}): StoryState {
  const maintenant = Date.now();
  return {
    version: VERSION_SCHEMA_HISTOIRE,
    meta: {
      id: genererId(),
      personnageNom: params.personnageNom,
      personnageDescription: params.personnageDescription,
      pointDeDepart: params.pointDeDepart,
      contexte: params.contexte,
      createdAt: maintenant,
      updatedAt: maintenant,
      raceOrigineId: params.raceOrigineId,
      sexe: params.sexe,
    },
    messages: [],
    memoire: {
      resume: '',
      faits: [],
      dernierMessageIndexMaj: 0,
    },
    loreEmergent: [],
    settings: params.settings,
    directeur: {
      arcActuel: '',
      tension: 'calme',
      dernierBeatIndex: 0,
      beats: [],
    },
    monde: { zones: [], flags: {}, compteurs: {}, declencheurs: [] },
    social: { engagements: [], relations: [] },
  };
}

// Branches de conversation (brief Phase 2) : copie indépendante d'une
// histoire à partir de son état courant, pour explorer une autre suite sans
// toucher à l'originale. Copie profonde par sérialisation — évite tout
// partage de référence (messages, faits, lore émergent) avec le parent.
export function creerBranche(story: StoryState, nomBranche?: string): StoryState {
  const clone: StoryState = JSON.parse(JSON.stringify(story));
  const maintenant = Date.now();
  clone.meta = {
    ...clone.meta,
    id: genererId(),
    personnageNom: nomBranche ? `${clone.meta.personnageNom} — ${nomBranche}` : clone.meta.personnageNom,
    brancheDeId: story.meta.id,
    pointDeBranchement: story.messages.length,
    createdAt: maintenant,
    updatedAt: maintenant,
  };
  return clone;
}
