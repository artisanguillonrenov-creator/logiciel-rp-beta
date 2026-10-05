import { requireOptionalNativeModule } from 'expo-modules-core';

export interface ObjectBoxNativeModule {
  syncLore(namespace: string, entriesJson: string): Promise<number>;
  searchLore(namespace: string, vectorJson: string, maxCount: number): Promise<string>;
  searchLoreSync(namespace: string, vectorJson: string, maxCount: number): string;
  syncHistory(storyId: string, entriesJson: string): Promise<number>;
  searchHistory(storyId: string, vectorJson: string, maxCount: number): Promise<string>;
  searchHistorySync(storyId: string, vectorJson: string, maxCount: number): string;
  clearStory(storyId: string): Promise<boolean>;
}

const moduleObjectBox = requireOptionalNativeModule<ObjectBoxNativeModule>('ElyndorObjectBox');

export default moduleObjectBox;
