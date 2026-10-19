import type { ImageSourcePropType } from 'react-native';
import type { PaquetMonde, RaceMonde } from './types';
import { PAQUET_ELYNDOR } from './elyndor';

export type { PaquetMonde } from './types';

// Registre des paquets monde et monde actif (chantier multi-mondes).
// L'interface lit le monde actif ; le moteur lit le monde de l'histoire en
// cours (StoryMeta.mondeId, absent = elyndor). Ouvrir une histoire d'un autre
// monde bascule le monde actif sur le sien : les deux coïncident en jeu.

export const MONDE_PAR_DEFAUT = 'elyndor';

const PAQUETS: readonly PaquetMonde[] = [PAQUET_ELYNDOR];

export function listerMondes(): readonly PaquetMonde[] {
  return PAQUETS;
}

export function trouverMonde(id: string | null | undefined): PaquetMonde | undefined {
  return id ? PAQUETS.find((p) => p.id === id) : undefined;
}

/** Paquet d'un identifiant ; inconnu ou absent : Elyndor. */
export function paquetMonde(id?: string | null): PaquetMonde {
  return trouverMonde(id) ?? trouverMonde(MONDE_PAR_DEFAUT)!;
}

/** Identifiant du monde d'une histoire : une histoire sans mondeId est d'Elyndor. */
export function mondeIdDe(meta: { mondeId?: string } | null | undefined): string {
  return meta?.mondeId || MONDE_PAR_DEFAUT;
}

let idActif = MONDE_PAR_DEFAUT;
const abonnes = new Set<(id: string) => void>();

export const monde = {
  /** Paquet du monde actif. */
  actif(): PaquetMonde {
    return paquetMonde(idActif);
  },
  actifId(): string {
    return idActif;
  },
  /** Change le monde actif en mémoire (la mémorisation dans les réglages reste à l'appelant). */
  definirActif(id: string): void {
    const suivant = paquetMonde(id).id;
    if (suivant === idActif) return;
    idActif = suivant;
    for (const abonne of abonnes) abonne(suivant);
  },
  abonner(abonne: (id: string) => void): () => void {
    abonnes.add(abonne);
    return () => { abonnes.delete(abonne); };
  },
};

/** Histoires du monde donné (une histoire sans mondeId est d'Elyndor). */
export function histoiresDuMonde<T extends { mondeId?: string }>(liste: readonly T[], mondeId: string): T[] {
  return liste.filter((meta) => mondeIdDe(meta) === mondeId);
}

/** Titre du bloc de lore du prompt : celui du paquet, sinon dérivé du nom. */
export function titreLoreDe(paquet: PaquetMonde): string {
  return paquet.titreLore ?? `LORE ${paquet.carte.nom.toUpperCase()} PERTINENT`;
}

export function racesDuMonde(paquet: PaquetMonde): RaceMonde[] {
  return paquet.modules?.races?.liste ?? [];
}

/** « d'Elyndor », « de Valcourt » : complément de nom avec élision. */
export function complementDe(nom: string): string {
  return /^[aeiouyhàâéèêëîïôûü]/i.test(nom) ? `d'${nom}` : `de ${nom}`;
}

/** « d'Elyndor » : pour les libellés de l'interface. */
export function deNomMonde(paquet: PaquetMonde): string {
  return complementDe(paquet.carte.nom);
}

/**
 * Portrait correspondant à la race (id, ex. "humains") et au sexe choisis
 * ("Homme"/"Femme"/"Autre", voir OPTIONS_SEXE dans CreateScreenStudio.tsx).
 * Renvoie undefined si l'un des deux manque encore, si le monde n'a pas de
 * portraits ou si la combinaison n'a pas d'image — l'appelant doit alors
 * simplement ne rien afficher.
 */
export function obtenirPortrait(
  raceId: string | undefined,
  sexe: string | undefined,
  mondeId: string = monde.actifId(),
): ImageSourcePropType | undefined {
  if (!raceId || !sexe) return undefined;
  return paquetMonde(mondeId).modules?.races?.portraits?.[`${raceId}-${sexe.toLowerCase()}`];
}
