import type {
  AppSettings,
  DirecteurState,
  EntreeLoreEmergent,
  EtatScene,
  MemoryState,
  Message,
  MondeState,
  SocialState,
} from '../types';
import type { ChapitreMonde } from '../mondes/types';
import { appellerModele, configurationLLM, type AppelOutil, type ChatMessage, type ToolDefinition } from './openrouter';
import { appelsOutilsDepuisObjet, decrireOutilsJson } from './toolCallingJson';
import { outilsPourComposant } from './tools';
import {
  CONSIGNE_EXTRACTION_MEMOIRE,
  contexteExtractionMemoire,
  interpreterExtractionMemoire,
  type ExtractionMemoire,
} from './memory';
import { consigneDirecteur, interpreterDirecteur, type AnalyseDirecteur } from './storyDirector';
import { chapitreAvantExtraction, consigneMonde } from './worldSimulation';
import { consigneSocial } from './socialDynamics';
import { consigneLoreEmergent, interpreterCandidatsLore, type CandidatsLoreEmergent } from './emergentLore';
import { CONSIGNE_RELEVE, interpreterReleve, type ReleveScene } from './etatScene';

/**
 * Extraction groupée : les analyses du post-traitement qui portent sur le
 * même extrait partagent un seul appel modèle, avec une sortie JSON à un
 * bloc par analyse. Chaque bloc est relu par le validateur de son module ;
 * un bloc absent ou invalide vaut null et l'appelant retombe sur l'appel
 * séparé de ce module. La narration et le STATE DELTA n'en font pas partie.
 */

export const BUDGET_EXTRACTION_PERIODIQUE = 600 + 400 + 500 + 500;
export const BUDGET_EXTRACTION_TOUR = 160 + 2600;

function transcriptGroupe(messages: Message[], personnageNom: string): string {
  return messages
    .map((m) => `${m.role === 'user' ? `Joueur (${personnageNom})` : 'Narrateur'} : ${m.content}`)
    .join('\n');
}

function sectionOutils(nomBloc: string, consigne: string, outils: ToolDefinition[]): string {
  return `${consigne}

Outils disponibles pour ce bloc :
${decrireOutilsJson(outils)}
Valeur du bloc "${nomBloc}" : {"appels": [{"outil": "nom_outil", "arguments": {...}}]} ; si aucun outil n'est nécessaire, exactement {"appels": []}.`;
}

function entete(blocs: string[], forme: string): string {
  return `Tu es le moteur d'analyse d'un logiciel de jeu de rôle : tu ne racontes rien. Tu réalises en une seule réponse ${blocs.length} analyses indépendantes du même extrait. Réponds UNIQUEMENT avec un objet JSON strict contenant les blocs ${blocs.map((b) => `"${b}"`).join(', ')} :
${forme}
Chaque bloc suit exactement la consigne de sa section ci-dessous, comme s'il s'agissait d'une réponse séparée ; une section n'influence pas les autres. Dans une consigne, « réponds avec un JSON » désigne la valeur du bloc et « appelle les outils » signifie lister les appels dans le bloc.`;
}

