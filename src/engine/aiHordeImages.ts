import type { GenerateurImage, RequeteImage } from './elyndorCloudImages';
import { ErreurImagesIndisponibles } from './elyndorCloudImages';

/** File d'attente communautaire. Aucune garantie de modèle, de délai ou de confidentialité en mode anonyme. */
const API = 'https://aihorde.net/api/v2';
const CLE_ANONYME = '0000000000';
const LIMITE_ATTENTE_MS = 240_000;

export function corpsRequeteHorde(requete: RequeteImage, adulte: boolean, modele = '', anonyme = true) {
  const scene = requete.format === '16:9';
  return {
    prompt: requete.negatif ? `${requete.prompt} ### ${requete.negatif}` : requete.prompt,
    params: {
      width: scene ? 768 : 576,
      height: scene ? 448 : 768,
      steps: Math.min(30, Math.max(10, requete.steps ?? 25)),
      cfg_scale: requete.guidance ?? 7,
      n: 1,
      ...(requete.seed !== undefined ? { seed: String(requete.seed) } : {}),
    },
    nsfw: adulte,
    censor_nsfw: !adulte,
    r2: true,
    shared: anonyme, // AI Horde impose le partage pour les requêtes anonymes.
    ...(modele.trim() ? { models: [modele.trim()] } : {}),
  };
}

async function reponseJSON(url: string, options: RequestInit, signal?: AbortSignal): Promise<any> {
  const reponse = await fetch(url, { ...options, signal });
  if (!reponse.ok) {
    if (reponse.status === 429) throw new ErreurImagesIndisponibles('AI Horde : trop de requêtes, réessaie plus tard.');
    throw new ErreurImagesIndisponibles(`AI Horde : erreur HTTP ${reponse.status}.`);
  }
  return reponse.json();
}

function attendre(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new ErreurImagesIndisponibles('Image annulée.')); return; }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', interrompre); resolve(); }, ms);
    const interrompre = () => { clearTimeout(timer); reject(new ErreurImagesIndisponibles('Image annulée.')); };
    signal?.addEventListener('abort', interrompre, { once: true });
  });
}

async function imageVersDataURL(image: string, signal?: AbortSignal): Promise<string> {
  if (image.startsWith('data:image/')) return image;
  if (!/^https:\/\//i.test(image)) {
    throw new ErreurImagesIndisponibles('AI Horde : adresse de résultat invalide.');
  }
  const reponse = await fetch(image, { signal });
  if (!reponse.ok) throw new ErreurImagesIndisponibles('AI Horde : image générée mais téléchargement impossible.');
  const blob = await reponse.blob();
  if (!blob.type.startsWith('image/')) throw new ErreurImagesIndisponibles('AI Horde : réponse reçue non reconnue comme image.');
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onerror = () => reject(new ErreurImagesIndisponibles('AI Horde : lecture du fichier image impossible.'));
    lecteur.onload = () => resolve(String(lecteur.result));
    lecteur.readAsDataURL(blob);
  });
}

export function genererImageHorde(clePersonnelle = '', adulte = false, modele = ''): GenerateurImage {
  return async (requete, signal) => {
    const cle = clePersonnelle.trim() || CLE_ANONYME;
    const enTetes = { 'Content-Type': 'application/json', apikey: cle, 'Client-Agent': 'Elyndor:1.0:github.com/artisanguillonrenov-creator/logiciel-rp-beta' };
    const demande = await reponseJSON(`${API}/generate/async`, {
      method: 'POST', headers: enTetes,
      body: JSON.stringify(corpsRequeteHorde(requete, adulte, modele, cle === CLE_ANONYME)),
    }, signal);
    const id = demande?.id;
    if (typeof id !== 'string' || !/^[a-z0-9-]{10,80}$/i.test(id)) {
      throw new ErreurImagesIndisponibles('AI Horde : la file d’attente n’a pas accepté la demande.');
    }
    const debut = Date.now();
    while (Date.now() - debut < LIMITE_ATTENTE_MS) {
      await attendre(4000, signal);
      const etat = await reponseJSON(`${API}/generate/check/${id}`, { headers: enTetes }, signal);
      if (etat?.faulted === true || etat?.is_possible === false) {
        throw new ErreurImagesIndisponibles('AI Horde : aucun worker ne peut réaliser cette image pour le moment.');
      }
      if ((etat?.finished ?? 0) > 0 || etat?.done === true) {
        const statut = await reponseJSON(`${API}/generate/status/${id}`, { headers: enTetes }, signal);
        const image = statut?.generations?.[0]?.img;
        if (typeof image !== 'string') throw new ErreurImagesIndisponibles('AI Horde : résultat sans image.');
        return imageVersDataURL(image, signal);
      }
    }
    throw new ErreurImagesIndisponibles('AI Horde : délai communautaire dépassé (4 minutes). Réessaie plus tard.');
  };
}
