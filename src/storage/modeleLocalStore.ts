import { File, Paths } from 'expo-file-system';

// Stockage du modèle local Android.
// - .gguf : chargé directement avec llama.rn / llama.cpp
// - .litertlm / .task : anciens modèles LiteRT conservés pour compatibilité
// Le fichier choisi par l'utilisateur est copié dans le répertoire document
// persistant de l'application sous un nom fixe afin qu'Elyndor puisse le
// retrouver au prochain lancement sans redemander le fichier.
const EXTENSIONS_SUPPORTEES = ['.gguf', '.litertlm', '.task'] as const;
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
  const fichier = fichierModeleExistant();
  if (!fichier) return null;

  // llama.rn accepte directement les URI file:// pour les GGUF. LiteRT-LM
  // attend au contraire un chemin brut sans le préfixe file://.
  if (fichier.uri.toLowerCase().endsWith('.gguf')) {
    return fichier.uri;
  }
  return fichier.uri.replace(/^file:\/\//, '');
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

/**
 * Ouvre le sélecteur de fichiers système pour importer un modèle déjà
 * téléchargé. Remplace tout modèle local précédent.
 *
 * Le format privilégié est désormais GGUF : c'est celui utilisé par
 * llama.cpp/llama.rn et il permet de prendre directement un fichier comme
 * Gemma-3-it-4B-Uncensored-D_AU-Q4_k_m.gguf depuis Téléchargements.
 */
export async function importerModeleLocal(): Promise<void> {
  const resultat = await File.pickFileAsync({ mimeTypes: '*/*' });
  if (resultat.canceled) return;

  const source = resultat.result;
  const nom = source.name.toLowerCase();
  const extensionDetectee = EXTENSIONS_SUPPORTEES.find((ext) => nom.endsWith(ext));

  // Certains fournisseurs Android renvoient un identifiant opaque en guise
  // de nom (ex. "msf:6722"). Pour les nouveaux imports on privilégie GGUF,
  // qui est maintenant le format local principal d'Elyndor.
  const extension = extensionDetectee ?? '.gguf';

  const tailleSource = source.size ?? 0;
  if (tailleSource > 0) {
    // Garde une marge pour le fichier temporaire et les écritures Android.
    const minimum = Math.ceil(tailleSource * 1.15);
    if (Paths.availableDiskSpace < minimum) {
      throw new Error("Espace insuffisant pour importer ce modèle. Libère de la place puis réessaie.");
    }
  }

  fichierModeleExistant()?.delete();
  const destination = new File(Paths.document, `${NOM_BASE}${extension}`);
  await source.copy(destination);
}
