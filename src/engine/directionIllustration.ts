import type { PromptImageStructure } from './visualBible';
import {
  validerReglagesVisuels, type ReglagesVisuels,
} from '../concepteur/reglagesVisuels';

/**
 * Direction cinématographique appliquée aux illustrations 16:9 UNIQUEMENT.
 * Le canon de l'action, des PNJ et du décor ne change pas.
 * Les portraits 3:4 n'utilisent jamais ce module.
 */
const PLANS = {
  automatique: { camera: '', anglais: '' },
  moyen: {
    camera: 'plan moyen d ensemble, personnages dans leur environnement, décor identifiable',
    anglais: 'cinematic medium wide shot, environmental scene, characters interacting in their surroundings',
  },
  large: {
    camera: 'plan large de scène, personnages à leur place dans le décor, silhouettes et interaction lisibles',
    anglais: 'cinematic wide shot, full scene composition, characters interacting, detailed environment visible',
  },
  ensemble: {
    camera: 'très grand plan d ensemble, architecture et environnement dominants, personnages à échelle du lieu',
    anglais: 'extreme wide establishing shot, panoramic environment, full location and architecture, people small in frame',
  },
} as const;

const PRIORITES = {
  equilibree: { fr: '', anglais: '' },
  decor: {
    fr: 'le lieu, sa profondeur et ses éléments narratifs dominent la composition ; personnages replacés dans l espace',
    anglais: 'environment dominant, visible architecture, deep background, layered foreground and background',
  },
  action: {
    fr: 'l interaction et les gestes narratifs sont au centre de la composition, avec le lieu visible autour',
    anglais: 'story action and interaction, visible gestures, multiple subjects in environmental context',
  },
} as const;

/** Écarter les poses de portrait sans perdre les attributs du personnage. */
export function retirerMotsPortraitDuPromptCourt(prompt: string): string {
  return prompt.split(',')
    .map((segment) => segment.trim())
    // « portrait of a dark elf » contient une identité à conserver.
    .map((segment) => segment.replace(/^(?:cinematic\s+|studio\s+)?portrait\s+of\s+/i, '').trim())
    .filter((segment) => !/^(?:(?:cinematic|studio|professional|static)\s+)*(?:close[ -]?up(?:\s+(?:portrait|shot|face))?|headshot|bust(?:[ -]only|[ -]portrait)?|portrait(?:\s+(?:shot|photo|photograph))?|upper[ -]body[ -]portrait|studio[ -]photo(?:graph)?)$/i.test(segment))
    .filter(Boolean)
    .join(', ');
}

export function reglerDirectionIllustration(
  structure: PromptImageStructure,
  preference: ReglagesVisuels,
): PromptImageStructure {
  const v = validerReglagesVisuels(preference);
  const plan = PLANS[v.cadrageIllustration];
  const priorite = PRIORITES[v.prioriteIllustration];

  const consignesLongues = [
    plan.camera,
    priorite.fr,
    v.eviterPortraitScene
      ? 'scène vécue avec gestes et interactions réels ; personnages intégrés à la profondeur du lieu, sans pose devant l’objectif'
      : '',
  ].filter(Boolean).join(' ; ');

  const indicesAnglais = [
    plan.anglais,
    priorite.anglais,
    v.eviterPortraitScene ? 'environmental storytelling, natural character gestures, cinematic scene framing' : '',
  ].filter(Boolean).join(', ');

  const promptSdxl = v.eviterPortraitScene && structure.promptSdxl
    ? retirerMotsPortraitDuPromptCourt(structure.promptSdxl)
    : structure.promptSdxl;

  if (!consignesLongues && !indicesAnglais) return structure;
  // Le profil « dialogue » proposait souvent un cadrage poitrine, même avec
  // un décor 16:9. Automatique conserve les vrais plans de scène, pas les bustes.
  const planNaturel = v.eviterPortraitScene && /portrait|buste|gros plan|close[ -]?up|visage|poitrine/i.test(structure.camera.typePlan)
    ? 'plan moyen cinématographique sur les personnages en interaction dans le décor'
    : structure.camera.typePlan;
  return {
    ...structure,
    promptSdxl,
    camera: {
      ...structure.camera,
      typePlan: plan.camera || planNaturel,
      composition: [priorite.fr, structure.camera.composition].filter(Boolean).join(' ; '),
      profondeur: v.prioriteIllustration === 'decor'
        ? 'profondeur de scène lisible : premier plan, personnages, second plan et architecture'
        : structure.camera.profondeur,
    },
    indiceCameraSdxl: [indicesAnglais, v.cadrageIllustration === 'automatique'
      ? structure.indiceCameraSdxl : ''].filter(Boolean).join(', '),
    ambiance: {
      ...structure.ambiance,
      rendu: [consignesLongues, structure.ambiance.rendu].filter(Boolean).join(' ; '),
    },
  };
}

export function negatifCadrageIllustration(v: ReglagesVisuels): string {
  const config = validerReglagesVisuels(v);
  return config.eviterPortraitScene
    ? 'headshot, tight face crop, isolated character portrait, studio backdrop, bust-only composition, close-up portrait, static front-facing pose, posing for camera'
    : '';
}
