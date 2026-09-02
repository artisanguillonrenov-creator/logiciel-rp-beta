import {
  generateLiteRtResponse,
  isLiteRtAvailable,
  loadLiteRtModel,
  unloadLiteRtModel,
} from 'expo-litert-lm';
import { cheminModeleLocal } from '../storage/modeleLocalStore';
import type { AppelOutil, ChatMessage, ToolDefinition } from './openrouter';

// Moteur local (expo-litert-lm, natif uniquement — voir localInference.web.ts
// pour le web, jamais bundlé ensemble grâce à la résolution de plateforme de
// Metro). Ce fichier est le SEUL endroit du projet qui importe
// expo-litert-lm : le garder isolé ici évite qu'une dépendance native
// casse le build web existant.
export class ErreurMoteurLocal extends Error {}

// Le pont natif (Kotlin) peut lever ses propres exceptions (mémoire
// insuffisante, échec d'initialisation du GPU, format de modèle invalide,
// etc.) qui arrivent en JS comme des erreurs génériques, pas des
// ErreurMoteurLocal — sans ce filet, leur message se perdait et l'écran de
// conversation retombait sur un texte générique ne disant rien de la
// cause réelle.
function convertirErreurNative(e: unknown, contexte: string): ErreurMoteurLocal {
  const detail = e instanceof Error ? e.message : String(e);
  return new ErreurMoteurLocal(`${contexte} : ${detail}`);
}

// L'API d'expo-litert-lm fixe température/topK/maxTokens au CHARGEMENT du
// modèle, pas par appel (contrairement à OpenRouter où chaque pipeline
// module sa température) — limitation de la lib, pas un choix : on charge
// une fois avec des valeurs raisonnables pour de la narration et on vit
// avec la perte de réglage fin par appel en mode local.
//
// maxTokens est un plafond combiné prefill + decode (défaut de la lib :
// 2048), pas juste la longueur de la réponse générée : le prompt système
// (règles, personnage, style) plus la fenêtre de messages récents dépasse
// à lui seul ce défaut dès le premier message d'une scène un peu développée
// (observé : 2481 tokens rien qu'en prefill), d'où l'erreur native "Input
// token ids are too long". 4096 laisse de la marge sans doubler encore le
// coût mémoire d'un modèle déjà volumineux sur un appareil à 4 Go de RAM.
const MAX_TOKENS_LOCAL = 4096;
const TOP_K_LOCAL = 40;
const TEMPERATURE_LOCAL = 0.8;

let modeleCharge: string | null = null;
let chargementEnCours: Promise<void> | null = null;

export async function estDisponibleLocal(): Promise<boolean> {
  try {
    return await isLiteRtAvailable();
  } catch {
    return false;
  }
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
    if (modeleCharge !== null) {
      try {
        await unloadLiteRtModel();
      } catch {
        // On recharge quand même : mieux vaut tenter le nouveau chargement
        // que rester bloqué sur un déchargement raté.
      }
      modeleCharge = null;
    }
    try {
      await loadLiteRtModel(chemin, {
        maxTokens: MAX_TOKENS_LOCAL,
        topK: TOP_K_LOCAL,
        temperature: TEMPERATURE_LOCAL,
        preferredBackend: 'gpu',
      });
    } catch (e) {
      throw convertirErreurNative(e, 'Échec du chargement du modèle local');
    }
    modeleCharge = chemin;
  })();

  try {
    await chargementEnCours;
  } finally {
    chargementEnCours = null;
  }
}

/**
 * Gemma n'a pas de rôle système distinct : son chat template attend une
 * alternance stricte user/model. On fusionne chaque message système dans
 * le tour utilisateur qui suit.
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

export async function genererTexteLocal(messages: ChatMessage[]): Promise<string> {
  if (!(await estDisponibleLocal())) {
    throw new ErreurMoteurLocal("Le moteur local n'est pas disponible sur cet appareil (Android 12+ requis).");
  }
  await assurerModeleCharge();

  let reponse: string;
  try {
    reponse = await generateLiteRtResponse(formaterPromptGemma(messages));
  } catch (e) {
    throw convertirErreurNative(e, 'Échec de la génération locale');
  }
  const nettoyee = reponse.replace(/<end_of_turn>\s*$/i, '').trim();
  if (!nettoyee) {
    throw new ErreurMoteurLocal('Réponse vide reçue du modèle local.');
  }
  return nettoyee;
}

function formaterInstructionsOutils(outils: ToolDefinition[]): string {
  const liste = outils
    .map((o) => {
      const params = Object.entries(o.parametres)
        .map(([nom, def]) => {
          const optionnel = o.requis.includes(nom) ? '' : '?';
          const enumTxt = def.enum ? ` parmi (${def.enum.join('|')})` : '';
          return `${nom}${optionnel}: ${def.type}${enumTxt}`;
        })
        .join(', ');
      return `- ${o.nom}(${params}) — ${o.description}`;
    })
    .join('\n');

  return `Outils disponibles :\n${liste}\n\nSi un ou plusieurs outils doivent être appelés, termine ta réponse par un bloc JSON strict, seul sur sa dernière ligne, de cette forme exacte :\n{"appels": [{"outil": "nom_outil", "arguments": {...}}]}\nSi aucun outil n'est nécessaire, n'ajoute aucun bloc JSON.`;
}

function extraireAppelsOutils(brut: string): { contenu: string; appelsOutils: AppelOutil[] } {
  const correspondance = brut.match(/\{[\s\S]*"appels"[\s\S]*\}\s*$/);
  if (!correspondance || correspondance.index === undefined) {
    return { contenu: brut, appelsOutils: [] };
  }

  const contenu = brut.slice(0, correspondance.index).trim();
  try {
    const parsed = JSON.parse(correspondance[0]);
    const appelsBruts: unknown[] = Array.isArray(parsed?.appels) ? parsed.appels : [];
    const appelsOutils: AppelOutil[] = [];
    for (const a of appelsBruts) {
      const candidat = a as { outil?: unknown; arguments?: unknown };
      if (candidat && typeof candidat.outil === 'string' && candidat.arguments && typeof candidat.arguments === 'object') {
        appelsOutils.push({ nom: candidat.outil, arguments: candidat.arguments as Record<string, unknown> });
      }
    }
    return { contenu, appelsOutils };
  } catch {
    return { contenu: brut, appelsOutils: [] };
  }
}

/**
 * Fallback JSON-en-prose pour le tool calling en mode local (l'API
 * d'expo-litert-lm ne connaît que du texte, pas de function calling natif).
 * Renvoie la même forme {contenu, appelsOutils} qu'appellerModeleAvecOutils
 * pour qu'aucun appelant (worldSimulation.ts, socialDynamics.ts, qui
 * valident déjà chaque appel via tools.ts) n'ait à changer.
 */
export async function appellerModeleLocalAvecOutilsJson(
  messages: ChatMessage[],
  outils: ToolDefinition[],
): Promise<{ contenu: string; appelsOutils: AppelOutil[] }> {
  const messagesAvecInstructions: ChatMessage[] = [
    ...messages,
    { role: 'system', content: formaterInstructionsOutils(outils) },
  ];
  const brut = await genererTexteLocal(messagesAvecInstructions);
  return extraireAppelsOutils(brut);
}

export async function dechargerModeleLocal(): Promise<void> {
  if (modeleCharge === null) return;
  await unloadLiteRtModel();
  modeleCharge = null;
}
