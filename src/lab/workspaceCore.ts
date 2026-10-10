// Noyau pur, déterministe, sans accès aux fichiers privés de l'application.
export type EtatVersionLab = 'brouillon' | 'experimentale' | 'stable';
export interface VersionLab {
  id: string;
  nom: string;
  date: string;
  etat: EtatVersionLab;
  // Snapshot de toutes les modifications, indépendamment des sources embarquées.
  changements: Record<string, string | null>;
}
export interface AtelierLocal {
  schema: 1;
  reference: string;
  changements: Record<string, string | null>;
  versions: VersionLab[];
  versionActive: string | null;
  chantier: string;
}
export interface ControleLab {
  statut: 'valide' | 'erreur' | 'avertissement';
  titre: string;
  detail: string;
}
export const MAX_CONTENU_FICHIER = 2 * 1024 * 1024;
const extensionsAutorisees = /\.(ts|tsx|js|jsx|cjs|mjs|json|md|txt|yml|yaml|sh|py|kt|java|xml|properties|gradle|jinja)$/i;
const secretFile = /(^|\/)(\.env($|\.)|id_rsa$|[^/]*\.(pem|p12|pfx|jks|keystore|key)$|secrets?\.json$|credentials?\.json$)/i;

export function cheminValide(entree: string): boolean {
  if (typeof entree !== 'string' || entree.length > 320 || entree.length < 1) return false;
  if (entree.includes('\\') || entree.startsWith('/') || entree.includes('\0') || entree.includes(':')) return false;
  if (entree.split('/').some((partie) => !partie || partie === '.' || partie === '..')) return false;
  if (entree.split('/').some((partie) => ['node_modules','.git','.expo','dist','.test-dist'].includes(partie))) return false;
  if (entree === 'src/lab/sourceSnapshot.generated.ts' || secretFile.test(entree)) return false;
  return extensionsAutorisees.test(entree) || ['package.json','package-lock.json','Dockerfile','LICENSE','.gitignore'].includes(entree);
}
export function nouvelAtelier(reference: string): AtelierLocal {
  return { schema:1, reference, changements:{}, versions:[], versionActive:null, chantier:'Chantier principal' };
}
export function verifierAtelier(valeur: unknown): valeur is AtelierLocal {
  if (!valeur || typeof valeur !== 'object') return false;
  const v = valeur as Partial<AtelierLocal>;
  if (v.schema !== 1 || typeof v.reference !== 'string' || !v.changements || typeof v.changements !== 'object' || !Array.isArray(v.versions)) return false;
  if (typeof v.chantier !== 'string' || (v.versionActive !== null && typeof v.versionActive !== 'string')) return false;
  const verifierChangements = (obj: unknown) => !!obj && typeof obj === 'object' && Object.entries(obj).every(([p, t]) =>
    cheminValide(p) && (t === null || (typeof t === 'string' && t.length <= MAX_CONTENU_FICHIER)));
  if (!verifierChangements(v.changements)) return false;
  return v.versions.every((version) => !!version && typeof version.id === 'string' && typeof version.nom === 'string' &&
    typeof version.date === 'string' && ['brouillon','experimentale','stable'].includes(version.etat) &&
    verifierChangements(version.changements));
}
export function fichiersActuels(base: Record<string,string>, atelier: AtelierLocal): Record<string,string> {
  const resultat = { ...base };
  for (const [chemin, contenu] of Object.entries(atelier.changements)) {
    if (contenu === null) delete resultat[chemin];
    else resultat[chemin] = contenu;
  }
  return resultat;
}
export function modifierFichier(atelier: AtelierLocal, base: Record<string,string>, chemin: string, texte: string): AtelierLocal {
  if (!cheminValide(chemin)) throw new Error('Chemin de fichier refusé (hors projet ou sensible).');
  if (texte.length > MAX_CONTENU_FICHIER) throw new Error('Fichier trop grand pour cet éditeur tactile.');
  const changements = { ...atelier.changements };
  if (base[chemin] === texte) delete changements[chemin];
  else changements[chemin] = texte;
  return { ...atelier, changements };
}
export function supprimerFichier(atelier: AtelierLocal, base: Record<string,string>, chemin: string): AtelierLocal {
  if (!cheminValide(chemin)) throw new Error('Chemin de fichier refusé.');
  const changements = { ...atelier.changements };
  if (Object.prototype.hasOwnProperty.call(base, chemin)) changements[chemin] = null;
  else delete changements[chemin];
  return { ...atelier, changements };
}
export function enregistrerVersion(atelier: AtelierLocal, nom: string): AtelierLocal {
  const id = 'lab-' + Date.now() + '-' + (atelier.versions.length + 1);
  const v: VersionLab = { id, nom:nom.trim() || 'Instantané sans titre', date:new Date().toISOString(),
    etat:'brouillon', changements:{...atelier.changements} };
  return { ...atelier, versions:[...atelier.versions,v], versionActive:id };
}
export function restaurerVersion(atelier: AtelierLocal, id: string): AtelierLocal {
  const selection = atelier.versions.find((v) => v.id === id);
  if (!selection) throw new Error('Version introuvable.');
  // Préserver l'état en cours avant la restauration, y compris les brouillons.
  const sauvegarde = enregistrerVersion(atelier, 'Sauvegarde avant restauration de ' + selection.nom);
  return { ...sauvegarde, changements:{...selection.changements}, versionActive:selection.id };
}
export function confirmerVersionStable(atelier: AtelierLocal, id: string): AtelierLocal {
  if (atelier.versionActive !== id) throw new Error('Seule la version sélectionnée peut être marquée stable.');
  return { ...atelier, versions:atelier.versions.map((v) => v.id===id ? {...v,etat:'stable'} : v) };
}
// Ces vérifications NE compilent PAS le code : leur résultat ne vaut jamais validation d'exécution.
export function precontrolerFichier(chemin: string, texte: string): ControleLab[] {
  const resultat: ControleLab[] = [];
  if (!cheminValide(chemin)) return [{statut:'erreur',titre:'Chemin interdit',detail:'Le fichier est en dehors des types et emplacements autorisés.'}];
  if (texte.length > MAX_CONTENU_FICHIER) return [{statut:'erreur',titre:'Fichier volumineux',detail:'Éditeur limité à 2 Mio par fichier ; assistance extérieure requise.'}];
  if (/^(<{7}|={7}|>{7})/m.test(texte)) resultat.push({statut:'erreur',titre:'Conflit non résolu',detail:'Marqueurs de fusion Git détectés.'});
  if (chemin.endsWith('.json')) {
    try { JSON.parse(texte); resultat.push({statut:'valide',titre:'JSON lisible',detail:'Syntaxe JSON analysée.'}); }
    catch (e) { resultat.push({statut:'erreur',titre:'JSON invalide',detail:e instanceof Error ? e.message : 'Erreur JSON.'}); }
  }
  if (!texte.trim()) resultat.push({statut:'avertissement',titre:'Fichier vide',detail:'Vérifier que ce contenu vide est volontaire.'});
  resultat.push({statut:'avertissement',titre:'Compilation non exécutée',detail:'La tablette ne possède pas de compilateur Expo/Metro/Hermes intégré ; ce contrôle ne valide pas le fonctionnement de l’application.'});
  return resultat;
}
export function changementNatif(chemin: string): boolean {
  return /\.(kt|java|gradle|properties|xml)$/i.test(chemin) || chemin==='app.json' || chemin==='package.json' || chemin==='package-lock.json';
}
