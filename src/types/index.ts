export type Creativite = 'faible' | 'moyenne' | 'elevee';
export type Longueur = 'courte' | 'moyenne' | 'longue';

export interface StorySettings {
  creativite: Creativite;
  longueur: Longueur;
}

export interface StoryMeta {
  id: string;
  personnageNom: string;
  personnageDescription: string;
  pointDeDepart: string;
  createdAt: number;
  updatedAt: number;
}

export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
}

export type FactType = 'personnage' | 'lieu' | 'promesse' | 'autre';

// Mémoire à niveaux (brief Phase 2, "les six niveaux de mémoire L0-L5") :
// - L0 contexte immédiat et L1 résumé de session ne sont pas des faits —
//   L0 est la fenêtre de messages bruts déjà envoyée au modèle
//   (StoryState.messages), L1 est MemoryState.resume.
// - episodique (L2) : fait candidat tout juste extrait, pas encore
//   rapproché de la mémoire existante.
// - consolide (L3) : fusionné avec un fait proche déjà connu
//   (déduplication par similarité d'embeddings).
// - canon (L4) : consolidé et passé le contrôle de contradiction, injecté
//   systématiquement dans le contexte.
// - archive (L5) : ancien fait canon non reconfirmé depuis longtemps —
//   jamais supprimé ("un oubli ne détruit jamais un fait établi", [MÉTA]
//   Continuité), mais plus injecté systématiquement.
export type NiveauMemoire = 'episodique' | 'consolide' | 'canon' | 'archive';

export interface Fact {
  id: string;
  type: FactType;
  texte: string;
  resolue?: boolean;
  niveau: NiveauMemoire;
  // Index (dans StoryState.messages) du dernier message ayant confirmé ou
  // fait référence à ce fait — sert de base à la décroissance L4 → L5.
  dernierAcces: number;
  // Si ce fait résulte d'une fusion (L3), ids des faits d'origine.
  fusionneDe?: string[];
}

export interface MemoryState {
  resume: string;
  faits: Fact[];
  dernierMessageIndexMaj: number;
}

// Pipeline de lore émergent (brief Phase 2) : contrairement aux faits de
// mémoire (ce qui s'est passé), une entrée de lore émergent est une
// nouvelle donnée durable du MONDE créée en cours de partie — un PNJ
// récurrent, un lieu, une faction, un objet ou un événement marquant.
// Distincte du lorebook Elyndor statique, mais rejoint le même pool de
// sélection sémantique une fois "permanent".
export type CategorieLoreEmergent = 'pnj' | 'objet' | 'lieu' | 'faction' | 'evenement';

export interface EntreeLoreEmergent {
  id: string;
  categorie: CategorieLoreEmergent;
  titre: string;
  contenu: string;
  // "provisoire" : vu une fois, pas encore confirmé comme durable — n'est
  // pas injecté dans le contexte. "permanent" : reconfirmé au moins une
  // fois (voir src/engine/emergentLore.ts) — validé avant tout ajout
  // permanent au lorebook, comme demandé par le brief.
  statut: 'provisoire' | 'permanent';
  premiereMention: number;
  dernierAcces: number;
}

// Incrémenté à chaque changement de forme des données persistées ; voir
// migrerHistoire dans storage.ts (esprit de l'auto-updater du brief Phase 2 :
// compatibilité de sauvegarde garantie d'une version à l'autre).
export const VERSION_SCHEMA_HISTOIRE = 3;

export interface StoryState {
  version: number;
  meta: StoryMeta;
  messages: Message[];
  memoire: MemoryState;
  loreEmergent: EntreeLoreEmergent[];
  settings: StorySettings;
}

export interface AppSettings {
  openRouterApiKey: string;
  model: string;
  // Clé de secours pour les embeddings (recherche sémantique du lore) si
  // OpenRouter n'en sert pas pour ce compte. Optionnelle : voir
  // src/engine/embeddings.ts.
  embeddingsApiKey?: string;
}

export interface LoreEntry {
  id: string;
  titre: string;
  contenu: string;
  // Similarité cosinus avec la requête, quand l'entrée vient de la
  // sélection sémantique (absente pour les entrées toujours actives).
  score?: number;
}
