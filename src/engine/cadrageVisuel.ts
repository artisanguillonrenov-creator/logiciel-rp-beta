import type { ModeIllustration } from './visualState';
import type { ReglagesVisuels } from '../concepteur/reglagesVisuels';

/**
 * Cadrage technique des images : type de scène (fait établi par l'extraction),
 * plan, angle et composition par défaut, réglages de cadrage de l'Atelier et
 * variantes de régénération. Ce sont des contraintes de FORMAT et de prise de
 * vue, jamais un style artistique : le style vient uniquement de l'identité
 * artistique globale de l'Atelier.
 */
export type ProfilCadrage = 'dialogue' | 'combat' | 'tension' | 'decouverte' | 'groupe' | 'interieur' | 'paysage';

export const PROFILS_CADRAGE: readonly ProfilCadrage[] = [
  'dialogue', 'combat', 'tension', 'decouverte', 'groupe', 'interieur', 'paysage',
];

export function estProfilCadrage(valeur: unknown): valeur is ProfilCadrage {
  return typeof valeur === 'string' && (PROFILS_CADRAGE as readonly string[]).includes(valeur);
}

/** Prise de vue, en mots-clés anglais. */
export interface CadrageContrat {
  plan: string;
  angle: string;
  composition: string;
}

interface DefinitionProfil {
  libelle: string;
  cadrage: CadrageContrat;
  plans: string[];
  angles: string[];
  compositions: string[];
}

export const PROFILS: Record<ProfilCadrage, DefinitionProfil> = {
  dialogue: {
    libelle: 'Dialogue',
    cadrage: { plan: 'medium shot of the characters', angle: 'eye level, three-quarter view', composition: 'asymmetric composition, characters facing each other' },
    plans: ['expressive close-up on the speaker', 'medium two-shot', 'cowboy shot'],
    angles: ['slight low angle on the dominant character', 'strict profile view', 'slight high angle'],
    compositions: ['over the shoulder framing', 'characters at both edges of the frame', 'off-center main character, other character sharp in background'],
  },
  combat: {
    libelle: 'Combat',
    cadrage: { plan: 'dynamic medium shot', angle: 'low angle', composition: 'strong diagonals, decisive moment' },
    plans: ['wide readable shot of the fight', 'close shot on the impact', 'lateral tracking medium shot'],
    angles: ['side view at hip height', 'extreme low angle', 'top-down view'],
    compositions: ['opponents on a rising diagonal', 'weapon in the foreground, fighters behind', 'backlit silhouettes'],
  },
  tension: {
    libelle: 'Tension',
    cadrage: { plan: 'medium shot with negative space', angle: 'subtle dutch angle', composition: 'off-center character, threat partly visible in the shadows' },
    plans: ['close-up on watchful eyes', 'wide shot dwarfing the character', 'close shot from behind'],
    angles: ['unsettling high angle', 'low angle under a looming element', 'through an obstacle'],
    compositions: ['blurred threat in the foreground', 'tiny character in a corner', 'leading lines toward the threat'],
  },
  decouverte: {
    libelle: 'Découverte',
    cadrage: { plan: 'wide shot', angle: 'slight low angle toward the place', composition: 'character seen from behind, rule of thirds, sense of scale' },
    plans: ['extreme wide establishing shot', 'medium shot from behind facing the place', 'high wide shot'],
    angles: ['high angle from a ledge', 'dizzying low angle', 'frontal eye level'],
    compositions: ['centered silhouette, monumental symmetry', 'character at the bottom of the frame', 'foreground framing, place in depth'],
  },
  groupe: {
    libelle: 'Groupe',
    cadrage: { plan: 'medium wide group shot', angle: 'eye level', composition: 'each character distinct and readable, clear spacing, layered depth' },
    plans: ['wide shot of the group in its surroundings', 'cowboy shot on the group', 'tight medium shot on the main characters'],
    angles: ['slight heroic low angle', 'slight high angle', 'three-quarter side view'],
    compositions: ['group in an arc', 'characters along a vanishing line', 'main character in the foreground, group behind'],
  },
  interieur: {
    libelle: 'Intérieur',
    cadrage: { plan: 'medium shot', angle: 'eye level', composition: 'room readable from foreground to back, light from a visible source' },
    plans: ['wide shot of the room', 'close shot near the light source', 'medium shot from a doorway'],
    angles: ['slight high angle', 'low angle under the beams', 'symmetrical frontal view'],
    compositions: ['frame within a frame', 'furniture in the foreground', 'character backlit by the light source'],
  },
  paysage: {
    libelle: 'Paysage',
    cadrage: { plan: 'extreme wide shot', angle: 'eye level', composition: 'horizon on the third, strong foreground element' },
    plans: ['wide shot with a tiny silhouette', 'establishing shot from the ground', 'panoramic wide shot'],
    angles: ['low angle toward the sky', 'aerial view', 'ground level'],
    compositions: ['low horizon, dominant sky', 'path leading the eye', 'side foreground element'],
  },
};

