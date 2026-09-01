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
// produite, indépendamment du contenu de la scène (voir brief section 1 :
// "chargés et sélectionnés par pertinence de scène" — ce socle minimal reste
// nécessaire à chaque tour pour que le protocole Consulter/Sélectionner/
// Vérifier et l'agentivité du joueur s'appliquent systématiquement).
const METAMOTEURS_SOCLE = [
  '[MÉTA] Production de la Réponse',
  '[MÉTA] Continuité',
  '[MÉTA] Agentivité du Joueur',
  '[MÉTA] Registre et Style Narratif',
];

/**
 * Sélectionne les métamoteurs pertinents à la scène par similarité
 * sémantique (embeddings) : le socle toujours actif + les autres
 * métamoteurs les plus proches de la requête, plafonnés pour ne pas tout
 * injecter systématiquement (brief Phase 2 : remplace la correspondance
 * de mots-clés).
 */
export function selectionnerMetamoteursSemantique(
  entries: MetamoteurEntry[],
  vecteurRequete: number[],
  vecteursEntrees: Record<string, number[]>,
  maxSupplementaires = 5,
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
// Structure dédiée (id, category, primary_keys, secondary_keys,
// negative_keys, priority, constant), distincte du format RISU des
// métamoteurs ci-dessus. Les *_keys ne servent plus qu'à l'exclusion
// négative explicite ; le déclenchement se fait par similarité sémantique.

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
// cohérence du monde : la table race → territoire. Un PNJ improvisé se voit
// attribuer une race à la volée par le modèle (voir [MÉTA] Esprit des
// Personnages / Archétypes Universels) ; sans cette table toujours en
// contexte, rien ne l'ancre à un territoire canon (ex. une "elfe noire"
// inventée sans lien avec Delhi). Coût négligeable (~900 caractères).
const LORE_ELYNDOR_SOCLE_SUPPLEMENTAIRE = ['[MONDE] Géographie et Races'];

/**
 * Sélectionne les entrées du lore Elyndor pertinentes à la scène par
 * similarité sémantique (brief Phase 2 : remplace la correspondance de
 * mots-clés — c'est le correctif direct au cas observé où une elfe noire
 * mentionnée sans les mots-clés exacts du lorebook n'ancrait plus rien) :
 * - les entrées "constant" et la table Géographie et Races restent
 *   toujours actives, comme le socle des métamoteurs ;
 * - une entrée dont un mot-clé négatif apparaît littéralement dans le
 *   texte de la requête reste exclue (règle déterministe, indépendante de
 *   la similarité) ;
 * - les autres sont classées par similarité cosinus avec la requête et
 *   plafonnées.
 */
export function selectionnerLoreElyndorSemantique(
  entries: ElyndorEntryChargee[],
  texteRequete: string,
  vecteurRequete: number[],
  vecteursEntrees: Record<string, number[]>,
  maxSupplementaires = 4,
): LoreEntry[] {
  const texteNormalise = normalise(texteRequete);
  const toujoursActives = entries.filter(
    (e) => e.constant || LORE_ELYNDOR_SOCLE_SUPPLEMENTAIRE.includes(e.titre),
  );
  const reste = entries.filter(
    (e) => !e.constant && !LORE_ELYNDOR_SOCLE_SUPPLEMENTAIRE.includes(e.titre),
  );

  const classement = reste
    .filter((entry) => !entry.motsClesNegatifs.some((mot) => texteNormalise.includes(mot)))
    .map((entry) => ({
      entry,
      score: vecteursEntrees[entry.id] ? similariteCosinus(vecteurRequete, vecteursEntrees[entry.id]) : -1,
    }))
    .sort((a, b) => b.score - a.score || a.entry.priority - b.entry.priority)
    .slice(0, maxSupplementaires);

  return [
    ...toujoursActives.map((e) => ({ id: e.id, titre: e.titre, contenu: e.contenu })),
    ...classement.map((c) => ({ id: c.entry.id, titre: c.entry.titre, contenu: c.entry.contenu, score: c.score })),
  ];
}