/** Objet JSON de premier niveau de la réponse ; null si la réponse est inexploitable. */
export function lireReponseGroupee(sortie: string): Record<string, unknown> | null {
  const match = sortie.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const objet: unknown = JSON.parse(match[0]);
    return objet && typeof objet === 'object' && !Array.isArray(objet) ? objet as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function estObjet(valeur: unknown): valeur is Record<string, unknown> {
  return !!valeur && typeof valeur === 'object' && !Array.isArray(valeur);
}

function sansErreur<T>(lecture: () => T | null): T | null {
  try {
    return lecture();
  } catch {
    return null;
  }
}

// ── Appel groupé « périodique » : mémoire, directeur, monde, social ──────────

export interface EntreePeriodiqueGroupee {
  appSettings: AppSettings;
  storyId?: string;
  /** Messages déjà filtrés pour le profil de contenu. */
  messages: Message[];
  depuisIndex: number;
  personnageNom: string;
  memoire: MemoryState;
  directeur: DirecteurState;
  monde: MondeState;
  social: SocialState;
  chapitres?: readonly ChapitreMonde[];
}

export interface BlocsPeriodiques {
  memoire: ExtractionMemoire | null;
  directeur: AnalyseDirecteur | null;
  monde: AppelOutil[] | null;
  social: AppelOutil[] | null;
}

export function messagesAppelPeriodiqueGroupe(entree: EntreePeriodiqueGroupee): ChatMessage[] {
  // Même chapitre, donc même outil avancer_chapitre, que l'appel séparé.
  const { chapitre } = chapitreAvantExtraction(entree.monde, entree.messages.length, entree.chapitres);
  const systeme = [
    entete(
      ['memoire', 'directeur', 'monde', 'social'],
      '{"memoire": {...}, "directeur": {...}, "monde": {"appels": [...]}, "social": {"appels": [...]}}',
    ),
    `=== BLOC "memoire" ===\n${CONSIGNE_EXTRACTION_MEMOIRE}\n\n${contexteExtractionMemoire(entree.memoire)}`,
    `=== BLOC "directeur" ===\n${consigneDirecteur(entree.directeur)}`,
    `=== BLOC "monde" ===\n${sectionOutils('monde', consigneMonde(entree.monde, chapitre), outilsPourComposant('monde', chapitre))}`,
    `=== BLOC "social" ===\n${sectionOutils('social', consigneSocial(entree.social), outilsPourComposant('social'))}`,
  ].join('\n\n');
  return [
    { role: 'system', content: systeme },
    {
      role: 'user',
      content: `Personnage du joueur : ${entree.personnageNom}\n\nEXTRAIT À ANALYSER :\n${transcriptGroupe(entree.messages.slice(entree.depuisIndex), entree.personnageNom)}`,
    },
  ];
}

/** Relit chaque bloc avec le validateur de son module ; un bloc invalide vaut null. */
export function lireBlocsPeriodiques(reponse: Record<string, unknown>, entree: EntreePeriodiqueGroupee): BlocsPeriodiques {
  const { memoire, directeur, monde, social } = reponse;
  return {
    memoire: estObjet(memoire) && typeof memoire.resume === 'string'
      ? sansErreur(() => interpreterExtractionMemoire(memoire, entree.memoire))
      : null,
    directeur: estObjet(directeur) && typeof directeur.arcActuel === 'string'
      ? sansErreur(() => interpreterDirecteur(directeur, entree.directeur))
      : null,
    monde: appelsOutilsDepuisObjet(monde),
    social: appelsOutilsDepuisObjet(social),
  };
}

/** null : l'appel a échoué ou sa réponse n'est pas un objet JSON. */
export async function extrairePeriodiqueGroupe(entree: EntreePeriodiqueGroupee): Promise<BlocsPeriodiques | null> {
  const sortie = await appellerModele({
    ...configurationLLM(entree.appSettings),
    storyId: entree.storyId,
    temperature: 0.2,
    maxTokens: BUDGET_EXTRACTION_PERIODIQUE,
    diagnosticLabel: 'Extraction groupée — périodique',
    messages: messagesAppelPeriodiqueGroupe(entree),
  });
  const reponse = lireReponseGroupee(sortie);
  return reponse ? lireBlocsPeriodiques(reponse, entree) : null;
}

// ── Appel groupé « tour » : état de scène + lore émergent ────────────────────

export interface EntreeTourGroupee {
  appSettings: AppSettings;
  storyId?: string;
  /** Messages déjà filtrés pour le profil de contenu. */
  messages: Message[];
  loreDepuisIndex: number;
  personnageNom: string;
  loreExistant: EntreeLoreEmergent[];
  nomMonde?: string;
  sceneActuelle: EtatScene;
  capitales: string[];
}

export interface BlocsTour {
  scene: ReleveScene | null;
  lore: CandidatsLoreEmergent | null;
}

export function messagesAppelTourGroupe(entree: EntreeTourGroupee): ChatMessage[] {
  const systeme = [
    entete(['scene', 'lore'], '{"scene": {...}, "lore": {"candidats": [...]}}'),
    `=== BLOC "scene" ===\n${CONSIGNE_RELEVE}`,
    `=== BLOC "lore" ===\n${consigneLoreEmergent(entree.appSettings, entree.loreExistant, entree.nomMonde)}`,
  ].join('\n\n');
  const etatPrecedent = JSON.stringify({
    ville: entree.sceneActuelle.ville ?? null,
    lieu: entree.sceneActuelle.lieu ?? null,
    presents: entree.sceneActuelle.presents,
  });
  return [
    { role: 'system', content: systeme },
    {
      role: 'user',
      content: `Personnage du joueur : ${entree.personnageNom}\nÉtat de scène précédent : ${etatPrecedent}\n\nEXTRAIT À ANALYSER :\n${transcriptGroupe(entree.messages.slice(entree.loreDepuisIndex), entree.personnageNom)}`,
    },
  ];
}

const CHAMPS_SCENE = ['ville', 'lieu', 'presents', 'minutesEcoulees'];

export function lireBlocsTour(reponse: Record<string, unknown>, entree: EntreeTourGroupee): BlocsTour {
  const { scene, lore } = reponse;
  return {
    scene: estObjet(scene) && CHAMPS_SCENE.some((champ) => champ in scene)
      ? interpreterReleve(JSON.stringify(scene), entree.sceneActuelle, entree.capitales, entree.messages.length, entree.personnageNom)
      : null,
    lore: sansErreur(() => interpreterCandidatsLore(lore, entree.appSettings, entree.personnageNom)),
  };
}

export async function extraireTourGroupe(entree: EntreeTourGroupee): Promise<BlocsTour | null> {
  const sortie = await appellerModele({
    ...configurationLLM(entree.appSettings),
    storyId: entree.storyId,
    temperature: 0.1,
    maxTokens: BUDGET_EXTRACTION_TOUR,
    diagnosticLabel: 'Extraction groupée — tour',
    messages: messagesAppelTourGroupe(entree),
  });
  const reponse = lireReponseGroupee(sortie);
  return reponse ? lireBlocsTour(reponse, entree) : null;
}
