import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppSettings, Persona, Plugin } from '../types';
import { migrerHistoire } from './storyMigration';
import { creerDepotHistoires } from './storyRepository';
import { stockageHistoires } from './storyDatabase';
import { creerDepotReglages } from './settingsRepository';
import { stockageCles } from './apiKeysStore';

export { ErreurStockage } from './storyRepository';

const KEYS = {
  personas: '@rp_beta/personas',
  plugins: '@rp_beta/plugins',
  catalogueTraduction: (langue: string) => `@rp_beta/i18n/${langue}`,
};

const DEFAULT_SETTINGS: AppSettings = {
  openRouterApiKey: '',
  model: 'anthropic/claude-sonnet-4.5',
  // Migration des réglages antérieurs : l'absence de fournisseur conserve
  // strictement le comportement réseau historique.
  moteurInference: 'openrouter',
  // Grand public par défaut (fail-safe) : sans ce champ, tout le filtrage de
  // contenu (validerEntreeUtilisateur, validerProfilContenuHeuristique,
  // plafonnerCurseurs...) traite l'absence de choix comme équivalente à
  // "adulte" (aucune restriction) — voir contenuAdulte.ts, tous ces contrôles
  // testent `!== 'grand_public'`. Un appareil qui n'a jamais explicitement
  // choisi son profil démarre donc désormais filtré, pas grand ouvert ; ça
  // ne change rien pour un profil déjà sauvegardé explicitement (le spread
  // dans getSettings ne touche que les installs neuves/non déclarées).
  profilContenu: 'grand_public',
};

const reglages = creerDepotReglages(AsyncStorage, stockageCles, DEFAULT_SETTINGS);
export const getSettings = reglages.lire;
export const saveSettings = reglages.enregistrer;


const histoires = creerDepotHistoires(AsyncStorage, stockageHistoires, migrerHistoire);
export const getStory = histoires.lire;
export const getStoriesIndex = histoires.lister;
export const saveStory = histoires.enregistrer;
export const deleteStory = histoires.supprimer;
export const renommerStory = histoires.renommer;

// Bibliothèque de personas (brief Phase 2) : réutiliser {{user}} d'une
// histoire à l'autre sans ressaisir nom/description à chaque création.
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
  if (existingPos >= 0) {
    personas[existingPos] = persona;
  } else {
    personas.push(persona);
  }
  await AsyncStorage.setItem(KEYS.personas, JSON.stringify(personas));
}

export async function deletePersona(id: string): Promise<void> {
  const personas = await getPersonas();
  await AsyncStorage.setItem(KEYS.personas, JSON.stringify(personas.filter((p) => p.id !== id)));
}

// Packs de contenu / plugins "esprit" (brief Phase 2) : rejoignent le pool
// de lore sélectionnable — voir convertirPluginsPourSelection dans
// src/engine/plugins.ts.
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

// Sélecteur de langue (Ajouts_A_Integrer.md) : catalogue de traductions
// texte-source (français) → texte traduit, un par langue, construit à la
// volée par lot au fil de l'utilisation (voir src/i18n/traduction.ts) et
// mis en cache ici pour ne jamais retraduire deux fois la même chaîne sur
// un même appareil.
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
  const existant = await getCatalogueTraduction(langue);
  await AsyncStorage.setItem(KEYS.catalogueTraduction(langue), JSON.stringify({ ...existant, ...ajout }));
}
