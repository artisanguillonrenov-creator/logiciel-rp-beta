// Briques de texte communes à toute la chaîne de récupération (lore, passages,
// mémoire, événements). Avant ce module, la normalisation existait en trois
// exemplaires légèrement différents (rechercheLexicale, loreScoring,
// loreLoader) et plusieurs recherches utilisaient `includes()` : « garde »
// était trouvé dans « regarder », « Paris » dans « Parisien ».

/** Mots vides français et anglais (union des anciennes listes). */
export const MOTS_VIDES = new Set([
  'a', 'ai', 'an', 'and', 'are', 'au', 'aux', 'avec', 'be', 'been', 'ce', 'ces', 'dans', 'de', 'des', 'du', 'elle', 'en', 'et', 'eux',
  'for', 'he', 'i', 'il', 'ils', 'in', 'is', 'it', 'je', 'la', 'le', 'les', 'leur', 'lui', 'ma', 'mais', 'me', 'mes', 'moi', 'mon',
  'ne', 'nos', 'notre', 'nous', 'of', 'on', 'or', 'ou', 'par', 'pas', 'pour', 'qu', 'que', 'qui', 'sa', 'se', 'she', 'ses', 'son',
  'sur', 'ta', 'te', 'tes', 'that', 'the', 'they', 'this', 'those', 'these', 'to', 'toi', 'ton', 'tu', 'un', 'une', 'vos', 'votre',
  'vous', 'was', 'we', 'were', 'with', 'y', 'you',
]);

const CACHE_MAX = 4000;
const cacheNormalisation = new Map<string, string>();

/**
 * Minuscules, sans accents ; tout ce qui n'est ni lettre ni chiffre
 * (ponctuation, apostrophes, tirets) devient une espace. « L'Elfe », « l’elfe »
 * et « Saint-Denis » donnent donc des mots entiers, comparables aux frontières.
 */
export function normaliserTexte(texte: unknown): string {
  const brut = String(texte ?? '');
  const memorise = cacheNormalisation.get(brut);
  if (memorise !== undefined) return memorise;
  const resultat = brut
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (brut.length <= 6000) {
    if (cacheNormalisation.size >= CACHE_MAX) cacheNormalisation.delete(cacheNormalisation.keys().next().value as string);
    cacheNormalisation.set(brut, resultat);
  }
  return resultat;
}

/** Mots significatifs d'un texte déjà normalisé (ou non), sans doublon. */
export function termesTexte(texte: string): string[] {
  const vus = new Set<string>();
  const termes: string[] = [];
  for (const terme of normaliserTexte(texte).split(' ')) {
    if (terme.length < 2 || MOTS_VIDES.has(terme) || vus.has(terme)) continue;
    vus.add(terme);
    termes.push(terme);
  }
  return termes;
}

/**
 * Racine pour la comparaison lexicale seulement : pluriel simple (s, x) retiré.
 * Jamais utilisée pour les noms canoniques, qui se comparent mot pour mot.
 */
export function racineSimple(terme: string): string {
  if (terme.length >= 5 && (terme.endsWith('s') || terme.endsWith('x')) && !terme.endsWith('ss')) return terme.slice(0, -1);
  return terme;
}

/** Ensemble des mots et de leurs racines simples. */
export function ensembleRacines(termes: Iterable<string>): Set<string> {
  const ensemble = new Set<string>();
  for (const t of termes) ensemble.add(racineSimple(t));
  return ensemble;
}

/**
 * Vrai si `expression` apparaît dans `texte` comme suite de mots entiers.
 * Les deux textes sont normalisés ici (mémoïsés) : « garde » ne se trouve pas
 * dans « regarde », mais se trouve dans « la garde de nuit ».
 */
export function contientExpression(texte: string, expression: string): boolean {
  return positionExpression(texte, expression) >= 0;
}

/** Position (dans le texte normalisé) de la première occurrence aux frontières de mots, ou -1. */
export function positionExpression(texte: string, expression: string): number {
  const cible = normaliserTexte(expression);
  if (!cible) return -1;
  const haystack = ` ${normaliserTexte(texte)} `;
  const i = haystack.indexOf(` ${cible} `);
  return i < 0 ? -1 : i;
}

/** Nombre d'occurrences d'un mot entier dans une liste de mots. */
export function compterMot(mots: readonly string[], terme: string): number {
  let n = 0;
  for (const m of mots) if (m === terme) n += 1;
  return n;
}
