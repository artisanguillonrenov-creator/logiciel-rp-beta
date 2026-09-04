import type { EntreeLoreEmergent, StoryState } from '../types';
import { ErreurOpenRouter } from './openrouter';
import { obtenirAvatarPnj, enregistrerAvatarPnj } from '../storage/pnjAvatarsStore';

// Modèle ouvert (Black Forest Labs, poids publics) accessible via
// l'API image unifiée d'OpenRouter (même fournisseur/même clé que le texte
// — /chat/completions avec modalities: ['image']). Fixe (pas le
// modèle de texte choisi par le joueur, souvent optimisé conversation, pas
// image) pour garder un style cohérent d'une image à l'autre. Variante
// gratuite (":free") disponible mais limitée en requêtes/minute et sans
// garantie de disponibilité aux heures de pointe — voir AppSettings.modeleImagesGratuit.
const MODELE_IMAGE_PAYANT = 'black-forest-labs/flux.2-flex';
const MODELE_IMAGE_GRATUIT = 'black-forest-labs/flux.2-flex:free';

// Cadrage artistique commun à toutes les illustrations de scène — la seule
// vraie garantie de cohérence visuelle ici (le modèle ne garde pas de
// mémoire d'une génération à l'autre) : répéter le même style à chaque
// appel, comme pour les portraits générés à la main plus tôt ce soir.
const ANCRAGE_STYLE =
  "digital painting, dark romantic fantasy illustration, cinematic dramatic lighting, painted texture, rich detail, no text, no watermark, no logo, no signature";

// Nombre max de PNJ dont l'apparence est injectée dans le prompt de scène —
// au-delà, le prompt gonfle sans gain (un prompt trop long dilue l'attention
// du modèle, cf. la troncature de texteScene ci-dessous).
const MAX_PNJ_DANS_PROMPT_SCENE = 3;

/**
 * Un PNJ est considéré "présent" dans la scène si son nom (titre de sa
 * fiche de lore émergent) apparaît dans le texte narré — comparaison en
 * minuscules, même approche que normalise() dans socialDynamics.ts. Accepte
 * aussi le seul prénom (premier mot du titre) : la narration réutilise
 * rarement le nom complet à chaque mention.
 */
function pnjMentionneDansTexte(pnj: EntreeLoreEmergent, texteSceneMinuscule: string): boolean {
  const titre = pnj.titre.trim().toLowerCase();
  if (!titre) return false;
  if (texteSceneMinuscule.includes(titre)) return true;
  const premierMot = titre.split(/\s+/)[0];
  return premierMot.length > 2 && texteSceneMinuscule.includes(premierMot);
}

/**
 * Bloc d'apparence des PNJ récurrents confirmés (lore émergent "permanent",
 * même filtre que la galerie de portraits) détectés dans le texte de la
 * scène — sans ça, seule l'apparence du personnage joueur était respectée ;
 * un PNJ présent dans la scène n'avait aucune ancre visuelle au-delà de ce
 * que la prose narrée redit (rarement l'apparence physique complète).
 */
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
 * Construit le prompt d'illustration à partir de la dernière réponse du
 * narrateur (la scène telle qu'elle vient d'être décrite) — à défaut, le
 * point de départ de l'histoire. Tronqué : un prompt d'image trop long dilue
 * l'attention du modèle plutôt que d'améliorer le résultat.
 *
 * La fiche personnage (race, apparence...) est placée EN TÊTE, avant la
 * scène : sans elle, rien dans le prompt ne dit au modèle à quoi ressemble
 * {{user}} (race, teint...) — la scène narrée seule ne le répète pas à
 * chaque tour, d'où des personnages visuellement incohérents d'une
 * génération à l'autre malgré une fiche pourtant déjà renseignée à la
 * création (constaté en usage réel : une elfe noire rendue comme une
 * humaine générique). Les PNJ récurrents détectés dans la scène suivent le
 * même principe (voir construireBlocPnjPresents).
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

