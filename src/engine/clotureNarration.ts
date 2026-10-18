import { appellerModele, type AppelModeleOptions } from './elyndorCloudClient';
import type { PlageLongueur } from '../concepteur/reglagesNarrateur';

/**
 * Garde la signature utilisée par le moteur narratif.
 * Le quota est désormais un paramètre technique de l'appel, pas une
 * instruction ajoutée au prompt ni une relance simulant un message joueur.
 *
 * Une seule génération, plafonnée à la borne MAX ; le contrôleur de
 * longueur séparé mesure ensuite le résultat sans le bloquer.
 * La clôture naturelle dans la fourchette demandera un futur contrôleur
 * natif et ne peut pas être garantie par maxTokens seul.
 */
export async function genererNarrationAvecCloture(
  options: AppelModeleOptions,
  plage: PlageLongueur,
  appel: (o: AppelModeleOptions) => Promise<string> = appellerModele,
): Promise<string> {
  if (!Number.isSafeInteger(plage.min) || !Number.isSafeInteger(plage.max) ||
      plage.min < 1 || plage.max <= plage.min) {
    throw new Error('Fourchette narrative incorrecte.');
  }

  // N'altère JAMAIS les messages système, utilisateur ou assistant.
  const texte = await appel({ ...options, maxTokens: plage.max });
  return texte.trim();
}
