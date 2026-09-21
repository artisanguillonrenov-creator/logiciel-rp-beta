// Direction artistique Elyndor V11 — fantasy sombre, éditoriale, cinématique.
//
// Un seul thème réutilisable : toutes les couleurs, polices, espacements et
// rayons de l'interface passent par ces jetons, jamais en dur dans un
// composant. L'or reste réservé à une seule action principale par écran ;
// l'azur marque les PNJ de faction royale et les accents secondaires ;
// l'indigo habille exclusivement la bulle du joueur. Les blocs de narration
// n'ont ni cadre ni fond : le texte est le seul objet.
export const couleurs = {
  // Profondeur générale : encre nuit, jamais noir pur.
  fond: '#070B18',
  fondProfond: '#04060C',
  // Panneaux/cartes posés sur une illustration (verre translucide).
  fondCarte: 'rgba(12, 18, 34, 0.66)',
  fondCarteDense: 'rgba(12, 18, 34, 0.92)',
  // Panneau opaque (palette, fiches, cartes hors illustration).
  fondPanneau: '#0C1222',
  fondChampSaisie: 'rgba(12, 18, 34, 0.8)',
  // Barres haute/basse (à flouter quand la plateforme le permet).
  fondBarre: 'rgba(6, 9, 18, 0.78)',

  // Bordures et texte. La bordure principale est toujours teintée d'or, très
  // discrète — les écrans narratifs doivent lire comme une page.
  bordure: 'rgba(201, 164, 92, 0.18)',
  bordureSubtile: 'rgba(201, 164, 92, 0.18)',
  bordureDoree: 'rgba(201, 164, 92, 0.45)',
  texte: '#E6E9F2',
  texteAtténué: '#93A0BE',
  texteFaible: '#7E8BA8',
  texteNarration: '#D6DBE8',

  // Azur = PNJ de faction royale dans le récit, accent secondaire ailleurs
  // dans l'interface (focus, sélection technique) — jamais un bouton plein.
  accent: '#93A9E0',
  accentClair: '#C9D6F5',
  accentSombre: '#3B4A78',

  // Or = monde / progression / action principale / décision. Règle d'or :
  // un seul bouton plein or par écran (voir Bouton.tsx, variante "principal").
  dore: '#C9A45C',
  doreClair: '#F3E2B8',
  doreSombre: '#8E6F33',

  danger: '#E3707D',
  succes: '#68A98C',

  // Indigo = bulle du joueur, exclusivement.
  indigo: '#26365F',
  bulleJoueur: 'rgba(38, 54, 98, 0.62)',
  bulleJoueurDegrade: 'rgba(24, 36, 70, 0.62)',
  bulleJoueurBordure: 'rgba(140, 170, 240, 0.22)',
  // Bloc de narration : aucun cadre, aucun fond — pleine largeur de colonne.
  bulleNarrateur: 'transparent',
};

export const espacement = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// V11 assume des cartes et boutons arrondis (contrairement à la V2, qui
// préférait des angles presque droits) : le relief vient toujours des
// liserés dorés et de la transparence, mais les surfaces sont plus douces.
export const rayon = {
  sm: 8, // petits éléments : puces, avatars carrés, boutons d'icône
  md: 10, // champs de saisie, boutons
  lg: 12, // cartes, panneaux
  xl: 14, // modales centrées
  pilule: 999,
};

// Glow azur pour le focus et les accents secondaires (PNJ de faction royale,
// éléments interactifs hors décision principale).
export const ombresLueur = {
  shadowColor: couleurs.accent,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.38,
  shadowRadius: 7,
  elevation: 3,
};

// Glow or pour les décisions et actions principales. Opacité faible pour
// éviter un rendu néon et préserver la sensation "fantasy premium".
export const ombresOr = {
  shadowColor: couleurs.dore,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.34,
  shadowRadius: 10,
  elevation: 3,
};

export const polices = {
  // Titres / marque / noms de PNJ / libellés de boutons / labels de
  // section — toujours en MAJUSCULES avec un interlettrage large (voir
  // `interlettrage` ci-dessous).
  display: 'Cinzel_700Bold',
  displaySemiGras: 'Cinzel_600SemiBold',
  // Titres de section éditoriaux, noms de personnage hors dialogue.
  titre: 'CormorantGaramond_600SemiBold',
  // Texte courant et lecture narrative.
  corps: 'CormorantGaramond_400Regular',
  corpsMedium: 'CormorantGaramond_500Medium',
  // Réplique de PNJ — italique, jamais de repli sans-serif.
  corpsItalique: 'CormorantGaramond_400Regular',
};

// Échelle d'interlettrage Cinzel : plus le texte est petit, plus
// l'interlettrage est large (§2 de la direction visuelle V11).
export const interlettrage = {
  labelSection: 2.6, // 11px / .26em
  nomPersonnage: 2.2, // 12px / .20em
  bouton: 2.4, // 12–14px / .20em
  titreEcran: 3.2, // 20–28px / .14em
  logo: 11, // 46–84px / .20em
  pilule: 2, // labels de pilule / nav
};

export const stylePetitesCapitales = {
  fontFamily: polices.displaySemiGras,
  textTransform: 'uppercase' as const,
  letterSpacing: interlettrage.labelSection,
};

// Mesures communes de l'interface. Elles n'imposent pas une mise en page
// particulière aux écrans existants, mais garantissent une ergonomie mobile
// cohérente et des cibles tactiles assez grandes.
export const interfaceV2 = {
  cibleTactileMin: 48,
  cibleTactileRail: 44,
  espacementCiblesMin: 10,
  // Règle la plus importante du redesign V11 : au-delà de 720px la prose
  // devient illisible sur tablette. Toute colonne de lecture doit s'y tenir.
  largeurLectureMax: 720,
  largeurPanneauMax: 620,
  largeurBulleJoueurMax: '78%' as const,
  dureeTransitionCourte: 180,
  dureeTransitionNormale: 400,
};
