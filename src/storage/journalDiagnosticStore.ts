import { Directory, File, Paths } from 'expo-file-system';
import type { EntreeJournal } from '../engine/journalDiagnostic';

// Journal de diagnostic d'une histoire : un fichier JSON Lines par histoire
// dans les documents de l'app, hors RKStorage / AsyncStorage.
// Aucun effacement automatique lié à une taille limite.

const DOSSIER = 'diagnostics';
const DELAI_ECRITURE_MS = 2000;

interface Tampon {
  lignes: string[];
  charge: boolean;
}

const tampons = new Map<string, Tampon>();
const minuteurs = new Map<string, ReturnType<typeof setTimeout>>();

function nomFichier(storyId: string): string {
  return `${storyId.replace(/[^a-zA-Z0-9_-]/g, '_')}.jsonl`;
}

function fichier(storyId: string): File {
  return new File(Paths.document, DOSSIER, nomFichier(storyId));
}

async function tampon(storyId: string): Promise<Tampon> {
  let t = tampons.get(storyId);
  if (!t) {
    t = { lignes: [], charge: false };
    tampons.set(storyId, t);
  }
  if (!t.charge) {
    t.charge = true;
    const f = fichier(storyId);
    if (f.exists) {
      const existantes = (await f.text()).split('\n').filter(Boolean);
      t.lignes = [...existantes, ...t.lignes];
    }
  }
  return t;
}

async function ecrire(storyId: string): Promise<void> {
  minuteurs.delete(storyId);
  const t = await tampon(storyId);
  const dossier = new Directory(Paths.document, DOSSIER);
  if (!dossier.exists) dossier.create({ intermediates: true });
  const f = fichier(storyId);
  f.create({ overwrite: true });
  f.write(t.lignes.join('\n') + '\n');
}

/** Puits branché sur journalDiagnostic : ajoute l'entrée et planifie l'écriture. */
export function ajouterAuJournal(storyId: string, entree: EntreeJournal): void {
  let t = tampons.get(storyId);
  if (!t) {
    t = { lignes: [], taille: 0, charge: false };
    tampons.set(storyId, t);
  }
  const ligne = JSON.stringify(entree);
  t.lignes.push(ligne);
  if (!minuteurs.has(storyId)) {
    minuteurs.set(storyId, setTimeout(() => { void ecrire(storyId).catch(() => {}); }, DELAI_ECRITURE_MS));
  }
}

export async function lireJournal(storyId: string): Promise<EntreeJournal[]> {
  try {
    const t = await tampon(storyId);
    return t.lignes.flatMap((l) => {
      try {
        return [JSON.parse(l) as EntreeJournal];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

/**
 * Supprime les journaux des histoires qui n'existent plus (app fermée entre la
 * suppression de l'histoire et son nettoyage, par exemple).
 */
export async function supprimerJournauxOrphelins(storyIdsValides: readonly string[]): Promise<number> {
  const dossier = new Directory(Paths.document, DOSSIER);
  if (!dossier.exists) return 0;
  const valides = new Set(storyIdsValides.map(nomFichier));
  let supprimes = 0;
  for (const entree of dossier.list()) {
    if (!(entree instanceof File) || valides.has(entree.name)) continue;
    const storyId = [...tampons.keys()].find((id) => nomFichier(id) === entree.name);
    if (storyId) await supprimerJournal(storyId);
    else entree.delete();
    supprimes++;
  }
  return supprimes;
}

export async function supprimerJournal(storyId: string): Promise<void> {
  const minuteur = minuteurs.get(storyId);
  if (minuteur) clearTimeout(minuteur);
  minuteurs.delete(storyId);
  tampons.delete(storyId);
  const f = fichier(storyId);
  if (f.exists) f.delete();
}
