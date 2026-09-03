export type Creativite = 'faible' | 'moyenne' | 'elevee';
export type Longueur = 'courte' | 'moyenne' | 'longue';
// Violence a son échelle propre (jusqu'à "extrême"), distincte de Romance
// et Humour (échelle à 4 crans partant d'"aucun") — voir Préférences
// narratives, étape 4/5 de la création.
export type NiveauViolence = 'faible' | 'modere' | 'eleve' | 'extreme';
export type NiveauQuatre = 'aucun' | 'faible' | 'modere' | 'eleve';
export type LiberteJoueur = 'faible' | 'moderee' | 'elevee' | 'totale';
export type RythmeHistoire = 'lent' | 'normal' | 'rapide';
export type TonHistoire = 'sombre_realiste' | 'heroique_epique' | 'mysterieux_intrigant' | 'leger_aventureux';

export interface StorySettings {
  creativite: Creativite;
  longueur: Longueur;
  ton: TonHistoire;
  // Curseurs de contenu (brief Phase 2, contrôle d'âge). Plafonnés par le
  // profil de contenu de l'appareil quand celui-ci est GRAND_PUBLIC — voir
  // AppSettings.profilContenu et src/engine/contenuAdulte.ts.
  violence: NiveauViolence;
  romance: NiveauQuatre;
  humour: NiveauQuatre;
  liberteJoueur: LiberteJoueur;
  rythme: RythmeHistoire;
}

// Panneau "Contexte de l'Histoire" (brief Phase 2) : lieu, date, ambiance,
// objectifs en prose. Collecté à l'étape "Histoire" du parcours de
// création en 5 étapes, affiché ensuite dans la conversation. Pas
// d'"image" ici — génération d'images explicitement hors périmètre pour
// cette phase.
export interface ContexteHistoire {
  lieu: string;
  ambiance: string;
  dateChronique: string;
  objectifs: string;
}

export interface StoryMeta {
  id: string;
  personnageNom: string;
  personnageDescription: string;
  pointDeDepart: string;
  contexte: ContexteHistoire;
  createdAt: number;
  updatedAt: number;
  // Branches de conversation (brief Phase 2) : une histoire "branche" est une
  // copie indépendante créée depuis un point donné d'une histoire parente —
  // pour explorer une autre suite sans perdre l'originale. Champs optionnels
  // volontairement : les sauvegardes existantes restent valides sans
  // transformation, pas de bump de VERSION_SCHEMA_HISTOIRE nécessaire.
  brancheDeId?: string;
  pointDeBranchement?: number;
  // Réglages de prompt avancés (réglages concepteur, mode test) : override
  // par histoire des paramètres normalement fixés globalement dans
  // Réglages. Optionnels, ignorés tant qu'absents.
  modeleOverride?: string;
  temperatureOverride?: number;
  // Titre personnalisé donné depuis "Charger Conversation" (Renommer) —
  // affiché à la place de personnageNom quand présent.
  titre?: string;
}

// Bibliothèque de personas (brief Phase 2) : un persona réutilisable décrit
// {{user}} indépendamment d'une histoire donnée — prénom/description
// prêts à préremplir l'étape "Personnage" de la création plutôt que de
// ressaisir à chaque nouvelle histoire.
export interface Persona {
  id: string;
  nom: string;
  description: string;
  createdAt: number;
  // Détails optionnels (brief Phase 2, écran de création enrichi) — absents
  // sur les personas déjà sauvegardés avant cet ajout, donc tous facultatifs.
  sexe?: string;
  raceOrigine?: string;
  age?: string;
  apparence?: string;
}

export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  // Épinglé par le joueur pour retrouver facilement un bon moment (distinct
  // d'un signalement de problème) — voir Ajouts_A_Integrer.md #2.
  epingle?: boolean;
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

// Story Director / Scene Director (brief Phase 2, systèmes narratifs
// avancés) : suit l'arc en cours, la tension dramatique et les éléments
// plantés (foreshadowing) en attente de payoff, pour repérer la stagnation
// et orienter la prochaine réponse plutôt que de laisser le modèle dériver
// scène après scène sans direction.
export type NiveauTension = 'calme' | 'montante' | 'climax' | 'retombee';

export interface BeatNarratif {
  id: string;
  description: string;
  planteAuMessage: number;
  paye: boolean;
}

export interface DirecteurState {
  arcActuel: string;
  tension: NiveauTension;
  // Index (dans StoryState.messages) du dernier développement narratif
  // significatif repéré — sert de base à la détection de stagnation.
  dernierBeatIndex: number;
  beats: BeatNarratif[];
}

// World Simulation + State Machine (brief Phase 2, systèmes narratifs
// avancés) : le monde continue d'exister hors champ. Une zone perd en
// "activité" au fil des messages sans y être fait référence — jusqu'à
// dormante, jamais supprimée. Les déclencheurs sont évalués localement,
// de façon déterministe, contre les flags/compteurs — une vraie machine à
// états, pas une appréciation narrative du modèle.
export type NiveauActivite = 'active' | 'proche' | 'lointaine' | 'dormante';

export interface ZoneMonde {
  id: string;
  nom: string;
  niveau: NiveauActivite;
  description: string;
  // Index (dans StoryState.messages) du dernier message où la scène s'est
  // déroulée dans cette zone — base du calcul de niveau d'activité.
  dernierAcces: number;
}

