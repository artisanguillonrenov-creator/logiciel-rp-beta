// Direction artistique Elyndor V2 — fantasy sombre cinématique.
//
// Principe : le monde et les décisions utilisent l'or ; l'IA, la magie et
// les états de focus utilisent le bleu arcane. Les surfaces restent très
// sombres et translucides afin que l'illustration porte l'immersion sans
// sacrifier la lisibilité.
export const couleurs = {
  // Profondeur générale : bleu-noir, jamais noir pur.
  fond: '#07111C',
  fondProfond: '#040A12',
  fondCarte: 'rgba(7, 17, 28, 0.90)',
  fondCarteDense: 'rgba(9, 22, 36, 0.96)',
  fondChampSaisie: 'rgba(4, 12, 22, 0.76)',

  // Bordures et texte.
  bordure: '#29445C',
  bordureSubtile: 'rgba(141, 171, 196, 0.24)',
  bordureDoree: 'rgba(216, 179, 107, 0.72)',
  texte: '#E9E3D5',
  texteAtténué: '#9CA8B4',
  texteFaible: '#71808F',

  // Bleu = magie / IA / focus / sélection technique.
  accent: '#4EAEF8',
  accentClair: '#86D0FF',
  accentSombre: '#174B72',

  // Or = monde / progression / action principale / décision.
  dore: '#D8B36B',
  doreClair: '#F0D89E',
  doreSombre: '#8E6C32',

  danger: '#E3707D',
  succes: '#68A98C',

  // Conversation : le narrateur devient une page de roman plutôt qu'une
  // bulle de messagerie ; le joueur reste légèrement matérialisé.
  bulleJoueur: 'rgba(14, 37, 55, 0.82)',
  bulleNarrateur: 'rgba(7, 17, 28, 0.30)',
};

export const espacement = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Elyndor conserve des angles presque droits : le relief vient des liserés,
// de la lumière et de la transparence, pas des cartes SaaS arrondies.
export const rayon = {
  sm: 2,
  md: 4,
  lg: 6,
};

// Glow bleu pour la magie, l'IA et les éléments en focus.
export const ombresLueur = {
  shadowColor: couleurs.accent,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.48,
  shadowRadius: 7,
  elevation: 3,
};

// Glow or pour les décisions et actions principales. L'opacité reste faible
// pour éviter un rendu néon et préserver la sensation "fantasy premium".
export const ombresOr = {
  shadowColor: couleurs.dore,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.34,
  shadowRadius: 8,
  elevation: 3,
};

export const polices = {
  // Titres / marque.
  display: 'Cinzel_700Bold',
  displaySemiGras: 'Cinzel_600SemiBold',
  // Titres de section, noms de personnage.
  titre: 'CormorantGaramond_600SemiBold',
  // Texte courant et lecture narrative.
  corps: 'CormorantGaramond_400Regular',
  corpsMedium: 'CormorantGaramond_500Medium',
};

export const stylePetitesCapitales = {
  fontFamily: polices.corpsMedium,
  textTransform: 'uppercase' as const,
  letterSpacing: 1.5,
};

// Mesures communes de l'interface V2. Elles n'imposent pas une mise en page
// particulière aux écrans existants, mais garantissent une ergonomie mobile
// cohérente et des cibles tactiles assez grandes.
export const interfaceV2 = {
  cibleTactileMin: 48,
  largeurLectureMax: 860,
  largeurPanneauMax: 620,
  dureeTransitionCourte: 180,
  dureeTransitionNormale: 240,
};
