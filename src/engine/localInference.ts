import {
  generateLiteRtResponse,
  isLiteRtAvailable,
  loadLiteRtModel,
  unloadLiteRtModel,
} from 'expo-litert-lm';
import { initLlama } from 'llama.rn';
import { cheminModeleLocal } from '../storage/modeleLocalStore';
import type { AppelOutil, ChatMessage, ToolDefinition } from './openrouter';
import { ajouterInstructionsOutilsJson, extraireAppelsOutilsJson } from './toolCallingJson';

// Moteur local natif Android.
// - .gguf   -> llama.rn / llama.cpp
// - .litertlm / .task -> ancien moteur LiteRT-LM conservé pour compatibilité
// Le web continue d'utiliser localInference.web.ts et n'embarque aucun de ces
// runtimes natifs grâce à la résolution de plateforme de Metro.
export class ErreurMoteurLocal extends Error {}

function convertirErreurNative(e: unknown, contexte: string): ErreurMoteurLocal {
  const detail = e instanceof Error ? e.message : String(e);
  return new ErreurMoteurLocal(`${contexte} : ${detail}`);
}

const MAX_TOKENS_LOCAL = 4096;
const TOP_K_LOCAL = 40;
const TEMPERATURE_LOCAL = 0.8;
const N_PREDICT_GGUF = 700;
const STOP_GGUF = [
  '</s>',
  '<|end|>',
  '<|eot_id|>',
  '<|end_of_text|>',
  '<|im_end|>',
  '<|EOT|>',
  '<|END_OF_TURN_TOKEN|>',
  '<|end_of_turn|>',
  '<|endoftext|>',
];

let modeleCharge: string | null = null;
let backendCharge: 'gguf' | 'litert' | null = null;
let chargementEnCours: Promise<void> | null = null;
let contexteGGUF: Awaited<ReturnType<typeof initLlama>> | null = null;

function estGGUF(chemin: string): boolean {
  return chemin.toLowerCase().endsWith('.gguf');
}

export async function estDisponibleLocal(): Promise<boolean> {
  const chemin = cheminModeleLocal();
  if (chemin && estGGUF(chemin)) {
    // Si ce fichier natif est chargé, l'import de llama.rn a déjà réussi.
    return true;
  }
  try {
    return await isLiteRtAvailable();
  } catch {
    return false;
  }
}

async function dechargerRuntimeActif(): Promise<void> {
  if (backendCharge === 'gguf' && contexteGGUF) {
    try {
      await contexteGGUF.release();
    } catch {
      // On tente quand même le prochain chargement.
    }
    contexteGGUF = null;
  }

  if (backendCharge === 'litert') {
    try {
      await unloadLiteRtModel();
    } catch {
      // On tente quand même le prochain chargement.
    }
  }

  backendCharge = null;
  modeleCharge = null;
}

async function assurerModeleCharge(): Promise<void> {
  const chemin = cheminModeleLocal();
  if (!chemin) {
    throw new ErreurMoteurLocal("Aucun modèle local importé. Va dans Réglages pour l'importer.");
  }
  if (modeleCharge === chemin) return;

  if (chargementEnCours) {
    await chargementEnCours;
    if (modeleCharge === chemin) return;
  }

  chargementEnCours = (async () => {
    if (modeleCharge !== null || backendCharge !== null) {
      await dechargerRuntimeActif();
    }

    if (estGGUF(chemin)) {
      try {
        // Réglage volontairement conservateur pour tablette : 4K de contexte
        // et CPU uniquement. Cela évite de dépendre d'un GPU Android précis et
        // garde la consommation mémoire compatible avec davantage d'appareils.
        contexteGGUF = await initLlama({
          model: chemin,
          n_ctx: MAX_TOKENS_LOCAL,
          n_batch: 256,
          n_threads: 4,
          n_gpu_layers: 0,
          use_mlock: false,
        });
      } catch (e) {
        contexteGGUF = null;
        throw convertirErreurNative(e, 'Échec du chargement du modèle GGUF');
      }
      backendCharge = 'gguf';
      modeleCharge = chemin;
      return;
    }

    try {
      // Compatibilité avec les anciens petits modèles Android déjà utilisés
      // par Elyndor (.litertlm / .task).
      await loadLiteRtModel(chemin, {
        maxTokens: MAX_TOKENS_LOCAL,
        topK: TOP_K_LOCAL,
        temperature: TEMPERATURE_LOCAL,
        preferredBackend: 'gpu',
      });
    } catch (e) {
      throw convertirErreurNative(e, 'Échec du chargement du modèle LiteRT local');
    }
    backendCharge = 'litert';
    modeleCharge = chemin;
  })();

  try {
    await chargementEnCours;
  } finally {
    chargementEnCours = null;
  }
}

