// Elyndor — Noyau narratif natif V2.1
// Fondations de types communes aux quinze responsabilités M01 à M15.
//
// Ce fichier ne remplace aucun stockage existant et n'est pas encore raccordé
// au pipeline de génération. Il décrit un langage commun pour le futur Kernel.

export type IdMoteurNarratif =
  | 'M01'
  | 'M02'
  | 'M03'
  | 'M04'
  | 'M05'
  | 'M06'
  | 'M07'
  | 'M08'
  | 'M09'
  | 'M10'
  | 'M11'
  | 'M12'
  | 'M13'
  | 'M14'
  | 'M15';

export type IdInvariantNoyau =
  | 'K01'
  | 'K02'
  | 'K03'
  | 'K04'
  | 'K05'
  | 'K06'
  | 'K07'
  | 'K08'
  | 'K09'
  | 'K10';

export type StatutInformation =
  | 'canonique'
  | 'observation'
  | 'rapport'
  | 'croyance'
  | 'rumeur'
  | 'hypothese'
  | 'inconnu';

export type CategorieConsequence =
  | 'materielle'
  | 'contractuelle'
  | 'institutionnelle'
  | 'psychologique'
  | 'sociale'
  | 'informationnelle'
  | 'narrative';

export type NatureEchange =
  | 'fiction'
  | 'hors_personnage'
  | 'clarification'
  | 'reglage'
  | 'arret';

export type EtatFilNarratif =
  | 'actif'
  | 'dormant'
  | 'suspendu'
  | 'clos'
  | 'abandonne';

export type EtatEngagement =
  | 'propose'
  | 'accepte'
  | 'en_cours'
  | 'accompli'
  | 'rompu'
  | 'expire'
  | 'annule'
  | 'conteste'
  | 'suspendu';

export type NiveauRendu =
  | 'desactive'
  | 'faible'
  | 'modere'
  | 'eleve'
  | 'maximal';

export type EtatResolution =
  | 'reussite'
  | 'reussite_partielle'
  | 'echec'
  | 'interrompue'
  | 'impossible'
  | 'a_clarifier';

export type PorteeInformation = 'privee' | 'groupe' | 'locale' | 'publique';

export interface SourceNarrative {
  id: string;
  type:
    | 'evenement'
    | 'fait'
    | 'perception'
    | 'message_joueur'
    | 'document'
    | 'temoignage'
    | 'regle_monde'
    | 'reglage'
    | 'autre';
  description?: string;
  messageIndex?: number;
  tempsFictif?: string;
}

export interface CadreEchange {
  histoireId: string;
  varianteId?: string;
  nature: NatureEchange;
  initiativeJoueur: string;
  decisionPendante?: string;
}

export interface CadrageScene {
  id?: string;
  lieu?: string;
  pointDeVue?: string;
  enjeu?: string;
  ambiance?: string;
  participants: string[];
  momentFictif?: string;
}

export interface EvenementNarratif {
  id: string;
  resume: string;
  acteurs: string[];
  cibles?: string[];
  lieu?: string;
  tempsFictif?: string;
  causes?: string[];
  sources: SourceNarrative[];
  categorie?: CategorieConsequence;
  canonique: boolean;
}

export interface IdentitePersonnage {
  id: string;
  nom: string;
  traits: string[];
  valeurs: string[];
  buts: string[];
  competences: string[];
  etatEmotionnel?: string;
}

export interface RelationDirigee {
  id: string;
  acteurId: string;
  cibleId: string;
  confiance?: number;
  attachement?: number;
  respect?: number;
  peur?: number;
  ressentiment?: number;
  dependance?: number;
  attirance?: number;
  attentes: string[];
  evenementsJustificatifs: string[];
}

export interface ReputationSituee {
  id: string;
  cibleId: string;
  communauteId: string;
  jugement: string;
  force?: number;
  inertie?: number;
  affirmationIds: string[];
  effetsObservables: string[];
}

export interface EngagementNarratif {
  id: string;
  parties: string[];
  termes: string[];
  etat: EtatEngagement;
  acceptePar: string[];
  echeance?: string;
  preuvesAttendues?: string[];
  reconnaissancePar?: string[];
  contrepartie?: string;
  conditionsSortie?: string[];
  sources: SourceNarrative[];
}

export interface InstitutionNarrative {
  id: string;
  nom: string;
  objectifs: string[];
  regles: string[];
  mandat?: string;
  organisation?: string;
  moyens: string[];
  agenda: string[];
}

export interface BlessureNarrative {
  id: string;
  cibleId: string;
  description: string;
  gravite?: 'mineure' | 'serieuse' | 'critique';
  contraintes: string[];
  soins: string[];
  evolution?: string;
  sourceEvenementId?: string;
}

export interface PositionPhysique {
  entiteId: string;
  lieu: string;
  precision?: string;
}

export interface SituationPhysique {
  lieu?: string;
  positions: PositionPhysique[];
  objetsPertinents: string[];
  blessures: BlessureNarrative[];
  contraintesMaterielles: string[];
  moyensDisponibles: string[];
}

export interface DelegationNarrative {
  id: string;
  auteurId: string;
  beneficiaireId: string;
  tache: string;
  perimetre: string;
  margeInitiative?: string;
  duree?: string;
  conditionsArret?: string[];
  revoquee: boolean;
}

