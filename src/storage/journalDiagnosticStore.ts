import { Directory, File, Paths } from 'expo-file-system';
import type { EntreeJournal } from '../engine/journalDiagnostic';

// Journal de diagnostic d'une histoire : un fichier JSON Lines par histoire
// dans le dossier documents de l'app, hors AsyncStorage (plafond de 6 Mo).
// Écritures groupées (toutes les 2 s au plus) et plafond par histoire : au-delà,
// les entrées les plus anciennes sont abandonnées.

const DOSSIER = 'diagnostics';
const TAILLE_MAX = 8_000_000;
const DELAI_ECRITURE_MS = 2000;

interface Tampon {
  lignes: string[];
  taille: number;
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
    t = { lignes: [], taille: 0, charge: false };
    tampons.set(storyId, t);
  }
  if (!t.charge) {
    t.charge = true;
    const f = fichier(storyId);
    if (f.exists) {
      const existantes = (await f.text()).split('\n').filter(Boolean);
      t.lignes = [...existantes, ...t.lignes];
      t.taille = t.lignes.reduce((s, l) => s + l.length + 1, 0);
    }
  }
  return t;
}

function elaguer(t: Tampon): void {
  while (t.taille > TAILLE_MAX && t.lignes.length > 1) {
    t.taille -= (t.lignes.shift()?.length ?? 0) + 1;
  }
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
  t.taille += ligne.length + 1;
  elaguer(t);
  if (!minuteurs.has(storyId)) {
    minuteurs.set(storyId, setTimeout(() => { void ecrire(storyId).catch(() => {}); }, DELAI_ECRITURE_MS));
  }
}

export async function lireJournal(storyId: string): Promise<EntreeJournal[]> {
  try {
    const t = await tampon(storyId);
    elaguer(t);
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

export async function supprimerJournal(storyId: string): Promise<void> {
  const minuteur = minuteurs.get(storyId);
  if (minuteur) clearTimeout(minuteur);
  minuteurs.delete(storyId);
  tampons.delete(storyId);
  const f = fichier(storyId);
  if (f.exists) f.delete();
}
