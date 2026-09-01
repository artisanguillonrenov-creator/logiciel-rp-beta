// Direction artistique "grimoire illuminé" (Direction_Artistique_Elyndor.md) :
// panneaux ornés semi-transparents sur fond sombre, une seule famille serif
// dans toute l'interface, motif de séparateur ornemental récurrent. Ce
// fichier ne fixe que les tokens ; les composants qui les appliquent (coins
// droits, liseré fin, glow) vivent dans src/components/.
export const couleurs = {
  fond: '#0A0D1A',
  // Panneaux : semi-transparents (~88%) pour laisser deviner le fond
  // derrière eux plutôt qu'une carte pleine façon app générique.
  fondCarte: 'rgba(18, 23, 43, 0.88)',
  fondChampSaisie: 'rgba(10, 13, 26, 0.6)',
  bordure: '#2A3255',
  texte: '#D8DCE8',
  texteAtténué: '#8B94B0',
  // Accent lumineux (bordures actives, icônes sélectionnées) — glow léger
  // appliqué via ombresLueur ci-dessous, jamais un box-shadow gris.
  accent: '#5AACFF',
  accentClair: '#8CC6FF',
  // Or/champagne : nom du monde, noms de personnage, éléments précieux.
  dore: '#E4D3A0',
  danger: '#E3707D',
  bulleJoueur: 'rgba(90, 172, 255, 0.14)',
  bulleNarrateur: 'rgba(18, 23, 43, 0.88)',
};

export const espacement = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

// Coins droits partout (pas d'arrondi façon carte SaaS) — seul un radius
// minime reste disponible pour des cas ponctuels (pastille, avatar...).
export const rayon = {
  sm: 0,
  md: 0,
  lg: 2,
};

// Glow léger sur l'accent bleu, pour les éléments actifs (bordure de champ
// en focus, cercle d'étape actif...). Rendu correctement sur web et iOS ;
// dégradé sur Android (RN n'y colore pas les ombres nativement).
export const ombresLueur = {
  shadowColor: couleurs.accent,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.6,
  shadowRadius: 6,
  elevation: 3,
};

// Une seule famille serif dans toute l'interface — pas de repli sans-serif
// (voir App.tsx pour le chargement). Les noms de police sont ceux exportés
// par @expo-google-fonts ; le fallback en cas d'échec de chargement est le
// serif système via la pile déclarée sur chaque plateforme au besoin.
export const polices = {
  // Grands titres d'écran / nom du monde.
  display: 'Cinzel_700Bold',
  displaySemiGras: 'Cinzel_600SemiBold',
  // Titres de section, noms de personnage.
  titre: 'CormorantGaramond_600SemiBold',
  // Texte courant.
  corps: 'CormorantGaramond_400Regular',
  corpsMedium: 'CormorantGaramond_500Medium',
};

// Labels de champ / tags : petites capitales décoratives (RN ne supporte
// pas font-variant: small-caps de façon fiable multiplateforme — la casse
// forcée + letter-spacing en est l'équivalent pratique).
export const stylePetitesCapitales = {
  fontFamily: polices.corpsMedium,
  textTransform: 'uppercase' as const,
  letterSpacing: 1.5,
};
