import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import { ecrireVisuelWeb, lireVisuelWeb, supprimerVisuelsWebOrphelins, supprimerVisuelsWebParPrefixe } from './visualBinaryStore';

const DOSSIER_SCENES = 'scene-images';
const PREFIXE_WEB = 'scene:';
function nettoyerSegment(value: string): string { return value.replace(/[^a-zA-Z0-9_-]/g, '_'); }
function prefixeHistoire(storyId: string): string { return `${nettoyerSegment(storyId)}_`; }
function nomFichier(storyId: string, revision: string): string { return `${prefixeHistoire(storyId)}${nettoyerSegment(revision)}.png`; }
function cleWeb(storyId: string, revision: string): string { return `${PREFIXE_WEB}${prefixeHistoire(storyId)}${nettoyerSegment(revision)}`; }
function prefixeWebHistoire(storyId: string): string { return `${PREFIXE_WEB}${prefixeHistoire(storyId)}`; }
function extraireBase64(dataUrl: string): string { const virgule = dataUrl.indexOf(','); return virgule === -1 ? dataUrl : dataUrl.slice(virgule + 1); }

export async function obtenirIllustrationScene(storyId: string, revision: string): Promise<string | null> {
  if (Platform.OS === 'web') return lireVisuelWeb(cleWeb(storyId, revision));
  const fichier = new File(Paths.document, DOSSIER_SCENES, nomFichier(storyId, revision));
  return fichier.exists ? fichier.uri : null;
}

export async function enregistrerIllustrationScene(storyId: string, revision: string, dataUrl: string): Promise<string> {
  if (Platform.OS === 'web') {
    const cible = cleWeb(storyId, revision);
    await supprimerVisuelsWebParPrefixe(prefixeWebHistoire(storyId), cible);
    return ecrireVisuelWeb(cible, dataUrl);
  }
  const dossier = new Directory(Paths.document, DOSSIER_SCENES);
  if (!dossier.exists) dossier.create({ intermediates: true });
  const prefixe = prefixeHistoire(storyId);
  const cible = nomFichier(storyId, revision);
  for (const entree of dossier.list()) if (entree instanceof File && entree.name.startsWith(prefixe) && entree.name !== cible) entree.delete();
  const fichier = new File(dossier, cible);
  fichier.create({ overwrite: true });
  fichier.write(extraireBase64(dataUrl), { encoding: 'base64' });
  return fichier.uri;
}

export async function supprimerIllustrationsHistoire(storyId: string): Promise<void> {
  if (Platform.OS === 'web') { await supprimerVisuelsWebParPrefixe(prefixeWebHistoire(storyId)); return; }
  const dossier = new Directory(Paths.document, DOSSIER_SCENES);
  if (!dossier.exists) return;
  const prefixe = prefixeHistoire(storyId);
  for (const entree of dossier.list()) if (entree instanceof File && entree.name.startsWith(prefixe)) entree.delete();
}

export async function supprimerIllustrationsOrphelines(storyIdsValides: readonly string[]): Promise<number> {
  if (Platform.OS === 'web') return supprimerVisuelsWebOrphelins(PREFIXE_WEB, storyIdsValides.map(prefixeWebHistoire));
  const dossier = new Directory(Paths.document, DOSSIER_SCENES);
  if (!dossier.exists) return 0;
  const prefixesValides = storyIdsValides.map(prefixeHistoire);
  let supprimees = 0;
  for (const entree of dossier.list()) {
    if (!(entree instanceof File) || prefixesValides.some((prefixe) => entree.name.startsWith(prefixe))) continue;
    entree.delete(); supprimees++;
  }
  return supprimees;
}
