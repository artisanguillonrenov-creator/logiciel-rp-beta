// Règles pures et testables des archives Elyndor Lab.
// Aucun ZIP externe n'est autorisé à supprimer implicitement des fichiers.
import { cheminValide, MAX_CONTENU_FICHIER, type AtelierLocal } from './workspaceCore';

export const MAX_ARCHIVE_COMPRESSEE = 32 * 1024 * 1024;
export const MAX_ARCHIVE_DECOMPRESSEE = 64 * 1024 * 1024;
export const MAX_ENTREES_ARCHIVE = 2500;
export const MANIFESTE_LAB = 'ELYNDOR-LAB-MANIFEST.json';
export const EXTENSIONS_TEXTES = /\.(ts|tsx|js|jsx|cjs|mjs|json|md|txt|yml|yaml|sh|py|kt|java|xml|properties|gradle|jinja)$/i;
export const ARCHIVE_TEXTES_PERMIS = new Set(['Dockerfile','LICENSE','.gitignore','package.json','package-lock.json']);
export const EST_SECRET = /(?:\b(?:API[_-]?KEY|SECRET[_-]?KEY|PRIVATE[_-]?KEY|ACCESS[_-]?TOKEN|AUTH[_-]?TOKEN|PASSWORD)\s*[:=]\s*['"]?\S{8,}|\bAKIA[0-9A-Z]{16}\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk-proj|sk-live|sk_test|sk_live)-[A-Za-z0-9_-]{16,})/i;

export interface ManifesteArchiveV2 {
  format: 'elyndor-lab-sources-texte';
  schema: 2;
  reference: string;
  mode: 'patch';
  fichiers: Record<string,{octets:number; empreinte:string}>;
  chantier: string;
  changements: AtelierLocal['changements'];
  versions: AtelierLocal['versions'];
}
export function nomSourceAutorise(nom:string):boolean {
  return cheminValide(nom) && (EXTENSIONS_TEXTES.test(nom) || ARCHIVE_TEXTES_PERMIS.has(nom));
}
export function verifierOriginalZip(nom:string):string {
  if (!nom || nom.startsWith('/') || nom.includes('\\') || nom.includes('\0') || nom.includes(':') ||
    nom.split('/').some(x=>x==='.' || x==='..' || x==='')) {
    throw new Error('Chemin ZIP interdit : '+nom.slice(0,120));
  }
  return nom;
}
export function collisionDesChemins(chemins:string[]):void {
  const exacts = new Set<string>(), insensibles = new Set<string>();
  for (const chemin of chemins) {
    const cle=chemin.toLocaleLowerCase('en-US');
    if(exacts.has(chemin) || insensibles.has(cle))throw new Error('Entrées ZIP dupliquées ou ambiguës : '+chemin);
    exacts.add(chemin); insensibles.add(cle);
  }
}
export function octetsUtf8(s:string):number {
  // TextEncoder est inclus dans Hermes moderne, mais ceci reste portable en tests Node.
  return new TextEncoder().encode(s).length;
}
// Hash déterministe (contrôle d'intégrité, PAS signature d'authenticité).
export function empreinteTexte(source:string):string {
  const bytes = new TextEncoder().encode(source);
  let h1=0x811c9dc5, h2=0x811c9dc5 ^ 0x9e3779b9;
  for(const b of bytes){
    h1=Math.imul(h1 ^ b, 0x01000193) >>> 0;
    h2=Math.imul(h2 ^ b, 0x01000193) >>> 0;
  }
  return h1.toString(16).padStart(8,'0')+h2.toString(16).padStart(8,'0');
}
export function contientSecretProbable(texte:string):boolean { return EST_SECRET.test(texte); }
export function examinerManifeste(valeur:unknown, importes:Record<string,string>, reference:string):ManifesteArchiveV2 {
  if(!valeur || typeof valeur!=='object')throw new Error('Manifeste ZIP invalide.');
  const m=valeur as Partial<ManifesteArchiveV2>;
  if(m.format!=='elyndor-lab-sources-texte' || m.schema!==2 || m.mode!=='patch' ||
    m.reference!==reference || !m.fichiers || typeof m.fichiers!=='object' ||
    Array.isArray(m.fichiers) || typeof m.chantier!=='string' || !m.changements ||
    typeof m.changements!=='object' || !Array.isArray(m.versions)) {
      throw new Error('Archive de laboratoire incompatible avec la copie locale ; aucun fichier changé.');
  }
  const attendus=Object.keys(m.fichiers);
  collisionDesChemins(attendus);
  if(attendus.length!==Object.keys(importes).length)throw new Error('Manifeste incomplet ou contenu ZIP inattendu.');
  for(const chemin of attendus){
    if(!nomSourceAutorise(chemin) || !Object.prototype.hasOwnProperty.call(importes,chemin))throw new Error('Source déclarée absente : '+chemin);
    const item=m.fichiers[chemin];
    const contenu=importes[chemin];
    if(!item || !Number.isSafeInteger(item.octets) || item.octets<0 ||
       item.octets!==octetsUtf8(contenu) || item.empreinte!==empreinteTexte(contenu)){
      throw new Error('Fichier ZIP altéré ou incomplet : '+chemin);
    }
  }
  return m as ManifesteArchiveV2;
}
export function verifierTexteArchive(chemin:string, texte:string):void {
  if(!nomSourceAutorise(chemin))throw new Error('Chemin archive incompatible : '+chemin);
  if(octetsUtf8(texte)>MAX_CONTENU_FICHIER)throw new Error('Source trop lourde : '+chemin);
}
