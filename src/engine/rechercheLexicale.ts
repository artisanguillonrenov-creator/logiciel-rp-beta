import type { LoreEntry, Message } from '../types';
import { calculerScoreHybrideLore, infererScopeLore, MAX_LORE_CONTEXTUEL, preparerRequeteLore, SEUIL_LORE_HYBRIDE, type EntreeLoreScorable, type ScopeLore } from './loreScoring';
import { ensembleRacines, normaliserTexte, racineSimple, termesTexte } from './texteRecherche';

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

export const BUDGET_LORE: BudgetRecherche = { maxResultats: MAX_LORE_CONTEXTUEL, maxCaracteres: 3600, maxCaracteresParResultat: 520 };
export const BUDGET_HISTORIQUE: BudgetRecherche = { maxResultats: 3, maxCaracteres: 1500, maxCaracteresParResultat: 520 };

/** Anciennes API, conservées : une seule normalisation dans texteRecherche.ts. */
export const normaliserRecherche = normaliserTexte;
export const termesRecherche = termesTexte;

// Extrait centré sur la première occurrence d'un terme, plutôt que le début
// d'une fiche de lore qui parle peut-être d'autre chose.
function echapper(terme: string): string {
  return terme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extraire(texte: string, termes: string[], max: number): string {
  if (texte.length <= max) return texte.trim();
  // Position du premier mot cherché, aux frontières de mots, dans le texte
  // d'origine (retirer les accents ne change pas sa longueur). Pas de
  // lookbehind : tous les moteurs JS de l'app ne le gèrent pas.
  const simple = texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  let premier = -1;
  for (const terme of termes) {
    const m = new RegExp(`(^|[^a-z0-9])${echapper(terme)}(?![a-z0-9])`).exec(simple);
    if (m && (premier < 0 || m.index + m[1].length < premier)) premier = m.index + m[1].length;
  }
  const depart = Math.min(premier < 0 ? 0 : Math.max(0, premier - Math.floor(max * 0.35)), Math.max(0, texte.length - max));
  return `${depart > 0 ? '…' : ''}${texte.slice(depart, depart + max).trim()}${depart + max < texte.length ? '…' : ''}`;
}

interface AnalyseElement {
  titre: string;
  texte: string;
  comptes: Map<string, number>;
  corps: string;
  racinesTitre: Set<string>;
}

const analysesMemorisees = new WeakMap<object, AnalyseElement>();

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
  const racinesTermes = termes.map(racineSimple);
  // Expression complète de la requête, en racines, cherchée telle quelle (mots entiers).
  const expressionRacines = expression.length >= 6 ? ` ${expression.split(' ').map(racineSimple).join(' ')} ` : '';

  // Passe 1 : chaque élément est analysé une fois (mots entiers et racines
  // simples). Un élément inchangé d'un tour à l'autre (événement, fait…) garde
  // son analyse : elle ne se refait que si son texte ou son titre a changé.
  const analyses = items.map((item) => {
    const titre = titreDe?.(item) ?? '';
    const texte = texteDe(item);
    const memorise = typeof item === 'object' && item !== null ? analysesMemorisees.get(item as object) : undefined;
    if (memorise && memorise.texte === texte && memorise.titre === titre) return { item, ...memorise };
    const motsCorps = normaliserRecherche(`${titre} ${texte}`).split(' ').map(racineSimple);
    const comptes = new Map<string, number>();
    for (const mot of motsCorps) comptes.set(mot, (comptes.get(mot) ?? 0) + 1);
    const analyse = { titre, texte, comptes, corps: motsCorps.join(' '), racinesTitre: ensembleRacines(termesRecherche(titre)) };
    if (typeof item === 'object' && item !== null) analysesMemorisees.set(item as object, analyse);
    return { item, ...analyse };
  });
  // Poids de rareté (IDF) : un mot présent dans presque tous les éléments
  // (« marché », le nom du PNJ du moment) compte peu ; un mot rare de la
  // question du joueur (« clé », « argent ») fait la différence. Sans cela, dans
  // une longue histoire, les mots communs noyaient la question.
  const poids = racinesTermes.map((racine) => {
    const df = analyses.reduce((n, a) => n + (a.comptes.has(racine) ? 1 : 0), 0);
    return Math.log(1 + (analyses.length + 1) / (df + 1));
  });
  const poidsTotal = poids.reduce((n, w) => n + w, 0) || 1;

  const notes = analyses.map(({ item, texte, comptes, corps, racinesTitre }) => {
    let trouves = 0;
    let frequence = 0;
    let dansTitre = 0;
    racinesTermes.forEach((racine, i) => {
      const n = comptes.get(racine) ?? 0;
      if (n > 0) trouves += poids[i];
      frequence += Math.min(n, 4) * (poids[i] / poidsTotal) * racinesTermes.length;
      if (racinesTitre.has(racine)) dansTitre += 1;
    });
    if (!trouves) return { item, score: 0, extrait: '' };
    let fraicheur = 0;
    const date = dateDe?.(item);
    if (date && date > 0) {
      const jours = Math.max(0, (maintenant - date) / 86_400_000);
      fraicheur = Math.max(0, 0.7 - 0.25 * Math.log10(1 + jours));
    }
    const score = 5 * (trouves / poidsTotal)
      + 1.2 * Math.log2(1 + frequence)
      + 1.8 * dansTitre
      + (expressionRacines && ` ${corps} `.includes(expressionRacines) ? 2.5 : 0)
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

/** Fiches de lore classées avec le même score hybride que le mode embeddings. */
export function rechercherLoreLexical(entrees: LoreEntry[], requete: string): LoreEntry[] {
  const termes = preparerRequeteLore(requete).termes;
  const toujoursActives: LoreEntry[] = [];
  const candidats: { item: LoreEntry; score: number; extrait: string; priority: number }[] = [];

  for (const item of entrees) {
    const meta = item as LoreEntry & Partial<EntreeLoreScorable> & {
      motsClesPrimaires?: string[];
      motsClesSecondaires?: string[];
      motsClesNegatifs?: string[];
      priority?: number;
      constant?: boolean;
      category?: string;
      scope?: ScopeLore;
    };
    if (meta.constant || item.titre === '[MONDE] Géographie et Races') {
      toujoursActives.push({ id: item.id, titre: item.titre, contenu: item.contenu });
      continue;
    }
    const details = calculerScoreHybrideLore(
      {
        titre: item.titre,
        contenu: item.contenu,
        primaryKeys: meta.primaryKeys ?? meta.motsClesPrimaires,
        secondaryKeys: meta.secondaryKeys ?? meta.motsClesSecondaires,
        negativeKeys: meta.negativeKeys ?? meta.motsClesNegatifs,
        priority: meta.priority,
        category: meta.category,
        scope: meta.scope ?? infererScopeLore(meta.category),
        constant: meta.constant,
      },
      requete,
    );
    if (details.score < SEUIL_LORE_HYBRIDE) continue;
    candidats.push({
      item,
      score: details.score,
      extrait: extraire(item.contenu, termes, BUDGET_LORE.maxCaracteresParResultat),
      priority: Number.isFinite(meta.priority) ? Number(meta.priority) : 100,
    });
  }

  candidats.sort((a, b) => b.score - a.score || a.priority - b.priority);
  const retenus: LoreEntry[] = [];
  let total = 0;
  for (const note of candidats) {
    if (retenus.length >= BUDGET_LORE.maxResultats) break;
    if (retenus.length && total + note.extrait.length + 2 > BUDGET_LORE.maxCaracteres) break;
    const extrait = note.extrait.slice(0, Math.max(0, BUDGET_LORE.maxCaracteres - total));
    if (!extrait) break;
    retenus.push({ id: note.item.id, titre: note.item.titre, contenu: extrait, score: note.score });
    total += extrait.length + 2;
  }

  return [...toujoursActives, ...retenus];
}

/** Messages anciens (hors fenêtre récente) qui partagent le plus de termes avec la scène. */
export function rechercherSouvenirsLexical(messagesAnciens: Message[], requete: string, maxSouvenirs = BUDGET_HISTORIQUE.maxResultats): { message: Message; score: number }[] {
  return classerLexical({
    requete,
    items: messagesAnciens,
    texteDe: (m) => m.content,
    dateDe: (m) => m.timestamp,
    budget: { ...BUDGET_HISTORIQUE, maxResultats: maxSouvenirs },
  }).map((r) => ({ message: r.item, score: r.score }));
}
