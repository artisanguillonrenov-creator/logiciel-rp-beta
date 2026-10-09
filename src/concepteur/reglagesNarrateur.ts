/** Paramètres réellement transmis au llama-server Elyndor (llama.cpp).
 * Top-A, TFS, smoothing, repeat-slope, eta/epsilon cutoff non garantis sur
 * le llama.cpp actuel : ne pas offrir de curseurs muets.
 */
import type { Longueur, StorySettings } from '../types';
import { defautsAventure, stylesNarratifsDefaut, validerDefautsAventure, validerStylesNarratifs, type StylesNarratifs } from './interpretationNarrative';

export const SAMPLERS_LLAMA_CPP = {
  top_p: { nom: 'Top-P', groupe: 'Distribution', min: 0, max: 1, pas: 0.01, defaut: 0.95 },
  top_k: { nom: 'Top-K', groupe: 'Distribution', min: 0, max: 200, pas: 1, defaut: 40 },
  min_p: { nom: 'Min-P', groupe: 'Distribution', min: 0, max: 0.5, pas: 0.01, defaut: 0.05 },
  typical_p: { nom: 'Typical-P', groupe: 'Distribution', min: 0, max: 1, pas: 0.01, defaut: 1 },
  repeat_penalty: { nom: 'Repetition Penalty', groupe: 'Répétitions', min: 1, max: 2, pas: 0.01, defaut: 1.05 },
  repeat_last_n: { nom: 'Repetition Range', groupe: 'Répétitions', min: 0, max: 2048, pas: 32, defaut: 512 },
  frequency_penalty: { nom: 'Frequency Penalty', groupe: 'Répétitions', min: -2, max: 2, pas: 0.05, defaut: 0 },
  presence_penalty: { nom: 'Presence Penalty', groupe: 'Répétitions', min: -2, max: 2, pas: 0.05, defaut: 0 },
  dry_multiplier: { nom: 'DRY Multiplier', groupe: 'DRY', min: 0, max: 3, pas: 0.05, defaut: 0.8 },
  dry_base: { nom: 'DRY Base', groupe: 'DRY', min: 1, max: 3, pas: 0.05, defaut: 1.75 },
  dry_allowed_length: { nom: 'DRY Allowed Length', groupe: 'DRY', min: 1, max: 12, pas: 1, defaut: 2 },
  dry_penalty_last_n: { nom: 'DRY Range', groupe: 'DRY', min: 0, max: 4096, pas: 64, defaut: 2048 },
  xtc_probability: { nom: 'XTC Probability', groupe: 'Expert', min: 0, max: 1, pas: 0.01, defaut: 0 },
  xtc_threshold: { nom: 'XTC Threshold', groupe: 'Expert', min: 0, max: 1, pas: 0.01, defaut: 0.1 },
  dynatemp_range: { nom: 'Dynamic Temperature Range', groupe: 'Expert', min: 0, max: 1, pas: 0.05, defaut: 0 },
  dynatemp_exponent: { nom: 'Dynamic Temperature Exponent', groupe: 'Expert', min: 0.1, max: 4, pas: 0.1, defaut: 1 },
  mirostat: { nom: 'Mirostat (0/1/2)', groupe: 'Expert', min: 0, max: 2, pas: 1, defaut: 0 },
  mirostat_tau: { nom: 'Mirostat Tau', groupe: 'Expert', min: 1, max: 10, pas: 0.25, defaut: 5 },
  mirostat_eta: { nom: 'Mirostat Eta', groupe: 'Expert', min: 0.01, max: 1, pas: 0.01, defaut: 0.1 },
} as const;
export type CleSampler = keyof typeof SAMPLERS_LLAMA_CPP;
export const CLES_SAMPLERS = Object.keys(SAMPLERS_LLAMA_CPP) as CleSampler[];
export type ValeursSamplers = Record<CleSampler, number>;
export type PlageLongueur = { min: number; max: number };
export type PlagesLongueur = Record<Longueur, PlageLongueur>;
export interface ReglagesNarrateur {
  samplersActifs: boolean;
  samplers: ValeursSamplers;
  /** Sélection par clé, indépendante de sa validation sur le serveur réel. */
  samplersEnvoyes: Record<CleSampler, boolean>;
  longueurs: PlagesLongueur;
  styles: StylesNarratifs;
  aventureDefaut: StorySettings;
}

