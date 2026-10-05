import type { LoreEntry } from '../types';
import { similariteCosinus } from './embeddings';
import {
  calculerScoreHybrideLore,
  infererScopeLore,
  MAX_LORE_CONTEXTUEL,
  SEUIL_LORE_HYBRIDE,
  type ScopeLore,
} from './loreScoring';

function normalise(texte: string): string {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

interface ElyndorEntryBrute {
  id: number;
  category: string;
  title: string;
  primary_keys?: string[];
  secondary_keys?: string[];
  negative_keys?: string[];
  content: string;
  priority: number;
  constant: boolean;
  lore_level?: 0 | 1 | 2 | 3;
  scope?: ScopeLore;
}

interface ElyndorLorebook {
  entries: ElyndorEntryBrute[];
}

export interface ElyndorEntryChargee {
  id: string;
  titre: string;
  contenu: string;
  motsClesPrimaires?: string[];
  motsClesSecondaires?: string[];
  motsClesNegatifs: string[];
  primaryKeys?: string[];
  secondaryKeys?: string[];
  negativeKeys?: string[];
  priority: number;
  constant: boolean;
  loreLevel?: 0 | 1 | 2 | 3;
  category?: string;
  scope?: ScopeLore;
}

export function chargerLoreElyndor(raw: ElyndorLorebook): ElyndorEntryChargee[] {
  return raw.entries.map((entry) => {
    const primaryKeys = (entry.primary_keys ?? []).map(normalise);
    const secondaryKeys = (entry.secondary_keys ?? []).map(normalise);
    const negativeKeys = (entry.negative_keys ?? []).map(normalise);
    return {
      id: `elyndor-${entry.id}`,
      titre: `[${entry.category}] ${entry.title}`,
      contenu: entry.content,
      motsClesPrimaires: primaryKeys,
      motsClesSecondaires: secondaryKeys,
      motsClesNegatifs: negativeKeys,
      primaryKeys,
      secondaryKeys,
      negativeKeys,
      priority: entry.priority,
      constant: entry.constant,
      loreLevel: entry.lore_level,
      category: entry.category,
      scope: entry.scope ?? infererScopeLore(entry.category),
    };
  });
}

const LORE_ELYNDOR_SOCLE_SUPPLEMENTAIRE = ['[MONDE] Géographie et Races'];

function piocherAleatoirement<T>(items: T[], n: number): T[] {
  const copie = [...items];
  for (let i = copie.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie.slice(0, n);
}

export interface OptionsSelectionLore {
  aleatoire?: boolean;
  tailleBassinAleatoire?: number;
  seuilPertinence?: number;
}

/**
 * V3 : récupération hybride du lore.
 * Les embeddings améliorent le classement lorsqu'ils existent, mais les
 * clés, le scope et le lexical restent suffisants pour un fallback local.
 * Les règles fondamentales du moteur ne passent jamais par cette sélection.
 */
export function selectionnerLoreElyndorSemantique(
  entries: ElyndorEntryChargee[],
  texteRequete: string,
  vecteurRequete: number[],
  vecteursEntrees: Record<string, number[]>,
  maxSupplementaires = MAX_LORE_CONTEXTUEL,
  options?: OptionsSelectionLore,
): LoreEntry[] {
  const toujoursActives = entries.filter(
    (e) => e.constant || LORE_ELYNDOR_SOCLE_SUPPLEMENTAIRE.includes(e.titre),
  );
  const reste = entries.filter(
    (e) => !e.constant && !LORE_ELYNDOR_SOCLE_SUPPLEMENTAIRE.includes(e.titre),
  );
  const seuil = options?.seuilPertinence ?? SEUIL_LORE_HYBRIDE;

  const classementComplet = reste
    .map((entry) => {
      const similarite = vecteursEntrees[entry.id]
        ? similariteCosinus(vecteurRequete, vecteursEntrees[entry.id])
        : undefined;
      const details = calculerScoreHybrideLore(
        {
          titre: entry.titre,
          contenu: entry.contenu,
          primaryKeys: entry.primaryKeys ?? entry.motsClesPrimaires,
          secondaryKeys: entry.secondaryKeys ?? entry.motsClesSecondaires,
          negativeKeys: entry.negativeKeys ?? entry.motsClesNegatifs,
          priority: entry.priority,
          category: entry.category,
          scope: entry.scope,
          constant: entry.constant,
        },
        texteRequete,
        similarite,
      );
      return { entry, score: details.score };
    })
    .filter((x) => x.score >= seuil)
    .sort((a, b) => b.score - a.score || a.entry.priority - b.entry.priority);

  const plafond = Math.max(0, Math.min(MAX_LORE_CONTEXTUEL, maxSupplementaires));
  const classement = options?.aleatoire
    ? piocherAleatoirement(
        classementComplet.slice(0, Math.max(options.tailleBassinAleatoire ?? 10, plafond)),
        plafond,
      )
    : classementComplet.slice(0, plafond);

  return [
    ...toujoursActives.map((e) => ({ id: e.id, titre: e.titre, contenu: e.contenu })),
    ...classement.map((c) => ({ id: c.entry.id, titre: c.entry.titre, contenu: c.entry.contenu, score: c.score })),
  ];
}

const SCOPES_ANCRABLES = new Set<ScopeLore>(['CITY', 'FACTION', 'CHARACTER']);

function sujetCanoniqueTitre(titre: string): string {
  let sujet = titre.trim();
  while (/^\[[^\]]+\]\s*/.test(sujet)) sujet = sujet.replace(/^\[[^\]]+\]\s*/, '');
  return sujet.split(/\s+[—–]\s+/)[0]?.trim() ?? sujet;
}

