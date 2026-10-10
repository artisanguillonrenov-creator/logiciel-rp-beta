import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';
import { FICHIERS_BINAIRES_NON_EMBARQUES, SOURCES_EMBARQUEES, SOURCE_REFERENCE } from './sourceSnapshot.generated';
import { cheminValide, fichiersActuels, modifierFichier, supprimerFichier, type AtelierLocal } from './workspaceCore';
const EXTENSIONS_TEXTES = /\.(ts|tsx|js|jsx|cjs|mjs|json|md|txt|yml|yaml|sh|py|kt|java|xml|properties|gradle|jinja)$/i;

export async function exporterSourcesLab(atelier: AtelierLocal): Promise<{ uri:string; total:number }> {
  const zip = new JSZip();
  const fichiers = fichiersActuels(SOURCES_EMBARQUEES, atelier);
  for (const [chemin, texte] of Object.entries(fichiers)) {
    if (cheminValide(chemin)) zip.file('sources/' + chemin, texte);
  }
  zip.file('ELYNDOR-LAB-MANIFEST.json', JSON.stringify({
    format:'elyndor-lab-sources-texte', schema:1, date:new Date().toISOString(),
    reference:SOURCE_REFERENCE, chantier:atelier.chantier,
    sources: Object.keys(fichiers).filter(cheminValide).length,
    actifsNonInclus:FICHIERS_BINAIRES_NON_EMBARQUES,
    precision:'Archive complète des sources texte éditables locales. Images et autres actifs binaires non inclus ; ils demeurent dans le dépôt de référence.',
    changements:atelier.changements, versions:atelier.versions,
    avertissement:'Aucun historique de parties, aucune clé API ni donnée privée ne sont exportés.',
  },null,2));
  const contenu = await zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:5}});
  const nom = 'Elyndor-Lab-' + new Date().toISOString().replace(/[:.]/g,'-') + '.zip';
  const destination = new File(Paths.cache, nom);
  destination.write(contenu);
  if (!await Sharing.isAvailableAsync()) throw new Error('Partage Android indisponible. Archive locale : '+destination.uri);
  await Sharing.shareAsync(destination.uri,{mimeType:'application/zip',dialogTitle:'Exporter la copie locale Elyndor Lab'});
  return {uri:destination.uri,total:Object.keys(fichiers).length};
}
export async function importerArchiveLab(atelier: AtelierLocal): Promise<{atelier:AtelierLocal;nombre:number;complet:boolean}> {
  const selection = await File.pickFileAsync({mimeTypes:['application/zip','application/octet-stream','application/x-zip-compressed']});
  if (!selection || Array.isArray(selection)) throw new Error('Sélection annulée ou fichier non pris en charge.');
  const entree = await JSZip.loadAsync(await selection.arrayBuffer());
  const chemins = Object.keys(entree.files).filter((nom)=>!entree.files[nom].dir);
  if (chemins.length>2500) throw new Error('Archive trop volumineuse en nombre de fichiers.');
  const estLab = !!entree.files['ELYNDOR-LAB-MANIFEST.json'];
  const sourcePrefix = estLab ? 'sources/' : (() => {
    const candidates = chemins.filter((c)=>c.endsWith('/package.json'));
    return candidates.length===1 ? candidates[0].slice(0,-'package.json'.length) : '';
  })();
  let prochain = {...atelier,changements:{...atelier.changements}};
  const importes: Record<string,string> = {};
  let volume=0;
  for (const archivePath of chemins) {
    if (archivePath==='ELYNDOR-LAB-MANIFEST.json' || (sourcePrefix && !archivePath.startsWith(sourcePrefix))) continue;
    const chemin = archivePath.slice(sourcePrefix.length);
    if (!cheminValide(chemin) || !EXTENSIONS_TEXTES.test(chemin) && !['Dockerfile','LICENSE','.gitignore'].includes(chemin)) continue;
    const texte = await entree.files[archivePath].async('string');
    volume+=texte.length;
    if (volume>24*1024*1024) throw new Error('Archive texte trop volumineuse pour une importation locale sûre.');
    importes[chemin]=texte;
  }
  const nomFichiers = Object.keys(importes);
  if (!nomFichiers.length) throw new Error('Aucun fichier source compatible dans cette archive.');
  const complet = estLab || Object.prototype.hasOwnProperty.call(importes,'package.json');
  if (complet) {
    for (const chemin of Object.keys(SOURCES_EMBARQUEES)) {
      if (cheminValide(chemin) && !Object.prototype.hasOwnProperty.call(importes,chemin)) {
        prochain=supprimerFichier(prochain,SOURCES_EMBARQUEES,chemin);
      }
    }
  }
  for (const [chemin, texte] of Object.entries(importes)) prochain=modifierFichier(prochain,SOURCES_EMBARQUEES,chemin,texte);
  return {atelier:prochain,nombre:nomFichiers.length,complet};
}
