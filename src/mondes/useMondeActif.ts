import { useEffect, useState } from 'react';
import { monde } from './index';
import type { PaquetMonde } from './types';

/** Paquet du monde actif, rafraîchi quand le monde actif change. */
export function useMondeActif(): PaquetMonde {
  const [, setId] = useState(monde.actifId());
  useEffect(() => monde.abonner(setId), []);
  return monde.actif();
}
