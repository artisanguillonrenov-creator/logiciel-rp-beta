import type { AppSettings, Message } from '../types';
import { assurerEmbeddings } from '../storage/embeddingsStore';
import { similariteCosinus } from './embeddings';

// Filet de sécurité pour la continuité : le pipeline de mémoire (memory.ts)
// compresse l'histoire en résumé + faits, mais une extraction périodique
// peut manquer un détail. Plutôt que de tout renvoyer au modèle (ce que la
// recherche sémantique du lore a justement remplacé pour les mêmes raisons
// de coût/bruit), on ne recherche que dans les messages bruts plus anciens
// que la fenêtre récente (L0) déjà envoyée systématiquement — voir
// NB_MESSAGES_RECENTS dans promptBuilder.ts.
const MAX_SOUVENIRS = 3;
// Similarité minimale pour retenir un message : en dessous, rien à voir
// avec la scène en cours, on préfère ne rien injecter plutôt que du bruit.
const SEUIL_PERTINENCE = 0.3;

export interface Souvenir {
  message: Message;
  score: number;
}

/**
 * Embeddings des messages plus anciens que la fenêtre récente — appel
 * réseau, à exécuter en parallèle des autres embeddings du tour (voir
 * calculerSelectionLore dans generateTurn.ts). Mis en cache par
 * assurerEmbeddings comme le lore : un message déjà sorti de la fenêtre
 * récente ne sera plus jamais réembeddé une fois calculé.
 */
export async function embedderMessagesAnciens(
  messagesAnciens: Message[],
  appSettings: AppSettings,
): Promise<Record<string, number[]>> {
  if (messagesAnciens.length === 0) return {};
  return assurerEmbeddings(
    messagesAnciens.map((m) => ({ id: m.id, contenu: m.content })),
    appSettings,
  );
}

/** Classe et retient les messages anciens les plus pertinents — calcul local, aucun appel réseau. */
export function selectionnerSouvenirs(
  messagesAnciens: Message[],
  vecteurRequete: number[],
  vecteursMessagesAnciens: Record<string, number[]>,
): Souvenir[] {
  return messagesAnciens
    .map((message) => ({
      message,
      score: vecteursMessagesAnciens[message.id] ? similariteCosinus(vecteurRequete, vecteursMessagesAnciens[message.id]) : -1,
    }))
    .filter((s) => s.score >= SEUIL_PERTINENCE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SOUVENIRS);
}

/** Formate les souvenirs retrouvés pour le prompt — jamais visible du joueur. */
export function formaterSouvenirs(souvenirs: Souvenir[], personnageNom: string): string {
  if (souvenirs.length === 0) return '';
  const lignes = [...souvenirs]
    // Ordre chronologique pour la lisibilité, même si le classement de
    // pertinence (ci-dessus) a servi à les sélectionner.
    .sort((a, b) => a.message.timestamp - b.message.timestamp)
    .map((s) => `- ${s.message.role === 'user' ? personnageNom : 'Narrateur'} : ${s.message.content}`);

  return `\n\n[MOMENTS PERTINENTS DE L'HISTOIRE]\nRetrouvés dans des échanges plus anciens que ceux ci-dessus, pertinents pour la scène en cours — à réutiliser naturellement si utile, sans jamais dire au joueur que tu les as "recherchés".\n${lignes.join('\n')}`;
}

/** Courts aperçus pour le panneau de debug — même esprit que DebugLore. */
export function formaterSouvenirsDebug(souvenirs: Souvenir[]): string[] {
  return souvenirs.map((s) => `${s.message.content.slice(0, 60)}${s.message.content.length > 60 ? '…' : ''} (${s.score.toFixed(2)})`);
}
