import type { LoreEntry } from '../types';
import { similariteCosinus } from './embeddings';

function normalise(texte: string): string {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // retire les accents
}

// --- Métamoteurs (format RISU) -----------------------------------------

interface RisuEntry {
  key: string;
  secondkey?: string;
  comment: string;
  content: string;
  alwaysActive?: boolean;
}

interface RisuLorebook {
  type: string;
  ver: number;
  data: RisuEntry[];
}

export interface MetamoteurEntry {
  id: string;
  titre: string;
  contenu: string;
}

export function chargerMetamoteurs(raw: RisuLorebook): MetamoteurEntry[] {
  return raw.data.map((entry, index) => ({
    id: `meta-${index}`,
    titre: entry.comment,
    contenu: entry.content,
  }));
}

// Métamoteurs toujours retenus car ils gouvernent COMMENT toute réponse est
// produite, indépendamment du contenu de la scène.
const METAMOTEURS_SOCLE = [
  '[MÉTA] Production de la Réponse',
  '[MÉTA] Continuité',
  '[MÉTA] Agentivité du Joueur',
  '[MÉTA] Registre et Style Narratif',
];

/**
 * L'ancien pipeline reste actif jusqu'à la bascule V2.1. Pendant cette
 * transition, les 15 entrées sont conservées à chaque tour ; le score sert
 * uniquement à ordonner les entrées hors socle, jamais à les supprimer.
 */
