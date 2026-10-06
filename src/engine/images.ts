import { Image } from 'react-native';
import type { AppSettings, EntreeLoreEmergent, ProfilContenu, StoryState } from '../types';
import { enregistrerAvatarPnj, obtenirAvatarPnj, preparerImageReference } from '../storage/pnjAvatarsStore';
import { obtenirIllustrationScene } from '../storage/sceneImagesStore';
import { obtenirPortrait } from '../data/portraits';
import {
  ErreurImagesIndisponibles,
  MAX_REFERENCES_IMAGE,
  genererImageElyndorCloud,
  imagesElyndorCloudDisponibles,
  type GenerateurImage,
  type ReferenceImage,
} from './elyndorCloudImages';
import {
  STYLE_PORTRAIT_ELYNDOR,
  STYLE_PORTRAIT_SDXL,
  construirePromptSdxl,
  formaterPromptImage,
  negatifAplati,
  type PromptImageStructure,
} from './visualBible';
import { redigerPromptPortraitSdxl } from './directionArtistique';
import { canonRace, detecterRacePnj } from './racePnj';
import {
  ID_ASSET_JOUEUR,
  ordonnerReferences,
  selectionnerReferencesGenerateur,
  type PersonnageVisibleResolu,
  type ReferenceVisuelle,
  type SceneIllustree,
} from './visualState';

// Couche image de l'application (V2). Les illustrations de scène SONT
// persistées : sceneImagesStore conserve les 2 dernières scènes illustrées de
// chaque histoire (historique glissant) et elles servent de références de
// continuité à la génération suivante. Les avatars restent rangés par
// identifiant dans pnjAvatarsStore. Le générateur lui-même est le modèle
// image Elyndor Cloud (elyndorCloudImages.ts), injectable pour un futur
// backend.

export { ErreurImagesIndisponibles };
export { ID_ASSET_JOUEUR as ID_AVATAR_JOUEUR };

let generateurCourant: GenerateurImage = genererImageElyndorCloud;

/** Point d'extension : un autre backend image peut remplacer Elyndor Cloud. */
export function definirGenerateurImage(generateur: GenerateurImage | null): void {
  generateurCourant = generateur ?? genererImageElyndorCloud;
}

