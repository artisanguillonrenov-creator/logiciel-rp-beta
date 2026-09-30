// Séparé de serveurLocal.ts pour que llmProvider.ts puisse normaliser
// l'adresse sans import circulaire.
export const URL_SERVEUR_LOCAL_DEFAUT = 'http://127.0.0.1:1234/v1';

export const EXEMPLES_URL_SERVEUR_LOCAL = {
  lmStudio: 'http://127.0.0.1:1234/v1',
  ollama: 'http://127.0.0.1:11434/v1',
} as const;

/**
 * Tolère ce que l'utilisateur recopie réellement : « 192.168.1.25:1234 »
 * sans schéma, l'adresse racine sans /v1, ou l'URL complète d'un endpoint
 * copiée depuis la console de LM Studio.
 */
export function normaliserUrlServeur(saisie: string | undefined): string {
  let url = (saisie ?? '').trim();
  if (!url) return URL_SERVEUR_LOCAL_DEFAUT;
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  url = url.replace(/\/+$/, '').replace(/\/(chat\/completions|models)$/i, '');
  const chemin = url.replace(/^https?:\/\/[^/]+/i, '');
  return chemin ? url : `${url}/v1`;
}
