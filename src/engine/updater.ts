import { Platform } from 'react-native';
import { VERSION_APP } from '../version';

// Fichier publié à la racine du dépôt (pas de branche "main" dans ce
// projet : tout le développement se fait sur claude/new-session-glwy6e),
// séparé du build déployé sur gh-pages pour rester consultable sans
// dépendre du succès du déploiement lui-même.
const URL_VERSION =
  'https://raw.githubusercontent.com/artisanguillonrenov-creator/logiciel-rp-beta/claude/new-session-glwy6e/version.json';

export interface InfoMiseAJour {
  versionActuelle: string;
  derniereVersion: string;
  disponible: boolean;
  url: string;
  notes?: string;
}

// Comparaison de versions sémantiques simples (MAJOR.MINOR.PATCH).
function estPlusRecente(distante: string, locale: string): boolean {
  const a = distante.split('.').map((n) => parseInt(n, 10) || 0);
  const b = locale.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

/**
 * Auto-updater "esprit" (brief Phase 2, distribution sans vraie protection) :
 * aucun téléchargement ni installation binaire automatique — ni possible
 * (web, Expo Go) ni souhaité pour cette bêta — seulement une vérification
 * de version distante et une notification avec lien vers la dernière
 * version quand elle diffère.
 */
export async function verifierMiseAJour(): Promise<InfoMiseAJour> {
  const reponse = await fetch(`${URL_VERSION}?t=${Date.now()}`);
  if (!reponse.ok) {
    throw new Error('Vérification des mises à jour indisponible pour le moment.');
  }
  const data = await reponse.json();
  if (typeof data.version !== 'string' || typeof data.url !== 'string') {
    throw new Error('Réponse de mise à jour invalide.');
  }
  // Sur Android, le lien web n'a aucun sens (rien à installer) : on pointe
  // vers l'APK quand un lien dédié est publié, sinon on retombe sur le
  // lien web par défaut plutôt que de ne rien afficher.
  const urlCiblee = Platform.OS === 'android' && typeof data.urlAndroid === 'string' ? data.urlAndroid : data.url;
  return {
    versionActuelle: VERSION_APP,
    derniereVersion: data.version,
    disponible: estPlusRecente(data.version, VERSION_APP),
    url: urlCiblee,
    notes: typeof data.notes === 'string' ? data.notes : undefined,
  };
}
