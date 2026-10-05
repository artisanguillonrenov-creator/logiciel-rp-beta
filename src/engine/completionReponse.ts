import {
  appellerModeleDetaille,
  type AppelModeleOptions,
  type ChatMessage,
  type ReponseModele,
} from './elyndorCloudClient';
import { FIN_ETAT, MARQUEUR_ETAT } from './noyauNarratif';

// Réponses coupées par le plafond de tokens : au lieu de laisser la dernière
// phrase en suspens, on demande au modèle de réécrire et terminer cette seule
// phrase (et d'ajouter le bloc d'état qui n'a pas pu être écrit), puis on la
// recolle à la partie déjà complète. En cas d'échec, la phrase inachevée est
// retirée : le joueur ne voit jamais une réponse coupée net.

/**
 * Ponctuation finale, éventuellement suivie de fermetures (guillemets,
 * astérisque…), avec l'espace typographique française avant « » ».
 */
const FIN_DE_PHRASE = /[.!?…]+(?:[ \u00a0\u202f]?[»"”’*)\]])*(?=\s|$)/g;

export interface DecoupePhrase {
  /** Texte jusqu'à la dernière phrase complète (incluse). */
  base: string;
  /** Espacement d'origine entre la base et la phrase inachevée. */
  separateur: string;
  /** Phrase inachevée (vide si le texte se termine proprement). */
  reste: string;
}

export function couperALaDernierePhraseComplete(texte: string): DecoupePhrase {
  const source = texte.replace(/\s+$/, '');
  let fin = 0;
  for (const m of source.matchAll(FIN_DE_PHRASE)) fin = Math.max(fin, (m.index ?? 0) + m[0].length);
  // Un saut de ligne clôt aussi un bloc (réplique « NOM : « … » », titre…).
  const saut = source.lastIndexOf('\n');
  if (saut > fin && /[.!?…»"”*)\]]\s*$/.test(source.slice(0, saut))) fin = saut;
  const base = source.slice(0, fin).trimEnd();
  const apres = source.slice(base.length);
  const reste = apres.trim();
  const separateur = reste ? apres.slice(0, apres.length - apres.trimStart().length) || ' ' : '';
  return { base, separateur, reste };
}

/** Referme une réplique « … » ou un passage *…* restés ouverts. */
export function refermerBalisesOuvertes(texte: string): string {
  let propre = texte.trimEnd();
  const ouvrantes = (propre.match(/«/g) ?? []).length;
  const fermantes = (propre.match(/»/g) ?? []).length;
  if (ouvrantes > fermantes) propre += ' »';
  if ((propre.match(/\*/g) ?? []).length % 2 === 1) propre += '*';
  return propre;
}

export function consigneCompletion(reste: string, avecEtat = true): string {
  const etat = avecEtat ? `Termine ensuite par le bloc d'état habituel, entre ${MARQUEUR_ETAT} et ${FIN_ETAT}.` : '';
  if (!reste) {
    return `[CONSIGNE TECHNIQUE — invisible pour le joueur] Ta réponse précédente est complète, mais le bloc d'état n'a pas pu être écrit faute de place. N'écris AUCUNE narration. ${etat}`;
  }
  return `[CONSIGNE TECHNIQUE — invisible pour le joueur] Ta réponse précédente a été interrompue faute de place au milieu de cette phrase :
« ${reste} »
Réécris UNIQUEMENT cette phrase en entier et termine-la, en une ou deux phrases au plus : même style, même locuteur, réplique refermée si elle était ouverte. N'ajoute aucune suite à l'histoire et ne répète rien de ce qui précède.${etat ? `\n${etat}` : ''}`;
}

/** Messages de l'appel de complétion : l'échange d'origine + la réponse coupée + la consigne. */
export function messagesCompletion(
  messages: ChatMessage[],
  reponseCoupee: string,
  reste: string,
  avecEtat = true,
): ChatMessage[] {
  return [
    ...messages,
    { role: 'assistant', content: reponseCoupee },
    { role: 'user', content: consigneCompletion(reste, avecEtat) },
  ];
}

/** Recolle la phrase terminée par le modèle à la partie déjà complète. */
export function assemblerCompletion(decoupe: DecoupePhrase, completion: string): string {
  const suite = completion.trim();
  if (!decoupe.reste) return `${decoupe.base}\n\n${suite}`;
  return decoupe.base ? `${decoupe.base}${decoupe.separateur}${suite}` : suite;
}

/** Repli sans modèle : on retire la phrase inachevée, en refermant ce qui était ouvert. */
export function retirerPhraseInachevee(texte: string): string {
  const { base, reste } = couperALaDernierePhraseComplete(texte);
  return refermerBalisesOuvertes(base || reste);
}

/** Place laissée à la complétion : une ou deux phrases + le bloc d'état. */
const MAX_TOKENS_COMPLETION = 520;
/** Au-delà, le modèle a poursuivi l'histoire au lieu de finir la phrase. */
const MAX_CARACTERES_PHRASE_COMPLETEE = 700;

/**
 * Appel narratif principal : si la réponse est coupée par le plafond de
 * tokens pendant la narration, le modèle termine la phrase interrompue (et
 * écrit le bloc d'état). Une coupure dans le bloc d'état seul ne touche pas
 * le texte visible : extraireEnveloppeEtat s'en charge.
 */
export async function genererReponseComplete(
  options: AppelModeleOptions,
  appeler: (options: AppelModeleOptions) => Promise<ReponseModele> = appellerModeleDetaille,
  avecEtat = true,
): Promise<string> {
  const premiere = await appeler(options);
  if (!premiere.coupee || premiere.contenu.includes(MARQUEUR_ETAT)) return premiere.contenu;

  const decoupe = couperALaDernierePhraseComplete(premiere.contenu);
  // Sans bloc d'état à écrire, une réponse finie sur une phrase complète n'a rien à compléter.
  if (!decoupe.reste && !avecEtat) return premiere.contenu;
  try {
    const suite = await appeler({
      ...options,
      temperature: Math.min(options.temperature ?? 0.7, 0.7),
      maxTokens: MAX_TOKENS_COMPLETION,
      messages: messagesCompletion(options.messages, premiere.contenu, decoupe.reste, avecEtat),
    });
    const i = suite.contenu.indexOf(MARQUEUR_ETAT);
    let phrase = (i >= 0 ? suite.contenu.slice(0, i) : suite.contenu).trim();
    const etat = i >= 0 ? suite.contenu.slice(i) : '';
    if (suite.coupee && !etat) phrase = retirerPhraseInachevee(phrase);
    if (phrase.length > MAX_CARACTERES_PHRASE_COMPLETEE) {
      phrase = retirerPhraseInachevee(phrase.slice(0, MAX_CARACTERES_PHRASE_COMPLETEE));
    }
    if (decoupe.reste && !phrase) return retirerPhraseInachevee(premiere.contenu);
    const assemble = decoupe.reste ? assemblerCompletion(decoupe, refermerBalisesOuvertes(phrase)) : decoupe.base;
    return etat ? `${assemble}\n\n${etat}` : assemble;
  } catch (erreur) {
    if (options.signal?.aborted) throw erreur;
    return retirerPhraseInachevee(premiere.contenu);
  }
}