/**
 * Génère une illustration à partir d'un prompt texte via l'API image
 * unifiée d'OpenRouter. Renvoie une URL data: (PNG en base64) — jamais
 * persistée par l'appelant (voir ConversationScreen) : une image générée
 * pèse facilement plusieurs centaines de Ko à quelques Mo, l'enregistrer
 * dans l'histoire referait dépasser le quota de stockage du navigateur déjà
 * corrigé une fois ce soir (voir storage.ts, ecrireAvecRetraitSurQuota).
 */
export async function genererImageScene(apiKey: string, prompt: string, gratuit?: boolean): Promise<string> {
  return appellerModeleImage(apiKey, prompt, gratuit);
}

/**
 * Construit le prompt d'un portrait PNJ (cadrage buste/visage, pas une
 * scène) à partir de sa fiche de lore émergent (titre + description
 * factuelle déjà extraite par emergentLore.ts). Le même ancrage de style
 * que les illustrations de scène garantit une cohérence visuelle entre
 * portraits et scènes.
 */
export function construirePromptAvatarPnj(pnj: EntreeLoreEmergent): string {
  return (
    `Portrait (buste, cadrage serré sur le visage et les épaules) de ${pnj.titre}.\n` +
    `Description : ${pnj.contenu.slice(0, 400)}\n\n` +
    `Style : ${ANCRAGE_STYLE}, character portrait, plain dark background.`
  );
}

/**
 * Renvoie l'avatar d'un PNJ, depuis le cache persistant (pnjAvatarsStore)
 * s'il existe déjà, sinon le génère puis l'y enregistre — un seul appel
 * payant par PNJ pour toute la durée de l'histoire, et un visage qui ne
 * change plus d'une scène à l'autre.
 */
export async function obtenirOuGenererAvatarPnj(
  storyId: string,
  pnj: EntreeLoreEmergent,
  apiKey: string,
  gratuit?: boolean
): Promise<string> {
  const existant = await obtenirAvatarPnj(storyId, pnj.id);
  if (existant) return existant;
  const url = await appellerModeleImage(apiKey, construirePromptAvatarPnj(pnj), gratuit);
  await enregistrerAvatarPnj(storyId, pnj.id, url);
  return url;
}

async function appellerModeleImage(apiKey: string, prompt: string, gratuit?: boolean): Promise<string> {
  if (!apiKey) {
    throw new ErreurOpenRouter("Aucune clé API OpenRouter renseignée. Configure-la dans Réglages.");
  }

  let response: Response;
  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'Logiciel RP Beta',
      },
      body: JSON.stringify({
        model: gratuit ? MODELE_IMAGE_GRATUIT : MODELE_IMAGE_PAYANT,
        // FLUX ne produit QUE des images, jamais de texte en retour — lui
        // demander modalities: ['image', 'text'] fait qu'aucun endpoint ne
        // correspond côté OpenRouter (404 "No endpoints found that support
        // the requested output modalities: image, text", constaté en usage
        // réel). ['image'] seul est ce que ce type de modèle accepte.
        modalities: ['image'],
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch {
    throw new ErreurOpenRouter("Impossible de contacter OpenRouter. Vérifie ta connexion.");
  }

  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body?.error?.message ?? JSON.stringify(body);
    } catch {
      detail = await response.text();
    }
    throw new ErreurOpenRouter(`Erreur OpenRouter (${response.status}) : ${detail}`);
  }

  const data = await response.json();
  const images = data?.choices?.[0]?.message?.images;
  const premiere = Array.isArray(images) ? images[0] : undefined;
  // Forme exacte non garantie côté doc au moment de l'écriture — accepte
  // une chaîne directe ou le format image_url imbriqué (même convention que
  // l'entrée d'image envoyée aux modèles de vision).
  const url: string | undefined =
    typeof premiere === 'string' ? premiere : premiere?.image_url?.url ?? premiere?.url;

  if (!url) {
    throw new ErreurOpenRouter('Aucune image reçue du modèle (réponse OpenRouter dans un format inattendu).');
  }

  return url;
}
