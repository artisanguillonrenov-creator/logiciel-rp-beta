import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppSettings } from '../types';
import {
  deleteStory,
  getPersonas,
  getSettings,
  getStoriesIndex,
  importerHistoireBrute,
  lireHistoireBrute,
  remplacerPersonas,
  saveSettings,
} from '../storage/storage';
import { empreinte, SLOT_PERSONAS, SLOT_REGLAGES, type DepotLocal, type ValeurSuivie } from './synchronisation';

// Réglages qui suivent le joueur d'un appareil à l'autre. Tout le reste
// reste local : les clés API (jamais envoyées), et ce qui dépend de
// l'appareil — moteur d'inférence, adresse du serveur local, conservation
// des clés dans le navigateur.
const REGLAGES_PARTAGES = [
  'model',
  'infermaticModel',
  'profilContenu',
  'codeDeverrouillage',
  'betaAcceptee',
  'modeConcepteur',
  'langueInterface',
  'genererImagesActive',
  'modeleImagesGratuit',
] as const satisfies readonly (keyof AppSettings)[];

const CLE_META = { [SLOT_REGLAGES]: 'elyndor.cloud.settingsMeta.v1', [SLOT_PERSONAS]: 'elyndor.cloud.personasMeta.v1' } as const;
// Dernière valeur complète reçue : une version V13 du même compte y range
// aussi ses propres réglages, qu'il ne faut pas effacer en renvoyant les nôtres.
const CLE_REGLAGES_DISTANTS = 'elyndor.cloud.settingsRemote.v1';

function partages(source: Record<string, unknown>): Record<string, unknown> {
  const resultat: Record<string, unknown> = {};
  for (const cle of REGLAGES_PARTAGES) if (source[cle] !== undefined) resultat[cle] = source[cle];
  return resultat;
}

async function lireKv<T>(cle: string, defaut: T): Promise<T> {
  try {
    const brut = await AsyncStorage.getItem(cle);
    return brut ? (JSON.parse(brut) as T) : defaut;
  } catch {
    return defaut;
  }
}

async function ecrireKv(cle: string, valeur: unknown): Promise<void> {
  await AsyncStorage.setItem(cle, JSON.stringify(valeur));
}

// Date de modification d'une valeur suivie : avancée seulement quand son
// contenu change réellement (même règle que la V13).
async function suivre(slot: typeof SLOT_REGLAGES | typeof SLOT_PERSONAS, valeurPropre: unknown): Promise<{ updatedAt: number; empreinte: string }> {
  const h = empreinte(valeurPropre);
  let meta = await lireKv<{ hash: string; updatedAt: number } | null>(CLE_META[slot], null);
  if (!meta || meta.hash !== h) {
    meta = { hash: h, updatedAt: Date.now() };
    await ecrireKv(CLE_META[slot], meta);
  }
  return { updatedAt: meta.updatedAt, empreinte: h };
}

export const depotLocal: DepotLocal = {
  async entetes() {
    return new Map((await getStoriesIndex()).map((m) => [m.id, Number(m.updatedAt) || 0]));
  },
  lireHistoire: (id) => lireHistoireBrute(id),
  ecrireHistoire: (histoire) => importerHistoireBrute(histoire),
  supprimerHistoire: (id) => deleteStory(id),

  async lireSuivi(slot): Promise<ValeurSuivie | null> {
    if (slot === SLOT_REGLAGES) {
      const locaux = partages((await getSettings()) as unknown as Record<string, unknown>);
      const distants = await lireKv<Record<string, unknown>>(CLE_REGLAGES_DISTANTS, {});
      const { updatedAt, empreinte: h } = await suivre(slot, locaux);
      return { valeur: { ...distants, ...locaux }, updatedAt, empreinte: h };
    }
    const personas = await getPersonas();
    const { updatedAt, empreinte: h } = await suivre(slot, personas);
    return { valeur: personas, updatedAt, empreinte: h };
  },

  async ecrireSuivi(slot, valeur, updatedAt) {
    if (slot === SLOT_REGLAGES) {
      if (!valeur || typeof valeur !== 'object') return false;
      await ecrireKv(CLE_REGLAGES_DISTANTS, valeur);
      const actuels = await getSettings();
      const recus = partages(valeur as Record<string, unknown>);
      const change = Object.entries(recus).some(([cle, v]) => (actuels as unknown as Record<string, unknown>)[cle] !== v);
      const nouveaux = { ...actuels, ...recus } as AppSettings;
      if (change) await saveSettings(nouveaux);
      await ecrireKv(CLE_META[slot], { hash: empreinte(partages(nouveaux as unknown as Record<string, unknown>)), updatedAt });
      return change;
    }
    if (!Array.isArray(valeur)) return false;
    const avant = empreinte(await getPersonas());
    await remplacerPersonas(valeur);
    await ecrireKv(CLE_META[slot], { hash: empreinte(valeur), updatedAt });
    return avant !== empreinte(valeur);
  },

  lire: lireKv,
  ecrire: ecrireKv,
};
