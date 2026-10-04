export type ScopeLore = 'GLOBAL' | 'CONTINENT' | 'REGION' | 'CITY' | 'FACTION' | 'CHARACTER' | 'SCENE';

export interface EntreeLoreScorable {
  titre: string;
  contenu: string;
  primaryKeys?: string[];
  secondaryKeys?: string[];
  negativeKeys?: string[];
  priority?: number;
  category?: string;
  scope?: ScopeLore;
  constant?: boolean;
}

export const SEUIL_LORE_HYBRIDE = 0.30;
export const MAX_LORE_CONTEXTUEL = 8;

const MOTS_VIDES_LORE = new Set([
  'a', 'au', 'aux', 'avec', 'ce', 'ces', 'dans', 'de', 'des', 'du', 'en', 'et', 'il', 'ils', 'la', 'le', 'les', 'leur',
  'mais', 'ne', 'nous', 'on', 'ou', 'par', 'pas', 'pour', 'que', 'qui', 'sa', 'se', 'ses', 'son', 'sur', 'un', 'une', 'vous',
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'is', 'are', 'was', 'were', 'be', 'it', 'this', 'that',
]);

export function normaliserLore(texte: string): string {
  return String(texte ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9'-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function termesSignificatifsLore(texte: string): string[] {
  const vus = new Set<string>();
  const termes: string[] = [];
  for (const brut of normaliserLore(texte).split(' ')) {
    const terme = brut.replace(/^[-']+|[-']+$/g, '');
    if (terme.length < 2 || MOTS_VIDES_LORE.has(terme) || vus.has(terme)) continue;
    vus.add(terme);
    termes.push(terme);
  }
  return termes;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function scoreCle(requeteNormalisee: string, termesRequete: Set<string>, cles: string[] | undefined): number {
  if (!cles?.length) return 0;
  let meilleur = 0;
  for (const cle of cles) {
    const cleNormalisee = normaliserLore(cle);
    if (!cleNormalisee) continue;
    if (requeteNormalisee.includes(cleNormalisee)) {
      meilleur = 1;
      break;
    }
    const termesCle = termesSignificatifsLore(cleNormalisee);
    if (!termesCle.length) continue;
    const communs = termesCle.filter((t) => termesRequete.has(t)).length;
    meilleur = Math.max(meilleur, communs / termesCle.length);
  }
  return clamp01(meilleur);
}

function sujetTitre(titre: string): string {
  const sansCategorie = normaliserLore(titre.replace(/^\[[^\]]+\]\s*/, ''));
  return sansCategorie.split(/\s+[—–-]\s+/)[0]?.trim() ?? sansCategorie;
}

export function estExclueParClesNegatives(entry: EntreeLoreScorable, requete: string): boolean {
  const q = normaliserLore(requete);
  return (entry.negativeKeys ?? []).some((cle) => {
    const n = normaliserLore(cle);
    return n.length >= 2 && q.includes(n);
  });
}

export function infererScopeLore(category?: string): ScopeLore {
  const c = normaliserLore(category ?? '');
  if (c.includes('relation')) return 'REGION';
  if (c.includes('royaume') || c.includes('conflit') || c.includes('probleme')) return 'CITY';
  if (c.includes('guilde') || c.includes('faction')) return 'FACTION';
  if (c.includes('recurrent') || c.includes('physique') || c === 'profil' || c.includes('personnage')) return 'CHARACTER';
  if (c.includes('culture') || c.includes('racial') || c.includes('race')) return 'CONTINENT';
  if (c.includes('scene')) return 'SCENE';
  return 'GLOBAL';
}

export interface DetailsScoreLore {
  embedding: number;
  lexical: number;
  primary: number;
  secondary: number;
  explicite: number;
  categorie: number;
  scope: number;
  priorite: number;
  score: number;
}

export function calculerScoreHybrideLore(
  entry: EntreeLoreScorable,
  requete: string,
  similariteEmbedding?: number,
): DetailsScoreLore {
  if (estExclueParClesNegatives(entry, requete)) {
    return { embedding: 0, lexical: 0, primary: 0, secondary: 0, explicite: 0, categorie: 0, scope: 0, priorite: 0, score: 0 };
  }

  const requeteNormalisee = normaliserLore(requete);
  const termesRequeteListe = termesSignificatifsLore(requete);
  const termesRequete = new Set(termesRequeteListe);
  const corps = normaliserLore(entry.titre + ' ' + entry.contenu);
  const termesCorps = new Set(termesSignificatifsLore(corps));
  const trouves = termesRequeteListe.filter((t) => termesCorps.has(t)).length;
  // Une requête de tour contient souvent beaucoup de contexte : on ne divise
  // pas par des dizaines de termes, ce qui écraserait artificiellement le lexical.
  const lexical = clamp01(trouves / Math.max(1, Math.min(12, termesRequeteListe.length)));
  const primary = scoreCle(requeteNormalisee, termesRequete, entry.primaryKeys);
  const secondary = scoreCle(requeteNormalisee, termesRequete, entry.secondaryKeys);
  const sujet = sujetTitre(entry.titre);
  const explicite = sujet.length >= 3 && requeteNormalisee.includes(sujet) ? 1 : Math.max(primary, secondary * 0.6);
  const categorieNormalisee = normaliserLore(entry.category ?? '');
  const categorie = categorieNormalisee && requeteNormalisee.includes(categorieNormalisee) ? 1 : 0;
  const prioriteBrute = Number.isFinite(entry.priority) ? Number(entry.priority) : 100;
  const priorite = clamp01(1 - Math.max(0, Math.min(100, prioriteBrute)) / 100);
  const scopeValue = entry.scope ?? infererScopeLore(entry.category);
  const signalLocal = Math.max(primary, secondary, explicite, lexical);
  let scope = 0;
  switch (scopeValue) {
    case 'GLOBAL': scope = 0.45; break;
    case 'CONTINENT': scope = signalLocal >= 0.35 ? 0.75 : 0.15; break;
    case 'REGION': scope = signalLocal >= 0.35 ? 0.85 : 0.10; break;
    case 'CITY': scope = Math.max(primary, explicite) >= 0.75 ? 1 : signalLocal >= 0.45 ? 0.65 : 0.05; break;
    case 'FACTION': scope = Math.max(primary, explicite) >= 0.75 ? 1 : signalLocal >= 0.45 ? 0.65 : 0; break;
    case 'CHARACTER': scope = Math.max(primary, explicite) >= 0.75 ? 1 : signalLocal >= 0.45 ? 0.70 : 0; break;
    case 'SCENE': scope = lexical >= 0.25 ? 0.80 : 0; break;
  }

  const embeddingDisponible = typeof similariteEmbedding === 'number' && Number.isFinite(similariteEmbedding);
  const embedding = embeddingDisponible ? clamp01(similariteEmbedding) : 0;
  const score = embeddingDisponible
    ? 0.44 * embedding + 0.20 * lexical + 0.16 * primary + 0.07 * secondary + 0.05 * explicite + 0.04 * scope + 0.03 * priorite + 0.01 * categorie
    : 0.60 * lexical + 0.20 * primary + 0.08 * secondary + 0.05 * explicite + 0.04 * scope + 0.02 * priorite + 0.01 * categorie;

  return { embedding, lexical, primary, secondary, explicite, categorie, scope, priorite, score };
}
