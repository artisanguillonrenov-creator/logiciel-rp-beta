import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppSettings, StoryMeta, StoryState } from '../types';

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

export async function getStory(id: string): Promise<StoryState | null> {
  const raw = await AsyncStorage.getItem(KEYS.story(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
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
