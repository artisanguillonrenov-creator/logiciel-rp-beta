import type { LoreEntry } from '../types';

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

function normalise(texte: string): string {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // retire les accents
}

export function chargerLorebook(raw: RisuLorebook): LoreEntry[] {
  return raw.data.map((entry, index) => ({
    id: `${index}-${entry.comment}`,
    titre: entry.comment,
    motsCles: entry.key
      .split(',')
      .map((mot) => normalise(mot.trim()))
      .filter(Boolean),
    contenu: entry.content,
  }));
}

// Les `key` du fichier source sont des étiquettes de catégorie ("réussite,
// échec, tentative, résolution, opposition"), pas le vocabulaire qu'un
// joueur emploie réellement en jouant une scène ("j'attaque", "je pare").
// Ce dictionnaire complète les mots-clés bruts avec des déclencheurs de
// scène concrets, pour que la sélection par pertinence fonctionne sur de
// vrais messages de joueur plutôt que sur les seules étiquettes du lorebook.
const DECLENCHEURS_SUPPLEMENTAIRES: Record<string, string[]> = {
  '[MÉTA] Esprit des Personnages': ['dit', 'répond', 'sourit', 'regarde', 'murmure', 'grimace', 'hésite', 'pnj'],
  '[MÉTA] Dynamiques Sociales': ['confiance', 'méfiance', 'déteste', 'respecte', 'trahi', 'ami', 'ennemi'],
  '[MÉTA] Engagements et Institutions': [
    'promets', 'promesse', 'mission', 'quête', 'contrat', 'dette', 'paye', 'achète', 'vends', 'ordre', 'guilde',
  ],
  '[MÉTA] Lois du Monde en Scène': ['sort', 'magie', 'épée', 'frappe', 'tue', 'blesse', 'meurt', 'sang', 'arme'],
  '[MÉTA] Archétypes Universels': ['garde', 'marchand', 'noble', 'bandit', 'prêtre', 'mage', 'soldat', 'voleur'],
  '[MÉTA] Profils Sociaux Universels': ['noble', 'esclave', 'criminel', 'militaire', 'marchand', 'clergé'],
  '[MÉTA] Dynamique de Groupe': ['groupe', 'compagnons', 'équipe', 'ensemble'],
  '[MÉTA] Négociation du Consentement en Scène': [
    'embrasse', 'caresse', 'sexe', 'nue', 'nu', 'lit', 'désir', 'excite', 'arrête', 'stop',
  ],
  '[MÉTA] Résolution des Actions': ['attaque', 'esquive', 'pare', 'tente', 'essaie', 'combat', 'tire', 'vise'],
  "[MÉTA] Circulation de l'Information": ['rumeur', 'nouvelle', 'messager', 'apprend'],
};

/**
 * Charge spécifiquement les métamoteurs, en enrichissant leurs mots-clés
 * bruts avec les déclencheurs de scène ci-dessus.
 */
export function chargerMetamoteurs(raw: RisuLorebook): LoreEntry[] {
  return chargerLorebook(raw).map((entry) => {
    const extra = (DECLENCHEURS_SUPPLEMENTAIRES[entry.titre] ?? []).map(normalise);
    return { ...entry, motsCles: [...entry.motsCles, ...extra] };
  });
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
 * Sélectionne les métamoteurs pertinents à la scène : le socle toujours actif
 * + les autres métamoteurs dont un mot-clé correspond au texte récent,
 * plafonné pour ne pas tout injecter systématiquement.
 */
export function selectionnerMetamoteurs(entries: LoreEntry[], texte: string, maxSupplementaires = 5): LoreEntry[] {
  const texteNormalise = normalise(texte);
  const socle = entries.filter((e) => METAMOTEURS_SOCLE.includes(e.titre));
  const reste = entries.filter((e) => !METAMOTEURS_SOCLE.includes(e.titre));

  const correspondances = reste
    .map((entry) => ({
      entry,
      score: entry.motsCles.filter((mot) => texteNormalise.includes(mot)).length,
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSupplementaires)
    .map((c) => c.entry);

  return [...socle, ...correspondances];
}

// --- Lore Elyndor -----------------------------------------------------
// Structure dédiée (id, category, primary_keys, secondary_keys,
// negative_keys, priority, constant), distincte du format RISU des
// métamoteurs ci-dessus.

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
  motsClesPrimaires: string[];
  motsClesSecondaires: string[];
  motsClesNegatifs: string[];
  priority: number;
  constant: boolean;
}

export function chargerLoreElyndor(raw: ElyndorLorebook): ElyndorEntryChargee[] {
  return raw.entries.map((entry) => ({
    id: `elyndor-${entry.id}`,
    titre: `[${entry.category}] ${entry.title}`,
    contenu: entry.content,
    motsClesPrimaires: entry.primary_keys.map(normalise),
    motsClesSecondaires: entry.secondary_keys.map(normalise),
    motsClesNegatifs: entry.negative_keys.map(normalise),
    priority: entry.priority,
    constant: entry.constant,
  }));
}

/**
 * Sélectionne les entrées du lore Elyndor pertinentes à la scène : même
 * logique de déclenchement par mots-clés simples que le reste du moteur
 * (le personnage, lieu ou objet mentionné déclenche l'entrée), adaptée à
 * la structure du lorebook Elyndor :
 * - les entrées "constant" (règles fondatrices du monde : présentation,
 *   paramètres, registre, consentement...) sont toujours incluses, comme
 *   le socle des métamoteurs ;
 * - un mot-clé primaire compte double par rapport à un mot-clé secondaire ;
 * - une entrée dont un mot-clé négatif apparaît dans le texte est exclue ;
 * - à score égal, la priorité la plus basse (donc la plus importante) est
 *   favorisée.
 */
export function selectionnerLoreElyndor(
  entries: ElyndorEntryChargee[],
  texte: string,
  maxSupplementaires = 4,
): LoreEntry[] {
  const texteNormalise = normalise(texte);
  const toujoursActives = entries.filter((e) => e.constant);
  const reste = entries.filter((e) => !e.constant);

  const correspondances = reste
    .map((entry) => {
      const negatif = entry.motsClesNegatifs.some((mot) => texteNormalise.includes(mot));
      if (negatif) return { entry, score: -1 };
      const scorePrimaire = entry.motsClesPrimaires.filter((mot) => texteNormalise.includes(mot)).length;
      const scoreSecondaire = entry.motsClesSecondaires.filter((mot) => texteNormalise.includes(mot)).length;
      return { entry, score: scorePrimaire * 2 + scoreSecondaire };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.priority - b.entry.priority)
    .slice(0, maxSupplementaires)
    .map((c) => c.entry);

  return [...toujoursActives, ...correspondances].map((entry) => ({
    id: entry.id,
    titre: entry.titre,
    motsCles: [...entry.motsClesPrimaires, ...entry.motsClesSecondaires],
    contenu: entry.contenu,
  }));
}
