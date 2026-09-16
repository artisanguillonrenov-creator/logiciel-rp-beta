import { Directory, File, Paths } from 'expo-file-system';

const DOSSIER_SCENES = 'scene-images';

function nettoyerSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function prefixeHistoire(storyId: string): string {
  return `${nettoyerSegment(storyId)}_`;
}

function nomFichier(storyId: string, revision: string): string {
  return `${prefixeHistoire(storyId)}${nettoyerSegment(revision)}.png`;
}

function extraireBase64(dataUrl: string): string {
  const virgule = dataUrl.indexOf(',');
  return virgule === -1 ? dataUrl : dataUrl.slice(virgule + 1);
}

export async function obtenirIllustrationScene(storyId: string, revision: string): Promise<string | null> {
  const fichier = new File(Paths.document, DOSSIER_SCENES, nomFichier(storyId, revision));
  return fichier.exists ? fichier.uri : null;
}

/**
 * Conserve seulement l'illustration de la révision courante de l'histoire.
 * Les images restent hors du JSON de sauvegarde et ne gonflent donc ni
 * SQLite/IndexedDB ni le contexte narratif.
 */
export async function enregistrerIllustrationScene(
  storyId: string,
  revision: string,
  dataUrl: string,
): Promise<string> {
  const dossier = new Directory(Paths.document, DOSSIER_SCENES);
  if (!dossier.exists) dossier.create({ intermediates: true });

  const prefixe = prefixeHistoire(storyId);
  const cible = nomFichier(storyId, revision);
  for (const entree of dossier.list()) {
    if (entree instanceof File && entree.name.startsWith(prefixe) && entree.name !== cible) {
      entree.delete();
    }
  }

  const fichier = new File(dossier, cible);
  fichier.create({ overwrite: true });
  fichier.write(extraireBase64(dataUrl), { encoding: 'base64' });
  return fichier.uri;
}

export async function supprimerIllustrationsHistoire(storyId: string): Promise<void> {
  const dossier = new Directory(Paths.document, DOSSIER_SCENES);
  if (!dossier.exists) return;
  const prefixe = prefixeHistoire(storyId);
  for (const entree of dossier.list()) {
    if (entree instanceof File && entree.name.startsWith(prefixe)) entree.delete();
  }
}
