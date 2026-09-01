import { Platform } from 'react-native';

// Identité visuelle bleu nuit / indigo (brief Phase 2) — remplace le thème
// strictement fonctionnel de la bêta.
export const couleurs = {
  fond: '#0b0e24',
  fondCarte: '#161a3c',
  fondChampSaisie: '#1c2148',
  bordure: '#2e3468',
  texte: '#f4f3fb',
  texteAtténué: '#9b9fce',
  accent: '#7c6ff0',
  accentClair: '#a89bff',
  danger: '#ff6b7a',
  bulleJoueur: '#33306e',
  bulleNarrateur: '#161a3c',
};

export const espacement = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const rayon = {
  sm: 6,
  md: 12,
  lg: 18,
};

// Typographie serif pour les titres (brief Phase 2), système par défaut
// pour le reste — pas de police embarquée, pour rester léger.
export const polices = {
  titre: Platform.select({
    ios: 'Georgia',
    android: 'serif',
    default: 'Georgia, "Times New Roman", serif',
  }),
};