export function selectionnerMetamoteursSemantique(
  entries: MetamoteurEntry[],
  vecteurRequete: number[],
  vecteursEntrees: Record<string, number[]>,
  maxSupplementaires = Infinity,
): LoreEntry[] {
  const socle = entries.filter((e) => METAMOTEURS_SOCLE.includes(e.titre));
  const reste = entries.filter((e) => !METAMOTEURS_SOCLE.includes(e.titre));

  const classement = reste
    .map((entry) => ({
      entry,
      score: vecteursEntrees[entry.id] ? similariteCosinus(vecteurRequete, vecteursEntrees[entry.id]) : -1,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSupplementaires);

  return [
    ...socle.map((e) => ({ id: e.id, titre: e.titre, contenu: e.contenu })),
    ...classement.map((c) => ({ id: c.entry.id, titre: c.entry.titre, contenu: c.entry.contenu, score: c.score })),
  ];
}

// --- Lore Elyndor -----------------------------------------------------

interface ElyndorEntryBrute {
  id: number;
  category: string;
  title: string;
  primary_keys: string[];
  secondary_keys: string[];
  negative_keys: string[];
  content: string;
  priority: number;
  constant: boolean;
}

interface ElyndorLorebook {
  entries: ElyndorEntryBrute[];
}

export interface ElyndorEntryChargee {
  id: string;
  titre: string;
  contenu: string;
  motsClesNegatifs: string[];
  priority: number;
  constant: boolean;
}

export function chargerLoreElyndor(raw: ElyndorLorebook): ElyndorEntryChargee[] {
  return raw.entries.map((entry) => ({
    id: `elyndor-${entry.id}`,
    titre: `[${entry.category}] ${entry.title}`,
    contenu: entry.content,
    motsClesNegatifs: entry.negative_keys.map(normalise),
    priority: entry.priority,
    constant: entry.constant,
  }));
}

// Une entrée non couverte par "constant" mais dont l'absence casse la
// cohérence du monde : la table race → territoire.
const LORE_ELYNDOR_SOCLE_SUPPLEMENTAIRE = ['[MONDE] Géographie et Races'];

// Les fiches de lore sont plus longues et plus générales que les messages
// historiques. Un seuil légèrement inférieur à celui des souvenirs (0,30)
// évite de remplir le prompt avec les « moins mauvaises » fiches tout en
// conservant les rapprochements sémantiques utiles.
export const SEUIL_PERTINENCE_LORE = 0.22;

function piocherAleatoirement<T>(items: T[], n: number): T[] {
  const copie = [...items];
  for (let i = copie.length - 1; i > 0; i--) {
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
 * Sélection sémantique du lore :
 * - les entrées constantes et Géographie et Races sont obligatoires ;
 * - les exclusions négatives restent déterministes ;
 * - les entrées supplémentaires doivent franchir un vrai seuil de
 *   pertinence avant d'être classées ;
 * - maxSupplementaires reste un plafond, jamais un objectif à remplir.
 */
export function selectionnerLoreElyndorSemantique(
  entries: ElyndorEntryChargee[],
  texteRequete: string,
  vecteurRequete: number[],
  vecteursEntrees: Record<string, number[]>,
  maxSupplementaires = 18,
  options?: OptionsSelectionLore,
): LoreEntry[] {
  const texteNormalise = normalise(texteRequete);
  const seuil = options?.seuilPertinence ?? SEUIL_PERTINENCE_LORE;
  const toujoursActives = entries.filter(
    (e) => e.constant || LORE_ELYNDOR_SOCLE_SUPPLEMENTAIRE.includes(e.titre),
  );
  const reste = entries.filter(
    (e) => !e.constant && !LORE_ELYNDOR_SOCLE_SUPPLEMENTAIRE.includes(e.titre),
  );

  const classementComplet = reste
    .filter((entry) => !entry.motsClesNegatifs.some((mot) => texteNormalise.includes(mot)))
    .map((entry) => ({
      entry,
      score: vecteursEntrees[entry.id] ? similariteCosinus(vecteurRequete, vecteursEntrees[entry.id]) : -1,
    }))
    .filter((c) => c.score >= seuil)
    .sort((a, b) => b.score - a.score || a.entry.priority - b.entry.priority);

  const classement = options?.aleatoire
    ? piocherAleatoirement(
        classementComplet.slice(0, Math.max(options.tailleBassinAleatoire ?? 10, maxSupplementaires)),
        maxSupplementaires,
      )
    : classementComplet.slice(0, maxSupplementaires);

  return [
    ...toujoursActives.map((e) => ({ id: e.id, titre: e.titre, contenu: e.contenu })),
    ...classement.map((c) => ({ id: c.entry.id, titre: c.entry.titre, contenu: c.entry.contenu, score: c.score })),
  ];
}

const PREFIXE_ROYAUME = '[ROYAUME] ';
const MAX_ANCRES_CANON = 2;

/**
 * Priorité canon : les royaumes explicitement nommés et le socle permanent
 * sont injectés avant le lore sémantique. Ainsi, une fiche « toujours active »
 * ne peut plus se retrouver derrière des résultats scorés puis disparaître
 * faute de budget dans le constructeur de prompt.
 */
export function prioriserLoreCanon(
  texteRequete: string,
  selection: LoreEntry[],
  entrees: ElyndorEntryChargee[],
): LoreEntry[] {
  const requete = normalise(texteRequete);
  const ancres: LoreEntry[] = [];
  for (const entree of entrees) {
    if (ancres.length >= MAX_ANCRES_CANON) break;
    if (!entree.titre.startsWith(PREFIXE_ROYAUME)) continue;
    const lieu = normalise(entree.titre.slice(PREFIXE_ROYAUME.length).split('—')[0].trim());
    if (lieu.length >= 3 && requete.includes(lieu)) {
      ancres.push({ id: entree.id, titre: entree.titre, contenu: entree.contenu, score: 2 });
    }
  }

  const socle: LoreEntry[] = entrees
    .filter((e) => e.constant || LORE_ELYNDOR_SOCLE_SUPPLEMENTAIRE.includes(e.titre))
    .map((e) => ({ id: e.id, titre: e.titre, contenu: e.contenu }));

  const vus = new Set<string>();
  const resultat: LoreEntry[] = [];
  for (const e of [...ancres, ...socle, ...selection]) {
    if (vus.has(e.id)) continue;
    vus.add(e.id);
    resultat.push(e);
  }
  return resultat;
}
