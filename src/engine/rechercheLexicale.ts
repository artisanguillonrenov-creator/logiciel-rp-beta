import type { LoreEntry, Message } from '../types';

// Recherche lexicale locale (reprise de la V13) : repli quand aucun
// fournisseur d'embeddings n'est disponible — typiquement un narrateur sur
// serveur local sans clé OpenRouter. Sans elle, le tour partait sans aucun
// lore ni souvenir ; ici on classe par mots communs, sans appel réseau.

export interface BudgetRecherche {
  maxResultats: number;
  maxCaracteres: number;
  maxCaracteresParResultat: number;
}

export interface ResultatLexical<T> {
  item: T;
  score: number;
  extrait: string;
}

export const BUDGET_LORE: BudgetRecherche = { maxResultats: 4, maxCaracteres: 1800, maxCaracteresParResultat: 520 };
export const BUDGET_HISTORIQUE: BudgetRecherche = { maxResultats: 3, maxCaracteres: 1500, maxCaracteresParResultat: 520 };

const MOTS_VIDES = new Set([
  'a', 'ai', 'au', 'aux', 'avec', 'ce', 'ces', 'dans', 'de', 'des', 'du', 'elle', 'en', 'et', 'eux', 'il', 'ils', 'je', 'la',
  'le', 'les', 'leur', 'lui', 'ma', 'mais', 'me', 'mes', 'moi', 'mon', 'ne', 'nos', 'notre', 'nous', 'on', 'ou', 'par', 'pas',
  'pour', 'qu', 'que', 'qui', 'sa', 'se', 'ses', 'son', 'sur', 'ta', 'te', 'tes', 'toi', 'ton', 'tu', 'un', 'une', 'vos', 'votre',
  'vous', 'y', 'the', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'is', 'are', 'was', 'were', 'be', 'been', 'it',
  'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they',
]);

export function normaliserRecherche(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9'-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function termesRecherche(texte: string): string[] {
  const vus = new Set<string>();
  const termes: string[] = [];
  for (const brut of normaliserRecherche(texte).split(' ')) {
    const terme = brut.replace(/^[-']+|[-']+$/g, '');
    if (terme.length < 2 || MOTS_VIDES.has(terme) || vus.has(terme)) continue;
    vus.add(terme);
    termes.push(terme);
  }
  return termes;
}

function occurrences(texte: string, terme: string): number {
  let n = 0;
  for (let i = texte.indexOf(terme); i >= 0; i = texte.indexOf(terme, i + terme.length)) n += 1;
  return n;
}

// Extrait centré sur la première occurrence d'un terme, plutôt que le début
// d'une fiche de lore qui parle peut-être d'autre chose.
function extraire(texte: string, termes: string[], max: number): string {
  if (texte.length <= max) return texte.trim();
  const normalise = normaliserRecherche(texte);
  let premier = -1;
  for (const terme of termes) {
    const i = normalise.indexOf(terme);
    if (i >= 0 && (premier < 0 || i < premier)) premier = i;
  }
  const depart = Math.min(premier < 0 ? 0 : Math.max(0, premier - Math.floor(max * 0.35)), Math.max(0, texte.length - max));
  return `${depart > 0 ? '…' : ''}${texte.slice(depart, depart + max).trim()}${depart + max < texte.length ? '…' : ''}`;
}

export interface OptionsClassement<T> {
  requete: string;
  items: T[];
  texteDe: (item: T) => string;
  titreDe?: (item: T) => string;
  dateDe?: (item: T) => number | undefined;
  budget: BudgetRecherche;
  maintenant?: number;
}

/**
 * Score = part des termes de la requête présents (×5) + fréquence amortie
 * + bonus titre + bonus expression exacte + léger bonus de fraîcheur. Les
 * résultats sont ensuite plafonnés en nombre et en caractères.
 */
export function classerLexical<T>(options: OptionsClassement<T>): ResultatLexical<T>[] {
  const { items, texteDe, titreDe, dateDe, budget } = options;
  const termes = termesRecherche(options.requete);
  if (!termes.length || !items.length || budget.maxResultats <= 0 || budget.maxCaracteres <= 0) return [];
  const expression = normaliserRecherche(options.requete);
  const maintenant = options.maintenant ?? Date.now();

  const notes = items.map((item) => {
    const titre = titreDe?.(item) ?? '';
    const texte = texteDe(item);
    const titreNormalise = normaliserRecherche(titre);
    const corps = normaliserRecherche(`${titre} ${texte}`);
    let trouves = 0;
    let frequence = 0;
    let dansTitre = 0;
    for (const terme of termes) {
      const n = occurrences(corps, terme);
      if (n > 0) trouves += 1;
      frequence += Math.min(n, 4);
      if (titreNormalise.includes(terme)) dansTitre += 1;
    }
    if (!trouves) return { item, score: 0, extrait: '' };
    let fraicheur = 0;
    const date = dateDe?.(item);
    if (date && date > 0) {
      const jours = Math.max(0, (maintenant - date) / 86_400_000);
      fraicheur = Math.max(0, 0.7 - 0.25 * Math.log10(1 + jours));
    }
    const score = 5 * (trouves / termes.length)
      + 1.2 * Math.log2(1 + frequence)
      + 1.8 * dansTitre
      + (expression.length >= 6 && corps.includes(expression) ? 2.5 : 0)
      + fraicheur;
    return { item, score, extrait: extraire(texte, termes, budget.maxCaracteresParResultat) };
  });

  const retenus: ResultatLexical<T>[] = [];
  let total = 0;
  for (const note of notes.sort((a, b) => b.score - a.score)) {
    if (note.score <= 0 || retenus.length >= budget.maxResultats) break;
    if (retenus.length && total + note.extrait.length + 2 > budget.maxCaracteres) break;
    const extrait = note.extrait.slice(0, Math.max(0, budget.maxCaracteres - total));
    if (!extrait) break;
    retenus.push({ ...note, extrait });
    total += extrait.length + 2;
  }
  return retenus;
}

/** Fiches de lore les plus proches, réduites à leur extrait pertinent. */
export function rechercherLoreLexical(entrees: LoreEntry[], requete: string): LoreEntry[] {
  return classerLexical({
    requete,
    items: entrees,
    titreDe: (e) => e.titre,
    texteDe: (e) => e.contenu,
    budget: BUDGET_LORE,
  }).map((r) => ({ id: r.item.id, titre: r.item.titre, contenu: r.extrait, score: r.score }));
}

/** Messages anciens (hors fenêtre récente) qui partagent le plus de termes avec la scène. */
export function rechercherSouvenirsLexical(messagesAnciens: Message[], requete: string): { message: Message; score: number }[] {
  return classerLexical({
    requete,
    items: messagesAnciens,
    texteDe: (m) => m.content,
    dateDe: (m) => m.timestamp,
    budget: BUDGET_HISTORIQUE,
  }).map((r) => ({ message: r.item, score: r.score }));
}
