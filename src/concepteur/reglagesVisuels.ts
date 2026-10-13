/**
 * Réglages de l'Atelier visuel V3 : UNE seule configuration pour toutes les
 * images (scènes, portraits, aperçus, futures images de lore). L'identité
 * artistique est unique ; seuls les paramètres TECHNIQUES (dimensions, pas,
 * guidance, graine, modules, précisions de format) peuvent différer entre le
 * format scène (16:9) et le format portrait (3:4).
 *
 * Aucun nom de modèle d'image ni syntaxe propre à un générateur ici : les
 * adaptateurs de fournisseurs traduisent la requête selon leurs capacités.
 */
export type CadrageIllustration = 'automatique' | 'moyen' | 'large' | 'ensemble';
export type PrioriteIllustration = 'equilibree' | 'decor' | 'action';
export type TailleScene = '1024x576' | '1344x768' | '1536x864';
export type TaillePortrait = '768x1024' | '896x1152' | '960x1280';
export type FormatSujet = 'scene' | 'portrait';

export const CADRAGES: readonly CadrageIllustration[] = ['automatique', 'moyen', 'large', 'ensemble'];
export const PRIORITES: readonly PrioriteIllustration[] = ['equilibree', 'decor', 'action'];
export const TAILLES_SCENE: readonly TailleScene[] = ['1024x576', '1344x768', '1536x864'];
export const TAILLES_PORTRAIT: readonly TaillePortrait[] = ['768x1024', '896x1152', '960x1280'];

export const SCHEMA_REGLAGES_VISUELS = 3 as const;

/** Identité artistique globale : la seule source du style de toutes les images. */
export interface IdentiteArtistique {
  nom: string;
  /** Mots-clés de style ajoutés par l'application à chaque prompt (anglais, séparés par des virgules). */
  motsCles: string;
  description: string;
}

export const STYLE_PAR_DEFAUT: Readonly<IdentiteArtistique> = Object.freeze({
  nom: 'Cinéma façon Quentin Tarantino',
  motsCles: 'cinematic film still, Quentin Tarantino style cinematography, bold framing, expressive composition, strong foreground, deep depth of field, high contrast, rich saturated colors, warm color grading, 35mm film grain, dramatic motivated lighting',
  description: 'Cadrages audacieux, compositions très lisibles, énergie de cinéma, contrastes, grain de pellicule, profondeur et éclairage expressif adapté à la scène — sans imiter un film, un plan ou un personnage précis.',
});

/** Exclusions de cohérence et d'anatomie proposées par défaut ; visibles et modifiables dans l'Atelier. */
export const NEGATIF_GLOBAL_PAR_DEFAUT = 'text, logo, watermark, signature, duplicated character, merged characters, extra limbs, malformed hands, deformed face, bad anatomy, floating objects';

export interface ReglagesTechniquesFormat {
  pas: number | null;
  guidance: number | null;
  graine: number | null;
  /** Modules (LoRA…) propres à ce format ; envoyés seulement si le générateur les accepte. */
  modules: Record<string, number>;
  /** Précisions techniques propres au format (jamais un second style). */
  positif: string;
  negatif: string;
}

export interface ReglagesScene extends ReglagesTechniquesFormat { taille: TailleScene }
export interface ReglagesPortrait extends ReglagesTechniquesFormat {
  taille: TaillePortrait;
  /** Poids de la référence de race pour les portraits (si le générateur sait le régler). */
  poidsReferenceRace: number | null;
}

export interface ReferencesActivees {
  /** Avatars/portraits des personnages visibles dans les scènes. */
  personnages: boolean;
  /** Portraits prédéfinis des races (allure, carnation). */
  races: boolean;
  /** Images rattachées aux fiches du lorebook (lieux, bâtiments, objets). */
  lieux: boolean;
  /** Scène illustrée précédente, seulement si elle se passe au même lieu. */
  scenePrecedente: boolean;
}

/** Ancienne configuration conservée telle quelle pour récupération. */
export interface ArchiveMigrationVisuelle {
  depuisSchema: number;
  date: number;
  valeurs: Record<string, unknown>;
  notes: string[];
}