async function assetVersDataUrl(source: ReturnType<typeof obtenirPortrait>): Promise<string | null> {
  if (!source) return null;
  try {
    const { uri } = Image.resolveAssetSource(source);
    const reponse = await fetch(uri);
    const blob = await reponse.blob();
    return await new Promise<string>((resolve, reject) => {
      const lecteur = new FileReader();
      lecteur.onerror = () => reject(lecteur.error);
      lecteur.onload = () => resolve(String(lecteur.result));
      lecteur.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function obtenirPortraitReferenceJoueur(story: StoryState): Promise<string | null> {
  const portrait = obtenirPortrait(story.meta.raceOrigineId, story.meta.sexe);
  return assetVersDataUrl(portrait);
}

async function versReference(uri: string | null): Promise<string | null> {
  if (!uri) return null;
  try {
    return await preparerImageReference(uri);
  } catch {
    return null;
  }
}

/**
 * Rassemble les références de la scène, uniquement pour les personnages
 * réellement visibles, puis les ordonne par priorité : joueur, PNJ
 * principaux, autres PNJ, scène précédente, avant-dernière scène.
 */
export async function collecterReferencesScene(
  story: StoryState,
  visibles: readonly PersonnageVisibleResolu[],
  scenesPrecedentes: readonly SceneIllustree[],
): Promise<ReferenceVisuelle[]> {
  const candidats: ReferenceVisuelle[] = [];
  for (const personnage of visibles) {
    if (personnage.type === 'joueur') {
      const portrait = await obtenirPortraitReferenceJoueur(story);
      if (portrait) candidats.push({ type: 'joueur-portrait', uri: portrait, libelle: `visage de référence de ${personnage.nom} (portrait de création)` });
      const avatar = await versReference(await obtenirAvatarPnj(story.meta.id, ID_ASSET_JOUEUR).catch(() => null));
      if (avatar) candidats.push({ type: 'joueur-avatar', uri: avatar, libelle: `avatar de ${personnage.nom}` });
    } else if (personnage.type === 'pnj' && personnage.assetId) {
      const avatar = await versReference(await obtenirAvatarPnj(story.meta.id, personnage.assetId).catch(() => null));
      if (avatar) {
        candidats.push({
          type: personnage.principal ? 'pnj-principal' : 'pnj-secondaire',
          uri: avatar,
          libelle: `avatar de ${personnage.nom}`,
        });
      }
    }
  }

  const recentes = [...scenesPrecedentes].reverse();
  for (const [rang, scene] of recentes.slice(0, 2).entries()) {
    const uri = await versReference(await obtenirIllustrationScene(story.meta.id, scene.revision).catch(() => null));
    if (!uri) continue;
    candidats.push({
      type: rang === 0 ? 'scene-precedente' : 'scene-avant-derniere',
      uri,
      libelle: rang === 0 ? 'scène illustrée précédente (continuité)' : 'avant-dernière scène illustrée (continuité)',
    });
  }
  return ordonnerReferences(candidats, MAX_REFERENCES_IMAGE);
}

// Lustify SDXL sait produire du contenu explicite : hors profil Adulte, il
// est exclu par le prompt négatif, en plus du filtrage du texte en amont.
const NEGATIF_GRAND_PUBLIC = 'nsfw, nudity, nude, naked, explicit, sexual content, gore';

function negatifPourProfil(profil: ProfilContenu | undefined): string {
  return profil === 'adulte' ? negatifAplati() : `${negatifAplati()}, ${NEGATIF_GRAND_PUBLIC}`;
}

/** Prompt final + génération 16:9 d'une scène. */
export async function genererImageScene(
  structure: PromptImageStructure,
  references: readonly ReferenceVisuelle[],
  profil?: ProfilContenu,
): Promise<string> {
  if (!imagesElyndorCloudDisponibles() && generateurCourant === genererImageElyndorCloud) {
    throw new ErreurImagesIndisponibles();
  }
  return generateurCourant({
    prompt: formaterPromptImage(structure, references),
    promptCourt: construirePromptSdxl(structure),
    negatif: negatifPourProfil(profil),
    references: selectionnerReferencesGenerateur(references),
    format: '16:9',
  });
}

export function construirePromptAvatarPnj(pnj: EntreeLoreEmergent): string {
  const race = detecterRacePnj(pnj.titre, pnj.contenu);
  return (
    `Portrait (buste, cadrage serré sur le visage et les épaules) de ${pnj.titre}.\n` +
    `Description : ${pnj.contenu.slice(0, 400)}\n` +
    (race ? `${canonRace(race)}\n` : '') +
    '\n' +
    `Style : ${STYLE_PORTRAIT_ELYNDOR}.`
  );
}

export function construirePromptAvatarJoueur(story: StoryState): string {
  const fiche = story.meta.personnageDescription?.trim();
  return (
    `Portrait (buste, cadrage serré sur le visage et les épaules) de ${story.meta.personnageNom}.\n` +
    `Description : ${(fiche || 'Personnage principal de l\'histoire.').slice(0, 400)}\n\n` +
    `Style : ${STYLE_PORTRAIT_ELYNDOR}.`
  );
}

async function genererPortrait(
  prompt: string,
  promptCourt: string | undefined,
  references: (ReferenceImage | null)[],
  profil?: ProfilContenu,
): Promise<string> {
  if (!imagesElyndorCloudDisponibles() && generateurCourant === genererImageElyndorCloud) {
    throw new ErreurImagesIndisponibles();
  }
  return generateurCourant({
    prompt,
    promptCourt,
    negatif: negatifPourProfil(profil),
    references: references.filter((r): r is ReferenceImage => !!r?.image),
    format: '3:4',
  });
}

/** Avatar en cache, sinon généré (cadrage portrait conservé) puis mis en cache. */
/** Prompt anglais rédigé par le modèle narratif ; sans lui, le serveur lit le prompt français. */
async function promptPortraitSdxl(story: StoryState, nom: string, fiche: string, settings: AppSettings) {
  try {
    const prompt = await redigerPromptPortraitSdxl(story, nom, fiche, settings);
    return prompt ? `${prompt}, ${STYLE_PORTRAIT_SDXL}` : undefined;
  } catch {
    return undefined;
  }
}

export async function obtenirOuGenererAvatarPnj(
  story: StoryState,
  pnj: EntreeLoreEmergent,
  settings: AppSettings,
): Promise<string> {
  const existant = await obtenirAvatarPnj(story.meta.id, pnj.id);
  if (existant) return existant;
  // Fiche fusionnée : le portrait déjà généré sous un ancien identifiant est repris.
  for (const alias of pnj.alias ?? []) {
    const ancien = await obtenirAvatarPnj(story.meta.id, alias).catch(() => null);
    const image = ancien ? await preparerImageReference(ancien).catch(() => null) : null;
    if (image) return enregistrerAvatarPnj(story.meta.id, pnj.id, image);
  }
  // Le portrait prédéfini de sa race (création de personnage) guide l'allure
  // du PNJ ; le canon de la race est rappelé au modèle qui rédige le prompt.
  const race = detecterRacePnj(pnj.titre, pnj.contenu);
  const referenceRace = race ? await assetVersDataUrl(obtenirPortrait(race.race.id, race.sexe)) : null;
  const fiche = race ? `${pnj.contenu}\n${canonRace(race)}` : pnj.contenu;
  const dataUrl = await genererPortrait(
    construirePromptAvatarPnj(pnj),
    await promptPortraitSdxl(story, pnj.titre, fiche, settings),
    [referenceRace ? { role: 'race', image: referenceRace } : null],
    settings.profilContenu,
  );
  return enregistrerAvatarPnj(story.meta.id, pnj.id, dataUrl);
}

export async function obtenirOuGenererAvatarJoueur(story: StoryState, settings: AppSettings): Promise<string> {
  const existant = await obtenirAvatarPnj(story.meta.id, ID_ASSET_JOUEUR);
  if (existant) return existant;
  const portrait = await obtenirPortraitReferenceJoueur(story);
  const dataUrl = await genererPortrait(
    construirePromptAvatarJoueur(story),
    await promptPortraitSdxl(story, story.meta.personnageNom, story.meta.personnageDescription || story.meta.personnageNom, settings),
    [portrait ? { role: 'personnage', image: portrait } : null],
    settings.profilContenu,
  );
  return enregistrerAvatarPnj(story.meta.id, ID_ASSET_JOUEUR, dataUrl);
}