export function reglagesNarrateurDefaut(): ReglagesNarrateur {
  const samplers = {} as ValeursSamplers;
  for (const cle of CLES_SAMPLERS) samplers[cle] = SAMPLERS_LLAMA_CPP[cle].defaut;
  return { samplersActifs: false, samplers, samplersEnvoyes: Object.fromEntries(CLES_SAMPLERS.map(k => [k, true])) as Record<CleSampler, boolean>, styles: stylesNarratifsDefaut(), aventureDefaut: defautsAventure(), longueurs: {
    courte: { min: 140, max: 160 },
    moyenne: { min: 215, max: 235 },
    longue: { min: 280, max: 320 },
  } };
}
function objet(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
export function validerReglagesNarrateur(raw: unknown): ReglagesNarrateur {
  if (!objet(raw) || typeof raw.samplersActifs !== 'boolean' ||
      !objet(raw.samplers) || !objet(raw.longueurs)) {
    throw new Error('Configuration du narrateur invalide.');
  }
  const samplers = {} as ValeursSamplers;
  for (const cle of CLES_SAMPLERS) {
    const spec = SAMPLERS_LLAMA_CPP[cle];
    const valeur = raw.samplers[cle];
    if (typeof valeur !== 'number' || !Number.isFinite(valeur) ||
        valeur < spec.min || valeur > spec.max ||
        (spec.pas >= 1 && !Number.isInteger(valeur))) {
      throw new Error('Curseur du narrateur invalide : ' + cle);
    }
    samplers[cle] = valeur;
  }
  const samplersEnvoyes = {} as Record<CleSampler, boolean>;
  for (const cle of CLES_SAMPLERS) {
    const selection = objet(raw.samplersEnvoyes) ? raw.samplersEnvoyes[cle] : undefined;
    if (selection !== undefined && typeof selection !== 'boolean') {
      throw new Error('Activation sampler invalide : ' + cle);
    }
    samplersEnvoyes[cle] = selection === undefined ? true : selection;
  }
  const longueurs = {} as PlagesLongueur;
  for (const cle of ['courte', 'moyenne', 'longue'] as Longueur[]) {
    const plage = raw.longueurs[cle];
    if (!objet(plage) || !Number.isSafeInteger(plage.min) || !Number.isSafeInteger(plage.max) ||
        (plage.min as number) < 32 || (plage.max as number) > 1600 ||
        (plage.min as number) >= (plage.max as number)) {
      throw new Error('Fourchette narrative invalide : ' + cle);
    }
    longueurs[cle] = { min: plage.min as number, max: plage.max as number };
  }
  // Anciennes configurations : migrations non destructives, valeurs sûres par défaut.
  const styles = raw.styles === undefined ? stylesNarratifsDefaut() : validerStylesNarratifs(raw.styles);
  const aventureDefaut = raw.aventureDefaut === undefined ? defautsAventure() : validerDefautsAventure(raw.aventureDefaut);
  return { samplersActifs: raw.samplersActifs, samplers, samplersEnvoyes, longueurs, styles, aventureDefaut };
}
/** Retourne exclusivement des clés de l'API chat llama.cpp : aucune clé non supportée n'est inventée. */
export function samplersPourRequete(config: ReglagesNarrateur | undefined): Record<string, number> {
  if (!config?.samplersActifs) return {};
  const valeurs = validerReglagesNarrateur(config).samplers;
  const liste = CLES_SAMPLERS.filter(cle => config.samplersEnvoyes?.[cle] !== false);
  // Mirostat optimise son propre tirage : ne pas fournir aussi les coupes
  // de distribution qui seraient neutralisées ou incompatibles.
  const mirostat = liste.includes('mirostat') ? valeurs.mirostat : 0;
  const incompatibles = new Set<CleSampler>(
    mirostat > 0 ? ['top_k', 'top_p', 'min_p', 'typical_p'] : [],
  );
  return Object.fromEntries(liste.filter(cle => !incompatibles.has(cle)).map(cle => [cle, valeurs[cle]]));
}
export function consigneLongueur(longueur: Longueur, config?: PlagesLongueur): string {
  const plage = config?.[longueur] ?? reglagesNarrateurDefaut().longueurs[longueur];
  const cible = Math.round((plage.min + plage.max) / 2);
  return `Réponse narrative : vise ${cible} tokens, idéalement entre ${plage.min} et ${plage.max} tokens de texte visible (pas des mots). Termine toujours naturellement par une phrase complète. Ne développe pas un nouveau paragraphe quand tu arrives près du maximum. Les données techniques d'état ne comptent pas dans cette longueur.`;
}
