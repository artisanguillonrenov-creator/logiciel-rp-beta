export interface EntreeObjectBox {
  id: string;
  contenu: string;
  vecteur: number[];
  timestamp?: number;
}

export type ScoresObjectBox = Record<string, number>;

export function objectBoxDisponible(): boolean {
  return false;
}

export async function synchroniserLoreObjectBox(_namespace: string, _entrees: EntreeObjectBox[]): Promise<boolean> {
  return false;
}

export async function synchroniserHistoireObjectBox(_storyId: string, _entrees: EntreeObjectBox[]): Promise<boolean> {
  return false;
}

export async function rechercherLoreObjectBox(
  _namespace: string,
  _vecteurRequete: number[],
  _maxResultats = 40,
): Promise<ScoresObjectBox | null> {
  return null;
}

export async function rechercherHistoireObjectBox(
  _storyId: string,
  _vecteurRequete: number[],
  _maxResultats = 24,
): Promise<ScoresObjectBox | null> {
  return null;
}

export async function purgerObjectBoxStory(_storyId: string): Promise<void> {
  // ObjectBox est un moteur Android natif. Le web conserve le moteur existant.
}
