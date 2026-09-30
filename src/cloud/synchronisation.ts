import type { HistoireStockee } from '../storage/storySerialization';

// Synchronisation cloud (reprise de elyndor-cloud.js, V13) — logique pure,
// indépendante de Supabase et du stockage : les deux côtés sont injectés.
//
// Même format de données que la V13 (emplacements « slots ») pour qu'un
// compte partagé entre la version web V13 et l'application reste cohérent :
//   story:<id>   { version: 1, story: HistoireStockee }
//   settings:v1  { version: 1, value, updatedAt }
//   personas:v1  { version: 1, value, updatedAt }
//   manifest:v1  { version: 1, deletedStories: { id: date }, updatedAt }
//
// Principes repris de la V13 :
// - au démarrage (ou à la connexion), seules les dates sont lues ; une
//   histoire n'est téléchargée que si elle est plus récente ailleurs ;
// - ensuite, rien ne part sur le réseau tant que rien n'a changé
//   localement, et une histoire n'est renvoyée que si elle a été modifiée ;
// - les suppressions voyagent par un manifeste de « pierres tombales »
//   fusionné entre appareils : une histoire supprimée ailleurs n'est jamais
//   ressuscitée.

export const SLOT_REGLAGES = 'settings:v1';
export const SLOT_PERSONAS = 'personas:v1';
export const SLOT_MANIFESTE = 'manifest:v1';
export const PREFIXE_HISTOIRE = 'story:';

export type PierresTombales = Record<string, number>;

export interface EntreeDistante {
  // Date de modification de l'histoire (meta.updatedAt) pour un slot story.
  at: number;
  // Date de la valeur pour les slots settings / personas.
  valueAt: number;
  deleted: PierresTombales | null;
}

export interface DepotDistant {
  /** Dates seulement ; tous les slots de l'utilisateur si `slots` est absent. */
  index(slots?: string[]): Promise<Map<string, EntreeDistante>>;
  charger(slots: string[]): Promise<{ slot_key: string; payload: any }[]>;
  envoyer(slot: string, payload: unknown): Promise<void>;
  supprimer(slot: string): Promise<void>;
}

export interface ValeurSuivie {
  valeur: unknown;
  updatedAt: number;
  empreinte: string;
}

export interface DepotLocal {
  /** id → date de modification de chaque histoire locale. */
  entetes(): Promise<Map<string, number>>;
  lireHistoire(id: string): Promise<HistoireStockee | null>;
  ecrireHistoire(histoire: HistoireStockee): Promise<void>;
  supprimerHistoire(id: string): Promise<void>;
  lireSuivi(slot: typeof SLOT_REGLAGES | typeof SLOT_PERSONAS): Promise<ValeurSuivie | null>;
  /** Applique une valeur reçue ; vrai si quelque chose a changé localement. */
  ecrireSuivi(slot: typeof SLOT_REGLAGES | typeof SLOT_PERSONAS, valeur: unknown, updatedAt: number): Promise<boolean>;
  lire<T>(cle: string, defaut: T): Promise<T>;
  ecrire(cle: string, valeur: unknown): Promise<void>;
}

const CLE_TOMBES = 'elyndor.cloud.storyTombstones.v1';
const CLE_BASE = 'elyndor.cloud.storyBaseline.v1';
const cleEnvois = (utilisateur: string) => `elyndor.cloud.pushed.v2.${utilisateur}`;