export interface ReglagesVisuels {
  schema: typeof SCHEMA_REGLAGES_VISUELS;
  /** Date de la dernière modification (trace de diagnostic). */
  majLe: number;
  style: IdentiteArtistique;
  /** 0,7 à 1,3 : part des mots-clés de style ajoutés (sobre → appuyé). */
  intensite: number;
  /** Consigne universelle d'extraction des mots-clés par le narrateur ; null = consigne d'origine. */
  consigneExtraction: string | null;
  positif: string;
  negatif: string;
  cadrageIllustration: CadrageIllustration;
  prioriteIllustration: PrioriteIllustration;
  eviterPortraitScene: boolean;
  references: ReferencesActivees;
  /** Modules communs à tous les formats ; aucun par défaut. */
  modules: Record<string, number>;
  scene: ReglagesScene;
  portrait: ReglagesPortrait;
  archives: ArchiveMigrationVisuelle[];
}

const TECHNIQUE_VIDE: ReglagesTechniquesFormat = { pas: null, guidance: null, graine: null, modules: {}, positif: '', negatif: '' };

export const REGLAGES_VISUELS_INITIAUX: Readonly<ReglagesVisuels> = Object.freeze({
  schema: SCHEMA_REGLAGES_VISUELS,
  majLe: 0,
  style: { ...STYLE_PAR_DEFAUT },
  intensite: 1,
  consigneExtraction: null,
  positif: '',
  negatif: NEGATIF_GLOBAL_PAR_DEFAUT,
  cadrageIllustration: 'large',
  prioriteIllustration: 'decor',
  eviterPortraitScene: true,
  references: { personnages: false, races: true, lieux: true, scenePrecedente: true },
  modules: {},
  scene: { ...TECHNIQUE_VIDE, taille: '1344x768' },
  portrait: { ...TECHNIQUE_VIDE, taille: '896x1152', poidsReferenceRace: null },
  archives: [],
}) as Readonly<ReglagesVisuels>;

