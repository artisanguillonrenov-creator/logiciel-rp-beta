import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';
import type { DepotSourcesLab } from './depotSources';
import { cheminValide, fichiersActuels, modifierFichier, verifierAtelier, type AtelierLocal, type VersionLab } from './workspaceCore';
import {
  MANIFESTE_LAB, MAX_ARCHIVE_COMPRESSEE, MAX_ARCHIVE_DECOMPRESSEE, MAX_ENTREES_ARCHIVE,
  contientSecretProbable, collisionDesChemins, empreinteTexte, examinerManifeste,
  nomSourceAutorise, octetsUtf8, verifierOriginalZip, verifierTexteArchive, type ManifesteArchiveV2,
} from './archivePolicy';

export interface ResultatImportLab {
  atelier: AtelierLocal;
  nombre:number;
  complet:false;
  versionsImportees:VersionLab[];
  referenceAvant:string;
}
const capaciteFichier = (value:unknown):{uncompressedSize:number;compressedSize:number} | null => {
  if(!value || typeof value!=='object')return null;
  const data=value as {uncompressedSize?:unknown;compressedSize?:unknown};
  if(typeof data.uncompressedSize!=='number' || typeof data.compressedSize!=='number' ||
    !Number.isSafeInteger(data.uncompressedSize) || !Number.isSafeInteger(data.compressedSize))return null;
  return {uncompressedSize:data.uncompressedSize as number,compressedSize:data.compressedSize as number};
};

// Extraire par flux : arrêt immédiat si la taille réellement décompressée
// dépasse la limite, même si l'en-tête ZIP annonçait une taille mensongère.
function extraireTexteBorne(entree:JSZip.JSZipObject,limite:number):Promise<string>{
  return new Promise<string>((resolve,reject)=>{
    const morceaux:string[]=[];
    let octets=0,termine=false;
    const flux=entree.internalStream('string');
    const echouer=(cause:unknown)=>{
      if(termine)return;
      termine=true;flux.pause();reject(cause instanceof Error?cause:new Error(String(cause)));
    };
    flux.on('data',(chunk:string)=>{
      if(termine)return;
      octets+=octetsUtf8(chunk);
      if(octets>limite){echouer(new Error('Décompression ZIP excessive : import annulé.'));return;}
      morceaux.push(chunk);
    });
    flux.on('error',echouer);
    flux.on('end',()=>{if(!termine){termine=true;resolve(morceaux.join(''));}});
    flux.resume();
  });
}

export async function exporterSourcesLab(atelier: AtelierLocal, depot: DepotSourcesLab): Promise<{ uri:string; total:number }> {
  if(atelier.reference!==depot.reference)throw new Error('Référence locale divergente : export interrompu avant réconciliation.');
  const zip = new JSZip();
  const fichiers = fichiersActuels(depot.sources, atelier);
  const inventaire:ManifesteArchiveV2['fichiers']={};
  let octets=0;
  for(const [chemin,texte] of Object.entries(fichiers)){
    if(!cheminValide(chemin))continue;
    verifierTexteArchive(chemin,texte);
    if(contientSecretProbable(texte))throw new Error('Secret potentiel dans '+chemin+'. Export annulé : vérifie ce fichier avant tout partage.');
    octets+=octetsUtf8(texte);
    if(octets>MAX_ARCHIVE_DECOMPRESSEE)throw new Error('Les sources sont trop volumineuses pour un ZIP en mémoire sur cette tablette.');
    inventaire[chemin]={octets:octetsUtf8(texte),empreinte:empreinteTexte(texte)};
    zip.file('sources/'+chemin,texte);
  }
  const manifest:ManifesteArchiveV2={
    format:'elyndor-lab-sources-texte',schema:2,reference:depot.reference,mode:'patch',fichiers:inventaire,
    chantier:atelier.chantier,changements:atelier.changements,versions:atelier.versions,
  };
  zip.file(MANIFESTE_LAB,JSON.stringify(manifest,null,2));
  const contenu=await zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:5}});
  if(contenu.byteLength>MAX_ARCHIVE_COMPRESSEE)throw new Error('ZIP dépassant la capacité sûre pour ce mode de partage.');
  const nom='Elyndor-Lab-'+new Date().toISOString().replace(/[:.]/g,'-')+'.zip';
  const destination=new File(Paths.cache,nom);
  destination.write(contenu);
  if(!await Sharing.isAvailableAsync())throw new Error('Partage Android indisponible. Archive temporaire : '+destination.uri);
  await Sharing.shareAsync(destination.uri,{mimeType:'application/zip',dialogTitle:'Exporter les sources texte Elyndor Lab'});
  return {uri:destination.uri,total:Object.keys(inventaire).length};
}