/**
 * Vue normalisee et transitoire des reglages de l'application pour M08.
 * Elle ne doit pas devenir un second stockage concurrent des parametres UI.
 */
export interface ProfilRenduNarratif {
  mode: 'grand_public' | 'adulte';
  ton?: string;
  violence: NiveauRendu;
  romance: NiveauRendu;
  crudite?: NiveauRendu;
  detail?: NiveauRendu;
  longueur?: string;
  rythme?: string;
  creativite?: string;
  humour?: NiveauRendu;
  autresPreferences: Record<string, string | number | boolean>;
}

export interface TendanceArchetype {
  id: string;
  nom: string;
  attentions: string[];
  optionsAction: string[];
  variantes: string[];
}

export interface AncrageSocial {
  personnageId: string;
  statutReconnu?: string;
  droits: string[];
  acces: string[];
  dependances: string[];
  soutiens: string[];
  expositions: string[];
}

export interface FilNarratif {
  id: string;
  enjeu: string;
  acteurs: string[];
  etat: EtatFilNarratif;
  importance?: number;
  conditionsReprise: string[];
  engagementIds?: string[];
  evenementIds?: string[];
}

export interface GroupeNarratif {
  id: string;
  membres: string[];
  rolesContextuels: Record<string, string>;
  butCommun?: string;
  reglesDecision: string[];
}

export interface LimiteActive {
  id: string;
  theme: string;
  portee: string;
  intensite?: NiveauRendu;
  signalActuel?: string;
  autorisee: boolean;
  revocable: boolean;
  source: SourceNarrative;
}

export interface TentativeAction {
  id: string;
  auteurId: string;
  description: string;
  methode?: string;
  cibles: string[];
  moyens: string[];
  opposition: string[];
  preparation: string[];
  connaissanceAccessible: string[];
}

export interface ResolutionAction {
  tentativeId: string;
  etat: EtatResolution;
  resume: string;
  facteurs: string[];
  effets: PropositionTransition[];
}

export interface AffirmationNarrative {
  id: string;
  contenu: string;
  statut: StatutInformation;
  origine?: SourceNarrative;
  credibilite?: number;
}

export interface TransmissionInformation {
  id: string;
  affirmationId: string;
  emetteurId?: string;
  destinataireIds: string[];
  canal: string;
  moment?: string;
  fidelite?: number;
  portee: PorteeInformation;
  recue: boolean;
}

export interface ConnaissanceSituee {
  acteurId: string;
  affirmationId: string;
  statut: StatutInformation;
  sourceIds: string[];
  confiance?: number;
  interpretation?: string;
}

export type DomaineEtatNarratif =
  | 'chronologie'
  | 'scene'
  | 'personnage'
  | 'relation'
  | 'reputation'
  | 'engagement'
  | 'institution'
  | 'physique'
  | 'delegation'
  | 'rendu'
  | 'archetype'
  | 'social'
  | 'fil'
  | 'groupe'
  | 'limite'
  | 'resolution'
  | 'information';

export interface PropositionTransition<T = unknown> {
  id: string;
  moteurProprietaire: IdMoteurNarratif;
  domaine: DomaineEtatNarratif;
  categorie?: CategorieConsequence;
  cibleIds: string[];
  justification: string;
  sourceIds: string[];
  valeurProposee: T;
  perceptible: boolean;
  transmissible: boolean;
}

export interface BlocageNarratif {
  type:
    | 'contradiction'
    | 'information_manquante'
    | 'limite'
    | 'impossibilite'
    | 'agentivite'
    | 'autre';
  raison: string;
  questionClarification?: string;
  sources?: SourceNarrative[];
}

export interface ResultatMoteur<TContribution = unknown> {
  moteur: IdMoteurNarratif;
  contribution?: TContribution;
  transitions: PropositionTransition[];
  contraintes: string[];
  alertes: string[];
  blocage?: BlocageNarratif;
}

export interface ContexteNarratifV21 {
  cadre: CadreEchange;
  scene: CadrageScene;
  profilRendu: ProfilRenduNarratif;
  limitesActives: LimiteActive[];
  evenementsPertinents: EvenementNarratif[];
  personnages: IdentitePersonnage[];
  relations: RelationDirigee[];
  reputations: ReputationSituee[];
  engagements: EngagementNarratif[];
  institutions: InstitutionNarrative[];
  situationPhysique: SituationPhysique;
  delegations: DelegationNarrative[];
  archetypes: TendanceArchetype[];
  ancragesSociaux: AncrageSocial[];
  filsNarratifs: FilNarratif[];
  groupes: GroupeNarratif[];
  connaissances: ConnaissanceSituee[];
  affirmations: AffirmationNarrative[];
  transmissions: TransmissionInformation[];
  resultatsDejaEtablis: ResolutionAction[];
  incertitudes: string[];
}

export interface ControleNarratif {
  id:
    | 'continuite'
    | 'agentivite'
    | 'causalite'
    | 'savoir'
    | 'engagement'
    | 'social'
    | 'registre'
    | 'limites'
    | 'fidelite_recit';
  ok: boolean;
  raison?: string;
  sources?: SourceNarrative[];
}
