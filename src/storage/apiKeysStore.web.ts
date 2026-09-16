import type { StockageCles } from './settingsRepository';

const CLE = 'elyndor.api-keys.v1';

// Le navigateur n'offre pas de coffre équivalent au Keystore/Keychain.
// La session survit au rechargement de la page, pas à la fermeture de l'onglet.
// La conservation durable, non chiffrée, exige un choix explicite dans Réglages.
export const stockageCles: StockageCles = {
  async lire() {
    const raw = sessionStorage.getItem(CLE) ?? localStorage.getItem(CLE);
    return raw ? JSON.parse(raw) : null;
  },
  async ecrire(cles, conserverSurLeWeb) {
    const cible = conserverSurLeWeb ? localStorage : sessionStorage;
    const autre = conserverSurLeWeb ? sessionStorage : localStorage;
    cible.setItem(CLE, JSON.stringify(cles));
    autre.removeItem(CLE);
  },
};
