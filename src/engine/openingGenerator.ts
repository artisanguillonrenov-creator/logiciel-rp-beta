import type { AppSettings, Message, StoryState } from '../types';
import { calculerSelectionLore, construireCtxBase } from './generateTurn';
import { construireMessages, maxTokensPourLongueur, temperaturePourCreativite } from './promptBuilder';
import { appellerModele } from './openrouter';
import { ErreurProfilContenu, validerProfilContenuHeuristique } from './contenuAdulte';

function genererId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Texte de requête pour la recherche sémantique de lore — centré sur le lieu
// de départ choisi par le joueur, puisque c'est lui qui doit déterminer
// quels éléments piochés (PNJ mineur, rumeur, événement récent, détail
// d'ambiance) enrichissent la scène d'ouverture.
function construireTexteRequeteOuverture(story: StoryState): string {
  return [story.meta.contexte.lieu, story.meta.pointDeDepart, story.meta.personnageDescription]
    .filter(Boolean)
    .join('\n');
}

const INSTRUCTION_OUVERTURE =
  "Écris la toute première scène de l'histoire, avant que {{user}} n'ait dit ou fait quoi que ce soit. Installe le lieu, l'ambiance et la situation de départ telle que décrite, en intégrant naturellement les éléments du lore ci-dessus quand ils sont pertinents à la scène (sans les énumérer comme une liste). Termine sur un moment qui appelle une première réaction ou décision de {{user}}, sans jamais parler ni agir à sa place.";

/**
 * Enrichissement automatique et invisible de l'ouverture (chantier 3) :
 * avant que le joueur ne voie le premier message, pioche 2-3 éléments de
 * lore liés au lieu de départ — en réutilisant la même recherche sémantique
 * que le reste de la partie (selectionnerLoreElyndorSemantique), mais en
 * mode aléatoire parmi les entrées pertinentes plutôt que déterministe — et
 * les intègre au prompt qui génère la scène d'ouverture. Deux joueurs avec
 * le même monde, un personnage similaire et le même lieu de départ
 * obtiennent ainsi des débuts différents.
 */
export async function genererMessageOuverture(story: StoryState, appSettings: AppSettings): Promise<Message> {
  const texteRequete = construireTexteRequeteOuverture(story);
  const selection = await calculerSelectionLore(story, texteRequete, appSettings, {
    aleatoire: true,
    tailleBassinAleatoire: 10,
  });

  const ctxBase = construireCtxBase(story, INSTRUCTION_OUVERTURE, appSettings, selection);

  const modelePourAppel = story.meta.modeleOverride?.trim() || appSettings.model;
  const temperature = story.meta.temperatureOverride ?? temperaturePourCreativite(story.settings.creativite);
  const maxTokens = maxTokensPourLongueur(story.settings.longueur);

  const contenu = await appellerModele({
    apiKey: appSettings.openRouterApiKey,
    model: modelePourAppel,
    moteurInference: appSettings.moteurInference,
    messages: construireMessages(ctxBase),
    temperature,
    maxTokens,
  });

  // Même verrou fail-closed que genererTour (voir generateTurn.ts) : cette
  // ouverture n'a pas de boucle de réparation (pas d'échange encore établi
  // à corriger), donc un dépassement du profil GRAND_PUBLIC est traité
  // comme un échec de génération pur et simple — CreateScreen.valider()
  // dégrade déjà silencieusement vers l'écran vide habituel si cette
  // fonction échoue, ce qui est le comportement voulu ici aussi.
  if (!validerProfilContenuHeuristique(contenu, appSettings.profilContenu).ok) {
    throw new ErreurProfilContenu("Scène d'ouverture générée hors des limites du profil Grand public.");
  }

  return {
    id: genererId(),
    role: 'assistant',
    content: contenu.trim(),
    timestamp: Date.now(),
  };
}
