import type { EntreeLoreEmergent, StoryState } from '../types';
import { analyserMessage } from '../engine/messageFormatter';
import { calculerRevisionNarrative } from './storyRevision';

export const ID_AVATAR_JOUEUR_VISUEL = '__joueur__';

const LOCUTEURS_GENERIQUES = new Set([
  'narrateur', 'garde', 'gardes', 'courtier', 'notaire', 'commissaire-priseur',
  'la captive', 'le captif', 'captive', 'captif', 'inconnue', 'inconnu',
  "l'inconnue", "l'inconnu", 'foule', 'voix', 'homme', 'femme',
]);

function normaliserNom(value: string): string {
  return value.trim().toLocaleLowerCase('fr').replace(/\s+/g, ' ');
}

function hashNom(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function titreLisible(value: string): string {
  return value.toLocaleLowerCase('fr').replace(/(^|[- '’])\p{L}/gu, (m) => m.toLocaleUpperCase('fr'));
}

export function idVisuelPnjDepuisNom(nom: string): string {
  const normalise = normaliserNom(nom);
  return `visual-pnj-${hashNom(normalise)}`;
}

function estGenerique(nom: string): boolean {
  return LOCUTEURS_GENERIQUES.has(normaliserNom(nom));
}

export function listerPnjVisuels(story: StoryState): EntreeLoreEmergent[] {
  const nomJoueur = normaliserNom(story.meta.personnageNom);
  const parNom = new Map<string, EntreeLoreEmergent>();

  for (const entree of story.loreEmergent.filter((e) => e.categorie === 'pnj')) {
    const nom = normaliserNom(entree.titre);
    if (!nom || nom === nomJoueur) continue;
    // Un PNJ déjà connu du lore conserve son identifiant historique : les
    // avatars existants restent donc retrouvables après mise à jour. Le hash
    // visuel n'est utilisé que pour un locuteur nommé détecté avant sa fiche.
    parNom.set(nom, entree);
  }

  story.messages.forEach((message, index) => {
    if (message.role !== 'assistant') return;
    for (const segment of analyserMessage(message.content)) {
      if (segment.type !== 'repliquePersonnage' || !segment.locuteur) continue;
      const nom = normaliserNom(segment.locuteur);
      if (!nom || nom === nomJoueur || estGenerique(nom) || parNom.has(nom)) continue;
      parNom.set(nom, {
        id: idVisuelPnjDepuisNom(nom),
        categorie: 'pnj',
        titre: titreLisible(segment.locuteur),
        contenu: `Personnage nommé présent dans le récit. Contexte visuel de sa première détection : ${message.content.slice(0, 700)}`,
        statut: 'provisoire',
        premiereMention: index,
        dernierAcces: index,
      });
    }
  });

  return [...parNom.values()];
}

export function listerIdsPnjVisuels(story: StoryState): string[] {
  return listerPnjVisuels(story).map((entree) => entree.id);
}

export function cleDedupeSynchronisationAvatars(story: StoryState): string {
  return `visual.avatars.sync:${story.meta.id}:${calculerRevisionNarrative(story)}`;
}

export function cleDedupeAvatar(storyId: string, assetId: string, forceToken?: string): string {
  return forceToken
    ? `visual.avatar.generate:${storyId}:${assetId}:${forceToken}`
    : `visual.avatar.generate:${storyId}:${assetId}`;
}

export function cleDedupeScene(story: StoryState, forceToken?: string): string {
  const revision = calculerRevisionNarrative(story);
  return forceToken
    ? `visual.scene.generate:${story.meta.id}:${revision}:${forceToken}`
    : `visual.scene.generate:${story.meta.id}:${revision}`;
}
