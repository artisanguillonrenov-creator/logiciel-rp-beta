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

/**
 * Sélectionne les entrées d'un lorebook dont au moins un mot-clé apparaît
 * dans le texte donné (message du joueur + contexte récent).
 * Utilisé pour le lore Elyndor (déclenchement simple par mention).
 */
export function selectionnerParMotsCles(entries: LoreEntry[], texte: string, maxEntrees = 5): LoreEntry[] {
  const texteNormalise = normalise(texte);
  const correspondances = entries
    .map((entry) => ({
      entry,
      score: entry.motsCles.filter((mot) => texteNormalise.includes(mot)).length,
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);
  return correspondances.slice(0, maxEntrees).map((c) => c.entry);
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
