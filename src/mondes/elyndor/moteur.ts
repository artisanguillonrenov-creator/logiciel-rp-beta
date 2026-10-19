import type { FicheRoleCanon, VisuelRace } from '../types';

// Données d'Elyndor lues par le moteur, déplacées telles quelles depuis
// rolesCanon.ts, racePnj.ts, scenarioGenerator.ts et contenuAdulte.ts.

/**
 * Fiches « [RÉCURRENT] » qui fixent, pour chaque capitale, qui tient la
 * guilde, l'accueil, la taverne, la forge, la Porte Astra et le trône.
 */
export const FICHES_ROLES_ELYNDOR: FicheRoleCanon[] = [
  { motif: /ma[iî]tresses de guilde/i, role: 'maitresse_guilde', libelle: 'Maîtresse de la Guilde des Aventuriers' },
  { motif: /r[ée]ceptionnistes/i, role: 'receptionniste', libelle: 'Réceptionniste de la Guilde des Aventuriers' },
  { motif: /taverni[èe]res/i, role: 'taverniere', libelle: 'Tavernière' },
  { motif: /forgeronnes/i, role: 'forgeronne', libelle: 'Forgeronne' },
  { motif: /passeuses astra/i, role: 'passeuse', libelle: 'Passeuse de la Porte Astra' },
  { motif: /souverains/i, role: 'souverain', libelle: 'Souverain' },
];

// Race et sexe d'un PNJ déduits de sa fiche, pour lui donner le portrait
// prédéfini de sa race comme référence visuelle et rappeler le canon au
// modèle image. Sans ce rappel, « elfe noire » était lu « black woman » :
// N'Kala sortait en femme africaine alors que les Elfes Noirs d'Elyndor ont
// la peau mate à brun sombre et les cheveux argentés.

/** Du plus précis au plus général : « orque noble » avant « orque », « elfe noir » avant « humain ». */
export const DETECTION_RACES_ELYNDOR: ReadonlyArray<{ race: string; motif: RegExp }> = [
  { race: 'elfes-noirs', motif: /\b(elfe?s? noire?s?|drows?)\b/ },
  { race: 'hauts-elfes', motif: /\bhaute?s? elfe?s?\b/ },
  { race: 'valkyries', motif: /\bvalkyries?\b/ },
  { race: 'amazones-nordiques', motif: /\bamazones? nordiques?\b/ },
  { race: 'amazones-sombres', motif: /\bamazones? sombres?\b/ },
  { race: 'orques-nobles', motif: /\borques? nobles?\b/ },
  { race: 'orcs', motif: /\b(orcs?|orques?)\b/ },
  { race: 'hommes-betes', motif: /\b(hommes?|femmes?) betes?\b/ },
  { race: 'tribus-primales', motif: /\btribus? primales?\b/ },
  { race: 'naga-marines', motif: /\bnagas?\b/ },
  { race: 'sirenes', motif: /\bsirenes?\b/ },
  { race: 'nains', motif: /\bnaine?s?\b/ },
  { race: 'geantes', motif: /\bgeante?s?\b/ },
  { race: 'sultanats', motif: /\bsultanats?\b/ },
  { race: 'humains', motif: /\bhumaine?s?\b/ },
];

/**
 * Traits visibles de chaque race, en anglais, ajoutés tels quels aux mots-clés
 * de l'image : le modèle narratif traduisait le canon à sa façon (« elfe noire » →
 * « black woman » ou « tan skin »). Elfes Noirs : peau ébène validée par
 * l'autrice (essais du 6 octobre), plus sombre que l'ancien « mate à brun
 * sombre ».
 */
