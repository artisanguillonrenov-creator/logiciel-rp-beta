import ElyndorObjectBox from '../../modules/elyndor-objectbox';

/** Types fournis par l'inspecteur Android, sans lecture du contenu des fichiers. */
export interface EntreeStockage {
  name: string;
  path: string;
  isDirectory: boolean;
  sizeBytes: number;
  fileCount: number;
  directoryCount: number;
  incomplete: boolean;
  modifiedAt: number;
}

export interface RacineStockage {
  id: string;
  label: string;
  path: string;
  sizeBytes: number;
  fileCount: number;
  directoryCount: number;
  incomplete: boolean;
}

export interface BilanStockage {
  totalBytes: number;
  availableBytes: number;
  appBytes: number;
  fileCount: number;
  directoryCount: number;
  incomplete: boolean;
  scannedAt: number;
  roots: RacineStockage[];
}

export interface ListeStockage {
  path: string;
  entries: EntreeStockage[];
  totalChildren: number;
  nextOffset: number | null;
}

function moduleNatif() {
  if (!ElyndorObjectBox?.inspectAppStorage || !ElyndorObjectBox?.listAppStorageDirectory) {
    throw new Error('Explorateur indisponible : installe le nouvel APK Android. Une mise à jour OTA ne suffit pas.');
  }
  return ElyndorObjectBox;
}

export function formatTailleStockage(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Taille inconnue';
  if (bytes < 1024) return Math.round(bytes) + ' o';
  const units = ['Ko', 'Mo', 'Go', 'To'];
  const order = Math.min(3, Math.floor(Math.log(bytes) / Math.log(1024)) - 1);
  const valeur = bytes / Math.pow(1024, order + 1);
  return valeur.toLocaleString('fr-FR', { maximumFractionDigits: valeur >= 10 ? 1 : 2 }) + ' ' + units[order];
}

export async function analyserStockage(): Promise<BilanStockage> {
  const raw = await moduleNatif().inspectAppStorage();
  const parsed = JSON.parse(raw) as BilanStockage;
  if (!Array.isArray(parsed.roots) || !Number.isFinite(parsed.appBytes)) {
    throw new Error('Rapport de stockage invalide.');
  }
  return parsed;
}

export async function listerDossierStockage(path: string, offset = 0): Promise<ListeStockage> {
  const raw = await moduleNatif().listAppStorageDirectory(path, offset);
  const parsed = JSON.parse(raw) as ListeStockage;
  if (!Array.isArray(parsed.entries)) throw new Error('Contenu du dossier invalide.');
  return parsed;
}
