import type { GenerateurImage, RequeteImage } from './elyndorCloudImages';
import { ErreurImagesIndisponibles } from './elyndorCloudImages';

/**
 * API REST Workers AI, FLUX.2 Klein 4B. Une clé personnelle est saisie sur
 * l'appareil (SecureStore), jamais intégrée à l'APK. Pour une offre multi-
 * utilisateurs, placer plutôt cet appel derrière un proxy authentifié.
 */
export const MODELE_CLOUDFLARE = '@cf/black-forest-labs/flux-2-klein-4b';

export function dimensionsCloudflare(requete: RequeteImage): { width: number; height: number } {
  const [largeur, hauteur] = (requete.size || (requete.format === '16:9' ? '1344x768' : '896x1152'))
    .split('x').map(Number);
  if (!Number.isInteger(largeur) || !Number.isInteger(hauteur) ||
      largeur < 256 || largeur > 1920 || hauteur < 256 || hauteur > 1920) {
    throw new ErreurImagesIndisponibles('Dimensions incompatibles avec FLUX.2 Klein (256 à 1920 pixels).');
  }
  return { width: largeur, height: hauteur };
}

/** Le fournisseur exige des fichiers binaires de dimensions strictement inférieures à 512x512. */
async function ajouterReferences(formulaire: FormData, requete: RequeteImage): Promise<void> {
  if (!requete.references.length) return;
  // Import différé : ne pas charger les modules natifs dans les tests Node.
  const ImageManipulator = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
  const { Image, Platform } = require('react-native') as typeof import('react-native');
  const limites = requete.references.slice(0, 4);
  for (let i = 0; i < limites.length; i++) {
    const source = limites[i].image;
    if (!source) continue;
    try {
      const dimensions = await new Promise<{width: number; height: number}>((resolve, reject) =>
        Image.getSize(source, (width, height) => resolve({width, height}), reject));
      const facteur = Math.min(1, 480 / Math.max(dimensions.width, dimensions.height));
      const largeur = Math.max(1, Math.floor(dimensions.width * facteur));
      const hauteur = Math.max(1, Math.floor(dimensions.height * facteur));
      const resultat = await ImageManipulator.manipulateAsync(
        source, [{ resize: { width: largeur, height: hauteur } }],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 0.82 },
      );
      const nom = `reference-${i}.jpg`;
      if (Platform.OS === 'web') {
        const blob = await (await fetch(resultat.uri)).blob();
        formulaire.append(`input_image_${i}`, blob, nom);
      } else {
        formulaire.append(`input_image_${i}`, { uri: resultat.uri, name: nom, type: 'image/jpeg' } as any);
      }
    } catch {
      throw new ErreurImagesIndisponibles(
        `Référence image ${i + 1} impossible à préparer pour Cloudflare. Génération annulée pour préserver la cohérence.`,
      );
    }
  }
}

export function genererImageCloudflare(accountId: string, apiKey: string): GenerateurImage {
  return async (requete, signal) => {
    const compte = accountId.trim(), cle = apiKey.trim();
    if (!/^[a-z0-9]{32}$/i.test(compte) || !cle) {
      throw new ErreurImagesIndisponibles('Cloudflare : renseigne ton Account ID (32 caractères) et ton jeton Workers AI.');
    }
    const dims = dimensionsCloudflare(requete);
    const formulaire = new FormData();
    formulaire.append('prompt', requete.prompt);
    formulaire.append('width', String(dims.width));
    formulaire.append('height', String(dims.height));
    if (typeof requete.seed === 'number') formulaire.append('seed', String(requete.seed));
    if (typeof requete.guidance === 'number') formulaire.append('guidance', String(requete.guidance));
    await ajouterReferences(formulaire, requete);
    const reponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${compte}/ai/run/${MODELE_CLOUDFLARE}`,
      { method: 'POST', headers: { Authorization: `Bearer ${cle}` }, body: formulaire, signal },
    );
    if (!reponse.ok) {
      if (reponse.status === 429) throw new ErreurImagesIndisponibles('Cloudflare : quota ou limitation de requêtes atteint.');
      if (reponse.status === 401 || reponse.status === 403) throw new ErreurImagesIndisponibles('Cloudflare : jeton invalide ou droits Workers AI insuffisants.');
      throw new ErreurImagesIndisponibles(`Cloudflare a refusé la génération (HTTP ${reponse.status}).`);
    }
    const payload = await reponse.json();
    const image = payload?.result?.image ?? payload?.image;
    if (typeof image !== 'string' || !image.length) {
      throw new ErreurImagesIndisponibles('Cloudflare n’a pas renvoyé de fichier image exploitable.');
    }
    return image.startsWith('data:image/') ? image : `data:image/png;base64,${image}`;
  };
}