export function empreinte(valeur: unknown): string {
  const s = typeof valeur === 'string' ? valeur : JSON.stringify(valeur ?? null);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export function dateMeta(meta: unknown): number {
  try {
    const m = typeof meta === 'string' ? JSON.parse(meta || '{}') : meta || {};
    return Number((m as { updatedAt?: unknown })?.updatedAt || 0) || 0;
  } catch {
    return 0;
  }
}

export function fusionnerTombes(...listes: (PierresTombales | null | undefined)[]): PierresTombales {
  const resultat: PierresTombales = {};
  for (const liste of listes) {
    for (const [id, date] of Object.entries(liste || {})) {
      const n = Number(date) || 0;
      if (n > (resultat[id] || 0)) resultat[id] = n;
    }
  }
  return resultat;
}

const slotHistoire = (id: string) => `${PREFIXE_HISTOIRE}${id}`;

// Suppressions faites sur un autre appareil : c'est lui qui retire
// l'histoire du cloud, rien à renvoyer d'ici.
function noterSuppressionsDistantes(envois: Record<string, any>, tombesDistantes: PierresTombales): void {
  for (const [id, date] of Object.entries(tombesDistantes)) {
    const n = Number(date) || 0;
    if (n > Number(envois[`del:${id}`] || 0)) envois[`del:${id}`] = n;
  }
}

async function synchroniserSuivi(
  slot: typeof SLOT_REGLAGES | typeof SLOT_PERSONAS,
  local: DepotLocal,
  distant: DepotDistant,
  index: Map<string, EntreeDistante>,
  envois: Record<string, any>,
  initial: boolean,
): Promise<boolean> {
  const suivi = await local.lireSuivi(slot);
  const connu = !!envois[slot];
  const d = index.get(slot);
  let change = false;
  if (initial && d && (!connu || !suivi || d.valueAt > suivi.updatedAt)) {
    const [ligne] = await distant.charger([slot]);
    if (ligne?.payload?.value != null) change = await local.ecrireSuivi(slot, ligne.payload.value, Number(ligne.payload.updatedAt) || Date.now());
  } else if (suivi && suivi.valeur != null && (!d || suivi.updatedAt > d.valueAt)) {
    await distant.envoyer(slot, { version: 1, value: suivi.valeur, updatedAt: suivi.updatedAt });
  }
  envois[slot] = (await local.lireSuivi(slot))?.empreinte ?? envois[slot];
  return change;
}

/**
 * Synchronisation complète, à la connexion ou au démarrage : récupère ce qui
 * est plus récent ailleurs, envoie ce qui est plus récent ici, applique les
 * suppressions. Vrai si des données locales ont changé.
 */
export async function synchroniserInitial(utilisateur: string, local: DepotLocal, distant: DepotDistant): Promise<boolean> {
  const envois = await local.lire<Record<string, any>>(cleEnvois(utilisateur), {});
  const index = await distant.index();
  const entetes = await local.entetes();
  const tombesDistantes = index.get(SLOT_MANIFESTE)?.deleted || {};
  const tombes = fusionnerTombes(tombesDistantes, await local.lire<PierresTombales>(CLE_TOMBES, {}));
  let change = false;

  const aTelecharger: string[] = [];
  for (const [slot, d] of index) {
    if (!slot.startsWith(PREFIXE_HISTOIRE)) continue;
    const id = slot.slice(PREFIXE_HISTOIRE.length);
    const supprimeeLe = Number(tombes[id] || 0);
    if (supprimeeLe > 0 && supprimeeLe >= d.at) continue;
    const l = entetes.get(id);
    if (l === undefined || d.at > l) aTelecharger.push(slot);
    else if (d.at === l) envois[slot] = Math.max(Number(envois[slot] || 0), l);
  }
  if (aTelecharger.length) {
    for (const ligne of await distant.charger(aTelecharger)) {
      const histoire = ligne.payload?.story as HistoireStockee | undefined;
      if (!histoire?.id) continue;
      await local.ecrireHistoire(histoire);
      const date = dateMeta(histoire.meta);
      entetes.set(histoire.id, date);
      envois[ligne.slot_key] = date;
      change = true;
    }
  }

  for (const [id, l] of [...entetes]) {
    const supprimeeLe = Number(tombes[id] || 0);
    if (supprimeeLe > 0 && supprimeeLe >= l) {
      // Supprimée sur un autre appareil après sa dernière modification ici.
      // (La V13 la gardait localement si le cloud n'avait plus son slot.)
      await local.supprimerHistoire(id);
      entetes.delete(id);
      change = true;
      continue;
    }
    const slot = slotHistoire(id);
    const d = index.get(slot);
    if (!d || l > d.at) {
      const histoire = await local.lireHistoire(id);
      if (histoire) {
        await distant.envoyer(slot, { version: 1, story: histoire });
        envois[slot] = l;
      }
    }
  }

  change = (await synchroniserSuivi(SLOT_REGLAGES, local, distant, index, envois, true)) || change;
  change = (await synchroniserSuivi(SLOT_PERSONAS, local, distant, index, envois, true)) || change;

  await local.ecrire(CLE_TOMBES, tombes);
  noterSuppressionsDistantes(envois, tombesDistantes);
  if (empreinte(tombes) !== empreinte(fusionnerTombes(tombesDistantes))) {
    await distant.envoyer(SLOT_MANIFESTE, { version: 1, deletedStories: tombes, updatedAt: Date.now() });
  }
  envois[SLOT_MANIFESTE] = empreinte(tombes);
  await local.ecrire(CLE_BASE, [...entetes.keys()]);
  await local.ecrire(cleEnvois(utilisateur), envois);
  return change;
}

export interface EtatDetectionSuppressions {
  // Garde-fou V13 : une base locale soudain vide attend une seconde lecture
  // avant de déclarer toutes ses histoires supprimées.
  baseVideSuspecte: boolean;
}

/**
 * Envoi périodique : ne touche le réseau que si quelque chose a changé
 * localement depuis le dernier envoi (histoire modifiée ou supprimée,
 * réglages, personas). Vrai si un envoi a eu lieu.
 */
export async function envoyerModifications(
  utilisateur: string,
  local: DepotLocal,
  distant: DepotDistant,
  garde: EtatDetectionSuppressions,
): Promise<boolean> {
  const envois = await local.lire<Record<string, any>>(cleEnvois(utilisateur), {});
  const entetes = await local.entetes();
  const base = await local.lire<string[]>(CLE_BASE, []);
  const tombes = await local.lire<PierresTombales>(CLE_TOMBES, {});

  if (!entetes.size && base.length > 1 && !garde.baseVideSuspecte) {
    garde.baseVideSuspecte = true;
    return false;
  }
  garde.baseVideSuspecte = false;
  let nouvellesTombes = false;
  for (const id of base) {
    if (!entetes.has(id) && !tombes[id]) {
      tombes[id] = Date.now();
      nouvellesTombes = true;
    }
  }
  if (nouvellesTombes) await local.ecrire(CLE_TOMBES, tombes);
  await local.ecrire(CLE_BASE, [...entetes.keys()]);

  const modifiees: string[] = [];
  for (const [id, l] of entetes) {
    const supprimeeLe = Number(tombes[id] || 0);
    if (supprimeeLe > 0 && supprimeeLe >= l) continue;
    if (l > Number(envois[slotHistoire(id)] || 0)) modifiees.push(id);
  }
  const suppressions = Object.entries(tombes).filter(([id, date]) => Number(date) > Number(envois[`del:${id}`] || 0)).map(([id]) => id);
  const reglages = await local.lireSuivi(SLOT_REGLAGES);
  const personas = await local.lireSuivi(SLOT_PERSONAS);
  const reglagesModifies = !!reglages && reglages.valeur != null && reglages.empreinte !== envois[SLOT_REGLAGES];
  const personasModifies = !!personas && personas.valeur != null && personas.empreinte !== envois[SLOT_PERSONAS];
  const manifesteModifie = empreinte(tombes) !== envois[SLOT_MANIFESTE];
  if (!modifiees.length && !suppressions.length && !reglagesModifies && !personasModifies && !manifesteModifie) return false;

  const slots = [...new Set([
    ...modifiees.map(slotHistoire),
    ...suppressions.map(slotHistoire),
    SLOT_MANIFESTE,
    ...(reglagesModifies ? [SLOT_REGLAGES] : []),
    ...(personasModifies ? [SLOT_PERSONAS] : []),
  ])];
  const index = await distant.index(slots);
  const tombesDistantes = index.get(SLOT_MANIFESTE)?.deleted || {};
  const fusion = fusionnerTombes(tombesDistantes, tombes);

  for (const id of suppressions) {
    const slot = slotHistoire(id);
    const d = index.get(slot);
    const date = Number(fusion[id] || 0);
    if (d && date >= d.at) await distant.supprimer(slot);
    envois[`del:${id}`] = date;
  }
  for (const id of modifiees) {
    const slot = slotHistoire(id);
    const l = entetes.get(id)!;
    const d = index.get(slot);
    const supprimeeLe = Number(fusion[id] || 0);
    // Supprimée ailleurs : on ne la ressuscite pas. Plus récente ailleurs :
    // elle sera récupérée à la prochaine synchronisation complète.
    if ((supprimeeLe > 0 && supprimeeLe >= l) || (d && d.at > l)) {
      envois[slot] = l;
      continue;
    }
    const histoire = await local.lireHistoire(id);
    if (!histoire) continue;
    await distant.envoyer(slot, { version: 1, story: histoire });
    envois[slot] = l;
  }
  if (reglagesModifies && reglages) {
    const d = index.get(SLOT_REGLAGES);
    if (!d || reglages.updatedAt > d.valueAt) await distant.envoyer(SLOT_REGLAGES, { version: 1, value: reglages.valeur, updatedAt: reglages.updatedAt });
    envois[SLOT_REGLAGES] = reglages.empreinte;
  }
  if (personasModifies && personas) {
    const d = index.get(SLOT_PERSONAS);
    if (!d || personas.updatedAt > d.valueAt) await distant.envoyer(SLOT_PERSONAS, { version: 1, value: personas.valeur, updatedAt: personas.updatedAt });
    envois[SLOT_PERSONAS] = personas.empreinte;
  }
  if (empreinte(fusion) !== empreinte(fusionnerTombes(tombesDistantes))) {
    await distant.envoyer(SLOT_MANIFESTE, { version: 1, deletedStories: fusion, updatedAt: Date.now() });
  }
  noterSuppressionsDistantes(envois, tombesDistantes);
  await local.ecrire(CLE_TOMBES, fusion);
  envois[SLOT_MANIFESTE] = empreinte(fusion);
  await local.ecrire(cleEnvois(utilisateur), envois);
  return true;
}
