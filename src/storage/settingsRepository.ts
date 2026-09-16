import type { AppSettings } from '../types';
import { creerFileSerie } from './serialQueue';

const CLE_REGLAGES = '@rp_beta/settings';
const CLES_API = ['openRouterApiKey', 'infermaticApiKey', 'embeddingsApiKey'] as const;
export type ClesApi = Pick<AppSettings, typeof CLES_API[number]>;
export interface StockageCles {
  lire(): Promise<ClesApi | null>;
  ecrire(cles: ClesApi, conserverSurLeWeb: boolean): Promise<void>;
}
interface StockageReglages {
  getItem(cle: string): Promise<string | null>;
  setItem(cle: string, valeur: string): Promise<void>;
}

function separerCles(settings: AppSettings) {
  const { openRouterApiKey, infermaticApiKey, embeddingsApiKey, ...publics } = settings;
  return { publics, cles: { openRouterApiKey: openRouterApiKey ?? '', infermaticApiKey, embeddingsApiKey } };
}

export function creerDepotReglages(stockage: StockageReglages, secrets: StockageCles, defauts: AppSettings) {
  const executer = creerFileSerie();
  return {
    lire: () => executer(async () => {
      const raw = await stockage.getItem(CLE_REGLAGES);
      const persistants = raw ? JSON.parse(raw) : {};
      const settings: AppSettings = { ...defauts, ...persistants };
      let cles = await secrets.lire();
      if (CLES_API.some((cle) => Object.prototype.hasOwnProperty.call(persistants, cle))) {
        // En cas d'arrêt après l'écriture sécurisée mais avant le nettoyage,
        // la copie sécurisée fait autorité (y compris une clé effacée).
        const separation = separerCles(settings);
        if (!cles) {
          cles = separation.cles;
          await secrets.ecrire(cles, settings.conserverClesWeb === true);
        }
        await stockage.setItem(CLE_REGLAGES, JSON.stringify(separation.publics));
      }
      return { ...separerCles(settings).publics, openRouterApiKey: '', ...cles };
    }),
    enregistrer(settings: AppSettings) {
      const { publics, cles } = separerCles(settings);
      const raw = JSON.stringify(publics);
      const conserverClesWeb = settings.conserverClesWeb === true;
      return executer(async () => {
        // Ne jamais réintroduire une clé en clair dans le stockage des réglages,
        // même lorsque le coffre refuse une écriture.
        await secrets.ecrire(cles, conserverClesWeb);
        await stockage.setItem(CLE_REGLAGES, raw);
      });
    },
  };
}
