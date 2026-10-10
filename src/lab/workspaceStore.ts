import * as FileSystem from 'expo-file-system/legacy';
import { SOURCES_EMBARQUEES, SOURCE_REFERENCE } from './sourceSnapshot.generated';
import { nouvelAtelier, verifierAtelier, type AtelierLocal } from './workspaceCore';
const dossier = (FileSystem.documentDirectory ?? '') + 'elyndor-lab/';
const principal = dossier + 'workspace.json';
const secours = dossier + 'workspace.backup.json';
const temporaire = dossier + 'workspace.tmp.json';
let fileEcriture: Promise<unknown> = Promise.resolve();

async function decoder(chemin:string): Promise<AtelierLocal | null> {
  try {
    const contenu = await FileSystem.readAsStringAsync(chemin);
    const v: unknown = JSON.parse(contenu);
    return verifierAtelier(v) ? v : null;
  } catch { return null; }
}
export async function lireAtelierLocal(): Promise<AtelierLocal> {
  if (!FileSystem.documentDirectory) throw new Error('Stockage local indisponible.');
  const actuel = await decoder(principal);
  if (actuel) return actuel;
  const backup = await decoder(secours);
  if (backup) return backup;
  const brouillon = await decoder(temporaire);
  if (brouillon) return brouillon;
  return nouvelAtelier(SOURCE_REFERENCE);
}
async function persister(atelier: AtelierLocal): Promise<void> {
  if (!FileSystem.documentDirectory || !verifierAtelier(atelier)) throw new Error('État du laboratoire invalide.');
  await FileSystem.makeDirectoryAsync(dossier, {intermediates:true});
  await FileSystem.writeAsStringAsync(temporaire, JSON.stringify(atelier), {encoding:FileSystem.EncodingType.UTF8});
  const sauvegardeActuelle = await decoder(principal);
  if (sauvegardeActuelle) {
    await FileSystem.deleteAsync(secours, {idempotent:true});
    await FileSystem.moveAsync({from:principal,to:secours});
  } else {
    await FileSystem.deleteAsync(principal, {idempotent:true});
  }
  try {
    await FileSystem.moveAsync({from:temporaire,to:principal});
  } catch (e) {
    if (sauvegardeActuelle) await FileSystem.moveAsync({from:secours,to:principal});
    throw e;
  }
}
export function enregistrerAtelierLocal(atelier: AtelierLocal): Promise<void> {
  const operation = fileEcriture.then(()=>persister(atelier));
  fileEcriture = operation.catch(()=>undefined);
  return operation;
}
export function estSourcePreparee(): boolean { return Object.keys(SOURCES_EMBARQUEES).length>0; }
