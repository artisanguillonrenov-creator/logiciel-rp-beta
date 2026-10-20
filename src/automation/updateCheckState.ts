import type { InfoMiseAJour } from '../engine/updater';
import type { AutomationRunInfo } from './kernelCore';

export interface UpdateCheckSnapshot {
  checkedAt: number;
  info: InfoMiseAJour;
}

export interface EtatVerificationMiseAJour {
  /** Dernier résultat réussi stocké par la routine updates.check. */
  snapshot: UpdateCheckSnapshot | null;
  disponible: boolean;
  /** Erreur de la dernière exécution, seulement si elle est postérieure au dernier succès. */
  erreur?: string;
}

export function resumerVerificationMiseAJour(
  snapshot: UpdateCheckSnapshot | null,
  derniereExecution?: AutomationRunInfo,
): EtatVerificationMiseAJour {
  const echecPlusRecent = derniereExecution && !derniereExecution.ok
    && (!snapshot || derniereExecution.at > snapshot.checkedAt);
  return {
    snapshot,
    disponible: snapshot?.info.disponible === true,
    erreur: echecPlusRecent ? derniereExecution.error ?? 'Vérification impossible pour le moment.' : undefined,
  };
}
