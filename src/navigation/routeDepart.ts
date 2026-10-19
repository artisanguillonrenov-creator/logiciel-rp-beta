import type { AppSettings } from '../types';
import { trouverMonde } from '../mondes';

export type RouteDepart = 'Activation' | 'ChoixMonde' | 'Demarrage';

/**
 * Premier écran : l'activation tant que la bêta n'est pas acceptée, puis
 * l'accueil si un monde connu est mémorisé, sinon le choix du monde.
 */
export function routeDeDepart(settings: Pick<AppSettings, 'betaAcceptee' | 'mondeActif'>): RouteDepart {
  if (!settings.betaAcceptee) return 'Activation';
  return trouverMonde(settings.mondeActif) ? 'Demarrage' : 'ChoixMonde';
}