export async function importerArchiveLab(atelier:AtelierLocal,depot:DepotSourcesLab):Promise<ResultatImportLab>{
  if(atelier.reference!==depot.reference)throw new Error('Références locales divergentes. Réconciliation nécessaire avant import.');
  const selection=await File.pickFileAsync({mimeTypes:['application/zip','application/octet-stream','application/x-zip-compressed']});
  if(selection.canceled || !selection.result)throw new Error('Sélection annulée.');
  if(selection.result.size>MAX_ARCHIVE_COMPRESSEE)throw new Error('Archive trop lourde pour l’import sur tablette.');
  const entree=await JSZip.loadAsync(await selection.result.arrayBuffer(),{createFolders:false});
  const chemins=Object.keys(entree.files).filter(nom=>!entree.files[nom].dir);
  if(chemins.length>MAX_ENTREES_ARCHIVE)throw new Error('Archive contenant trop de fichiers.');
  // JSZip normalise certains chemins à l'ouverture. Examiner aussi le nom ORIGINAL.
  for(const [nom,item] of Object.entries(entree.files)){
    const initial=(item as typeof item & {unsafeOriginalName?:string}).unsafeOriginalName ?? nom;
    verifierOriginalZip(item.dir ? initial.replace(/\/$/,'') : initial);
    if(!item.dir)verifierOriginalZip(nom);
  }
  collisionDesChemins(chemins);
  let totalAnnonce=0;
  for(const nom of chemins){
    const entreeZip=entree.files[nom] as typeof entree.files[string] & {_data?:unknown};
    const info=capaciteFichier(entreeZip._data);
    if(!info)throw new Error('Archive ZIP sans taille décompressée vérifiable.');
    const limiteParFichier=nom===MANIFESTE_LAB?2*1024*1024:2*1024*1024;
    if(info.uncompressedSize>limiteParFichier || info.uncompressedSize<0 ||
      info.compressedSize<0 || (info.compressedSize===0 && info.uncompressedSize>0) ||
      (info.compressedSize>0 && info.uncompressedSize/info.compressedSize>1000)) {
        throw new Error('Archive ZIP à décompression excessive ou suspecte.');
    }
    totalAnnonce+=info.uncompressedSize;
    if(totalAnnonce>MAX_ARCHIVE_DECOMPRESSEE)throw new Error('Archive ZIP trop volumineuse une fois décompressée.');
  }
  const estLab=Object.prototype.hasOwnProperty.call(entree.files,MANIFESTE_LAB);
  const prefixe=estLab ? 'sources/' : (()=>{
    const candidates=chemins.filter(p=>p.endsWith('/package.json'));
    return candidates.length===1 ? candidates[0].slice(0,-'package.json'.length):'';
  })();
  const importes:Record<string,string>={};
  let totalReel=0;
  for(const archivePath of chemins){
    if(archivePath===MANIFESTE_LAB)continue;
    if(prefixe && !archivePath.startsWith(prefixe)){
      if(estLab)throw new Error('Archive de laboratoire contenant une entrée imprévue.');
      continue;
    }
    const chemin=archivePath.slice(prefixe.length);
    if(!nomSourceAutorise(chemin)){
      if(estLab)throw new Error('Archive de laboratoire contenant un chemin interdit : '+chemin);
      continue;
    }
    const texte=await extraireTexteBorne(entree.files[archivePath],2*1024*1024);
    verifierTexteArchive(chemin,texte);
    totalReel+=octetsUtf8(texte);
    if(totalReel>MAX_ARCHIVE_DECOMPRESSEE)throw new Error('Taille décompressée excessive ; aucun changement écrit.');
    importes[chemin]=texte;
  }
  if(Object.keys(importes).length===0)throw new Error('Aucun fichier texte compatible dans cette archive.');
  let versionsImportees:VersionLab[]=[];
  if(estLab){
    const texteManifeste=await extraireTexteBorne(entree.files[MANIFESTE_LAB],2*1024*1024);
    if(octetsUtf8(texteManifeste)>2*1024*1024)throw new Error('Manifeste démesuré.');
    let lu:unknown;
    try{lu=JSON.parse(texteManifeste);}catch{throw new Error('Manifeste JSON illisible.');}
    // Les anciens ZIP schema 1 peuvent être relus comme patchs.
    // On ignore leur métadonnée "archive complète", qui n'autorise JAMAIS une suppression.
    if(lu && typeof lu==='object' && (lu as {schema?:unknown}).schema===1){
      const ancien=lu as {format?:unknown;reference?:unknown};
      if(ancien.format!=='elyndor-lab-sources-texte' || ancien.reference!==depot.reference)
        throw new Error('Ancienne archive non compatible avec cette référence de code.');
    }else{
      const valide=examinerManifeste(lu,importes,depot.reference);
      const candidate:AtelierLocal={schema:1,reference:valide.reference,changements:valide.changements,
        versions:valide.versions,chantier:valide.chantier,versionActive:null};
      if(!verifierAtelier(candidate))throw new Error('Historique ou modifications du manifeste invalides.');
      versionsImportees=valide.versions;
    }
  }
  // Toujours PATCH : aucune suppression de source absente, même avec package.json.
  let prochain={...atelier,changements:{...atelier.changements}};
  for(const [chemin,texte] of Object.entries(importes)){
    prochain=modifierFichier(prochain,depot.sources,chemin,texte);
  }
  return {atelier:prochain,nombre:Object.keys(importes).length,complet:false,
    versionsImportees,referenceAvant:atelier.reference};
}
