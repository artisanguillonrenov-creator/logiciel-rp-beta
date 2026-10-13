import { assurerPodElyndorCloud, urlServeurImagesElyndorCloud } from './elyndorCloud';
import type { FormatImage } from './contratVisuel';

/**
 * Adaptateur technique du serveur d'images Elyndor Cloud (pod, port 7860).
 *
 * Ce module ne fait que traduire une requête déjà construite par le moteur
 * visuel (serviceVisuel) vers le protocole du serveur : OpenAI-compatible
 * `/images/generations`, étendu par `aspect_ratio`, `negative_prompt`,
 * `reference_images`, `modules`, `steps`, `guidance`, `seed`. Il n'ajoute
 * aucun mot de style, aucun négatif et aucun module : tout vient de la requête.
 */

/**
 * Identifiant technique attendu par le protocole OpenAI-compatible du pod.
 * Il ne décrit aucun style ; null désactive la capacité `images`.
 */
export const IDENTIFIANT_TECHNIQUE_IMAGE_POD: string | null = 'elyndor-image';

/** Limite du nombre d'images de référence acceptées par requête par le serveur. */
export const MAX_REFERENCES_IMAGE = 6;
/** Visages distincts que le serveur sait placer (un par personnage visible). */
export const MAX_VISAGES_POD = 4;

const DELAI_GENERATION_IMAGE_MS = 300_000;

export type { FormatImage };

export const DIMENSIONS_FORMAT: Record<FormatImage, { width: number; height: number }> = {
  '16:9': { width: 1344, height: 768 },
  '3:4': { width: 896, height: 1152 },
};

/**
 * Image de référence transmise au générateur : `personnage` guide un visage,
 * `race` l'allure d'une race, `scene` la continuité du décor.
 */
export interface ReferenceImage {
  role: 'personnage' | 'scene' | 'race';
  image: string;
}

/** Requête EFFECTIVE, déjà filtrée selon les capacités du générateur. */
export interface RequeteImage {
  prompt: string;
  negatif?: string;
  /** Modules demandés (peut être vide : aucun module par défaut côté serveur). */
  modules?: Record<string, number>;
  references: ReferenceImage[];
  format: FormatImage;
  steps?: number;
  guidance?: number;
  seed?: number;
  poidsRace?: number;
  size?: string;
}

export type GenerateurImage = (requete: RequeteImage, signal?: AbortSignal) => Promise<string>;

export class ErreurImagesIndisponibles extends Error {
  constructor(message = 'Le générateur d’images Elyndor Cloud n’est pas disponible.') {
    super(message);
    this.name = 'ErreurImagesIndisponibles';
  }
}

export function imagesElyndorCloudDisponibles(): boolean {
  return !!IDENTIFIANT_TECHNIQUE_IMAGE_POD;
}

export function construireCorpsRequeteImage(requete: RequeteImage, identifiant: string): Record<string, unknown> {
  const { width, height } = DIMENSIONS_FORMAT[requete.format];
  const references = requete.references.filter((ref) => !!ref.image).slice(0, MAX_REFERENCES_IMAGE);
  return {
    model: identifiant,
    prompt: requete.prompt,
    ...(requete.negatif ? { negative_prompt: requete.negatif } : {}),
    // Toujours explicite : un objet vide signifie « aucun module », jamais
    // « modules par défaut du serveur ».
    modules: requete.modules ?? {},
    n: 1,
    size: requete.size ?? `${width}x${height}`,
    aspect_ratio: requete.format,
    ...(requete.steps !== undefined ? { steps: requete.steps } : {}),
    ...(requete.guidance !== undefined ? { guidance: requete.guidance } : {}),
    ...(requete.seed !== undefined ? { seed: requete.seed } : {}),
    ...(requete.poidsRace !== undefined ? { poids_race: requete.poidsRace } : {}),
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
  const identifiant = IDENTIFIANT_TECHNIQUE_IMAGE_POD;
  if (!identifiant) throw new ErreurImagesIndisponibles();

  const controleur = new AbortController();
  const relayer = () => controleur.abort(signal?.reason);
  if (signal?.aborted) relayer();
  else signal?.addEventListener('abort', relayer, { once: true });
  const timer = setTimeout(() => controleur.abort(new Error('Délai de génération d’image dépassé.')), DELAI_GENERATION_IMAGE_MS);

  try {
    await assurerPodElyndorCloud();
    const reponse = await fetch(`${urlServeurImagesElyndorCloud()}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(construireCorpsRequeteImage(requete, identifiant)),
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
