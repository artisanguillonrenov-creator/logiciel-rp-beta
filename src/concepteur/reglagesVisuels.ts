/**
 * Presets visuels de l'atelier : surcouche locale, jamais un changement de modèle
 * ni une promesse que le GPU a chargé un nouveau LoRA.
 */
export type PresetVisuel = 'elyndor' | 'equilibre' | 'nerveux';
/** Cadrage des illustrations uniquement : les portraits PNJ/joueur restent en 3:4. */
export type CadrageIllustration = 'automatique' | 'moyen' | 'large' | 'ensemble';
export type PrioriteIllustration = 'equilibree' | 'decor' | 'action';
const CADRAGES: readonly CadrageIllustration[] = ['automatique', 'moyen', 'large', 'ensemble'];
const PRIORITES: readonly PrioriteIllustration[] = ['equilibree', 'decor', 'action'];
export interface ReglagesVisuels {
  schema: 1;
  preset: PresetVisuel;
  intensite: number;
  negatifAdditionnel: string;
  cadrageIllustration: CadrageIllustration;
  prioriteIllustration: PrioriteIllustration;
  eviterPortraitScene: boolean;
  referencesPersonnagesScene: boolean;
}
export const REGLAGES_VISUELS_INITIAUX: Readonly<ReglagesVisuels> =
  Object.freeze({
    schema: 1, preset: 'elyndor', intensite: 1, negatifAdditionnel: '',
    cadrageIllustration: 'large', prioriteIllustration: 'decor',
    eviterPortraitScene: true, referencesPersonnagesScene: false,
  });
const PRESETS: readonly PresetVisuel[] = ['elyndor','equilibre','nerveux'];
export function validerReglagesVisuels(value: unknown): ReglagesVisuels {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Configuration visuelle invalide.');
  const v = value as Partial<ReglagesVisuels>;
  if (v.schema !== 1 || !PRESETS.includes(v.preset as PresetVisuel) ||
    typeof v.intensite !== 'number' || !Number.isFinite(v.intensite) ||
    v.intensite < 0.7 || v.intensite > 1.3 ||
    typeof v.negatifAdditionnel !== 'string' || v.negatifAdditionnel.length > 350 ||
    (v.cadrageIllustration !== undefined && !CADRAGES.includes(v.cadrageIllustration)) ||
    (v.prioriteIllustration !== undefined && !PRIORITES.includes(v.prioriteIllustration)) ||
    (v.eviterPortraitScene !== undefined && typeof v.eviterPortraitScene !== 'boolean') ||
    (v.referencesPersonnagesScene !== undefined && typeof v.referencesPersonnagesScene !== 'boolean')) {
    throw Error('Paramètres visuels hors limites : aucune modification appliquée.');
  }
  // Les anciennes configurations visuelles V1 n'ont pas ces champs.
  // Les charger sans effacer les préférences déjà enregistrées sur la tablette.
  return {
    schema: 1, preset: v.preset as PresetVisuel,
    intensite: Number(v.intensite.toFixed(2)),
    negatifAdditionnel: v.negatifAdditionnel.replace(/[\r\n\t]+/g, ', ').trim(),
    cadrageIllustration: v.cadrageIllustration ?? REGLAGES_VISUELS_INITIAUX.cadrageIllustration,
    prioriteIllustration: v.prioriteIllustration ?? REGLAGES_VISUELS_INITIAUX.prioriteIllustration,
    eviterPortraitScene: v.eviterPortraitScene ?? REGLAGES_VISUELS_INITIAUX.eviterPortraitScene,
    referencesPersonnagesScene: v.referencesPersonnagesScene ?? REGLAGES_VISUELS_INITIAUX.referencesPersonnagesScene,
  };
}
const borner = (v: number) => Math.max(0, Math.min(1.5, Number(v.toFixed(2))));
export function appliquerPresetVisuel(modulesOrigine: Readonly<Record<string,number>>, c: ReglagesVisuels): Record<string,number> {
  const v = validerReglagesVisuels(c);
  const modules = { ...modulesOrigine };
  const style = v.preset === 'equilibre' ? 0.7 : v.preset === 'nerveux' ? 1.25 : 1;
  if (typeof modules.elyndor === 'number') modules.elyndor = borner(modules.elyndor * v.intensite);
  if (typeof modules.tarantino === 'number') modules.tarantino = borner(modules.tarantino * style * v.intensite);
  if (typeof modules.cinema === 'number') modules.cinema = borner(modules.cinema * style);
  if (typeof modules.grain === 'number') modules.grain = borner(modules.grain * (v.preset === 'equilibre' ? 0.7 : 1));
  return modules;
}
export function enrichirNegatifVisuel(negatifDeBase: string, c: ReglagesVisuels): string {
  const v = validerReglagesVisuels(c);
  return [negatifDeBase, v.negatifAdditionnel].filter(Boolean).join(', ');
}
