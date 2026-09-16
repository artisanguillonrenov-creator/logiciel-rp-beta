import * as SecureStore from 'expo-secure-store';
import type { StockageCles } from './settingsRepository';

const CLE = 'elyndor.api-keys.v1';

export const stockageCles: StockageCles = {
  async lire() {
    const raw = await SecureStore.getItemAsync(CLE);
    return raw ? JSON.parse(raw) : null;
  },
  async ecrire(cles) {
    await SecureStore.setItemAsync(CLE, JSON.stringify(cles), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
};
