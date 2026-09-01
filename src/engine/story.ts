import type { StoryState, StorySettings } from '../types';

function genererId(): string {
  return `histoire-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function creerNouvelleHistoire(params: {
  personnageNom: string;
  personnageDescription: string;
  pointDeDepart: string;
  settings: StorySettings;
}): StoryState {
  const maintenant = Date.now();
  return {
    meta: {
      id: genererId(),
      personnageNom: params.personnageNom,
      personnageDescription: params.personnageDescription,
      pointDeDepart: params.pointDeDepart,
      createdAt: maintenant,
      updatedAt: maintenant,
    },
    messages: [],
    memoire: {
      resume: '',
      faits: [],
      dernierMessageIndexMaj: 0,
    },
    settings: params.settings,
  };
}
