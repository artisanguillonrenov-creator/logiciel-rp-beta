import AsyncStorage from '@react-native-async-storage/async-storage';

// Navigateur : utilise le stockage web existant. Les quotas réels du
// navigateur ne peuvent pas être désactivés par l'application.
export const stockageEvolutif = {
  getItem: (cle: string) => AsyncStorage.getItem(cle),
  setItem: (cle: string, valeur: string) => AsyncStorage.setItem(cle, valeur),
  multiGet: (cles: readonly string[]) => AsyncStorage.multiGet([...cles]),
  multiSet: (valeurs: readonly (readonly [string, string])[]) => AsyncStorage.multiSet(valeurs.map(([a, b]) => [a, b])),
  multiRemove: (cles: readonly string[]) => AsyncStorage.multiRemove([...cles]),
};
