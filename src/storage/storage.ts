import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppSettings, Persona, Plugin, StoryState } from '../types';
import { migrerHistoire } from './storyMigration';
import { creerDepotHistoires } from './storyRepository';
import { stockageHistoires } from './storyDatabase';
import { creerDepotReglages } from './settingsRepository';
import { stockageCles } from './apiKeysStore';
import { publierReglages } from '../automation/settingsStore';
import { publierSauvegardeNarrative, publierSauvegardeStory } from '../automation/storyEvents';
import { enqueueStoryCleanup, nettoyerDonneesDeriveesHistoire } from '../automation/lifecycleRoutines';
import { removeAutomationJobsForStory } from '../automation/kernel';
import { normaliserReglagesFournisseurs } from '../engine/elyndorCloud';
import { activerReglagesFournisseurs } from '../engine/fournisseursRuntime';

export { ErreurStockage } from './storyRepository';

const KEYS = {
  personas: '@rp_beta/personas',
  plugins: '@rp_beta/plugins',
  catalogueTraduction: (langue: string) => `@rp_beta/i18n/${langue}`,
};

const DEFAULT_SETTINGS: AppSettings = normaliserReglagesFournisseurs({
  openRouterApiKey: '',
  model: '',
  profilContenu: 'grand_public',
});

const reglages = creerDepotReglages(AsyncStorage, stockageCles, DEFAULT_SETTINGS);

export async function getSettings(): Promise<AppSettings> {
  const settingsLus = await reglages.lire();
  const settings = normaliserReglagesFournisseurs(settingsLus);
  if (JSON.stringify(settings) !== JSON.stringify(settingsLus)) {
    await reglages.enregistrer(settings);
  }
  activerReglagesFournisseurs(settings);
  return publierReglages(settings);
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const normalises = normaliserReglagesFournisseurs(settings);
  await reglages.enregistrer(normalises);
  activerReglagesFournisseurs(normalises);
  publierReglages(normalises);
}

const histoires = creerDepotHistoires(AsyncStorage, stockageHistoires, migrerHistoire);
export const getStory = histoires.lire;
export const getStoriesIndex = histoires.lister;
export const renommerStory = histoires.renommer;

/**
 * La sauvegarde canonique est supprimée en premier. Les jobs encore liés à
 * l'histoire sont ensuite retirés, puis un nettoyage persistant est mis en
 * file afin de s'exécuter après tout job qui aurait déjà commencé. Si la
 * file d'automatismes est indisponible, on tente immédiatement le nettoyage
 * des caches ; le sweep de démarrage constituera le dernier filet de sûreté.
 */
export async function deleteStory(id: string): Promise<void> {
  await histoires.supprimer(id);

  try {
    await removeAutomationJobsForStory(id);
  } catch {
    // L'histoire est déjà supprimée ; ne jamais la faire réapparaître pour
    // un incident de maintenance. Le sweep de démarrage retirera ces jobs.
  }

  try {
    await enqueueStoryCleanup(id);
  } catch {
    await nettoyerDonneesDeriveesHistoire(id).catch(() => {});
  }
}

export async function saveStory(story: StoryState): Promise<void> {
  await histoires.enregistrer(story);
  publierSauvegardeStory(story);
  publierSauvegardeNarrative(story);
}

export const updateStoryIf = histoires.mettreAJourSi;
export const lireHistoireBrute = histoires.lireBrut;
export const importerHistoireBrute = histoires.importerBrut;

export async function getPersonas(): Promise<Persona[]> {
  const raw = await AsyncStorage.getItem(KEYS.personas);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function savePersona(persona: Persona): Promise<void> {
  const personas = await getPersonas();
  const existingPos = personas.findIndex((p) => p.id === persona.id);
  if (existingPos >= 0) personas[existingPos] = persona;
  else personas.push(persona);
  await AsyncStorage.setItem(KEYS.personas, JSON.stringify(personas));
}

export async function remplacerPersonas(personas: Persona[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.personas, JSON.stringify(personas));
}

export async function deletePersona(id: string): Promise<void> {
  const personas = await getPersonas();
  await AsyncStorage.setItem(KEYS.personas, JSON.stringify(personas.filter((p) => p.id !== id)));
}

export async function getPlugins(): Promise<Plugin[]> {
  const raw = await AsyncStorage.getItem(KEYS.plugins);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function installerPlugin(plugin: Plugin): Promise<void> {
  const plugins = await getPlugins();
  plugins.push(plugin);
  await AsyncStorage.setItem(KEYS.plugins, JSON.stringify(plugins));
}

export async function supprimerPlugin(id: string): Promise<void> {
  const plugins = await getPlugins();
  await AsyncStorage.setItem(KEYS.plugins, JSON.stringify(plugins.filter((p) => p.id !== id)));
}

export async function getCatalogueTraduction(langue: string): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(KEYS.catalogueTraduction(langue));
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function fusionnerCatalogueTraduction(langue: string, ajout: Record<string, string>): Promise<void> {
  const existant = await AsyncStorage.getItem(KEYS.catalogueTraduction(langue));
  let base: Record<string, string> = {};
  if (existant) {
    try { base = JSON.parse(existant); } catch { base = {}; }
  }
  await AsyncStorage.setItem(KEYS.catalogueTraduction(langue), JSON.stringify({ ...base, ...ajout }));
}