/**
 * Gemma LiteRT n'a pas de rôle système distinct : son chat template attend
 * une alternance stricte user/model. Cette fonction reste uniquement pour
 * l'ancien backend LiteRT. llama.rn utilise directement le chat template
 * inclus dans le GGUF.
 */
function formaterPromptGemma(messages: ChatMessage[]): string {
  const tours: { role: 'user' | 'model'; contenu: string }[] = [];
  let prefixeSysteme = '';

  for (const m of messages) {
    if (m.role === 'system') {
      prefixeSysteme += (prefixeSysteme ? '\n\n' : '') + m.content;
      continue;
    }
    const role = m.role === 'assistant' ? 'model' : 'user';
    if (role === 'user' && prefixeSysteme) {
      tours.push({ role: 'user', contenu: `${prefixeSysteme}\n\n${m.content}` });
      prefixeSysteme = '';
    } else {
      tours.push({ role, contenu: m.content });
    }
  }
  if (prefixeSysteme) {
    tours.push({ role: 'user', contenu: prefixeSysteme });
  }

  const corps = tours.map((t) => `<start_of_turn>${t.role}\n${t.contenu}<end_of_turn>\n`).join('');
  return `${corps}<start_of_turn>model\n`;
}

function messagesPourLlama(messages: ChatMessage[]) {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
    content: m.content,
  }));
}

export async function genererTexteLocal(messages: ChatMessage[]): Promise<string> {
  await assurerModeleCharge();

  if (backendCharge === 'gguf') {
    if (!contexteGGUF) {
      throw new ErreurMoteurLocal('Le contexte GGUF local n’est pas initialisé.');
    }
    try {
      const resultat = await contexteGGUF.completion({
        messages: messagesPourLlama(messages) as any,
        n_predict: N_PREDICT_GGUF,
        temperature: TEMPERATURE_LOCAL,
        top_k: TOP_K_LOCAL,
        top_p: 0.95,
        stop: STOP_GGUF,
      });
      const nettoyee = (resultat.text ?? '').trim();
      if (!nettoyee) {
        throw new ErreurMoteurLocal('Réponse vide reçue du modèle GGUF local.');
      }
      return nettoyee;
    } catch (e) {
      if (e instanceof ErreurMoteurLocal) throw e;
      throw convertirErreurNative(e, 'Échec de la génération GGUF locale');
    }
  }

  if (!(await estDisponibleLocal())) {
    throw new ErreurMoteurLocal("Le moteur local LiteRT n'est pas disponible sur cet appareil (Android 12+ requis).");
  }

  let reponse: string;
  try {
    reponse = await generateLiteRtResponse(formaterPromptGemma(messages));
  } catch (e) {
    throw convertirErreurNative(e, 'Échec de la génération LiteRT locale');
  }
  const nettoyee = reponse.replace(/<end_of_turn>\s*$/i, '').trim();
  if (!nettoyee) {
    throw new ErreurMoteurLocal('Réponse vide reçue du modèle local.');
  }
  return nettoyee;
}

/**
 * Fallback JSON-en-prose pour le tool calling en mode local. Il garde la
 * même forme {contenu, appelsOutils} qu'appellerModeleAvecOutils afin que les
 * moteurs narratifs existants n'aient rien à changer.
 */
export async function appellerModeleLocalAvecOutilsJson(
  messages: ChatMessage[],
  outils: ToolDefinition[],
): Promise<{ contenu: string; appelsOutils: AppelOutil[] }> {
  const messagesAvecInstructions = ajouterInstructionsOutilsJson(messages, outils);
  const brut = await genererTexteLocal(messagesAvecInstructions);
  return extraireAppelsOutilsJson(brut);
}

export async function dechargerModeleLocal(): Promise<void> {
  if (modeleCharge === null && backendCharge === null) return;
  await dechargerRuntimeActif();
}
