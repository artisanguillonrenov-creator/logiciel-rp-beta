import { ELYNDOR_CLOUD_POD } from './elyndorCloud';

/**
 * Générateur d'images Elyndor Cloud.
 *
 * Comme pour la narration, aucun fournisseur tiers n'est configurable :
 * Lustify SDXL v4 est servi par le pod Elyndor Cloud (infra/runpod/
 * image_server.py, port 7860). Mettre ELYNDOR_CLOUD_MODELE_IMAGE à null
 * désactive la capacité `images` (voir automation/capabilities.ts).
 *
 * Contrat : OpenAI-compatible `/images/generations`, étendu par
 * `aspect_ratio`, `negative_prompt`, `reference_images` et `prompt_sdxl`
 * (prompt court en anglais, prioritaire : le CLIP de SDXL est limité à 77
 * jetons et comprend mal le français).
 * Toute la logique de continuité (prompt, références, état visuel) reste
 * indépendante de ce module : un autre backend (serveur GPU, modèle local…)
 * n'aura qu'à implémenter `GenerateurImage`.
 */
export const ELYNDOR_CLOUD_IMAGES_URL = `https://${ELYNDOR_CLOUD_POD}-7860.proxy.runpod.net/v1`;
export const ELYNDOR_CLOUD_MODELE_IMAGE: string | null = 'lustify-sdxl-v4';

/** Limite du nombre d'images de référence envoyées par requête. */
export const MAX_REFERENCES_IMAGE = 6;

const DELAI_GENERATION_IMAGE_MS = 300_000;

export type FormatImage = '16:9' | '3:4';

export const DIMENSIONS_FORMAT: Record<FormatImage, { width: number; height: number }> = {
  '16:9': { width: 1344, height: 768 },
  '3:4': { width: 896, height: 1152 },
};

/**
 * Image de référence envoyée au serveur (IP-Adapter) : `personnage` guide le
 * visage du personnage principal visible, `scene` la continuité du décor,
 * de la lumière et de l'ambiance.
 */
export interface ReferenceImage {
  role: 'personnage' | 'scene';
  image: string;
}

export interface RequeteImage {
  prompt: string;
  /** Version courte en anglais pour les modèles à encodeur CLIP (SDXL). */
  promptCourt?: string;
  negatif?: string;
  /** Déjà triées par priorité (voir selectionnerReferencesGenerateur). */
  references: ReferenceImage[];
  format: FormatImage;
}

export type GenerateurImage = (requete: RequeteImage, signal?: AbortSignal) => Promise<string>;

export class ErreurImagesIndisponibles extends Error {
  constructor(message = 'Le générateur d’images Elyndor Cloud n’est pas encore disponible.') {
    super(message);
    this.name = 'ErreurImagesIndisponibles';
  }
}

export function imagesElyndorCloudDisponibles(): boolean {
  return !!ELYNDOR_CLOUD_MODELE_IMAGE;
}

export function construireCorpsRequeteImage(requete: RequeteImage, modele: string): Record<string, unknown> {
  const { width, height } = DIMENSIONS_FORMAT[requete.format];
  const references = requete.references.filter((ref) => !!ref.image).slice(0, MAX_REFERENCES_IMAGE);
  return {
    model: modele,
    prompt: requete.prompt,
    ...(requete.promptCourt ? { prompt_sdxl: requete.promptCourt } : {}),
    ...(requete.negatif ? { negative_prompt: requete.negatif } : {}),
    n: 1,
    size: `${width}x${height}`,
    aspect_ratio: requete.format,
    response_format: 'b64_json',
    ...(references.length ? { reference_images: references.map((ref) => ({ role: ref.role, image: ref.image })) } : {}),
  };
}

export function extraireImageReponse(data: unknown): string | null {
  const premiere = (data as { data?: Array<{ b64_json?: unknown; url?: unknown }> })?.data?.[0];
  if (typeof premiere?.b64_json === 'string' && premiere.b64_json) {
    return premiere.b64_json.startsWith('data:') ? premiere.b64_json : `data:image/png;base64,${premiere.b64_json}`;
  }
  // Seule une data URL est stockable telle quelle (fichier natif, IndexedDB).
  if (typeof premiere?.url === 'string' && premiere.url.startsWith('data:image/')) return premiere.url;
  return null;
}

export const genererImageElyndorCloud: GenerateurImage = async (requete, signal) => {
  const modele = ELYNDOR_CLOUD_MODELE_IMAGE;
  if (!modele) throw new ErreurImagesIndisponibles();

  const controleur = new AbortController();
  const relayer = () => controleur.abort(signal?.reason);
  if (signal?.aborted) relayer();
  else signal?.addEventListener('abort', relayer, { once: true });
  const timer = setTimeout(() => controleur.abort(new Error('Délai de génération d’image dépassé.')), DELAI_GENERATION_IMAGE_MS);

  try {
    const reponse = await fetch(`${ELYNDOR_CLOUD_IMAGES_URL}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(construireCorpsRequeteImage(requete, modele)),
      signal: controleur.signal,
    });
    if (!reponse.ok) {
      throw new ErreurImagesIndisponibles(`Erreur du générateur d’images Elyndor Cloud (${reponse.status}).`);
    }
    const image = extraireImageReponse(await reponse.json());
    if (!image) throw new ErreurImagesIndisponibles('Elyndor Cloud n’a renvoyé aucune image exploitable.');
    return image;
  } catch (erreur) {
    if (erreur instanceof ErreurImagesIndisponibles) throw erreur;
    if (signal?.aborted) throw new ErreurImagesIndisponibles('Génération d’image annulée.');
    if (controleur.signal.aborted) {
      throw new ErreurImagesIndisponibles('Elyndor Cloud n’a pas produit l’image avant la limite. Réessaie dans quelques instants.');
    }
    throw new ErreurImagesIndisponibles('Impossible de joindre le générateur d’images Elyndor Cloud.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', relayer);
  }
};
