import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppSettings, StoryMeta, StoryState } from '../types';
import { VERSION_SCHEMA_HISTOIRE } from '../types';

const KEYS = {
  settings: '@rp_beta/settings',
  storiesIndex: '@rp_beta/stories_index',
  story: (id: string) => `@rp_beta/story/${id}`,
};

const DEFAULT_SETTINGS: AppSettings = {
  openRouterApiKey: '',
  model: 'anthropic/claude-sonnet-4.5',
};

export async function getSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(KEYS.settings);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

export async function getStoriesIndex(): Promise<StoryMeta[]> {
  const raw = await AsyncStorage.getItem(KEYS.storiesIndex);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveStoriesIndex(index: StoryMeta[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.storiesIndex, JSON.stringify(index));
}

// Compatibilité de sauvegarde d'une version à l'autre (esprit de
// l'auto-updater du brief Phase 2) : une histoire sauvegardée par une
// version antérieure de l'app est mise à niveau au chargement plutôt que
// de casser ou de perdre les données du joueur.
function migrerHistoire(data: any): StoryState {
  let migree = data;
  if (!migree.version || migree.version < 2) {
    // v1 -> v2 : les faits de mémoire gagnent niveau/dernierAcces (mémoire
    // L0-L5). Un fait déjà là est considéré "canon" (actif) par défaut.
    migree = {
      ...migree,
      version: 2,
      memoire: {
        ...migree.memoire,
        faits: (migree.memoire?.faits ?? []).map((f: any) => ({
          ...f,
          niveau: f.niveau ?? 'canon',
          dernierAcces: f.dernierAcces ?? migree.memoire?.dernierMessageIndexMaj ?? 0,
        })),
      },
    };
  }
  if (migree.version < 3) {
    // v2 -> v3 : ajout du pool de lore émergent (PNJ récurrents, lieux,
    // factions, objets, événements marquants créés en cours de partie).
    migree = { ...migree, version: 3, loreEmergent: migree.loreEmergent ?? [] };
  }
  if (migree.version < 4) {
    // v3 -> v4 : curseurs violence/romance (contrôle d'âge, brief Phase 2).
    migree = {
      ...migree,
      version: 4,
      settings: {
        ...migree.settings,
        violence: migree.settings?.violence ?? 'modere',
        romance: migree.settings?.romance ?? 'modere',
      },
    };
  }
  return { ...migree, version: VERSION_SCHEMA_HISTOIRE };
}

export async function getStory(id: string): Promise<StoryState | null> {
  const raw = await AsyncStorage.getItem(KEYS.story(id));
  if (!raw) return null;
  try {
    return migrerHistoire(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function saveStory(story: StoryState): Promise<void> {
  story.meta.updatedAt = Date.now();
  await AsyncStorage.setItem(KEYS.story(story.meta.id), JSON.stringify(story));
  const index = await getStoriesIndex();
  const existingPos = index.findIndex((m) => m.id === story.meta.id);
  if (existingPos >= 0) {
    index[existingPos] = story.meta;
  } else {
    index.push(story.meta);
  }
  await saveStoriesIndex(index);
}

export async function deleteStory(id: string): Promise<void> {
  await AsyncStorage.removeItem(KEYS.story(id));
  const index = await getStoriesIndex();
  await saveStoriesIndex(index.filter((m) => m.id !== id));
}
