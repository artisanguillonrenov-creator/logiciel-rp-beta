import { assurerPodElyndorCloud, urlNarrationElyndorCloud } from './elyndorCloud';
import { reglagesFournisseursActifs, resoudreRouteTexte } from './fournisseursRuntime';
import type { PlageLongueur } from '../concepteur/reglagesNarrateur';

/**
 * Ponctuation de phrase OU réplique close par un guillemet français.
 * Une guillemeture ouverte n'est pas une fin valide.
 */
export function finDeNarrationComplete(texte: string): boolean {
  const propre = texte.trim();
  if (!propre) return false;
  const ouverts = (propre.match(/«/g) ?? []).length;
  const fermes = (propre.match(/»/g) ?? []).length;
  if (ouverts > fermes) return false;
  return /(?:[.!?…](?:[\s»”"'*)\]]*)|[»”](?:[\s*)\]]*))$/.test(propre);
}
export function plageRespectee(nombre: number, plage: PlageLongueur): boolean {
  return Number.isSafeInteger(nombre) && nombre >= plage.min && nombre <= plage.max;
}

/** Utilise le tokenizer DU modèle réellement chargé sur llama-server, non une approximation. */
export async function compterTokensNarration(
  texte: string,
  requete: typeof fetch = fetch,
  preparerPod: () => Promise<unknown> = assurerPodElyndorCloud,
): Promise<number | null> {
  // Les fournisseurs distants ne disposent pas du tokenizer llama.cpp.
  // Estimation locale explicite : ne jamais réveiller RunPod en mode OpenRouter.
  const route = resoudreRouteTexte(reglagesFournisseursActifs());
  if (route.fournisseur !== 'runpod' && requete === fetch && preparerPod === assurerPodElyndorCloud) {
    const caract = Array.from(texte).length;
    return Math.max(1, Math.round(caract / 3.7));
  }
  try {
    await preparerPod();
    const controleur = new AbortController();
    const minuteur = setTimeout(() => controleur.abort(), 8000);
    try {
      const resultat = await requete(urlNarrationElyndorCloud().replace(/\/v1\/?$/, '') + '/tokenize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: texte, add_special: false, parse_special: false }),
        signal: controleur.signal,
      });
      if (!resultat.ok) return null;
      const contenu: unknown = await resultat.json();
      const tokens = (contenu as { tokens?: unknown } | null)?.tokens;
      return Array.isArray(tokens) && (tokens.length > 0 || texte.length === 0) && tokens.every(x => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0)
        ? tokens.length : null;
    } finally {
      clearTimeout(minuteur);
    }
  } catch { return null; }
}

/**
 * Si le budget est déjà respecté mais la dernière phrase est tronquée,
 * garde le plus long préfixe qui se termine proprement et reste dans la
 * fourchette. N'invente aucune fin et ne consomme aucun appel de génération.
 * Le comptage du préfixe utilise toujours le tokenizer réel du pod.
 */
export async function recupererFinCompleteDansPlage(
  texte: string,
  plage: PlageLongueur,
  compter: (texte: string) => Promise<number | null>,
): Promise<{ texte: string; tokens: number } | null> {
  if (!texte.trim() || finDeNarrationComplete(texte)) return null;
  const fins = [...texte.matchAll(/[.!?…»”](?=\s|[»”"'*)\]]|$)/g)];
  let essais = 0;
  for (let i = fins.length - 1; i >= 0 && essais < 12; i--) {
    const candidat = texte.slice(0, (fins[i].index ?? 0) + 1).trimEnd();
    if (!candidat || candidat.length === texte.trim().length ||
        !finDeNarrationComplete(candidat)) continue;
    essais++;
    const tokens = await compter(candidat);
    if (tokens !== null && plageRespectee(tokens, plage)) {
      return { texte: candidat, tokens };
    }
    if (tokens !== null && tokens < plage.min) break;
  }
  return null;
}

export interface ResultatControleLongueur {
  texte: string;
  tokens: number | null;
  conforme: boolean;
  corrige: boolean;
  /** Un contrôle absent n'est jamais présenté comme une conformité certifiée. */
  verification: 'exacte' | 'estimee' | 'indisponible';
}

interface OptionsControle {
  texte: string;
  plage: PlageLongueur;
  temperature: number;
  storyId?: string;
  samplers?: Record<string, number>;
  compter?: (texte: string) => Promise<number | null>;
  reformuler?: (texte: string, plage: PlageLongueur) => Promise<string>;
}

/**
 * Dernières fins de phrases réellement fermées, dans l'ordre décroissant.
 * Ne coupe ni à l'intérieur d'une citation encore ouverte, ni après un
 * simple marqueur de dialogue. Une réplique « … » complète reste valide.
 */
function prefixesComplets(texte: string): string[] {
  const resultats: string[] = [];
  const vus = new Set<string>();
  const fins = /(?:[.!?…]+(?:[ \u00a0\u202f]?[»"”'*)\]])*|[»”])(?=\s|$)/g;
  for (const fin of texte.matchAll(fins)) {
    const candidat = texte.slice(0, (fin.index ?? 0) + fin[0].length).trimEnd();
    if (!candidat || vus.has(candidat) || !finDeNarrationComplete(candidat)) continue;
    vus.add(candidat);
    resultats.push(candidat);
  }
  return resultats.reverse();
}

/**
 * Un seul contrôle de sortie : mesure le texte visible et ne garde, si la
 * génération finit au milieu d'une phrase (ou dépasse le plafond après
 * une réparation), que sa dernière phrase complète.
 *
 * La plage vient des réglages concepteur. Une réponse sous le minimum
 * reste publiable : aucun nouveau prompt, aucun refus pour longueur.
 * Sans phrase terminée, conserver le texte original plutôt que publier vide.
 */
export async function controlerLongueurNarration({
  texte, plage, compter = compterTokensNarration,
}: OptionsControle): Promise<ResultatControleLongueur> {
  const propre = texte.trim();
  const verification = compter === compterTokensNarration &&
    resoudreRouteTexte(reglagesFournisseursActifs()).fournisseur !== 'runpod'
    ? 'estimee' as const : 'exacte' as const;

  async function mesurer(valeur: string): Promise<number | null> {
    try { return await compter(valeur); }
    catch { return null; } // Un compteur indisponible ne bloque pas le jeu.
  }

  let retenu = propre;
  let tokens = await mesurer(retenu);
  const interrompue = !finDeNarrationComplete(retenu);
  const depassement = tokens !== null && tokens > plage.max;

  if (interrompue || depassement) {
    const candidats = prefixesComplets(retenu).filter(c => c !== retenu);
    for (const candidat of candidats) {
      const mesure = await mesurer(candidat);
      // En cas de dépassement connu, rechercher une phrase sous le plafond.
      // Le minimum reste indicatif : mieux vaut une phrase terminée et courte.
      if (depassement && mesure !== null && mesure > plage.max) continue;
      if (depassement && mesure === null && !interrompue) break;
      retenu = candidat;
      tokens = mesure;
      break;
    }
  }

  return {
    texte: retenu,
    tokens,
    conforme: tokens !== null && plageRespectee(tokens, plage),
    corrige: retenu !== propre,
    verification: tokens === null ? 'indisponible' : verification,
  };
}
