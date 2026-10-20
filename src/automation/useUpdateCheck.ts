import { useCallback, useEffect, useState } from 'react';
import { enqueueUpdateCheckNow, getLastUpdateCheck } from './routines';
import { resumerVerificationMiseAJour, type UpdateCheckSnapshot } from './updateCheckState';
import { useAutomationDiagnostics } from './useAutomationDiagnostics';

/**
 * Lit le résultat stocké par la routine updates.check et le rafraîchit à
 * chaque fin d'exécution de cette routine (abonnement aux diagnostics du
 * noyau, sans interrogation périodique ni second appel réseau).
 */
export function useUpdateCheck() {
  const derniereExecution = useAutomationDiagnostics().lastRuns['updates.check'];
  const [snapshot, setSnapshot] = useState<UpdateCheckSnapshot | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let actif = true;
    void getLastUpdateCheck()
      .then((resultat) => { if (actif) setSnapshot(resultat); })
      .catch(() => {})
      .finally(() => { if (actif && derniereExecution) setEnCours(false); });
    return () => { actif = false; };
  }, [derniereExecution?.at]);

  const verifierMaintenant = useCallback(async () => {
    setEnCours(true);
    try {
      await enqueueUpdateCheckNow();
    } catch {
      setEnCours(false);
    }
  }, []);

  return {
    ...resumerVerificationMiseAJour(snapshot, enCours ? undefined : derniereExecution),
    enCours,
    verifierMaintenant,
  };
}
