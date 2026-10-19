import { Image } from 'react-native';
import type { AppSettings, EntreeLoreEmergent, StoryState } from '../types';
import { enregistrerAvatarPnj, obtenirAvatarPnj, preparerImageReference } from '../storage/pnjAvatarsStore';
import { obtenirIllustrationScene } from '../storage/sceneImagesStore';
import { obtenirAssetVisuel } from '../storage/assetsVisuelsStore';
import { monde, mondeIdDe, obtenirPortrait } from '../mondes';
import { donneesMonde } from '../mondes/donnees';
import { lireReglagesVisuels } from '../concepteur/reglagesVisuelsStore';
import { lireAssetsLore } from '../concepteur/assetsLoreStore';
import { lireLoreAtelier } from '../concepteur/lorebookStore';
import { appliquerLorePublie } from '../concepteur/lorebookModele';
import { ErreurImagesIndisponibles } from './elyndorCloudImages';
import { referenceRaceFiable } from './racePnj';
import { contratPortrait, raceDuPersonnage, type ContratVisuel } from './contratVisuel';
import { extraireMotsClesPortrait } from './extracteurVisuel';
import { executerImage, type ResultatImage } from './serviceVisuel';
import { candidatsLorePourContrat } from './referencesVisuelles';
import type { ReferenceCandidate } from './moteurVisuel';
import {
  ID_ASSET_JOUEUR,
  lireEtatVisuel,
  projeterEtatVisuel,
  sceneDansChronologie,
  type PersonnageVisibleResolu,
  type SceneIllustree,
} from './visualState';

// Couche image de l'application : collecte des références disponibles sur
// l'appareil (portraits de création, avatars, portraits de race, scènes,
// images du lorebook) et génération des avatars. Toute génération passe par
// le service visuel unique (serviceVisuel) : aucun appel direct à un
// générateur ici. Les scènes illustrées sont conservées sans limite.

export { ErreurImagesIndisponibles };
export { ID_ASSET_JOUEUR as ID_AVATAR_JOUEUR };

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
  return assetVersDataUrl(obtenirPortrait(story.meta.raceOrigineId, story.meta.sexe, mondeIdDe(story.meta)));
}

/** Portrait prédéfini d'une race (création de personnage), en data URL. */
export async function obtenirPortraitRace(raceId: string, sexe?: string, mondeId: string = monde.actifId()): Promise<string | null> {
  return assetVersDataUrl(obtenirPortrait(raceId, sexe, mondeId));
}

async function versReference(uri: string | null): Promise<string | null> {
  if (!uri) return null;
  try {
    return await preparerImageReference(uri);
  } catch {
    return null;
  }
}

/** Lorebook publié (canon + fiches de l'Atelier), pour rattacher les images de référence. */
async function poolLorePublie(mondeId: string) {
  const canon = donneesMonde(mondeId).lore;
  try {
    return appliquerLorePublie(canon, await lireLoreAtelier(mondeId));
  } catch {
    return canon;
  }
}

/** Images du lorebook liées au lieu, aux personnages visibles et à leur race. */
async function candidatsLore(story: StoryState | null, contrat: ContratVisuel): Promise<ReferenceCandidate[]> {
  try {
    const etat = await lireAssetsLore();
    if (!Object.keys(etat.liens).length) return [];
    const races = new Map<string, string>();
    if (story) {
      for (const p of contrat.personnages) {
        const race = raceDuPersonnage(story, p);
        if (race) races.set(p.cle, race.race.nom);
      }
    }
    const sortie: ReferenceCandidate[] = [];
    for (const c of candidatsLorePourContrat(contrat, await poolLorePublie(story ? mondeIdDe(story.meta) : monde.actifId()), etat, races)) {
      sortie.push({ ...c, uri: await versReference(await obtenirAssetVisuel(c.assetId).catch(() => null)) });
    }
    return sortie;
  } catch {
    return [];
  }
}

/** Références candidates d'un personnage : identité (portrait de création, avatar) puis race. */
async function candidatsPersonnage(story: StoryState, p: ContratVisuel['personnages'][number], avecAvatar: boolean): Promise<ReferenceCandidate[]> {
  const sortie: ReferenceCandidate[] = [];
  if (p.type === 'joueur') {
    sortie.push({ id: 'portrait-creation:joueur', type: 'joueur-portrait', role: 'identite', entite: p.cle,
      libelle: `visage de ${p.nom} (portrait de création)`, uri: await obtenirPortraitReferenceJoueur(story) });
    if (avecAvatar) {
      sortie.push({ id: `avatar:${ID_ASSET_JOUEUR}`, type: 'joueur-avatar', role: 'identite', entite: p.cle,
        libelle: `avatar de ${p.nom}`, uri: await versReference(await obtenirAvatarPnj(story.meta.id, ID_ASSET_JOUEUR).catch(() => null)) });
    }
    return sortie;
  }
  if (p.type === 'pnj' && p.assetId && avecAvatar) {
    const uri = await versReference(await obtenirAvatarPnj(story.meta.id, p.assetId).catch(() => null));
    if (uri) sortie.push({ id: `avatar:${p.assetId}`, type: 'pnj-avatar', role: 'identite', entite: p.cle, libelle: `avatar de ${p.nom}`, uri });
  }
  const race = raceDuPersonnage(story, p);
  if (race && referenceRaceFiable(race)) {
    sortie.push({ id: `race:${race.race.id}-${race.sexe}`, type: 'race', role: 'race', entite: p.cle,
      libelle: `portrait de race ${race.race.nom} (${p.nom})`, uri: await obtenirPortraitRace(race.race.id, race.sexe, race.mondeId) });
  }
  return sortie;
}

