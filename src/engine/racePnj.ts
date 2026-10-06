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
  const trouvee = MOTIFS_RACE.find(([, motif]) => motif.test(texte));
  const race = trouvee && RACES_ELYNDOR.find((r) => r.id === trouvee[0]);
  if (!race) return null;
  const feminin = compter(texte, /\b(elle|femme|fille|jeune femme|guerriere|noire|naine|geante|humaine|reine|princesse|pretresse|esclave elle)\b/g);
  const masculin = compter(texte, /\b(il|homme|garcon|guerrier|noir|nain|geant|humain|roi|prince|pretre)\b/g);
  const sexe = feminin > masculin ? 'Femme' : masculin > feminin ? 'Homme' : 'Autre';
  return { race, sexe };
}

/** Rappel du canon de la race pour le prompt image. */
export function canonRace({ race }: RacePnj): string {
  return `Race (canon Elyndor) : ${race.nom} (${race.sousTitre}) — ${race.description}`;
}
