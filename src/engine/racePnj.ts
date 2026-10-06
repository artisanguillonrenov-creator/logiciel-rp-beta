import { RACES_ELYNDOR, type RaceElyndor } from '../data/races';

// Race et sexe d'un PNJ déduits de sa fiche, pour lui donner le portrait
// prédéfini de sa race comme référence visuelle et rappeler le canon au
// modèle image. Sans ce rappel, « elfe noire » était lu « black woman » :
// N'Kala sortait en femme africaine alors que les Elfes Noirs d'Elyndor ont
// la peau mate à brun sombre et les cheveux argentés.

function normaliser(texte: string): string {
  return texte
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ');
}

/** Du plus précis au plus général : « orque noble » avant « orque », « elfe noir » avant « humain ». */
const MOTIFS_RACE: ReadonlyArray<[string, RegExp]> = [
  ['elfes-noirs', /\b(elfe?s? noire?s?|drows?)\b/],
  ['hauts-elfes', /\bhaute?s? elfe?s?\b/],
  ['valkyries', /\bvalkyries?\b/],
  ['amazones-nordiques', /\bamazones? nordiques?\b/],
  ['amazones-sombres', /\bamazones? sombres?\b/],
  ['orques-nobles', /\borques? nobles?\b/],
  ['orcs', /\b(orcs?|orques?)\b/],
  ['hommes-betes', /\b(hommes?|femmes?) betes?\b/],
  ['tribus-primales', /\btribus? primales?\b/],
  ['naga-marines', /\bnagas?\b/],
  ['sirenes', /\bsirenes?\b/],
  ['nains', /\bnaine?s?\b/],
  ['geantes', /\bgeante?s?\b/],
  ['sultanats', /\bsultanats?\b/],
  ['humains', /\bhumaine?s?\b/],
];

export interface RacePnj {
  race: RaceElyndor;
  /** « Homme », « Femme » ou « Autre », comme à la création du personnage. */
  sexe: 'Homme' | 'Femme' | 'Autre';
}

function compter(texte: string, motif: RegExp): number {
  return texte.match(motif)?.length ?? 0;
}

export function detecterRacePnj(titre: string, contenu: string): RacePnj | null {
  const texte = ` ${normaliser(`${titre} ${contenu}`)} `;
  // La race du personnage est la première citée (« Humaine qui traque les
  // elfes noirs » est humaine) ; à position égale, la plus précise l'emporte.
  const trouvee = MOTIFS_RACE
    .map(([id, motif], rang) => ({ id, rang, position: texte.search(motif) }))
    .filter((m) => m.position >= 0)
    .sort((a, b) => a.position - b.position || a.rang - b.rang)[0];
  const race = trouvee && RACES_ELYNDOR.find((r) => r.id === trouvee.id);
  if (!race) return null;
  const feminin = compter(texte, /\b(elle|femme|fille|guerriere|noire|naine|geante|humaine|haute|reine|princesse|pretresse|valkyries?|amazones?|sirenes?)\b/g);
  const masculin = compter(texte, /\b(il|homme|garcon|guerrier|noir|nain|geant|humain|roi|prince|pretre)\b/g);
  const sexe = feminin > masculin ? 'Femme' : masculin > feminin ? 'Homme' : 'Autre';
  return { race, sexe };
}

/**
 * Traits visibles de chaque race, en anglais, ajoutés tels quels au prompt
 * SDXL : le modèle narratif traduisait le canon à sa façon (« elfe noire » →
 * « black woman » ou « tan skin »). Elfes Noirs : peau ébène validée par
 * l'autrice (essais du 6 octobre), plus sombre que l'ancien « mate à brun
 * sombre ».
 */
const TRAITS_SDXL: Record<string, { traits: string; negatif?: string; referenceFiable: boolean; apparence?: string }> = {
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

export function traitsSdxlRace({ race }: RacePnj): string {
  return TRAITS_SDXL[race.id]?.traits ?? '';
}

export function negatifSdxlRace({ race }: RacePnj): string {
  return TRAITS_SDXL[race.id]?.negatif ?? '';
}

/** Faux tant que le portrait prédéfini de la race ne correspond pas au canon visé. */
export function referenceRaceFiable({ race }: RacePnj): boolean {
  return TRAITS_SDXL[race.id]?.referenceFiable ?? true;
}

/** Rappel du canon de la race pour le prompt image. */
export function canonRace(r: RacePnj): string {
  const traits = traitsSdxlRace(r);
  const description = TRAITS_SDXL[r.race.id]?.apparence ?? r.race.description;
  return `Race (canon Elyndor) : ${r.race.nom} (${r.race.sousTitre}) — ${description}`
    + (traits ? ` Traits image à reprendre tels quels en anglais dans le prompt : ${traits}.` : '');
}
