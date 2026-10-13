import type { AppSettings } from '../types';
import { lireReglagesVisuels } from '../concepteur/reglagesVisuelsStore';
import type { ReglagesVisuels } from '../concepteur/reglagesVisuels';
import type { ContratVisuel } from './contratVisuel';
import { adaptateurSelonReglages, type AdaptateurImage, type CapacitesGenerateur } from './fournisseursImages';
import { journaliser } from './journalDiagnostic';
import {
  construireTrace,
  preparerRequeteImage,
  type PreparationImage,
  type ReferenceCandidate,
  type TraceIllustration,
} from './moteurVisuel';

/**
 * Service visuel UNIQUE : le seul point de l'application qui appelle un
 * générateur d'images. Scènes, portraits, aperçus libres, aperçus de scène et
 * tout futur module image passent par `executerImage`. Il lit une fois la
 * configuration de l'Atelier, les capacités du générateur choisi, construit
 * la requête effective (moteurVisuel) et journalise la trace complète.
 *
 * Aucune génération n'est lancée sans demande explicite de l'appelant ; le
 * mode `simulation` montre la requête telle qu'elle serait envoyée.
 */

export interface DemandeImage {
  contrat: ContratVisuel;
  candidats?: readonly ReferenceCandidate[];
  negatifCanon?: readonly string[];
  storyId?: string;
  revision?: string;
  extraction?: TraceIllustration['extraction'];
  signal?: AbortSignal;
  /** Prépare et trace sans rien envoyer au générateur. */
  simulation?: boolean;
  /** Références retirées à la main (aperçu) : tracées comme écartées. */
  retireesManuellement?: ReadonlyArray<{ id: string; libelle: string }>;
  /** Où l'image sera rangée (diagnostic) : « scène <révision> », « avatar <id> », « aperçu (non enregistré) ». */
  destination?: string;
}

export interface ResultatImage {
  image?: string;
  preparation: PreparationImage;
  trace: TraceIllustration;
}

interface Dependances {
  lireReglages(): Promise<ReglagesVisuels>;
  lireSettings(): Promise<AppSettings>;
  adaptateur(settings: AppSettings): AdaptateurImage;
}

const DEPENDANCES_PAR_DEFAUT: Dependances = {
  lireReglages: lireReglagesVisuels,
  // Chargement paresseux : le stockage natif n'est pas importé par les outils Node.
  lireSettings: () => (require('../storage/storage') as typeof import('../storage/storage')).getSettings(),
  adaptateur: adaptateurSelonReglages,
};

let dependances: Dependances = DEPENDANCES_PAR_DEFAUT;

/** Tests : remplace le stockage et le générateur (aucun réseau, aucun GPU). */
export function definirDependancesServiceVisuel(remplacement: Partial<Dependances> | null): void {
  dependances = remplacement ? { ...DEPENDANCES_PAR_DEFAUT, ...remplacement } : DEPENDANCES_PAR_DEFAUT;
}

function identifiantOperation(): string {
  return `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Capacités du générateur actuellement choisi (lecture seule, aucune génération). */
export async function capacitesGenerateurCourant(): Promise<CapacitesGenerateur> {
  const settings = await dependances.lireSettings();
  return dependances.adaptateur(settings).capacites();
}

export async function executerImage(demande: DemandeImage): Promise<ResultatImage> {
  const operation = identifiantOperation();
  const reglages = await dependances.lireReglages();
  const settings = await dependances.lireSettings();
  const adaptateur = dependances.adaptateur(settings);
  const capacites = await adaptateur.capacites();
  const preparation = preparerRequeteImage({
    contrat: demande.contrat,
    reglages,
    capacites,
    candidats: demande.candidats,
    profilContenu: settings.profilContenu,
    negatifCanon: demande.negatifCanon,
  });
  for (const ref of demande.retireesManuellement ?? []) {
    preparation.references.ecartees.push({ id: ref.id, libelle: ref.libelle, raison: 'retirée à la main dans l’aperçu' });
  }
  const contexte = { operation, storyId: demande.storyId, revision: demande.revision, extraction: demande.extraction, destination: demande.destination };
  if (demande.simulation) {
    return { preparation, trace: construireTrace(preparation, { ...contexte, statut: 'simulation' }, reglages) };
  }
  const debut = Date.now();
  try {
    const image = await adaptateur.executer(preparation.requete, demande.signal);
    const trace = construireTrace(preparation, { ...contexte, statut: 'ok', dureeMs: Date.now() - debut }, reglages);
    journaliser('image', { ...trace }, demande.storyId);
    return { image, preparation, trace };
  } catch (erreur) {
    const message = erreur instanceof Error ? erreur.message : String(erreur);
    journaliser('image', { ...construireTrace(preparation, { ...contexte, statut: 'erreur', dureeMs: Date.now() - debut, erreur: message }, reglages) }, demande.storyId);
    throw erreur;
  }
}
