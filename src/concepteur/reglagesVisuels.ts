/**
 * Presets visuels de l'atelier : surcouche locale, jamais un changement de modèle
 * ni une promesse que le GPU a chargé un nouveau LoRA.
 */
export type PresetVisuel = 'elyndor' | 'equilibre' | 'nerveux';
export interface ReglagesVisuels {
  schema: 1;
  preset: PresetVisuel;
  intensite: number;
  negatifAdditionnel: string;
}
export const REGLAGES_VISUELS_INITIAUX: Readonly<ReglagesVisuels> =
  Object.freeze({ schema: 1, preset: 'elyndor', intensite: 1, negatifAdditionnel: '' });
const PRESETS: readonly PresetVisuel[] = ['elyndor','equilibre','nerveux'];
export function validerReglagesVisuels(value: unknown): ReglagesVisuels {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Configuration visuelle invalide.');
  const v = value as Partial<ReglagesVisuels>;
  if (v.schema !== 1 || !PRESETS.includes(v.preset as PresetVisuel) ||
    typeof v.intensite !== 'number' || !Number.isFinite(v.intensite) ||
    v.intensite < 0.7 || v.intensite > 1.3 ||
    typeof v.negatifAdditionnel !== 'string' || v.negatifAdditionnel.length > 350) {
    throw Error('Paramètres visuels hors limites : aucune modification appliquée.');
  }
  // Contrôles et espaces non significatifs dans les poids ou le prompt.
  return { schema: 1, preset: v.preset as PresetVisuel, intensite: Number(v.intensite.toFixed(2)),
    negatifAdditionnel: v.negatifAdditionnel.replace(/[\r\n\t]+/g, ', ').trim() };
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
