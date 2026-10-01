import * as SecureStore from 'expo-secure-store';
import type { SessionCloud, StockageSession } from './supabaseRest';

const CLE = 'elyndor.cloud.session.v1';

// Le jeton de rafraîchissement donne accès au compte : même coffre que les
// clés API (Keystore / Keychain).
export const stockageSession: StockageSession = {
  async lire() {
    const brut = await SecureStore.getItemAsync(CLE);
    return brut ? (JSON.parse(brut) as SessionCloud) : null;
  },
  async ecrire(session) {
    if (!session) {
      await SecureStore.deleteItemAsync(CLE);
      return;
    }
    await SecureStore.setItemAsync(CLE, JSON.stringify(session), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  },
};
