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

// Les primary_keys des entrées ROYAUME/Géographie ciblent des expressions
// figées ("royaume elfe noir", "empire elfique") plutôt que le nom de race
// que le modèle emploie naturellement en narration ("elfe noire", "hauts-
// elfes"...). Sans ça, un PNJ dont la race est mentionnée en cours de scène
// ne déclenche ni la fiche de royaume correspondante ni la table
// Géographie/Races — le modèle invente alors un territoire hors canon.
// Formes singulier + pluriel car la correspondance est une sous-chaîne
// stricte (pas de gestion du pluriel/accord).
const DECLENCHEURS_SUPPLEMENTAIRES_ELYNDOR: Record<string, string[]> = {
  '[MONDE] Géographie et Races': [
    'humain', 'humains', 'haut-elfe', 'haut elfe', 'hauts-elfes', 'hauts elfes',
    'elfe noir', 'elfe noire', 'elfes noirs', 'elfes noires',
    'valkyrie', 'valkyries', 'amazone nordique', 'amazones nordiques',
    'amazone sombre', 'amazones sombres', 'orque noble', 'orques nobles',
    'orc', 'orcs', 'homme-bête', 'hommes-bêtes', 'tribu primale', 'tribus primales',
    'sirène', 'sirènes', 'naga', 'nagas', 'nain', 'nains', 'géante', 'géantes',
  ],
  '[ROYAUME] Paris — Royaume Humain': ['humain', 'humains'],
  '[ROYAUME] Tokyo — Empire des Hauts-Elfes': ['haut-elfe', 'haut elfe', 'hauts-elfes', 'hauts elfes'],
  '[ROYAUME] Delhi — Royaume des Elfes Noirs': ['elfe noir', 'elfe noire', 'elfes noirs', 'elfes noires'],
  '[ROYAUME] Oslo — Confédération des Valkyries': [
    'valkyrie', 'valkyries', 'amazone nordique', 'amazones nordiques',
  ],
  '[ROYAUME] Lagos — Matriarcat des Amazones Sombres': ['amazone sombre', 'amazones sombres'],
  '[ROYAUME] Johannesburg — Confédération des Orques Nobles': ['orque noble', 'orques nobles'],
  '[ROYAUME] Mexico — Territoires Orcs': ['orc', 'orcs'],
  '[ROYAUME] Bogotá — Tribus Primales': ['tribu primale', 'tribus primales'],
  '[ROYAUME] Sydney — Royaume des Sirènes': ['sirène', 'sirènes'],
  '[ROYAUME] Auckland — Royaume des Naga Marines': ['naga', 'nagas'],
  '[ROYAUME] Zurich — Royaume des Nains': ['nain', 'nains'],
  '[ROYAUME] Katmandou — Territoire des Géantes': ['géante', 'géantes'],
};

export function chargerLoreElyndor(raw: ElyndorLorebook): ElyndorEntryChargee[] {
  return raw.entries.map((entry) => {
    const titre = `[${entry.category}] ${entry.title}`;
    const extra = (DECLENCHEURS_SUPPLEMENTAIRES_ELYNDOR[titre] ?? []).map(normalise);
    return {
      id: `elyndor-${entry.id}`,
      titre,
      contenu: entry.content,
      motsClesPrimaires: [...entry.primary_keys.map(normalise), ...extra],
      motsClesSecondaires: entry.secondary_keys.map(normalise),
      motsClesNegatifs: entry.negative_keys.map(normalise),
      priority: entry.priority,
      constant: entry.constant,
    };
  });
}

// Une entrée non couverte par "constant" mais dont l'absence casse la
// cohérence du monde : la table race → territoire. Un PNJ improvisé se voit
// attribuer une race à la volée par le modèle (voir [MÉTA] Esprit des
// Personnages / Archétypes Universels) ; sans cette table toujours en
// contexte, rien ne l'ancre à un territoire canon (ex. une "elfe noire"
// inventée sans lien avec Delhi). Coût négligeable (~900 caractères).
const LORE_ELYNDOR_SOCLE_SUPPLEMENTAIRE = ['[MONDE] Géographie et Races'];

/**
 * Sélectionne les entrées du lore Elyndor pertinentes à la scène : même
 * logique de déclenchement par mots-clés simples que le reste du moteur
 * (le personnage, lieu ou objet mentionné déclenche l'entrée), adaptée à
 * la structure du lorebook Elyndor :
 * - les entrées "constant" (règles fondatrices du monde : présentation,
 *   paramètres, registre, consentement...) sont toujours incluses, comme
 *   le socle des métamoteurs, de même que la table Géographie et Races
 *   (voir LORE_ELYNDOR_SOCLE_SUPPLEMENTAIRE) ;
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
  const toujoursActives = entries.filter(
    (e) => e.constant || LORE_ELYNDOR_SOCLE_SUPPLEMENTAIRE.includes(e.titre),
  );
  const reste = entries.filter(
    (e) => !e.constant && !LORE_ELYNDOR_SOCLE_SUPPLEMENTAIRE.includes(e.titre),
  );

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
