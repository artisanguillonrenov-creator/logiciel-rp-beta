import { assurerPodElyndorCloud, urlNarrationElyndorCloud } from './elyndorCloud';
import { genererReponseComplete } from './completionReponse';
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

export interface ResultatControleLongueur {
  texte: string;
  tokens: number | null;
  conforme: boolean;
  corrige: boolean;
  /** Un contrôle absent n'est jamais présenté comme une conformité certifiée. */
  verification: 'exacte' | 'indisponible';
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
 * Maximum deux reformulations. Pas de coupe aveugle à un nombre de caractères.
 * Quand le tokenizer est disponible, une réponse hors plage ne passe jamais
 * silencieusement : échec explicite plutôt que réponse non conforme.
 */
export async function controlerLongueurNarration({
  texte, plage, temperature, storyId, samplers, compter = compterTokensNarration,
  reformuler,
}: OptionsControle): Promise<ResultatControleLongueur> {
  let candidate = texte.trim();
  let tokens = await compter(candidate);
  const produire = reformuler ?? (async (a: string, cible: PlageLongueur) => {
    const texteGenere = await genererReponseComplete({
      apiKey: '', model: '',
      storyId, samplers,
      temperature: Math.min(temperature, 0.7),
      maxTokens: cible.max,
      diagnosticLabel: 'Régulation du narrateur — longueur',
      messages: [
        { role: 'system', content: 'Tu es un éditeur de texte de jeu de rôle. Réécris la narration sans changer les faits, les noms, les paroles essentielles, les décisions du joueur ni les conséquences. N\'ajoute rien à l\'histoire. Termine naturellement chaque phrase et chaque réplique. Retourne uniquement la narration, sans commentaires ni bloc d\'état.' },
        { role: 'user', content: `Réécris le texte suivant entre ${cible.min} et ${cible.max} tokens de texte visible, en visant ${Math.round((cible.min + cible.max) / 2)} tokens. Préserve les événements, le point d'arrêt et les répliques. Texte :\n\n${a}` },
      ],
    }, undefined, false);
    return texteGenere.trim();
  });

  for (let essai = 0; essai <= 2; essai++) {
    if (finDeNarrationComplete(candidate) && tokens !== null && plageRespectee(tokens, plage)) {
      return { texte: candidate, tokens, conforme: true, corrige: essai > 0, verification: 'exacte' };
    }
    if (essai === 2) break;
    // Une longueur invérifiable n'est jamais publiée en mode strict.
    if (tokens === null) throw new Error('Comptage exact des tokens indisponible : aucune narration non vérifiée ne sera publiée.');
    const suivant = (await produire(candidate, plage)).trim();
    if (!suivant) break;
    candidate = suivant;
    tokens = await compter(candidate);
  }
  if (tokens !== null && (!plageRespectee(tokens, plage) || !finDeNarrationComplete(candidate))) {
    throw new Error(`Réponse hors fourchette ou incomplète (${tokens} tokens, attendu ${plage.min}–${plage.max}). Régénère ce tour.`);
  }
  throw new Error('Comptage exact des tokens indisponible : aucune narration non vérifiée ne sera publiée.');
}
