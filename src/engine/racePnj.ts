import { monde, paquetMonde } from '../mondes';
import type { RaceMonde, VisuelRace } from '../mondes/types';

// Race et sexe d'un PNJ déduits de sa fiche, pour lui donner le portrait
// prédéfini de sa race comme référence visuelle et rappeler le canon au
// modèle image. Les races, leurs motifs de reconnaissance et leurs traits
// visibles viennent du module races du paquet monde : sans module, aucune
// race n'est déduite.

function normaliser(texte: string): string {
  return texte
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ');
}

export interface RacePnj {
  race: RaceMonde;
  /** « Homme », « Femme » ou « Autre », comme à la création du personnage. */
  sexe: 'Homme' | 'Femme' | 'Autre';
  /** Monde dont la race est tirée (traits visuels, nom du canon). */
  mondeId: string;
}

function compter(texte: string, motif: RegExp): number {
  return texte.match(motif)?.length ?? 0;
}

/** Race d'identifiant connu (création du personnage) ; null si le monde n'a pas cette race. */
export function racePnjDepuisId(raceId: string | undefined, sexe: string | undefined, mondeId: string = monde.actifId()): RacePnj | null {
  const race = paquetMonde(mondeId).modules?.races?.liste.find((r) => r.id === raceId);
  if (!race) return null;
  return { race, sexe: sexe === 'Homme' || sexe === 'Femme' ? sexe : 'Autre', mondeId: paquetMonde(mondeId).id };
}

export function detecterRacePnj(titre: string, contenu: string, mondeId: string = monde.actifId()): RacePnj | null {
  const paquet = paquetMonde(mondeId);
  const module = paquet.modules?.races;
  if (!module?.detection?.length) return null;
  const texte = ` ${normaliser(`${titre} ${contenu}`)} `;
  // La race du personnage est la première citée (« Humaine qui traque les
  // elfes noirs » est humaine) ; à position égale, la plus précise l'emporte.
  const trouvee = module.detection
    .map(({ race, motif }, rang) => ({ id: race, rang, position: texte.search(motif) }))
    .filter((m) => m.position >= 0)
    .sort((a, b) => a.position - b.position || a.rang - b.rang)[0];
  const race = trouvee && module.liste.find((r) => r.id === trouvee.id);
  if (!race) return null;
  const feminin = compter(texte, /\b(elle|femme|fille|guerriere|noire|naine|geante|humaine|haute|reine|princesse|pretresse|valkyries?|amazones?|sirenes?)\b/g);
  const masculin = compter(texte, /\b(il|homme|garcon|guerrier|noir|nain|geant|humain|roi|prince|pretre)\b/g);
  const sexe = feminin > masculin ? 'Femme' : masculin > feminin ? 'Homme' : 'Autre';
  return { race, sexe, mondeId: paquet.id };
}

function visuel({ race, mondeId }: RacePnj): VisuelRace | undefined {
  return paquetMonde(mondeId).modules?.races?.visuels?.[race.id];
}

export function traitsVisuelsRace(r: RacePnj): string {
  return visuel(r)?.traits ?? '';
}

export function negatifVisuelRace(r: RacePnj): string {
  return visuel(r)?.negatif ?? '';
}

/** Faux tant que le portrait prédéfini de la race ne correspond pas au canon visé. */
export function referenceRaceFiable(r: RacePnj): boolean {
  return visuel(r)?.referenceFiable ?? true;
}

/** Rappel du canon de la race pour le prompt image. */
export function canonRace(r: RacePnj): string {
  const traits = traitsVisuelsRace(r);
  const description = visuel(r)?.apparence ?? r.race.description;
  return `Race (canon ${paquetMonde(r.mondeId).carte.nom}) : ${r.race.nom} (${r.race.sousTitre}) — ${description}`
    + (traits ? ` Traits visibles à reprendre tels quels en anglais dans les mots-clés : ${traits}.` : '');
}
