import type { ImageSourcePropType } from 'react-native';

// Portraits peints du personnage (étape Personnage de la création, Sexe ×
// Race — voir la conversation sur les images de fond, même principe).
// Metro exige un chemin littéral pour chaque require() : pas de
// require(variable), donc une table explicite plutôt qu'une construction
// dynamique du chemin. Une combinaison absente n'affiche simplement pas de
// portrait (voir obtenirPortrait) — l'écran fonctionne déjà sans, ce qui
// permet d'ajouter les images progressivement sans jamais faire planter
// l'app.
const PORTRAITS: Record<string, ImageSourcePropType> = {
  'humains-homme': require('../../assets/portraits/humains-homme.png'),
  'humains-femme': require('../../assets/portraits/humains-femme.png'),
  'humains-autre': require('../../assets/portraits/humains-autre.png'),
  'hauts-elfes-homme': require('../../assets/portraits/hauts-elfes-homme.png'),
  'hauts-elfes-femme': require('../../assets/portraits/hauts-elfes-femme.png'),
  'hauts-elfes-autre': require('../../assets/portraits/hauts-elfes-autre.png'),
  'elfes-noirs-homme': require('../../assets/portraits/elfes-noirs-homme.png'),
  'elfes-noirs-femme': require('../../assets/portraits/elfes-noirs-femme.png'),
  'elfes-noirs-autre': require('../../assets/portraits/elfes-noirs-autre.png'),
  'valkyries-homme': require('../../assets/portraits/valkyries-homme.png'),
  'valkyries-femme': require('../../assets/portraits/valkyries-femme.png'),
  'valkyries-autre': require('../../assets/portraits/valkyries-autre.png'),
  'amazones-nordiques-homme': require('../../assets/portraits/amazones-nordiques-homme.png'),
  'amazones-nordiques-femme': require('../../assets/portraits/amazones-nordiques-femme.png'),
  'amazones-nordiques-autre': require('../../assets/portraits/amazones-nordiques-autre.png'),
  'sultanats-homme': require('../../assets/portraits/sultanats-homme.png'),
  'sultanats-femme': require('../../assets/portraits/sultanats-femme.png'),
  'sultanats-autre': require('../../assets/portraits/sultanats-autre.png'),
  'amazones-sombres-homme': require('../../assets/portraits/amazones-sombres-homme.png'),
  'amazones-sombres-femme': require('../../assets/portraits/amazones-sombres-femme.png'),
  'amazones-sombres-autre': require('../../assets/portraits/amazones-sombres-autre.png'),
  'orques-nobles-homme': require('../../assets/portraits/orques-nobles-homme.png'),
  'orques-nobles-femme': require('../../assets/portraits/orques-nobles-femme.png'),
  'orques-nobles-autre': require('../../assets/portraits/orques-nobles-autre.png'),
  'orcs-homme': require('../../assets/portraits/orcs-homme.png'),
  'orcs-femme': require('../../assets/portraits/orcs-femme.png'),
  'orcs-autre': require('../../assets/portraits/orcs-autre.png'),
  'hommes-betes-homme': require('../../assets/portraits/hommes-betes-homme.png'),
  'hommes-betes-femme': require('../../assets/portraits/hommes-betes-femme.png'),
  'hommes-betes-autre': require('../../assets/portraits/hommes-betes-autre.png'),
  'tribus-primales-homme': require('../../assets/portraits/tribus-primales-homme.png'),
  'tribus-primales-femme': require('../../assets/portraits/tribus-primales-femme.png'),
  'tribus-primales-autre': require('../../assets/portraits/tribus-primales-autre.png'),
  'sirenes-homme': require('../../assets/portraits/sirenes-homme.png'),
  'sirenes-femme': require('../../assets/portraits/sirenes-femme.png'),
  'sirenes-autre': require('../../assets/portraits/sirenes-autre.png'),
  'naga-marines-homme': require('../../assets/portraits/naga-marines-homme.png'),
  'naga-marines-femme': require('../../assets/portraits/naga-marines-femme.png'),
  'naga-marines-autre': require('../../assets/portraits/naga-marines-autre.png'),
  'nains-homme': require('../../assets/portraits/nains-homme.png'),
  'nains-femme': require('../../assets/portraits/nains-femme.png'),
  'nains-autre': require('../../assets/portraits/nains-autre.png'),
  'geantes-homme': require('../../assets/portraits/geantes-homme.png'),
  'geantes-femme': require('../../assets/portraits/geantes-femme.png'),
  'geantes-autre': require('../../assets/portraits/geantes-autre.png'),
};

/**
 * Portrait correspondant à la race (id, ex. "humains") et au sexe choisis
 * ("Homme"/"Femme"/"Autre", voir OPTIONS_SEXE dans CreateScreen.tsx).
 * Renvoie undefined si l'un des deux manque encore ou si la combinaison
 * n'a pas d'image — l'appelant doit alors simplement ne rien afficher.
 */
export function obtenirPortrait(raceId: string | undefined, sexe: string | undefined): ImageSourcePropType | undefined {
  if (!raceId || !sexe) return undefined;
  return PORTRAITS[`${raceId}-${sexe.toLowerCase()}`];
}