export function reglagesVisuelsInitiaux(): ReglagesVisuels {
  return JSON.parse(JSON.stringify(REGLAGES_VISUELS_INITIAUX));
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const estObjet = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const nombreOptionnel = (n: unknown, min: number, max: number) =>
  n === null || (typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max);
const texteBorne = (t: unknown, max: number) => typeof t === 'string' && t.length <= max;

function modulesValides(m: unknown): m is Record<string, number> {
  return estObjet(m)
    && Object.entries(m).length <= 40
    && Object.entries(m).every(([nom, poids]) =>
      /^[a-z0-9_-]{1,40}$/i.test(nom) && typeof poids === 'number' && Number.isFinite(poids) && poids >= 0 && poids <= 1.5);
}

function erreur(): never {
  throw Error('Paramètres visuels hors limites : aucune modification appliquée.');
}

function nettoyerListe(texte: string): string {
  return texte.replace(/[\r\n\t]+/g, ', ').replace(/\s+/g, ' ').trim();
}

function validerTechnique(x: unknown, tailles: readonly string[]): ReglagesTechniquesFormat & { taille: string } {
  if (!estObjet(x)) erreur();
  if (!tailles.includes(x.taille as string)
    || !nombreOptionnel(x.pas, 1, 80) || !nombreOptionnel(x.guidance, 0.1, 20)
    || !nombreOptionnel(x.graine, 0, 2147483647) || !modulesValides(x.modules)
    || !texteBorne(x.positif, 500) || !texteBorne(x.negatif, 500)) erreur();
  return {
    taille: x.taille as string,
    pas: (x.pas as number | null), guidance: (x.guidance as number | null), graine: (x.graine as number | null),
    modules: { ...(x.modules as Record<string, number>) },
    positif: nettoyerListe(x.positif as string), negatif: nettoyerListe(x.negatif as string),
  };
}

function validerArchives(x: unknown): ArchiveMigrationVisuelle[] {
  if (!Array.isArray(x) || x.length > 10) erreur();
  return x.map((a) => {
    if (!estObjet(a) || typeof a.depuisSchema !== 'number' || typeof a.date !== 'number' || !estObjet(a.valeurs)
      || !Array.isArray(a.notes) || a.notes.some((n) => typeof n !== 'string')) erreur();
    return { depuisSchema: a.depuisSchema, date: a.date, valeurs: { ...a.valeurs }, notes: [...(a.notes as string[])] };
  });
}

/** Valide une configuration V3 complète ; refuse toute valeur hors limites. */
export function validerReglagesVisuels(value: unknown): ReglagesVisuels {
  if (!estObjet(value) || value.schema !== SCHEMA_REGLAGES_VISUELS) erreur();
  const v = value;
  const style = v.style;
  const refs = v.references;
  const portrait = v.portrait;
  if (!estObjet(style) || !texteBorne(style.nom, 80) || !texteBorne(style.motsCles, 600) || !texteBorne(style.description, 600)
    || !String(style.nom).trim() || !String(style.motsCles).trim()) erreur();
  if (typeof v.intensite !== 'number' || !Number.isFinite(v.intensite) || v.intensite < 0.7 || v.intensite > 1.3) erreur();
  if (v.consigneExtraction !== null && !texteBorne(v.consigneExtraction, 8000)) erreur();
  if (!texteBorne(v.positif, 500) || !texteBorne(v.negatif, 700)) erreur();
  if (!CADRAGES.includes(v.cadrageIllustration as CadrageIllustration)
    || !PRIORITES.includes(v.prioriteIllustration as PrioriteIllustration)
    || typeof v.eviterPortraitScene !== 'boolean') erreur();
  if (!estObjet(refs) || ['personnages', 'races', 'lieux', 'scenePrecedente'].some((k) => typeof refs[k] !== 'boolean')) erreur();
  if (!modulesValides(v.modules)) erreur();
  if (!estObjet(portrait) || !nombreOptionnel(portrait.poidsReferenceRace, 0, 1.5)) erreur();
  return {
    schema: SCHEMA_REGLAGES_VISUELS,
    majLe: typeof v.majLe === 'number' && Number.isFinite(v.majLe) ? v.majLe : 0,
    style: { nom: String(style.nom).trim(), motsCles: nettoyerListe(String(style.motsCles)), description: String(style.description).trim() },
    intensite: Number(v.intensite.toFixed(2)),
    consigneExtraction: typeof v.consigneExtraction === 'string' && v.consigneExtraction.trim() ? v.consigneExtraction.trim() : null,
    positif: nettoyerListe(v.positif as string),
    negatif: nettoyerListe(v.negatif as string),
    cadrageIllustration: v.cadrageIllustration as CadrageIllustration,
    prioriteIllustration: v.prioriteIllustration as PrioriteIllustration,
    eviterPortraitScene: v.eviterPortraitScene as boolean,
    references: {
      personnages: refs.personnages as boolean, races: refs.races as boolean,
      lieux: refs.lieux as boolean, scenePrecedente: refs.scenePrecedente as boolean,
    },
    modules: { ...(v.modules as Record<string, number>) },
    scene: validerTechnique(v.scene, TAILLES_SCENE) as ReglagesScene,
    portrait: {
      ...(validerTechnique(portrait, TAILLES_PORTRAIT) as ReglagesPortrait),
      poidsReferenceRace: portrait.poidsReferenceRace as number | null,
    },
    archives: validerArchives(v.archives ?? []),
  };
}

// ---------------------------------------------------------------------------
// Migration depuis la configuration V1/V2 (clé visuel-v1, schema: 1)
// ---------------------------------------------------------------------------

/** Modules envoyés implicitement par l'ancienne version ; conservés en archive seulement. */
export const MODULES_IMPLICITES_HISTORIQUES: Readonly<Record<string, number>> = Object.freeze({
  peau: 0.4, peau2: 0.3, details: 0.5, mains: 0.5, elyndor: 1.2, tarantino: 0.35,
});

/** Exclusions qu'appliquait l'ancienne version sans les afficher (traduites et rendues visibles). */
const NEGATIF_IMPLICITE_HISTORIQUE = NEGATIF_GLOBAL_PAR_DEFAUT;

interface AncienReglage {
  schema?: unknown;
  preset?: unknown;
  intensite?: unknown;
  negatifAdditionnel?: unknown;
  cadrageIllustration?: unknown;
  prioriteIllustration?: unknown;
  eviterPortraitScene?: unknown;
  referencesPersonnagesScene?: unknown;
  referencesScenePrecedente?: unknown;
  tailleScene?: unknown;
  taillePortrait?: unknown;
  pasScene?: unknown; pasPortrait?: unknown;
  guidanceScene?: unknown; guidancePortrait?: unknown;
  graineScene?: unknown; grainePortrait?: unknown;
  poidsReferenceRacePortrait?: unknown;
  modulesScene?: unknown; modulesPortrait?: unknown;
  positifScene?: unknown; negatifScene?: unknown; positifPortrait?: unknown; negatifPortrait?: unknown;
  consigneNarrateurScene?: unknown; consigneNarrateurPortrait?: unknown;
}

function elements(texte: unknown): string[] {
  return typeof texte === 'string'
    ? texte.split(/[,\n]/).map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean)
    : [];
}

