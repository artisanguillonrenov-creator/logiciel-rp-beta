import { Directory, File, Paths } from 'expo-file-system';

const DOSSIER_AVATARS = 'pnj-avatars';

function nettoyerSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function prefixeHistoire(storyId: string): string {
  return `${nettoyerSegment(storyId)}_`;
}

function nomFichier(storyId: string, pnjId: string): string {
  return `${nettoyerSegment(`${storyId}_${pnjId}`)}.png`;
}

function extraireBase64(dataUrl: string): string {
  const virgule = dataUrl.indexOf(',');
  return virgule === -1 ? dataUrl : dataUrl.slice(virgule + 1);
}

export async function obtenirAvatarPnj(storyId: string, pnjId: string): Promise<string | null> {
  const fichier = new File(Paths.document, DOSSIER_AVATARS, nomFichier(storyId, pnjId));
  if (!fichier.exists) return null;
  return fichier.uri;
}

export async function enregistrerAvatarPnj(storyId: string, pnjId: string, dataUrl: string): Promise<string> {
  const dossier = new Directory(Paths.document, DOSSIER_AVATARS);
  if (!dossier.exists) dossier.create({ intermediates: true });
  const fichier = new File(dossier, nomFichier(storyId, pnjId));
  fichier.create({ overwrite: true });
  fichier.write(extraireBase64(dataUrl), { encoding: 'base64' });
  return fichier.uri;
}

export async function preparerImageReference(uri: string): Promise<string> {
  if (!uri.startsWith('file:')) return uri;
  const fichier = new File(uri);
  return `data:image/png;base64,${await fichier.base64()}`;
}

export async function supprimerAvatarPnj(storyId: string, pnjId: string): Promise<void> {
  const fichier = new File(Paths.document, DOSSIER_AVATARS, nomFichier(storyId, pnjId));
  if (fichier.exists) fichier.delete();
}

export async function supprimerAvatarsHistoire(storyId: string): Promise<void> {
  const dossier = new Directory(Paths.document, DOSSIER_AVATARS);
  if (!dossier.exists) return;
  const prefixe = prefixeHistoire(storyId);
  for (const entree of dossier.list()) {
    if (entree instanceof File && entree.name.startsWith(prefixe)) entree.delete();
  }
}

export async function supprimerAvatarsOrphelins(storyIdsValides: readonly string[]): Promise<number> {
  const dossier = new Directory(Paths.document, DOSSIER_AVATARS);
  if (!dossier.exists) return 0;
  const prefixesValides = storyIdsValides.map(prefixeHistoire);
  let supprimes = 0;
  for (const entree of dossier.list()) {
    if (!(entree instanceof File)) continue;
    if (prefixesValides.some((prefixe) => entree.name.startsWith(prefixe))) continue;
    entree.delete();
    supprimes++;
  }
  return supprimes;
}