export const VISUELS_RACES_ELYNDOR: Record<string, VisuelRace> = {
  'elfes-noirs': {
    traits: 'dark elf, dark-skinned, ebony skin, very dark skin, silver white hair, long pointed elf ears',
    negatif: 'pale skin, white skin, fair skin, light skin, tan skin, human ears, round ears, afro, black hair',
    // Le portrait prédéfini actuel est plus clair que l'ébène voulu : à refaire.
    referenceFiable: false,
    apparence: 'Noblesse guerrière où le mérite militaire prime sur la lignée. Peau ébène très sombre, cheveux argentés, oreilles pointues, port martial.',
  },
  'hauts-elfes': { traits: 'high elf, East Asian features, flawless skin, long pointed elf ears, regal bearing', negatif: 'round ears', referenceFiable: true },
  valkyries: { traits: 'nordic valkyrie warrior, braided war hair, proud battle scars', referenceFiable: true },
  'amazones-nordiques': { traits: 'nordic forest huntress, wild braided hair', referenceFiable: true },
  sultanats: { traits: 'Middle Eastern and North African features', referenceFiable: true },
  'amazones-sombres': { traits: 'West African features, very dark skin', negatif: 'pale skin, light skin', referenceFiable: true },
  'orques-nobles': { traits: 'noble orc, tusks, powerful build', referenceFiable: true },
  orcs: { traits: 'orc, tusks, ritual scarification, muscular', referenceFiable: true },
  'hommes-betes': { traits: 'beastfolk, animal ears, tail, fur markings', referenceFiable: true },
  'tribus-primales': { traits: 'tribal shaman, South American features, spirit paint', referenceFiable: true },
  sirenes: { traits: 'siren, amphibious features, iridescent skin accents', referenceFiable: true },
  'naga-marines': { traits: 'naga, serpentine lower body, scales', referenceFiable: true },
  nains: { traits: 'dwarf, short and stocky, braided beard', referenceFiable: true },
  geantes: { traits: 'giantess, towering stature', referenceFiable: true },
  humains: { traits: 'human, European features', negatif: 'pointed ears', referenceFiable: true },
};

/**
 * Consigne type du scénario de départ : il sert de fil conducteur au
 * narrateur pour la première scène, et nomme le premier interlocuteur que
 * l'ouverture doit utiliser (controleOuverture.ts).
 */
export const CONSIGNE_SCENARIO_ELYNDOR = `Tu écris le scénario de départ d'une histoire de jeu de rôle dans Elyndor, à partir du monde, du personnage, du lieu, de la situation et du lore fournis. Ce scénario sert de fil conducteur au narrateur pour la première scène.

Écris 4 à 6 phrases au total (900 caractères au plus), au présent, à la deuxième personne (« tu »), qui posent :
1. Le lieu exact : la VILLE DE DÉPART fournie, nommée dans le texte, et l'endroit précis, avec un ou deux détails d'ambiance.
2. La raison de ta présence : ce qui t'amène ici, tiré de la situation choisie et du personnage.
3. La situation déjà en cours quand tu arrives : quelque chose se passe, une tension, une affaire, un danger.
4. Le premier interlocuteur, celui qui va t'interpeller : si le lore fixe quelqu'un pour ce lieu dans cette ville (voir PERSONNAGES FIXÉS PAR LE LORE), c'est lui, avec son nom exact ; sinon un personnage local mineur (marchand, garde, habitant…) avec un nom simple et une raison concrète de te parler.
5. Une amorce de dialogue autorisée : une seule courte réplique de ce personnage, sur sa propre ligne, au format NOM EN MAJUSCULES : « … ». Le scénario s'arrête sur cette réplique.

Interdits : terminer par une question au joueur (« Que fais-tu ? ») ; décider à ta place ce que tu dis, fais ou penses au-delà de ton arrivée ; résoudre la situation ; inventer un royaume, une grande guilde, un souverain ou une religion absents du lore. Réponds uniquement avec le texte du scénario, sans titre ni préambule.`;

export const ENTREES_ADULTE_ELYNDOR = [
  '[MONDE] Mœurs Vestimentaires Féminines',
  '[MONDE] Mœurs Sexuelles d\'Elyndor',
  '[PHYSIQUE] Canon Féminin d\'Elyndor',
];
