import type { ProfilContenu } from '../types';
import type { FormatImage, ReferenceImage, RequeteImage } from './elyndorCloudImages';
import {
  BIBLE_VISUELLE_ELYNDOR,
  MODULES_BASE,
  STYLE_PORTRAIT_ELYNDOR,
  construirePromptPortraitSdxl,
  construirePromptSdxl,
  formaterPromptImage,
  modulesPourScene,
  negatifAplati,
  structureDeRepli,
  type ProfilCadrage,
  type PromptImageStructure,
} from './visualBible';
import {
  negatifCadrageIllustration,
  reglerDirectionIllustration,
} from './directionIllustration';
import {
  appliquerModulesVisuels,
  enrichirNegatifVisuel,
  validerReglagesVisuels,
  type ReglagesVisuels,
} from '../concepteur/reglagesVisuels';
import {
  selectionnerReferencesGenerateur,
  type ReferenceVisuelle,
} from './visualState';

// Préparation partagée par la génération réelle et le laboratoire d'aperçu :
// modifier un réglage visuel doit produire le même paramètre serveur partout.
const NEGATIF_GRAND_PUBLIC = 'nsfw, nudity, nude, naked, explicit, sexual content, gore';

function negatifPourProfil(profil: ProfilContenu | undefined): string {
  return profil === 'adulte'
    ? negatifAplati()
    : negatifAplati() + ', ' + NEGATIF_GRAND_PUBLIC;
}

/** Les déclencheurs de LoRA restent en tête, puis les consignes de l'atelier. */
function enrichirPromptCourt(prompt: string | undefined, ajout: string): string | undefined {
  const extra = ajout.trim();
  if (!extra || !prompt) return prompt;
  const parties = prompt.split(', ');
  if (parties[0] === 'elyndor style' && parties.length >= 2) {
    return [...parties.slice(0, 2), extra, ...parties.slice(2)].join(', ');
  }
  return [extra, prompt].join(', ');
}

function enrichirPromptLong(prompt: string, ajout: string): string {
  return ajout.trim()
    ? prompt + '\n\n[INSTRUCTIONS VISUELLES CONCEPTEUR]\n' + ajout.trim()
    : prompt;
}

export function preparerRequeteScene(
  structure: PromptImageStructure,
  references: readonly ReferenceVisuelle[],
  reglages: ReglagesVisuels,
  profil?: ProfilContenu,
  storyId?: string,
  apercuLibre = false,
): RequeteImage {
  const visuel = validerReglagesVisuels(reglages);
  const dirigee = reglerDirectionIllustration(structure, visuel);
  const selection = selectionnerReferencesGenerateur(references);
  const referencesActives = selection.filter((ref) =>
    ref.role === 'scene' ? visuel.referencesScenePrecedente : visuel.referencesPersonnagesScene);
  const referencesDecrites = references.filter((ref) =>
    referencesActives.some((active) => active.image === ref.uri));

  // En aperçu libre il n'y a pas de personnages connus : ne pas injecter
  // « aucun personnage visible », qui contredirait le texte saisi.
  const promptLong = apercuLibre
    ? [
        '[SCÈNE À ILLUSTRER]\n' + structure.action,
        '[CAMÉRA / CADRAGE]\n' + Object.values(dirigee.camera).join(' ; '),
        '[STYLE VISUEL]\n' + BIBLE_VISUELLE_ELYNDOR.join(' ; '),
      ].join('\n\n')
    : formaterPromptImage(dirigee, referencesDecrites);

  return {
    prompt: enrichirPromptLong(promptLong, visuel.positifScene),
    promptCourt: enrichirPromptCourt(construirePromptSdxl(dirigee), visuel.positifScene),
    negatif: enrichirNegatifVisuel([
      negatifPourProfil(profil),
      negatifCadrageIllustration(visuel),
      visuel.negatifScene,
    ].filter(Boolean).join(', '), visuel),
    modules: appliquerModulesVisuels(modulesPourScene(dirigee), visuel, 'scene'),
    references: referencesActives,
    format: '16:9',
    size: visuel.tailleScene,
    ...(visuel.pasScene !== null ? { steps: visuel.pasScene } : {}),
    ...(visuel.guidanceScene !== null ? { guidance: visuel.guidanceScene } : {}),
    ...(visuel.graineScene !== null ? { seed: visuel.graineScene } : {}),
    storyId,
  };
}

export function preparerRequetePortrait(
  prompt: string,
  promptCourt: string | undefined,
  references: readonly ReferenceImage[],
  reglages: ReglagesVisuels,
  profil?: ProfilContenu,
  negatifSupplementaire = '',
  storyId?: string,
): RequeteImage {
  const visuel = validerReglagesVisuels(reglages);
  return {
    prompt: enrichirPromptLong(prompt, visuel.positifPortrait),
    promptCourt: enrichirPromptCourt(promptCourt, visuel.positifPortrait),
    negatif: enrichirNegatifVisuel([
      negatifPourProfil(profil), negatifSupplementaire, visuel.negatifPortrait,
    ].filter(Boolean).join(', '), visuel),
    modules: appliquerModulesVisuels(MODULES_BASE, visuel, 'portrait'),
    references: [...references],
    format: '3:4',
    size: visuel.taillePortrait,
    ...(visuel.pasPortrait !== null ? { steps: visuel.pasPortrait } : {}),
    ...(visuel.guidancePortrait !== null ? { guidance: visuel.guidancePortrait } : {}),
    ...(visuel.grainePortrait !== null ? { seed: visuel.grainePortrait } : {}),
    ...(visuel.poidsReferenceRacePortrait !== null ? { poidsRace: visuel.poidsReferenceRacePortrait } : {}),
    storyId,
  };
}

/** Aperçu libre : mêmes paramètres effectifs, sans histoire ni image de référence. */
export function preparerRequeteApercuImage(params: {
  prompt: string;
  negatif?: string;
  format: FormatImage;
  profilScene?: ProfilCadrage;
  reglages: ReglagesVisuels;
  profilContenu?: ProfilContenu;
}): RequeteImage {
  const texte = params.prompt.trim();
  if (!texte) throw new Error('Entre un prompt avant de générer.');
  const negatifLibre = params.negatif?.trim() ?? '';
  if (params.format === '3:4') {
    const demande = preparerRequetePortrait(
      texte + '\nStyle : ' + STYLE_PORTRAIT_ELYNDOR,
      construirePromptPortraitSdxl(texte),
      [],
      params.reglages,
      params.profilContenu,
    );
    return {
      ...demande,
      negatif: [demande.negatif, negatifLibre].filter(Boolean).join(', '),
    };
  }
  const structure = {
    ...structureDeRepli({
      profil: params.profilScene ?? 'groupe',
      personnages: [],
      texteScene: texte,
      lieu: '',
    }),
    promptSdxl: texte,
  };
  const demande = preparerRequeteScene(
    structure, [], params.reglages, params.profilContenu, undefined, true,
  );
  return {
    ...demande,
    negatif: [demande.negatif, negatifLibre].filter(Boolean).join(', '),
  };
}
