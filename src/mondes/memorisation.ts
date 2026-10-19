import { getSettings, saveSettings } from '../storage/storage';
import { monde, paquetMonde } from './index';

/** Monde actif mémorisé dans les réglages de l'appareil, puis appliqué à toute l'application. */
export async function memoriserMondeActif(id: string): Promise<void> {
  const mondeId = paquetMonde(id).id;
  const settings = await getSettings();
  if (settings.mondeActif !== mondeId) await saveSettings({ ...settings, mondeActif: mondeId });
  monde.definirActif(mondeId);
}
