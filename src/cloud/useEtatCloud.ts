import { useEffect, useState } from 'react';
import { abonnerCloud, lireEtatCloud, type EtatCloud } from './serviceCloud';

export function useEtatCloud(): EtatCloud {
  const [etat, setEtat] = useState<EtatCloud>(lireEtatCloud());
  useEffect(() => abonnerCloud(setEtat), []);
  return etat;
}
