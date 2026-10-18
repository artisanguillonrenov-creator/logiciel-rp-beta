import type { FicheEditable } from '../concepteur/lorebookModele';

export type RootStackParamList = {
  Activation: undefined;
  Demarrage: undefined;
  Creation: undefined;
  Conversation: { storyId: string };
  Reglages: undefined;
  Plugins: undefined;
  ReglagesConcepteur: undefined;
  ModuleConcepteur: { section: 'tableau' | 'modeles' | 'runpod' | 'narration' | 'metamoteurs' | 'recherche' | 'lorebook' | 'visuel' | 'stockage' | 'diagnostics' | 'maintenance' | 'commercial' | 'profils' | 'instantanes' | 'narrateur' | 'elyndorlab' | 'pnj'; promotionPnj?: { sourceId: string; fiche: Partial<FicheEditable> } };
  ChargerConversation: undefined;
  Compte: undefined;
};
