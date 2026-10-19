import { racesDuMonde } from './index';
import type { PaquetMonde } from './types';

/** Étapes de la création : le monde est choisi avant l'accueil, il n'a plus d'étape. */
export const ETAPES_CREATION = ['Personnage', 'Départ', 'Style', 'Résumé'] as const;

export interface ParcoursCreation {
  /** Choix de la race dans l'étape Personnage : seulement avec un module races. */
  choixRace: boolean;
  /** Lieux et situations proposés ; sinon le joueur écrit son lieu et sa situation. */
  departListe: boolean;
}

export function parcoursCreation(paquet: PaquetMonde): ParcoursCreation {
  const depart = paquet.modules?.depart;
  return {
    choixRace: racesDuMonde(paquet).length > 0,
    departListe: depart?.mode === 'liste' && !!depart.lieux?.length,
  };
}