export interface DeclencheurMonde {
  id: string;
  nom: string;
  // Une seule des deux conditions est définie ; absentes = jamais évalué
  // (déclencheur créé mais sans condition exploitable, ignoré).
  conditionFlag?: string;
  conditionCompteur?: { nom: string; seuil: number };
  effet: string;
  declenche: boolean;
  // Passé à true une fois la conséquence effectivement tissée dans une
  // réponse narrée (cf. mettreAJourMonde) — évite de la rappeler
  // indéfiniment une fois traitée.
  resolu: boolean;
}

export interface MondeState {
  zones: ZoneMonde[];
  flags: Record<string, boolean>;
  compteurs: Record<string, number>;
  declencheurs: DeclencheurMonde[];
}

// Engagements + dynamiques sociales (brief Phase 2, systèmes narratifs
// avancés) : les promesses/dettes/contrats pris envers un PNJ ne doivent
// pas être oubliés faute d'avoir été rappelés au joueur (auto-reminder), et
// les relations évoluent sur plusieurs axes plutôt qu'un simple "ami/
// ennemi" — avec une propagation limitée au sein d'une même faction.
export type TypeEngagement = 'promesse' | 'dette' | 'contrat';

export interface Engagement {
  id: string;
  type: TypeEngagement;
  description: string;
  partie: string;
  honore: boolean;
  rompu: boolean;
}

// Échelle -3..3 sur chaque axe ; 0 = neutre/inconnu.
export interface RelationPersonnage {
  id: string;
  nom: string;
  // Regroupe les personnages dont la réputation évolue ensemble (garde
  // d'une même ville, membres d'une même guilde...) — sert de base à la
  // propagation limitée des ajustements de relation.
  faction?: string;
  confiance: number;
  respect: number;
  peur: number;
  affection: number;
  hostilite: number;
}

export interface SocialState {
  engagements: Engagement[];
  relations: RelationPersonnage[];
}

// Incrémenté à chaque changement de forme des données persistées ; voir
// migrerHistoire dans storage.ts (esprit de l'auto-updater du brief Phase 2 :
// compatibilité de sauvegarde garantie d'une version à l'autre).
export const VERSION_SCHEMA_HISTOIRE = 9;

export interface StoryState {
  version: number;
  meta: StoryMeta;
  messages: Message[];
  memoire: MemoryState;
  loreEmergent: EntreeLoreEmergent[];
  settings: StorySettings;
  directeur: DirecteurState;
  monde: MondeState;
  social: SocialState;
}

// Contrôle d'âge (brief Phase 2) : profil déclaré une fois par appareil
// ("à l'achat" — ici au premier lancement, esprit sans vraie protection
// anti-piratage). GRAND_PUBLIC plafonne violence/romance et retire les
// contenus explicites du prompt ET du lore, imposé par le validateur (pas
// laissé à la seule discrétion du modèle) — voir contenuAdulte.ts.
export type ProfilContenu = 'grand_public' | 'adulte';

// Moteur d'inférence (demande explicite de faire tourner un modèle
// téléchargé en local plutôt que de dépendre d'OpenRouter) : 'openrouter'
// reste le mode par défaut, 'local' bascule sur expo-litert-lm — voir
// src/engine/localInference.ts et src/storage/modeleLocalStore.ts.
// Natif uniquement : jamais proposé/activable sur le build web.
export type MoteurInference = 'openrouter' | 'local';

export interface AppSettings {
  openRouterApiKey: string;
  model: string;
  // undefined (ou 'openrouter') = comportement historique. Voir MoteurInference.
  moteurInference?: MoteurInference;
  // Clé de secours pour les embeddings (recherche sémantique du lore) si
  // OpenRouter n'en sert pas pour ce compte. Optionnelle : voir
  // src/engine/embeddings.ts.
  embeddingsApiKey?: string;
  // undefined tant que non déclaré (déclaration requise avant de jouer).
  profilContenu?: ProfilContenu;
  // Fixé par l'utilisateur au premier passage en ADULTE ; requis pour
  // repasser de GRAND_PUBLIC à ADULTE ensuite. Stocké en clair en local :
  // c'est un garde-fou logiciel, pas une protection réelle (voir brief
  // Phase 2, distribution "esprit sans vraie protection").
  codeDeverrouillage?: string;
  // Distribution "esprit" (brief Phase 2) : accepté une fois par appareil à
  // l'écran d'activation — pas une vraie clé de licence vérifiée côté
  // serveur, juste la marche à suivre d'une activation.
  betaAcceptee?: boolean;
  // Réglages concepteur (Ajouts_A_Integrer.md #6) : accès direct pendant la
  // phase de test, sans code ni protection — un mécanisme de déverrouillage
  // (même esprit que codeDeverrouillage) viendra plus tard, une fois sorti
  // de cette phase.
  modeConcepteur?: boolean;
}

// Pack de contenu additionnel (plugin "esprit", brief Phase 2 section 5) :
// uniquement des données de lore (titre/contenu texte), jamais de code —
// rien à exécuter, donc rien à isoler dans un bac à sable. Rejoint le pool
// de sélection sémantique du lore Elyndor au même titre que le lore
// émergent, avec la marque du pack dans le titre.
export interface PluginEntree {
  titre: string;
  contenu: string;
}

export interface Plugin {
  id: string;
  nom: string;
  entrees: PluginEntree[];
  installeLe: number;
}

export interface LoreEntry {
  id: string;
  titre: string;
  contenu: string;
  // Similarité cosinus avec la requête, quand l'entrée vient de la
  // sélection sémantique (absente pour les entrées toujours actives).
  score?: number;
}
