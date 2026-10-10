import * as FileSystem from 'expo-file-system/legacy';
import { FICHIERS_BINAIRES_NON_EMBARQUES, SOURCES_EMBARQUEES, SOURCE_REFERENCE } from './sourceSnapshot.generated';
import { cheminValide, MAX_CONTENU_FICHIER } from './workspaceCore';

// Copie SOURCE figée sur le stockage Android lors de la première ouverture.
// Une mise à jour OTA ne doit jamais changer silencieusement le code de base
// sur lequel reposent les brouillons et versions précédentes.
export interface DepotSourcesLab {
  schema:1;
  reference:string;
  sources:Record<string,string>;
  binaires:string[];
}
const dossier = (FileSystem.documentDirectory??'')+'elyndor-lab/';
const principal = dossier+'sources-base.json';
const secours = dossier+'sources-base.backup.json';

function estValide(v:unknown):v is DepotSourcesLab {
  if (!v || typeof v!=='object')return false;
  const x=v as Partial<DepotSourcesLab>;
  return x.schema===1 && typeof x.reference==='string' && typeof x.sources==='object' &&
    x.sources!==null && Array.isArray(x.binaires) &&
    Object.entries(x.sources).every(([p,t])=>cheminValide(p) && typeof t==='string' && t.length<=MAX_CONTENU_FICHIER);
}
async function lire(fichier:string):Promise<DepotSourcesLab|null>{
  try{const t=JSON.parse(await FileSystem.readAsStringAsync(fichier));return estValide(t)?t:null;}
  catch{return null;}
}
export async function lireDepotSourcesLab():Promise<DepotSourcesLab>{
  if(!FileSystem.documentDirectory)throw new Error('Stockage local Android indisponible.');
  const existant=await lire(principal);
  if(existant)return existant;
  const backup=await lire(secours);
  if(backup)return backup;
  // Si l'archive existe mais est invalide, ne jamais l'écraser avec une
  // nouvelle version OTA : c'est une situation nécessitant une récupération.
  if((await FileSystem.getInfoAsync(principal)).exists || (await FileSystem.getInfoAsync(secours)).exists)
    throw new Error('Copie source locale endommagée. Conserve les fichiers de secours avant toute réinitialisation.');
  const sources=Object.fromEntries(Object.entries(SOURCES_EMBARQUEES).filter(([p,t])=>cheminValide(p)&&typeof t==='string'));
  const depot:DepotSourcesLab={schema:1,reference:SOURCE_REFERENCE,sources,binaires:[...FICHIERS_BINAIRES_NON_EMBARQUES]};
  await FileSystem.makeDirectoryAsync(dossier,{intermediates:true});
  const texte=JSON.stringify(depot);
  // Deux exemplaires, pour protéger le dépôt de référence local.
  await FileSystem.writeAsStringAsync(secours,texte,{encoding:FileSystem.EncodingType.UTF8});
  await FileSystem.writeAsStringAsync(principal,texte,{encoding:FileSystem.EncodingType.UTF8});
  return depot;
}