const cleElement = (x: string) => x.toLowerCase();

/**
 * Sépare deux listes de mots-clés (scène / portrait) : ce qui est commun part
 * dans le champ global, le reste devient une précision du format concerné.
 */
export function repartirElements(scene: unknown, portrait: unknown): { commun: string[]; scene: string[]; portrait: string[] } {
  const a = elements(scene);
  const b = elements(portrait);
  const cleB = new Set(b.map(cleElement));
  const cleA = new Set(a.map(cleElement));
  return {
    commun: a.filter((x) => cleB.has(cleElement(x))),
    scene: a.filter((x) => !cleB.has(cleElement(x))),
    portrait: b.filter((x) => !cleA.has(cleElement(x))),
  };
}

function fusionnerListes(...listes: string[][]): string {
  const vus = new Set<string>();
  const sortie: string[] = [];
  for (const x of listes.flat()) {
    const cle = cleElement(x);
    if (vus.has(cle)) continue;
    vus.add(cle);
    sortie.push(x);
  }
  return sortie.join(', ');
}

const choisir = <T,>(valeur: unknown, possibles: readonly T[], defaut: T): T =>
  possibles.includes(valeur as T) ? (valeur as T) : defaut;
const nombreOuNull = (n: unknown, min: number, max: number): number | null =>
  typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max ? n : null;
const modulesOuVide = (m: unknown): Record<string, number> => (modulesValides(m) ? { ...m } : {});
const borne = (t: string, max: number) => (t.length <= max ? t : t.slice(0, max).replace(/,[^,]*$/, ''));

export interface ResultatMigrationVisuelle {
  reglages: ReglagesVisuels;
  migre: boolean;
  notes: string[];
}

/**
 * Migration idempotente vers le schéma V3. Une configuration V3 est seulement
 * validée ; une ancienne configuration est convertie sans rien perdre : toutes
 * ses valeurs restent dans `archives` et chaque choix est expliqué en note.
 */
export function migrerReglagesVisuels(brut: unknown, maintenant = Date.now()): ResultatMigrationVisuelle {
  if (estObjet(brut) && brut.schema === SCHEMA_REGLAGES_VISUELS) {
    return { reglages: validerReglagesVisuels(brut), migre: false, notes: [] };
  }
  if (!estObjet(brut)) throw Error('Configuration visuelle illisible.');
  const v = brut as AncienReglage;
  const notes: string[] = [];
  const base = reglagesVisuelsInitiaux();

  const positifs = repartirElements(v.positifScene, v.positifPortrait);
  const negatifs = repartirElements(v.negatifScene, v.negatifPortrait);
  if (elements(v.positifScene).length && elements(v.positifPortrait).length && (positifs.scene.length || positifs.portrait.length)) {
    notes.push('Prompts positifs scène et portrait différents : la partie commune devient le positif global, le reste reste une précision de format.');
  }
  if (elements(v.negatifScene).length && elements(v.negatifPortrait).length && (negatifs.scene.length || negatifs.portrait.length)) {
    notes.push('Prompts négatifs scène et portrait différents : la partie commune devient le négatif global, le reste reste une précision de format.');
  }
  if (typeof v.consigneNarrateurScene === 'string' && v.consigneNarrateurScene.trim()) {
    notes.push('Consigne narrateur « scènes » personnalisée archivée : elle n’est plus utilisée (une seule consigne d’extraction pour toutes les images).');
  }
  if (typeof v.consigneNarrateurPortrait === 'string' && v.consigneNarrateurPortrait.trim()) {
    notes.push('Consigne narrateur « portraits » personnalisée archivée : elle n’est plus utilisée.');
  }
  if (v.preset !== undefined && v.preset !== 'elyndor') {
    notes.push(`Préréglage « ${String(v.preset)} » archivé : il modulait des modules propres à un générateur, sans équivalent universel.`);
  }
  notes.push('Les modules envoyés implicitement par l’ancienne version (peau, peau2, details, mains, elyndor, tarantino) ne le sont plus ; à réactiver dans les paramètres techniques si le générateur les possède.');
  notes.push('Les exclusions qu’ajoutait l’ancienne version sans les afficher sont désormais visibles dans le négatif global.');

  const intensite = typeof v.intensite === 'number' && Number.isFinite(v.intensite) && v.intensite >= 0.7 && v.intensite <= 1.3
    ? Number(v.intensite.toFixed(2)) : 1;

  const reglages: ReglagesVisuels = {
    ...base,
    majLe: maintenant,
    intensite,
    positif: borne(fusionnerListes(positifs.commun), 500),
    negatif: borne(fusionnerListes(elements(NEGATIF_IMPLICITE_HISTORIQUE), negatifs.commun, elements(v.negatifAdditionnel)), 700),
    cadrageIllustration: choisir(v.cadrageIllustration, CADRAGES, base.cadrageIllustration),
    prioriteIllustration: choisir(v.prioriteIllustration, PRIORITES, base.prioriteIllustration),
    eviterPortraitScene: typeof v.eviterPortraitScene === 'boolean' ? v.eviterPortraitScene : base.eviterPortraitScene,
    references: {
      ...base.references,
      personnages: typeof v.referencesPersonnagesScene === 'boolean' ? v.referencesPersonnagesScene : base.references.personnages,
      scenePrecedente: typeof v.referencesScenePrecedente === 'boolean' ? v.referencesScenePrecedente : base.references.scenePrecedente,
    },
    modules: {},
    scene: {
      taille: choisir(v.tailleScene, TAILLES_SCENE, base.scene.taille),
      pas: nombreOuNull(v.pasScene, 1, 80),
      guidance: nombreOuNull(v.guidanceScene, 0.1, 20),
      graine: nombreOuNull(v.graineScene, 0, 2147483647),
      modules: modulesOuVide(v.modulesScene),
      positif: borne(fusionnerListes(positifs.scene), 500),
      negatif: borne(fusionnerListes(negatifs.scene), 500),
    },
    portrait: {
      taille: choisir(v.taillePortrait, TAILLES_PORTRAIT, base.portrait.taille),
      pas: nombreOuNull(v.pasPortrait, 1, 80),
      guidance: nombreOuNull(v.guidancePortrait, 0.1, 20),
      graine: nombreOuNull(v.grainePortrait, 0, 2147483647),
      modules: modulesOuVide(v.modulesPortrait),
      positif: borne(fusionnerListes(positifs.portrait), 500),
      negatif: borne(fusionnerListes(negatifs.portrait), 500),
      poidsReferenceRace: nombreOuNull(v.poidsReferenceRacePortrait, 0, 1.5),
    },
    archives: [{
      depuisSchema: typeof v.schema === 'number' ? v.schema : 1,
      date: maintenant,
      valeurs: { ...(brut as Record<string, unknown>), modulesImplicites: { ...MODULES_IMPLICITES_HISTORIQUES } },
      notes,
    }],
  };
  return { reglages: validerReglagesVisuels(reglages), migre: true, notes };
}

