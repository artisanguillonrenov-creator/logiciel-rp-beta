import { Image } from 'react-native';
import type { AppSettings, EntreeLoreEmergent, StoryState } from '../types';
import { obtenirAvatarPnj } from '../storage/pnjAvatarsStore';
import { obtenirPortrait } from '../data/portraits';

const ANCRAGE_STYLE =
  'digital painting, dark romantic fantasy illustration, cinematic dramatic lighting, painted texture, rich detail, no text, no watermark, no logo, no signature';
const MAX_PNJ_DANS_PROMPT_SCENE = 3;

export class ErreurImagesIndisponibles extends Error {
  constructor() {
    super('La génération d’images externe a été retirée. Elyndor Cloud n’expose pas encore de générateur d’images.');
    this.name = 'ErreurImagesIndisponibles';
  }
}

export function pnjMentionneDansTexte(pnj: EntreeLoreEmergent, texteSceneMinuscule: string): boolean {
  const titre = pnj.titre.trim().toLowerCase();
  if (!titre) return false;
  if (texteSceneMinuscule.includes(titre)) return true;
  const premierMot = titre.split(/\s+/)[0];
  return premierMot.length > 2 && texteSceneMinuscule.includes(premierMot);
}

function construireBlocPnjPresents(story: StoryState, texteScene: string): string {
  const texteMinuscule = texteScene.toLowerCase();
  const presents = story.loreEmergent
    .filter((e) => e.categorie === 'pnj' && e.statut === 'permanent')
    .filter((pnj) => pnjMentionneDansTexte(pnj, texteMinuscule))
    .slice(0, MAX_PNJ_DANS_PROMPT_SCENE);
  if (presents.length === 0) return '';
  const lignes = presents.map((pnj) => `- ${pnj.titre} : ${pnj.contenu.slice(0, 150)}`).join('\n');
  return `Personnages secondaires présents — respecter leur apparence :\n${lignes}\n\n`;
}

/**
 * Construit localement le prompt visuel de la scène. Il n'entraîne aucun
 * appel réseau et reste disponible pour un futur moteur image Elyndor Cloud.
 */
export function construirePromptScene(story: StoryState): string {
  const dernierMessageNarrateur = [...story.messages].reverse().find((m) => m.role === 'assistant');
  const texteScene = (dernierMessageNarrateur?.content ?? story.meta.pointDeDepart).slice(0, 600);
  const ficheJoueur = story.meta.personnageDescription?.trim();
  const blocPersonnage = ficheJoueur
    ? `Personnage principal (${story.meta.personnageNom}) — respecter strictement cette apparence :\n${ficheJoueur.slice(0, 400)}\n\n`
    : '';
  const blocPnj = construireBlocPnjPresents(story, texteScene);
  return `${blocPersonnage}${blocPnj}Scène :\n${texteScene}\n\nStyle : ${ANCRAGE_STYLE}.`;
}

export async function obtenirPromptScene(
  story: StoryState,
  _appSettings: AppSettings,
): Promise<string> {
  return construirePromptScene(story);
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

/**
 * Conservé pour compatibilité avec l'interface existante. Aucun fournisseur
 * tiers n'est contacté : l'appel échoue explicitement tant qu'Elyndor Cloud
 * ne fournit pas d'endpoint image.
 */
export async function genererImageScene(
  _apiKey: string,
  _prompt: string,
  _gratuit?: boolean,
  _imagesReference?: (string | null | undefined)[],
): Promise<string> {
  throw new ErreurImagesIndisponibles();
}

export function construirePromptAvatarPnj(pnj: EntreeLoreEmergent): string {
  return (
    `Portrait (buste, cadrage serré sur le visage et les épaules) de ${pnj.titre}.\n` +
    `Description : ${pnj.contenu.slice(0, 400)}\n\n` +
    `Style : ${ANCRAGE_STYLE}, character portrait, plain dark background.`
  );
}

/**
 * Les avatars déjà générés restent lisibles. S'il n'en existe pas, aucune
 * génération externe de remplacement n'est tentée.
 */
export async function obtenirOuGenererAvatarPnj(
  story: StoryState,
  pnj: EntreeLoreEmergent,
  _appSettings: AppSettings,
): Promise<string> {
  const existant = await obtenirAvatarPnj(story.meta.id, pnj.id);
  if (existant) return existant;
  throw new ErreurImagesIndisponibles();
}

export const ID_AVATAR_JOUEUR = '__joueur__';

export function construirePromptAvatarJoueur(story: StoryState): string {
  const fiche = story.meta.personnageDescription?.trim();
  return (
    `Portrait (buste, cadrage serré sur le visage et les épaules) de ${story.meta.personnageNom}.\n` +
    `Description : ${(fiche || 'Personnage principal de l\'histoire.').slice(0, 400)}\n\n` +
    `Style : ${ANCRAGE_STYLE}, character portrait, plain dark background.`
  );
}

export async function obtenirOuGenererAvatarJoueur(
  story: StoryState,
  _appSettings: AppSettings,
): Promise<string> {
  const existant = await obtenirAvatarPnj(story.meta.id, ID_AVATAR_JOUEUR);
  if (existant) return existant;
  throw new ErreurImagesIndisponibles();
}