/**
 * Références candidates d'une scène : identités et races des personnages
 * visibles, images du lorebook, puis la dernière scène illustrée de la même
 * chronologie (le filtrage par lieu se fait dans le moteur, avec sa raison).
 * Même collecte pour l'illustration du jeu et l'aperçu de scène de l'Atelier.
 */
export async function collecterCandidatsScene(
  story: StoryState,
  contrat: ContratVisuel,
  scenesPrecedentes: readonly SceneIllustree[],
): Promise<ReferenceCandidate[]> {
  const candidats: ReferenceCandidate[] = [];
  for (const p of contrat.personnages) candidats.push(...await candidatsPersonnage(story, p, true));
  candidats.push(...await candidatsLore(story, contrat));
  const precedente = [...scenesPrecedentes].reverse().find((s) => sceneDansChronologie(s, story));
  if (precedente) {
    candidats.push({
      id: `scene:${precedente.revision}`,
      type: 'scene-precedente',
      role: 'continuite',
      libelle: 'scène illustrée précédente (continuité)',
      lieu: precedente.contrat?.lieu[0] ?? precedente.structure?.decor?.lieu,
      uri: await versReference(await obtenirIllustrationScene(story.meta.id, precedente.revision).catch(() => null)),
    });
  }
  return candidats;
}

/** Références candidates d'un portrait : identité de création (joueur) ou race, et images du lorebook. */
export async function collecterCandidatsPortrait(story: StoryState, contrat: ContratVisuel): Promise<ReferenceCandidate[]> {
  const sujet = contrat.personnages[0];
  if (!sujet) return [];
  return [...await candidatsPersonnage(story, sujet, false), ...await candidatsLore(story, contrat)];
}

/** Contrat, références et génération d'un portrait 3:4 (sans enregistrement). */
export async function genererPortraitPersonnage(
  story: StoryState,
  sujet: PersonnageVisibleResolu,
  settings: AppSettings,
  options: { simulation?: boolean; signal?: AbortSignal } = {},
): Promise<ResultatImage> {
  const etat = projeterEtatVisuel(lireEtatVisuel(story), story);
  const reglages = await lireReglagesVisuels();
  const extraction = await extraireMotsClesPortrait(story, sujet, settings, etat, { consigne: reglages.consigneExtraction, signal: options.signal });
  const { contrat, negatifCanon } = contratPortrait({
    story, sujet, extraction: extraction.extraction, parModele: extraction.parModele, etat, rejetsExtraction: extraction.rejets,
  });
  return executerImage({
    contrat,
    candidats: await collecterCandidatsPortrait(story, contrat),
    negatifCanon,
    storyId: story.meta.id,
    extraction: { parModele: extraction.parModele, brute: extraction.brute, erreur: extraction.erreur, rejets: extraction.rejets },
    simulation: options.simulation,
    signal: options.signal,
    destination: `avatar ${sujet.assetId ?? sujet.nom}`,
  });
}

function imageObligatoire(resultat: ResultatImage): string {
  if (!resultat.image) throw new ErreurImagesIndisponibles('Le générateur n’a renvoyé aucune image.');
  return resultat.image;
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
  const sujet: PersonnageVisibleResolu = { nom: pnj.titre, type: 'pnj', assetId: pnj.id, principal: pnj.statut === 'permanent' };
  return enregistrerAvatarPnj(story.meta.id, pnj.id, imageObligatoire(await genererPortraitPersonnage(story, sujet, settings)));
}

export async function obtenirOuGenererAvatarJoueur(story: StoryState, settings: AppSettings): Promise<string> {
  const existant = await obtenirAvatarPnj(story.meta.id, ID_ASSET_JOUEUR);
  if (existant) return existant;
  const sujet: PersonnageVisibleResolu = { nom: story.meta.personnageNom, type: 'joueur', assetId: ID_ASSET_JOUEUR, principal: true };
  return enregistrerAvatarPnj(story.meta.id, ID_ASSET_JOUEUR, imageObligatoire(await genererPortraitPersonnage(story, sujet, settings)));
}
