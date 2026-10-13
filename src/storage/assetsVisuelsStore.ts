import { Directory, File, Paths } from 'expo-file-system';

/**
 * Magasin des images de référence du lorebook : un fichier PNG par asset,
 * hors des fiches et des histoires. Un asset absent (supprimé, appareil
 * changé) est signalé au diagnostic, jamais bloquant pour le récit.
 */
const DOSSIER = 'visual-assets';
const FORME = /^asset-[a-z0-9-]{6,60}$/;

function fichier(assetId: string): File {
  if (!FORME.test(assetId)) throw new Error('Identifiant d’asset invalide.');
  return new File(Paths.document, DOSSIER, `${assetId}.png`);
}

function extraireBase64(dataUrl: string): string {
  const virgule = dataUrl.indexOf(',');
  return virgule === -1 ? dataUrl : dataUrl.slice(virgule + 1);
}

export async function obtenirAssetVisuel(assetId: string): Promise<string | null> {
  const f = fichier(assetId);
  return f.exists ? f.uri : null;
}

export async function enregistrerAssetVisuel(assetId: string, dataUrl: string): Promise<string> {
  const dossier = new Directory(Paths.document, DOSSIER);
  if (!dossier.exists) dossier.create({ intermediates: true });
  const f = fichier(assetId);
  f.create({ overwrite: true });
  f.write(extraireBase64(dataUrl), { encoding: 'base64' });
  return f.uri;
}

export async function supprimerAssetVisuel(assetId: string): Promise<void> {
  const f = fichier(assetId);
  if (f.exists) f.delete();
}
