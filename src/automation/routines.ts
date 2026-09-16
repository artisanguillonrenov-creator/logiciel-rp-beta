import AsyncStorage from '@react-native-async-storage/async-storage';
import { verifierMiseAJour, type InfoMiseAJour } from '../engine/updater';
import { enqueueAutomation, registerAutomationHandler } from './kernel';

const KEY_LAST_UPDATE_CHECK = '@rp_beta/automation/last_update_check';
export const UPDATE_CHECK_TTL_MS = 6 * 60 * 60 * 1000;

export interface UpdateCheckSnapshot {
  checkedAt: number;
  info: InfoMiseAJour;
}

export async function getLastUpdateCheck(): Promise<UpdateCheckSnapshot | null> {
  const raw = await AsyncStorage.getItem(KEY_LAST_UPDATE_CHECK);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.checkedAt !== 'number' || !parsed?.info) return null;
    return parsed as UpdateCheckSnapshot;
  } catch {
    return null;
  }
}

async function saveLastUpdateCheck(snapshot: UpdateCheckSnapshot): Promise<void> {
  await AsyncStorage.setItem(KEY_LAST_UPDATE_CHECK, JSON.stringify(snapshot));
}

export async function updateCheckIsDue(now = Date.now()): Promise<boolean> {
  const last = await getLastUpdateCheck();
  return !last || now - last.checkedAt >= UPDATE_CHECK_TTL_MS;
}

export async function enqueueUpdateCheckIfDue(now = Date.now()): Promise<boolean> {
  if (!(await updateCheckIsDue(now))) return false;
  // Dedupe par fenêtre de 6h : plusieurs transitions foreground très proches
  // ne déclenchent qu'un seul job tant qu'il est en attente/en cours.
  const bucket = Math.floor(now / UPDATE_CHECK_TTL_MS);
  await enqueueAutomation('updates.check', { dedupeKey: `updates.check:${bucket}` });
  return true;
}

export function registerBuiltInAutomationHandlers(): () => void {
  const unregisterUpdate = registerAutomationHandler('updates.check', async () => {
    const info = await verifierMiseAJour();
    await saveLastUpdateCheck({ checkedAt: Date.now(), info });
  });

  return () => {
    unregisterUpdate();
  };
}
