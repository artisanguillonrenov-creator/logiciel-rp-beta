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
 * Enregistre l'illustration d'une révision et applique l'historique glissant :
 * seules `cible` et les révisions de `revisionsAConserver` (les 2 dernières
 * scènes illustrées, voir ajouterSceneIllustree) restent sur l'appareil ;
 * la plus ancienne est supprimée automatiquement.
 */
export async function enregistrerIllustrationScene(
  storyId: string,
  revision: string,
  dataUrl: string,
  revisionsAConserver: readonly string[] = [],
): Promise<string> {
  const dossier = new Directory(Paths.document, DOSSIER_SCENES);
  if (!dossier.exists) dossier.create({ intermediates: true });

  const prefixe = prefixeHistoire(storyId);
  const cible = nomFichier(storyId, revision);
  const conserves = new Set([cible, ...revisionsAConserver.map((r) => nomFichier(storyId, r))]);
  for (const entree of dossier.list()) {
    if (entree instanceof File && entree.name.startsWith(prefixe) && !conserves.has(entree.name)) entree.delete();
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

export async function supprimerIllustrationsOrphelines(storyIdsValides: readonly string[]): Promise<number> {
  const dossier = new Directory(Paths.document, DOSSIER_SCENES);
  if (!dossier.exists) return 0;
  const prefixesValides = storyIdsValides.map(prefixeHistoire);
  let supprimees = 0;
  for (const entree of dossier.list()) {
    if (!(entree instanceof File)) continue;
    if (prefixesValides.some((prefixe) => entree.name.startsWith(prefixe))) continue;
    entree.delete();
    supprimees++;
  }
  return supprimees;
}
