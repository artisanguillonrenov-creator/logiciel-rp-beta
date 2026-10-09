import type { StorySettings, TonHistoire } from '../types';

/**
 * Seuls des choix typés modifient l'interprétation du style.
 * Aucune directive arbitraire ne peut contourner le canon ni l'agentivité.
 */
export type DensiteStyle = 'sobre' | 'equilibree' | 'dense';
export type CadenceStyle = 'posee' | 'equilibree' | 'soutenue';
export type AccentStyle = 'action' | 'sensoriel' | 'intrigue' | 'exploration';

export interface ProfilStyleNarratif {
  densite: DensiteStyle;
  cadence: CadenceStyle;
  accent: AccentStyle;
}
export type StylesNarratifs = Record<TonHistoire, ProfilStyleNarratif>;

export const CLES_STYLES: TonHistoire[] = [
  'heroique_epique', 'sombre_realiste', 'mysterieux_intrigant', 'leger_aventureux',
];
export const NOMS_STYLES: Record<TonHistoire, string> = {
  heroique_epique: 'Cinématique',
  sombre_realiste: 'Immersif',
  mysterieux_intrigant: 'Libre',
  leger_aventureux: 'Aventure',
};
export const OPTIONS_DENSITE: DensiteStyle[] = ['sobre', 'equilibree', 'dense'];
export const OPTIONS_CADENCE: CadenceStyle[] = ['posee', 'equilibree', 'soutenue'];
export const OPTIONS_ACCENT: AccentStyle[] = ['action', 'sensoriel', 'intrigue', 'exploration'];

export function stylesNarratifsDefaut(): StylesNarratifs {
  return {
    heroique_epique: { densite: 'equilibree', cadence: 'soutenue', accent: 'action' },
    sombre_realiste: { densite: 'dense', cadence: 'posee', accent: 'sensoriel' },
    mysterieux_intrigant: { densite: 'equilibree', cadence: 'posee', accent: 'intrigue' },
    leger_aventureux: { densite: 'sobre', cadence: 'soutenue', accent: 'exploration' },
  };
}

export function defautsAventure(): StorySettings {
  return {
    ton: 'sombre_realiste', creativite: 'moyenne', longueur: 'moyenne',
    violence: 'modere', romance: 'modere', humour: 'faible',
    rythme: 'normal', liberteJoueur: 'elevee',
  };
}

const CHOIX_AVENTURE = {
  ton: CLES_STYLES,
  creativite: ['faible', 'moyenne', 'elevee'],
  longueur: ['courte', 'moyenne', 'longue'],
  violence: ['faible', 'modere', 'eleve', 'extreme'],
  romance: ['aucun', 'faible', 'modere', 'eleve'],
  humour: ['aucun', 'faible', 'modere', 'eleve'],
  rythme: ['lent', 'normal', 'rapide'],
  liberteJoueur: ['faible', 'moderee', 'elevee', 'totale'],
} satisfies { [K in keyof StorySettings]: readonly StorySettings[K][] };
export const OPTIONS_AVENTURE = CHOIX_AVENTURE;

function estObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
export function validerStylesNarratifs(raw: unknown): StylesNarratifs {
  if (!estObjet(raw)) throw new Error('Profils de styles invalides.');
  const styles = {} as StylesNarratifs;
  for (const cle of CLES_STYLES) {
    const profil = raw[cle];
    if (!estObjet(profil) || !OPTIONS_DENSITE.includes(profil.densite as DensiteStyle) ||
      !OPTIONS_CADENCE.includes(profil.cadence as CadenceStyle) ||
      !OPTIONS_ACCENT.includes(profil.accent as AccentStyle)) {
      throw new Error('Style non reconnu : ' + cle);
    }
    styles[cle] = {
      densite: profil.densite as DensiteStyle,
      cadence: profil.cadence as CadenceStyle,
      accent: profil.accent as AccentStyle,
    };
  }
  return styles;
}
export function validerDefautsAventure(raw: unknown): StorySettings {
  if (!estObjet(raw)) throw new Error('Préférences d’aventure invalides.');
  const resultat = {} as StorySettings;
  for (const cle of Object.keys(CHOIX_AVENTURE) as Array<keyof StorySettings>) {
    const choix = CHOIX_AVENTURE[cle] as readonly string[];
    if (!choix.includes(String(raw[cle]))) throw new Error('Préférence inconnue : ' + cle);
    // Une copie explicitement filtrée empêche tout champ injecté par import JSON.
    (resultat as unknown as Record<string, unknown>)[cle] = raw[cle];
  }
  return resultat;
}

const DENSITE: Record<DensiteStyle, string> = {
  sobre: 'Descriptions concentrées sur les détails nécessaires.',
  equilibree: 'Descriptions équilibrées, lisibles et pertinentes.',
  dense: 'Détails sensoriels et matériels riches quand utiles à la scène.',
};
const CADENCE: Record<CadenceStyle, string> = {
  posee: 'Transitions posées ; laisse respirer les échanges.',
  equilibree: 'Alternance naturelle entre pauses et progression.',
  soutenue: 'Mise en scène dynamique, sans forcer de nouveaux événements.',
};
const ACCENT: Record<AccentStyle, string> = {
  action: 'Accent visuel sur les mouvements et la lisibilité des actions.',
  sensoriel: 'Accent sur la présence physique, les sensations et les lieux.',
  intrigue: 'Accent sur les informations accessibles et les motivations des PNJ.',
  exploration: 'Accent sur les lieux, les découvertes et les possibilités ouvertes.',
};
const TON: Record<TonHistoire, string> = {
  heroique_epique: 'Cinématique — souffle héroïque sans héroïsme imposé au joueur.',
  sombre_realiste: 'Immersif — monde crédible et conséquences matérielles cohérentes.',
  mysterieux_intrigant: 'Libre — mystères et initiatives ouvertes, sans diriger le joueur.',
  leger_aventureux: 'Aventure — découverte et voyage sans danger artificiel.',
};

/** Unique point de formulation du style, remplaçant le libellé historique. */
export function instructionStyle(ton: TonHistoire, styles?: StylesNarratifs): string {
  const profil = styles?.[ton] ?? stylesNarratifsDefaut()[ton];
  return [TON[ton], DENSITE[profil.densite], CADENCE[profil.cadence], ACCENT[profil.accent]].join(' ');
}

/** Prévisualisation déterministe, sans appel au modèle et donc sans coût GPU. */
export function comparerStyles(styles: StylesNarratifs): Array<{ nom: string; texte: string }> {
  return CLES_STYLES.map(cle => ({ nom: NOMS_STYLES[cle], texte: instructionStyle(cle, styles) }));
}
