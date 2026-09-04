import { Directory, File, Paths } from 'expo-file-system';

// Stockage persistant des avatars PNJ générés — hors AsyncStorage
// (quota web ~5-10 Mo déjà dépassé une fois cette session par du contenu
// bien plus petit que des images). Un dossier dédié dans le répertoire
// documents de l'app, un fichier PNG par PNJ.
const DOSSIER_AVATARS = 'pnj-avatars';

function nomFichier(storyId: string, pnjId: string): string {
  const cle = `${storyId}_${pnjId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${cle}.png`;
}

/** Retire le préfixe data URL (`data:image/png;base64,`) : le natif
 * n'écrit que la partie base64 pure. */
function extraireBase64(dataUrl: string): string {
  const virgule = dataUrl.indexOf(',');
  return virgule === -1 ? dataUrl : dataUrl.slice(virgule + 1);
}

export async function obtenirAvatarPnj(storyId: string, pnjId: string): Promise<string | null> {
  const fichier = new File(Paths.document, DOSSIER_AVATARS, nomFichier(storyId, pnjId));
  if (!fichier.exists) return null;
  const base64 = await fichier.base64();
  return `data:image/png;base64,${base64}`;
}

export async function enregistrerAvatarPnj(storyId: string, pnjId: string, dataUrl: string): Promise<void> {
  const dossier = new Directory(Paths.document, DOSSIER_AVATARS);
  if (!dossier.exists) dossier.create({ intermediates: true });
  const fichier = new File(dossier, nomFichier(storyId, pnjId));
  fichier.create({ overwrite: true });
  fichier.write(extraireBase64(dataUrl), { encoding: 'base64' });
}

export async function supprimerAvatarsHistoire(storyId: string): Promise<void> {
  const dossier = new Directory(Paths.document, DOSSIER_AVATARS);
  if (!dossier.exists) return;
  const prefixe = `${storyId.replace(/[^a-zA-Z0-9_-]/g, '_')}_`;
  for (const entree of dossier.list()) {
    if (entree instanceof File && entree.name.startsWith(prefixe)) {
      entree.delete();
    }
  }
}
