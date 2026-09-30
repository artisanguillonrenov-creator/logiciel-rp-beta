import type { SessionCloud, StockageSession } from './supabaseRest';

const CLE = 'elyndor.cloud.session.v1';

// Comme Supabase sur le web : la session reste dans le navigateur pour que
// la synchronisation reprenne à l'ouverture suivante.
export const stockageSession: StockageSession = {
  async lire() {
    try {
      const brut = localStorage.getItem(CLE);
      return brut ? (JSON.parse(brut) as SessionCloud) : null;
    } catch {
      return null;
    }
  },
  async ecrire(session) {
    if (session) localStorage.setItem(CLE, JSON.stringify(session));
    else localStorage.removeItem(CLE);
  },
};