function normaliserAncre(texte: string): string {
  return normalise(texte)
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function estEntreeAncrable(entree: ElyndorEntryChargee): boolean {
  if (entree.titre.toUpperCase().includes('[INDEX]')) return false;
  const scope = entree.scope ?? infererScopeLore(entree.category);
  if (SCOPES_ANCRABLES.has(scope)) return true;
  const categorie = normalise(entree.category ?? '');
  const titre = normalise(entree.titre);
  return [
    'royaume', 'ville', 'guilde', 'faction', 'pnj', 'personnage',
    'religion', 'culte', 'artefact', 'zone corrompue', 'porte astra',
  ].some((motif) => categorie.includes(motif) || titre.includes(motif));
}

function contientExpressionCanonique(requeteNormalisee: string, aliasNormalise: string): boolean {
  if (aliasNormalise.length < 3) return false;
  return ` ${requeteNormalisee} `.includes(` ${aliasNormalise} `);
}

function aliasesCanoniques(entree: ElyndorEntryChargee): string[] {
  const sujet = normaliserAncre(sujetCanoniqueTitre(entree.titre));
  if (!sujet) return [];
  const aliases = new Set<string>([sujet]);
  for (const cle of [...(entree.primaryKeys ?? []), ...(entree.secondaryKeys ?? [])]) {
    const alias = normaliserAncre(cle);
    if (!alias || alias.length < 3) continue;
    if (alias.includes(sujet) || sujet.includes(alias)) aliases.add(alias);
  }
  return [...aliases];
}

/**
 * Un nom canonique explicitement cité force sa fiche, indépendamment des
 * embeddings et du top-N. `score === undefined` marque volontairement une
 * entrée obligatoire pour le constructeur de prompt.
 */
export function extraireAncresCanoniques(
  texteRequete: string,
  entrees: ElyndorEntryChargee[],
): LoreEntry[] {
  const requete = normaliserAncre(texteRequete);
  const notes: { entree: ElyndorEntryChargee; position: number }[] = [];

  for (const entree of entrees) {
    if (!estEntreeAncrable(entree)) continue;
    let meilleurePosition = Number.POSITIVE_INFINITY;
    for (const alias of aliasesCanoniques(entree)) {
      if (!contientExpressionCanonique(requete, alias)) continue;
      const position = requete.indexOf(alias);
      if (position >= 0) meilleurePosition = Math.min(meilleurePosition, position);
    }
    if (!Number.isFinite(meilleurePosition)) continue;
    notes.push({ entree, position: meilleurePosition });
  }

  notes.sort((a, b) =>
    a.position - b.position
    || a.entree.priority - b.entree.priority
    || a.entree.titre.localeCompare(b.entree.titre),
  );

  return notes.map(({ entree }) => ({
    id: entree.id,
    titre: entree.titre,
    contenu: entree.contenu,
  }));
}

/**
 * Priorité réelle : ancres explicites, socle obligatoire, puis résultats
 * contextuels. Les ancres et le socle ne consomment pas le quota top-N.
 */
export function prioriserLoreCanon(
  texteRequete: string,
  selection: LoreEntry[],
  entrees: ElyndorEntryChargee[],
): LoreEntry[] {
  const ancres = extraireAncresCanoniques(texteRequete, entrees);
  const obligatoires = selection.filter((s) => s.score === undefined);
  const contextuels = selection.filter((s) => s.score !== undefined);
  const vus = new Set<string>();
  const resultat: LoreEntry[] = [];

  for (const e of [...ancres, ...obligatoires, ...contextuels]) {
    if (vus.has(e.id)) continue;
    vus.add(e.id);
    resultat.push(e);
  }
  return resultat;
}