/** Restaure seulement l'identité artistique ; tout le reste est conservé. */
export function restaurerStyleParDefaut(v: ReglagesVisuels): ReglagesVisuels {
  return { ...v, style: { ...STYLE_PAR_DEFAUT }, intensite: 1 };
}

/** Textes des anciennes consignes narrateur archivées (section de récupération). */
export function anciennesConsignesArchivees(v: ReglagesVisuels): Array<{ titre: string; texte: string }> {
  const sortie: Array<{ titre: string; texte: string }> = [];
  for (const archive of v.archives) {
    for (const [cle, titre] of [['consigneNarrateurScene', 'Ancienne consigne « scènes »'], ['consigneNarrateurPortrait', 'Ancienne consigne « portraits »']] as const) {
      const texte = archive.valeurs[cle];
      if (typeof texte === 'string' && texte.trim()) sortie.push({ titre, texte });
    }
  }
  return sortie;
}

/**
 * Mots-clés de style selon l'intensité : sobre (≈ la moitié, les plus
 * importants en tête), normal (tous), appuyé (tous, renforcés).
 */
export function motsClesStyle(v: Pick<ReglagesVisuels, 'style' | 'intensite'>): string[] {
  const mots = elements(v.style.motsCles);
  if (v.intensite < 0.85) return mots.slice(0, Math.max(1, Math.ceil(mots.length / 2)));
  if (v.intensite > 1.15) return [...mots, 'strongly stylized'];
  return mots;
}

export function reglagesFormat(v: ReglagesVisuels, format: FormatSujet): ReglagesScene | ReglagesPortrait {
  return format === 'scene' ? v.scene : v.portrait;
}

/** Modules effectivement demandés pour un format : communs puis ceux du format. */
export function modulesPourFormat(v: ReglagesVisuels, format: FormatSujet): Record<string, number> {
  return { ...v.modules, ...reglagesFormat(v, format).modules };
}

export { elements as elementsMotsCles };
