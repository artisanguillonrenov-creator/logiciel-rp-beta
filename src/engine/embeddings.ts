import type { AppSettings } from '../types';

/**
 * Narrative OS V1 — embeddings locaux déterministes.
 *
 * Objectif : garder la sélection sémantique existante (lore, mémoire,
 * métamoteurs) sans aucun appel réseau ni consommation de crédits/tokens.
 * On utilise un hashing vectoriel lexical compact : mots + trigrammes.
 */

export class ErreurEmbeddings extends Error {
  constructor(message: string, readonly statut?: number) { super(message); }
}

const DIMENSION = 512;
const IDENTITE_LOCALE = `local:hashing-v1:${DIMENSION}`;

export type FournisseurEmbeddings = 'local' | 'openrouter' | 'infermatic' | 'openai';

export interface ResultatEmbeddings {
  vecteurs: number[][];
  fournisseur: FournisseurEmbeddings;
  identiteCache: string;
}

const STOPWORDS = new Set([
  'a','au','aux','avec','ce','ces','dans','de','des','du','elle','en','et','eux','il','ils','je','la','le','les','leur','lui','ma','mais','me','mes','moi','mon','ne','nos','notre','nous','on','ou','par','pas','pour','qu','que','qui','sa','se','ses','son','sur','ta','te','tes','toi','ton','tu','un','une','vos','votre','vous','y',
  'the','a','an','and','or','of','to','in','on','for','with','is','are','was','were','be','been','it','this','that','these','those','i','you','he','she','we','they',
]);

function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9'-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashFNV1a(texte: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function ajouterFeature(vecteur: number[], feature: string, poids: number): void {
  const h = hashFNV1a(feature);
  const index = h % DIMENSION;
  // Signed hashing réduit les collisions systématiquement positives.
  const signe = (h & 0x80000000) === 0 ? 1 : -1;
  vecteur[index] += signe * poids;
}

function tokens(texte: string): string[] {
  return normaliser(texte)
    .split(' ')
    .map((mot) => mot.replace(/^[-']+|[-']+$/g, ''))
    .filter((mot) => mot.length >= 2 && !STOPWORDS.has(mot));
}

function vectoriser(texte: string): number[] {
  const vecteur = new Array<number>(DIMENSION).fill(0);
  const mots = tokens(texte);

  for (const mot of mots) {
    ajouterFeature(vecteur, `w:${mot}`, 1.6);

    // Trigrammes : meilleure robustesse aux variantes, accords et noms propres.
    const encadre = `^${mot}$`;
    if (encadre.length >= 3) {
      for (let i = 0; i <= encadre.length - 3; i++) {
        ajouterFeature(vecteur, `g:${encadre.slice(i, i + 3)}`, 0.34);
      }
    }
  }

  // Bigrams de mots : favorise le contexte local sans LLM.
  for (let i = 0; i + 1 < mots.length; i++) {
    ajouterFeature(vecteur, `b:${mots[i]}_${mots[i + 1]}`, 0.7);
  }

  let norme = 0;
  for (const valeur of vecteur) norme += valeur * valeur;
  if (norme > 0) {
    const racine = Math.sqrt(norme);
    for (let i = 0; i < vecteur.length; i++) vecteur[i] /= racine;
  }
  return vecteur;
}

/**
 * API compatible avec l'ancien moteur, mais 100 % locale.
 * Aucun fournisseur distant n'est appelé, même si une clé est configurée.
 */
export async function obtenirEmbeddings(
  textes: string[],
  _appSettings: AppSettings,
): Promise<ResultatEmbeddings> {
  return {
    vecteurs: textes.map(vectoriser),
    fournisseur: 'local',
    identiteCache: IDENTITE_LOCALE,
  };
}

/** La recherche est toujours disponible car elle ne dépend plus d'une clé. */
export function embeddingsDisponibles(_appSettings: AppSettings): boolean {
  return true;
}

export function identiteEmbeddingsConfiguree(_appSettings: AppSettings): string | null {
  return IDENTITE_LOCALE;
}

export function identitesEmbeddingsCompatibles(_appSettings: AppSettings): string[] {
  return [IDENTITE_LOCALE];
}

export function cacheEmbeddingsCompatible(identiteCache: string | null, _appSettings: AppSettings): boolean {
  return identiteCache === null || identiteCache === IDENTITE_LOCALE;
}

export function similariteCosinus(a: number[], b: number[]): number {
  const longueur = Math.min(a.length, b.length);
  let produit = 0;
  let normeA = 0;
  let normeB = 0;
  for (let i = 0; i < longueur; i++) {
    produit += a[i] * b[i];
    normeA += a[i] * a[i];
    normeB += b[i] * b[i];
  }
  if (normeA === 0 || normeB === 0) return 0;
  return produit / (Math.sqrt(normeA) * Math.sqrt(normeB));
}