export function cadrageParDefaut(profil: ProfilCadrage): CadrageContrat {
  return { ...(PROFILS[profil] ?? PROFILS.dialogue).cadrage };
}

/** Cadrage d'un portrait (3:4) : buste, fond neutre. */
export const CADRAGE_PORTRAIT: Readonly<CadrageContrat> = Object.freeze({
  plan: 'head and shoulders portrait',
  angle: 'eye level',
  composition: 'plain dark background',
});

const PLANS_ATELIER = {
  automatique: '',
  moyen: 'medium wide shot, characters in their surroundings',
  large: 'wide shot, full scene, detailed environment visible',
  ensemble: 'extreme wide establishing shot, architecture dominant, people small in frame',
} as const;

const PRIORITES_ATELIER = {
  equilibree: '',
  decor: 'environment dominant, layered foreground and background',
  action: 'story action and interaction in their environment',
} as const;

const MOTS_PORTRAIT = /^(?:cinematic\s+)?(?:close[ -]?up(?:\s+(?:portrait|shot))?|headshot|bust(?:\s+portrait)?|portrait(?:\s+shot)?|upper[ -]body\s+portrait|studio\s+portrait)$/i;

/** Retire d'une liste de mots-clés les directives de portrait contradictoires avec une scène. */
export function retirerMotsPortrait(motsCles: readonly string[]): string[] {
  return motsCles.filter((m) => !MOTS_PORTRAIT.test(m.trim()));
}

/**
 * Réglages de cadrage de l'Atelier, pour les scènes 16:9 uniquement : distance
 * de caméra, priorité de composition et refus des cadrages de portrait.
 */
export function appliquerCadrageAtelier(
  cadrage: CadrageContrat,
  reglages: Pick<ReglagesVisuels, 'cadrageIllustration' | 'prioriteIllustration' | 'eviterPortraitScene'>,
  avecPersonnages = true,
): { cadrage: CadrageContrat; negatif: string } {
  const plan = PLANS_ATELIER[reglages.cadrageIllustration];
  const priorite = PRIORITES_ATELIER[reglages.prioriteIllustration];
  // Sans personnage (paysage), refuser un portrait n'a pas de sens.
  const eviterPortrait = reglages.eviterPortraitScene && avecPersonnages;
  return {
    cadrage: {
      plan: plan || cadrage.plan,
      angle: cadrage.angle,
      composition: [priorite, cadrage.composition, eviterPortrait ? 'not a portrait, no isolated face' : '']
        .filter(Boolean).join(', '),
    },
    negatif: eviterPortrait
      ? 'headshot, tight face crop, isolated character portrait, studio backdrop, bust-only composition'
      : '',
  };
}

/** Variante de prise de vue pour une régénération : le contenu de la scène ne bouge pas. */
export function varierCadrage(
  cadrage: CadrageContrat,
  profil: ProfilCadrage,
  mode: ModeIllustration,
  variante: number,
): CadrageContrat {
  const def = PROFILS[profil] ?? PROFILS.dialogue;
  const choisir = (liste: string[]) => liste[Math.abs(variante) % liste.length];
  if (mode === 'autre-cadrage') return { ...cadrage, plan: choisir(def.plans) };
  if (mode === 'autre-angle') return { ...cadrage, angle: choisir(def.angles) };
  if (mode === 'autre-composition') return { ...cadrage, composition: choisir(def.compositions) };
  return cadrage;
}
