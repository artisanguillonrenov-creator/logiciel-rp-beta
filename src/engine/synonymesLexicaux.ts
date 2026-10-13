import { normaliserTexte, racineFrancaise } from './texteRecherche';

/**
 * Synonymes de la recherche lexicale : « auberge » doit aussi trouver la fiche
 * d'une taverne. Un synonyme compte moins qu'un mot exact (POIDS_SYNONYME) et
 * ne sert jamais à reconnaître un nom propre ni à créer une ancre canonique.
 * Les groupes par défaut sont complétés par ceux saisis dans l'Atelier.
 */
export const POIDS_SYNONYME = 0.7;

export const SYNONYMES_PAR_DEFAUT: readonly (readonly string[])[] = [
  ['auberge', 'taverne', 'gargote', 'estaminet'],
  ['garde', 'soldat', 'sentinelle', 'milicien'],
  ['epee', 'lame', 'glaive', 'rapiere'],
  ['roi', 'souverain', 'monarque'],
  ['reine', 'souveraine'],
  ['chateau', 'forteresse', 'citadelle', 'donjon'],
  ['temple', 'sanctuaire', 'chapelle', 'eglise'],
  ['pretre', 'clerc', 'pretresse'],
  ['marchand', 'commercant', 'negociant'],
  ['marche', 'foire', 'halles'],
  ['forgeron', 'forge', 'armurier'],
  ['voleur', 'brigand', 'bandit', 'malandrin'],
  ['mage', 'sorcier', 'magicien', 'enchanteur'],
  ['chef', 'meneur', 'dirigeant'],
  ['ville', 'cite'],
  ['port', 'quai', 'docks'],
  ['prison', 'geole', 'cachot'],
  ['bibliotheque', 'archives'],
  ['potion', 'elixir', 'philtre'],
  ['argent', 'or', 'pieces', 'monnaie'],
  ['bateau', 'navire', 'vaisseau'],
  ['cheval', 'monture', 'destrier'],
  ['guerisseur', 'medecin', 'soigneur'],
  ['mercenaire', 'spadassin'],
  ['noble', 'aristocrate', 'seigneur'],
];

const MAX_GROUPES = 200;
const MAX_TERMES_GROUPE = 12;

let personnalises: string[][] = [];
let index: Map<string, Set<string>> | null = null;

/** Valide une liste de groupes saisie par l'utilisateur (une ligne = un groupe). */
export function validerGroupesSynonymes(valeur: unknown): string[][] {
  if (!Array.isArray(valeur) || valeur.length > MAX_GROUPES) throw new Error(`Au plus ${MAX_GROUPES} groupes de synonymes.`);
  return valeur.map((groupe) => {
    if (!Array.isArray(groupe)) throw new Error('Groupe de synonymes invalide.');
    const termes = [...new Set(groupe.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean))];
    if (termes.length > MAX_TERMES_GROUPE || termes.some((t) => t.length > 40)) {
      throw new Error(`Un groupe compte au plus ${MAX_TERMES_GROUPE} mots de 40 caractères.`);
    }
    return termes;
  }).filter((g) => g.length >= 2);
}

/** Lit un texte « auberge, taverne » (une ligne par groupe) en groupes. */
export function lireGroupesSynonymes(texte: string): string[][] {
  return validerGroupesSynonymes(texte.split('\n').map((ligne) => ligne.split(/[,;]/)));
}

export function ecrireGroupesSynonymes(groupes: readonly (readonly string[])[]): string {
  return groupes.map((g) => g.join(', ')).join('\n');
}

/** Groupes saisis dans l'Atelier (remplacent l'index courant). */
export function definirSynonymesPersonnalises(groupes: readonly (readonly string[])[]): void {
  personnalises = groupes.map((g) => [...g]);
  index = null;
}

/** Une racine = un mot d'un seul tenant ; les expressions de plusieurs mots sont ignorées ici. */
function racineDe(terme: string): string | null {
  const mots = normaliserTexte(terme).split(' ').filter(Boolean);
  return mots.length === 1 ? racineFrancaise(mots[0]) : null;
}

function construireIndex(): Map<string, Set<string>> {
  const carte = new Map<string, Set<string>>();
  for (const groupe of [...SYNONYMES_PAR_DEFAUT, ...personnalises]) {
    const racines = [...new Set(groupe.map(racineDe).filter((r): r is string => !!r))];
    for (const r of racines) {
      const voisins = carte.get(r) ?? new Set<string>();
      for (const autre of racines) if (autre !== r) voisins.add(autre);
      carte.set(r, voisins);
    }
  }
  return carte;
}

/** Racines synonymes d'une racine (jamais elle-même). */
export function synonymesDe(racine: string): ReadonlySet<string> {
  index ??= construireIndex();
  return index.get(racine) ?? new Set<string>();
}
