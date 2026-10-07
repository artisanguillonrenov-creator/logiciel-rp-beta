import type { StoryState } from '../types';
import { CAPITALES, ROLES_CANON } from './canonElyndor';
import { detecterCapitale, lireEtatScene } from './etatScene';
import { analyserIntention, decrireIntention, type IntentionJoueur } from './intentionJoueur';
import { horloge } from './noyauNarratif';
import { prenomRole, rolesDeLaVille, type RoleCanon } from './rolesCanon';

/**
 * Fiche de scène : ce que l'application a établi avant que le narrateur
 * n'écrive (intention du joueur, ville, lieu, heure, présents, rôles fixés
 * par le lore, engagements). Placée en fin de prompt, elle fait autorité.
 */
export interface PreparationTour {
  intention: IntentionJoueur;
  ville?: string;
  /** Rôles fixés concernés par la scène : à utiliser, jamais à remplacer. */
  roles: RoleCanon[];
  fiche: string;
}

const MAX_DESCRIPTION_ROLE = 220;

export function preparerTour(story: StoryState, messageJoueur: string): PreparationTour {
  const scene = lireEtatScene(story, CAPITALES);
  const intention = analyserIntention(messageJoueur, ROLES_CANON);
  const ville = detecterCapitale(messageJoueur, CAPITALES) ?? scene.ville;

  const presents = scene.presents.map((p) => p.toLowerCase());
  const roles = [
    ...rolesDeLaVille(ROLES_CANON, ville, intention.roles),
    ...intention.pnjCites,
    // Un rôle fixé déjà présent dans la scène reste listé.
    ...rolesDeLaVille(ROLES_CANON, ville).filter((r) => presents.some((p) => p.includes(prenomRole(r).toLowerCase()))),
  ].filter((r, i, liste) => liste.findIndex((x) => x.nom === r.nom) === i);

  const lignes = ['[FICHE DE SCÈNE — fait autorité]'];
  const but = decrireIntention(intention);
  if (but) lignes.push(`Intention du joueur : ${but}.`);
  const lieux = [scene.lieu && `lieu actuel : ${scene.lieu}`, intention.deplacement && intention.lieu && `destination : ${intention.lieu.libelle}${ville ? ` de ${ville}` : ''}`]
    .filter(Boolean)
    .join(' → ');
  lignes.push(`Ville : ${ville ?? 'inconnue'}.${lieux ? ` ${lieux.charAt(0).toUpperCase()}${lieux.slice(1)}.` : ''}`);
  if (story.narrativeCore?.clock) lignes.push(`Heure du monde : ${horloge(story.narrativeCore.clock)}.`);
  if (scene.presents.length) lignes.push(`Présents : ${scene.presents.join(', ')}.`);
  if (roles.length) {
    lignes.push('Rôles fixés par le lore pour cette scène (utilise ces personnages, ne les remplace jamais par un inventé) :');
    for (const r of roles) {
      const description = r.description.length > MAX_DESCRIPTION_ROLE ? `${r.description.slice(0, MAX_DESCRIPTION_ROLE - 1)}…` : r.description;
      lignes.push(`- ${r.libelle} (${r.ville}) : ${r.nom} — ${description}`);
    }
  }
  const engagements = story.social.engagements.filter((e) => !e.honore && !e.rompu).slice(-3);
  if (engagements.length) {
    lignes.push('Engagements en cours :');
    for (const e of engagements) lignes.push(`- ${e.partie} : ${e.description}`);
  }
  return { intention, ville, roles, fiche: lignes.join('\n') };
}
