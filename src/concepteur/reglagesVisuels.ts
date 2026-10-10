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
export type TailleScene = '1024x576' | '1344x768' | '1536x864';
export type TaillePortrait = '768x1024' | '896x1152' | '960x1280';
export const NOMS_MODULES_IMAGES = [
  'elyndor', 'tarantino', 'cinema', 'details', 'mains',
  'peau', 'peau2', 'grain', 'horreur', 'kodachrome2',
] as const;
const TAILLES_SCENE: readonly TailleScene[] = ['1024x576', '1344x768', '1536x864'];
const TAILLES_PORTRAIT: readonly TaillePortrait[] = ['768x1024', '896x1152', '960x1280'];
const nombreOptionnel = (n: unknown, min: number, max: number) =>
  n === null || (typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max);
function modulesValides(m: unknown): m is Record<string,number> {
  return m !== null && typeof m === 'object' && !Array.isArray(m)
    && Object.entries(m).length <= 40
    && Object.entries(m).every(([nom,poids]) =>
      /^[a-z0-9_-]{1,40}$/i.test(nom) && typeof poids === 'number'
      && Number.isFinite(poids) && poids >= 0 && poids <= 1.5);
}
/** Tous les modules LoRA présents sur le pod peuvent être ciblés par leur nom. */
export function appliquerModulesVisuels(
  base: Readonly<Record<string,number>>, c: ReglagesVisuels, type: 'scene'|'portrait',
): Record<string,number> {
  const v = validerReglagesVisuels(c);
  return { ...appliquerPresetVisuel(base,v), ...(type === 'scene' ? v.modulesScene : v.modulesPortrait) };
}
export interface ReglagesVisuels {
  schema: 1;
  preset: PresetVisuel;
  intensite: number;
  negatifAdditionnel: string;
  cadrageIllustration: CadrageIllustration;
  prioriteIllustration: PrioriteIllustration;
  eviterPortraitScene: boolean;
  referencesPersonnagesScene: boolean;
  referencesScenePrecedente: boolean;
  tailleScene: TailleScene;
  taillePortrait: TaillePortrait;
  pasScene: number | null;
  pasPortrait: number | null;
  guidanceScene: number | null;
  guidancePortrait: number | null;
  graineScene: number | null;
  grainePortrait: number | null;
  poidsReferenceRacePortrait: number | null;
  modulesScene: Record<string,number>;
  modulesPortrait: Record<string,number>;
  positifScene: string;
  negatifScene: string;
  positifPortrait: string;
  negatifPortrait: string;
}
export const REGLAGES_VISUELS_INITIAUX: Readonly<ReglagesVisuels> =
  Object.freeze({
    schema: 1, preset: 'elyndor', intensite: 1, negatifAdditionnel: '',
    cadrageIllustration: 'large', prioriteIllustration: 'decor',
    eviterPortraitScene: true, referencesPersonnagesScene: false,
    referencesScenePrecedente: true,
    tailleScene: '1344x768', taillePortrait: '896x1152',
    pasScene: null, pasPortrait: null,
    guidanceScene: null, guidancePortrait: null,
    graineScene: null, grainePortrait: null,
    poidsReferenceRacePortrait: null,
    modulesScene: {}, modulesPortrait: {},
    positifScene: '', negatifScene: '', positifPortrait: '', negatifPortrait: '',
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
    (v.referencesPersonnagesScene !== undefined && typeof v.referencesPersonnagesScene !== 'boolean') ||
    (v.referencesScenePrecedente !== undefined && typeof v.referencesScenePrecedente !== 'boolean') ||
    (v.tailleScene !== undefined && !TAILLES_SCENE.includes(v.tailleScene)) ||
    (v.taillePortrait !== undefined && !TAILLES_PORTRAIT.includes(v.taillePortrait)) ||
    (v.pasScene !== undefined && !nombreOptionnel(v.pasScene, 1, 80)) ||
    (v.pasPortrait !== undefined && !nombreOptionnel(v.pasPortrait, 1, 80)) ||
    (v.guidanceScene !== undefined && !nombreOptionnel(v.guidanceScene, 0.1, 20)) ||
    (v.guidancePortrait !== undefined && !nombreOptionnel(v.guidancePortrait, 0.1, 20)) ||
    (v.graineScene !== undefined && !nombreOptionnel(v.graineScene, 0, 2147483647)) ||
    (v.grainePortrait !== undefined && !nombreOptionnel(v.grainePortrait, 0, 2147483647)) ||
    (v.poidsReferenceRacePortrait !== undefined && !nombreOptionnel(v.poidsReferenceRacePortrait, 0, 1.5)) ||
    (v.modulesScene !== undefined && !modulesValides(v.modulesScene)) ||
    (v.modulesPortrait !== undefined && !modulesValides(v.modulesPortrait)) ||
    (v.positifScene !== undefined && (typeof v.positifScene !== 'string' || v.positifScene.length > 500)) ||
    (v.negatifScene !== undefined && (typeof v.negatifScene !== 'string' || v.negatifScene.length > 500)) ||
    (v.positifPortrait !== undefined && (typeof v.positifPortrait !== 'string' || v.positifPortrait.length > 500)) ||
    (v.negatifPortrait !== undefined && (typeof v.negatifPortrait !== 'string' || v.negatifPortrait.length > 500))) {
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
    referencesScenePrecedente: v.referencesScenePrecedente ?? REGLAGES_VISUELS_INITIAUX.referencesScenePrecedente,
    tailleScene: v.tailleScene ?? REGLAGES_VISUELS_INITIAUX.tailleScene,
    taillePortrait: v.taillePortrait ?? REGLAGES_VISUELS_INITIAUX.taillePortrait,
    pasScene: v.pasScene ?? null, pasPortrait: v.pasPortrait ?? null,
    guidanceScene: v.guidanceScene ?? null, guidancePortrait: v.guidancePortrait ?? null,
    graineScene: v.graineScene ?? null, grainePortrait: v.grainePortrait ?? null,
    poidsReferenceRacePortrait: v.poidsReferenceRacePortrait ?? null,
    modulesScene: { ...(v.modulesScene ?? {}) }, modulesPortrait: { ...(v.modulesPortrait ?? {}) },
    positifScene: (v.positifScene ?? '').trim(),
    negatifScene: (v.negatifScene ?? '').trim(),
    positifPortrait: (v.positifPortrait ?? '').trim(),
    negatifPortrait: (v.negatifPortrait ?? '').trim(),
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
