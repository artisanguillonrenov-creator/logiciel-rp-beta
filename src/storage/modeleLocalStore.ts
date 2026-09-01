import { File, Paths } from 'expo-file-system';

// Stockage du modèle local (Gemma, .litertlm ou .task — voir
// src/engine/localInference.ts) : l'utilisateur l'a déjà téléchargé
// lui-même (Hugging Face, etc.) et l'importe depuis le sélecteur de
// fichiers système plutôt que de faire deviner une URL de téléchargement
// direct à l'application (souvent protégée par une connexion Hugging
// Face). Le fichier importé est copié dans le répertoire document de
// l'app (persistant, non purgé par l'OS sous pression de stockage,
// contrairement au cache) sous un nom fixe.
const EXTENSIONS_SUPPORTEES = ['.litertlm', '.task'] as const;
const NOM_BASE = 'modele-local';

function candidatsFichierModele(): File[] {
  return EXTENSIONS_SUPPORTEES.map((ext) => new File(Paths.document, `${NOM_BASE}${ext}`));
}

function fichierModeleExistant(): File | null {
  return candidatsFichierModele().find((f) => f.exists) ?? null;
}

export function modeleLocalTelecharge(): boolean {
  return fichierModeleExistant() !== null;
}

export function cheminModeleLocal(): string | null {
  return fichierModeleExistant()?.uri ?? null;
}

export function tailleModeleLocalOctets(): number | null {
  return fichierModeleExistant()?.size ?? null;
}

export function supprimerModeleLocal(): void {
  fichierModeleExistant()?.delete();
}

export function espaceDisponibleOctets(): number {
  return Paths.availableDiskSpace;
}

export class ErreurImportModele extends Error {}

/**
 * Ouvre le sélecteur de fichiers système pour importer un modèle déjà
 * téléchargé par l'utilisateur. Remplace tout modèle local précédent.
 */
export async function importerModeleLocal(): Promise<void> {
  const resultat = await File.pickFileAsync({ mimeTypes: '*/*' });
  if (resultat.canceled) return;

  const source = resultat.result;
  const extension = EXTENSIONS_SUPPORTEES.find((ext) => source.name.toLowerCase().endsWith(ext));
  if (!extension) {
    throw new ErreurImportModele(
      `Fichier non reconnu (${source.name}) : le modèle doit être un fichier .litertlm ou .task.`,
    );
  }

  fichierModeleExistant()?.delete();
  const destination = new File(Paths.document, `${NOM_BASE}${extension}`);
  await source.copy(destination);
}
