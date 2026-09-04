import type { StoryState } from '../types';
import { ErreurOpenRouter } from './openrouter';

// Modèle ouvert (Black Forest Labs, poids publics) accessible via
// l'API image unifiée d'OpenRouter (même fournisseur/même clé que le texte
// — /chat/completions avec modalities: ['image', 'text']). Fixe (pas le
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

/**
 * Construit le prompt d'illustration à partir de la dernière réponse du
 * narrateur (la scène telle qu'elle vient d'être décrite) — à défaut, le
 * point de départ de l'histoire. Tronqué : un prompt d'image trop long dilue
 * l'attention du modèle plutôt que d'améliorer le résultat.
 */
export function construirePromptScene(story: StoryState): string {
  const dernierMessageNarrateur = [...story.messages].reverse().find((m) => m.role === 'assistant');
  const texteScene = (dernierMessageNarrateur?.content ?? story.meta.pointDeDepart).slice(0, 600);
  return `${texteScene}\n\nStyle : ${ANCRAGE_STYLE}.`;
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
        modalities: ['image', 'text'],
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
