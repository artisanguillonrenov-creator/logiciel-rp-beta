// Direction artistique Elyndor — thème « grimoire nocturne » (V13.2) :
// bleu nuit profond, or ciselé, cadres ornés de coins filigranés.
//
// Principe : le monde, les décisions et la sélection utilisent l'or ; le
// bleu arcane reste réservé à l'IA, à la magie et à la voix du joueur. Les
// surfaces restent très sombres et translucides afin que l'illustration
// porte l'immersion sans sacrifier la lisibilité.
export const couleurs = {
  // Profondeur générale : bleu nuit, jamais noir pur.
  fond: '#030817',
  fondProfond: '#01040B',
  fondCarte: 'rgba(9, 20, 44, 0.92)',
  fondCarteDense: 'rgba(3, 9, 22, 0.96)',
  fondChampSaisie: 'rgba(5, 14, 32, 0.97)',
  // Alias sémantique utilisé par les écrans de réglages.
  surface: 'rgba(9, 20, 44, 0.92)',

  // Bordures et texte. La bordure froide reste discrète ; le liseré or
  // encadre les panneaux et les actions.
  bordure: 'rgba(128, 160, 215, 0.30)',
  bordureSubtile: 'rgba(216, 177, 95, 0.16)',
  bordureDoree: 'rgba(216, 177, 95, 0.46)',
  texte: '#F3ECDC',
  texteAtténué: '#B5BFD3',
  texteFaible: '#7F8CA8',
  texteSecondaire: '#B5BFD3',

  // Bleu = magie / IA / focus / sélection technique.
  accent: '#4EAEF8',
  accentClair: '#86D0FF',
  accentSombre: '#174B72',

  // Or = monde / progression / action principale / décision.
  dore: '#D6AE63',
  doreClair: '#F2D38C',
  doreSombre: '#8D6328',
  doreEclat: '#FBE8B4',
  // Texte posé sur l'or (boutons principaux).
  encre: '#1C1206',

  danger: '#E3707D',
  succes: '#68A98C',

  // Conversation : le narrateur doit presque disparaître en tant que
  // contenant. Le joueur garde juste assez de matière pour distinguer sa
  // propre action de la prose du monde.
  bulleJoueur: 'rgba(28, 64, 150, 0.94)',
  bulleNarrateur: 'rgba(7, 17, 28, 0.06)',
};

export const espacement = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Grimoire V13.2 : angles adoucis, comme des plats de reliure — boutons et
// champs à 10, panneaux à 14, fenêtres à 16.
export const rayon = {
  sm: 10,
  md: 14,
  lg: 16,
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

// Ombre portée des cadres : détache un panneau de l'illustration de fond.
export const ombreProfonde = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.42,
  shadowRadius: 24,
  elevation: 6,
};

// Dégradés du grimoire (expo-linear-gradient), repris des maquettes V13.2.
export const degrades = {
  or: {
    couleurs: ['#F9E3A6', '#E8C577', '#CF9F4C', '#E3BD6F'] as const,
    positions: [0, 0.36, 0.64, 1] as const,
  },
  // Reflet diagonal sur l'or.
  reflet: {
    couleurs: ['rgba(255, 255, 255, 0)', 'rgba(255, 250, 228, 0.34)', 'rgba(255, 255, 255, 0)'] as const,
    positions: [0.18, 0.36, 0.52] as const,
  },
  nuit: { couleurs: ['rgba(14, 30, 62, 0.96)', 'rgba(4, 10, 24, 0.98)'] as const },
  danger: { couleurs: ['rgba(40, 12, 20, 0.92)', 'rgba(14, 5, 9, 0.98)'] as const },
  panneau: { couleurs: ['rgba(9, 20, 44, 0.92)', 'rgba(3, 9, 22, 0.96)'] as const },
  champ: { couleurs: ['rgba(5, 14, 32, 0.97)', 'rgba(2, 8, 20, 0.99)'] as const },
  joueur: { couleurs: ['rgba(28, 64, 150, 0.98)', 'rgba(38, 92, 205, 0.96)'] as const },
};

// Option sélectionnée (carte, race, lieu, moteur…) : liseré or lumineux et
// fond ambré — une seule définition pour tous les écrans.
export const styleOptionSelectionnee = {
  borderColor: '#ECC97F',
  backgroundColor: 'rgba(46, 34, 14, 0.62)',
  shadowColor: '#D6AE63',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.3,
  shadowRadius: 12,
  elevation: 3,
};
export const texteOptionSelectionnee = { color: '#F6DEA0' };
// Carte illustrée sélectionnée : seul le cadre s'allume, l'image reste nette.
export const styleCarteImageSelectionnee = {
  borderColor: '#ECC97F',
  shadowColor: '#D6AE63',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.3,
  shadowRadius: 12,
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
  // Alias sémantiques conservés pour les écrans de réglages.
  texte: 'CormorantGaramond_400Regular',
  texteSemiGras: 'CormorantGaramond_500Medium',
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
