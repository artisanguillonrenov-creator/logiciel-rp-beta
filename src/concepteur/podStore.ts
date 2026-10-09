/* Identifiant de pod personnalisé, spécifique à cet appareil. Aucune clé privée. */
export const CLE_POD_CONCEPTEUR = '@elyndor/concepteur/pod-override-v1';
const ID_POD = /^[a-z0-9]{8,32}$/;

export function validerIdentifiantPod(valeur: unknown): string {
  if (typeof valeur !== 'string') throw new Error('Identifiant RunPod invalide.');
  const id = valeur.trim().toLowerCase();
  if (!ID_POD.test(id)) {
    throw new Error("L'identifiant RunPod doit contenir 8 à 32 lettres minuscules ou chiffres, sans adresse URL.");
  }
  return id;
}

// Chargement différé pour que le validateur et les tests purs Node
// n'aient pas besoin d'un module AsyncStorage Android chargé au niveau racine.
async function stockage() {
  const module = await import('@react-native-async-storage/async-storage');
  return module.default;
}

export async function lirePodConcepteur(): Promise<string | null> {
  const db = await stockage();
  const texte = await db.getItem(CLE_POD_CONCEPTEUR);
  if (!texte) return null;
  try { return validerIdentifiantPod(texte); }
  catch { throw new Error('Identifiant de pod enregistré invalide. Aucun changement appliqué.'); }
}

export async function enregistrerPodConcepteur(id: string): Promise<string> {
  const valide = validerIdentifiantPod(id);
  const db = await stockage();
  await db.setItem(CLE_POD_CONCEPTEUR, valide);
  return valide;
}

export async function effacerPodConcepteur(): Promise<void> {
  const db = await stockage();
  await db.removeItem(CLE_POD_CONCEPTEUR);
}
