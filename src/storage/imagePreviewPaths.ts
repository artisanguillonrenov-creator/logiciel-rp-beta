/** Correspondance avec les dossiers `Paths.document` des images créées par Elyndor. */
export interface ImageGeree {
  dossier: 'scene-images' | 'pnj-avatars';
  nom: string;
}
export type RattachementImage = 'histoire_presente' | 'histoire_introuvable';

/**
 * Refuse toutes les racines et extensions non gérées, les segments parents
 * et les chemins imbriqués. L'URI réelle est résolue par expo-file-system,
 * jamais construite à partir d'une URL arbitraire.
 */
export function analyserCheminImageGeree(path: string): ImageGeree | null {
  const resultat = /^interne\/files\/(scene-images|pnj-avatars)\/([A-Za-z0-9_.-]{1,240}\.png)$/i.exec(path);
  if (!resultat || resultat[2] === '..' || resultat[2] === '.') return null;
  return { dossier: resultat[1] as ImageGeree['dossier'], nom: resultat[2] };
}

function prefixeHistoire(storyId: string): string {
  return storyId.replace(/[^a-zA-Z0-9_-]/g, '_') + '_';
}

/**
 * Seulement une correspondance de préfixe de fichier, pas une preuve que
 * l'image reste employée dans une scène ni que le cloud est synchronisé.
 */
export function rattachementImageLocal(
  nomFichier: string, idsHistoiresLocales: readonly string[],
): RattachementImage {
  return idsHistoiresLocales.some((id) => nomFichier.startsWith(prefixeHistoire(id)))
    ? 'histoire_presente' : 'histoire_introuvable';
}
