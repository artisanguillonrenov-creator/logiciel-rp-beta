import * as FileSystem from 'expo-file-system/legacy';
import type { DepotSourcesLab } from './depotSources';
import { fichiersActuels, cheminValide, type AtelierLocal } from './workspaceCore';
import { empreinteTexte } from './archivePolicy';

// Copie PHYSIQUE d'une arborescence de fichiers de code source.
// Le registre V1.1 reste la référence transactionnelle pendant la migration.
// Ce miroir peut être reconstruit sans écraser les histoires de l'application.
interface IndexPhysique {
  schema:1;
  reference:string;
  empreintes:Record<string,string>;
}
const base=()=> {
  if(!FileSystem.documentDirectory)throw new Error('Stockage local Android indisponible.');
  return FileSystem.documentDirectory+'elyndor-lab/source-tree/';
};
const cheminDuFichier=(chemin:string):string=>{
  if(!cheminValide(chemin))throw new Error('Chemin source refusé : '+chemin);
  return base()+'files/'+chemin.split('/').map(encodeURIComponent).join('/');
};
const indexPrincipal=()=>base()+'index.json';
const indexSecours=()=>base()+'index.backup.json';
const indexTemporaire=()=>base()+'index.tmp.json';

async function lireIndex(chemin:string):Promise<IndexPhysique|null>{
  try{
    const x:unknown=JSON.parse(await FileSystem.readAsStringAsync(chemin));
    if(!x||typeof x!=='object')return null;
    const v=x as Partial<IndexPhysique>;
    if(v.schema!==1||typeof v.reference!=='string'||!v.empreintes||typeof v.empreintes!=='object')return null;
    if(!Object.entries(v.empreintes).every(([p,h])=>cheminValide(p)&&typeof h==='string'&&/^[a-f0-9]{16}$/.test(h)))return null;
    return v as IndexPhysique;
  }catch{return null;}
}
async function sauvegarderIndex(index:IndexPhysique):Promise<void>{
  await FileSystem.makeDirectoryAsync(base(),{intermediates:true});
  await FileSystem.writeAsStringAsync(indexTemporaire(),JSON.stringify(index));
  const actuel=await lireIndex(indexPrincipal());
  if(actuel){
    await FileSystem.deleteAsync(indexSecours(),{idempotent:true});
    await FileSystem.moveAsync({from:indexPrincipal(),to:indexSecours()});
  }else{
    await FileSystem.deleteAsync(indexPrincipal(),{idempotent:true});
  }
  try{await FileSystem.moveAsync({from:indexTemporaire(),to:indexPrincipal()});}
  catch(e){
    if(actuel)await FileSystem.moveAsync({from:indexSecours(),to:indexPrincipal()});
    throw e;
  }
}
async function ecrireSource(chemin:string,texte:string):Promise<void>{
  const cible=cheminDuFichier(chemin);
  await FileSystem.makeDirectoryAsync(cible.slice(0,cible.lastIndexOf('/')),{intermediates:true});
  const temporaire=cible+'.part';
  await FileSystem.writeAsStringAsync(temporaire,texte,{encoding:FileSystem.EncodingType.UTF8});
  await FileSystem.deleteAsync(cible,{idempotent:true});
  await FileSystem.moveAsync({from:temporaire,to:cible});
}
let ecritures:Promise<unknown>=Promise.resolve();

/** Réconcilie le miroir fichier-par-fichier, sans effacer de données RP.
    Si un arrêt arrive à mi-parcours, l'index ne sera validé qu'à la fin :
    la prochaine tentative peut reprendre la synchronisation.
*/
export function synchroniserArbrePhysique(depot:DepotSourcesLab,atelier:AtelierLocal):Promise<{total:number;actualises:number}>{
  const operation=ecritures.catch(()=>undefined).then(async()=>{
    if(depot.reference!==atelier.reference)throw new Error('Références sources incompatibles. Arborescence non modifiée.');
    const precedant=await lireIndex(indexPrincipal())??await lireIndex(indexSecours());
    if(precedant && precedant.reference!==depot.reference)throw new Error('Une autre référence de code existe : migration de base nécessaire.');
    const fichiers=fichiersActuels(depot.sources,atelier);
    const empreintes:Record<string,string>={};
    let actualises=0;
    for(const [chemin,texte] of Object.entries(fichiers)){
      if(!cheminValide(chemin))continue;
      const empreinte=empreinteTexte(texte);
      empreintes[chemin]=empreinte;
      if(precedant?.empreintes[chemin]===empreinte)continue;
      await ecrireSource(chemin,texte);
      actualises++;
    }
    for(const chemin of Object.keys(precedant?.empreintes??{})){
      if(!Object.prototype.hasOwnProperty.call(empreintes,chemin)){
        await FileSystem.deleteAsync(cheminDuFichier(chemin),{idempotent:true});
        actualises++;
      }
    }
    await sauvegarderIndex({schema:1,reference:depot.reference,empreintes});
    return {total:Object.keys(empreintes).length,actualises};
  });
  ecritures=operation.catch(()=>undefined);
  return operation;
}
export async function lireFichierPhysique(chemin:string):Promise<string>{
  return FileSystem.readAsStringAsync(cheminDuFichier(chemin));
}
