import type { FournisseurLLM } from '../types';
import { nettoyerRaisonnementInterne } from './responseSanitizer';

/**
 * Politique de raisonnement d'un modèle — point unique de vérité pour
 * "aucun raisonnement interne ne doit jamais apparaître dans l'interface
 * RP". Ce logiciel est exclusivement du RP : contrairement à un assistant
 * généraliste où l'utilisateur peut vouloir lire la chaîne de raisonnement,
 * ici elle ne doit JAMAIS atteindre le frontend. reasoningPolicy ne prend
 * donc jamais 'visible' en pratique (voir résolveur ci-dessous) — le type
 * documente les deux mécanismes disponibles, pas un choix laissé à l'appelant.
 * - 'disabled' : le fournisseur expose un paramètre natif pour couper le
 *   raisonnement à la source (privilégié : pas de tokens de raisonnement
 *   générés, donc ni coût ni fuite possible).
 * - 'hidden'   : aucun paramètre natif connu (ou modèle non identifié) ; le
 *   raisonnement peut être généré côté fournisseur mais est systématiquement
 *   filtré avant de quitter la couche provider.
 */
export type ReasoningPolicy = 'hidden' | 'disabled' | 'visible';

export interface ProfilRaisonnementModele {
  /** Le modèle est connu pour produire un raisonnement interne (chain-of-thought). */
  supportsReasoning: boolean;
  reasoningPolicy: ReasoningPolicy;
  /** Fusionnés dans le corps de la requête pour désactiver nativement le
   * raisonnement côté fournisseur, quand celui-ci l'expose. */
  reasoningRequestParameters?: Record<string, unknown>;
  /** Balises de repli à retirer du texte si le modèle y injecte quand même
   * son raisonnement (malgré la désactivation native, ou en son absence). */
  balisesRaisonnement: string[];
}

const BALISES_PAR_DEFAUT = ['think', 'analysis'];

/**
 * Familles de modèles connues pour raisonner en interne. Motifs, pas des ID
 * exacts : l'utilisateur choisit un identifiant libre dans le catalogue
 * OpenRouter/Infermatic, jamais une liste fermée qu'on pourrait énumérer.
 * Une famille absente de ce registre reste protégée par les balises par
 * défaut et, sur OpenRouter, par le paramètre natif — l'absence d'entrée ne
 * désactive aucune protection, elle ne fait qu'omettre un jeu de balises
 * spécifique.
 */
const FAMILLES_A_RAISONNEMENT: Array<{ motif: RegExp; balises?: string[] }> = [
  { motif: /deepseek/i },
  { motif: /qwen[ -]?3|qwq/i },
  { motif: /\bo1\b|\bo3\b|\bo4-mini\b|gpt-oss/i, balises: ['analysis', 'think'] },
  { motif: /gemini.*thinking|gemini-2\.[5-9]/i },
  { motif: /grok-(3|4)/i },
  { motif: /glm-4\.?5|kimi-k2-thinking/i },
];

function estConnuPourRaisonner(model: string): { supportsReasoning: boolean; balises: string[] } {
  const famille = FAMILLES_A_RAISONNEMENT.find((f) => f.motif.test(model));
  if (!famille) return { supportsReasoning: false, balises: BALISES_PAR_DEFAUT };
  return { supportsReasoning: true, balises: famille.balises ?? BALISES_PAR_DEFAUT };
}

/**
 * Point unique de résolution de la politique de raisonnement pour un appel
 * — c'est ici, et nulle part ailleurs, que la protection est décidée. Le
 * prompt système peut en plus demander au modèle de ne pas exposer son
 * raisonnement, mais ce n'est qu'une couche cosmétique : elle ne garantit
 * rien côté modèle et n'est pas ce qui protège l'interface.
 */
export function resoudreProfilRaisonnement(
  fournisseur: Exclude<FournisseurLLM, 'local'>,
  model: string,
): ProfilRaisonnementModele {
  if (fournisseur === 'codex') {
    // Codex App Server n'expose pas ce raisonnement via le corps d'une
    // requête REST (transport JSON-RPC/WebSocket, voir
    // codexAppServerClient.ts) : la protection se joue en deux temps,
    // toujours côté client — le transport ignore purement et simplement
    // toute notification dont la méthode évoque un canal de raisonnement
    // (reasoning/analysis/thinking), puis le texte final passe quand même
    // ici par le même filtrage de repli que les autres fournisseurs, au cas
    // où le modèle l'injecterait malgré tout dans le texte visible. Toute
    // la famille de modèles Codex/GPT descend de familles connues pour
    // raisonner en interne : supportsReasoning est donc toujours vrai,
    // indépendamment de l'ID de modèle choisi par l'utilisateur (jamais
    // codé en dur ici, voir section 7 du chantier).
    return { supportsReasoning: true, reasoningPolicy: 'hidden', balisesRaisonnement: BALISES_PAR_DEFAUT };
  }

  const { supportsReasoning, balises } = estConnuPourRaisonner(model);

  if (fournisseur === 'openrouter') {
    // Paramètre unifié OpenRouter : coupe le raisonnement à la source pour
    // tout modèle qui l'expose, quelle que soit la famille sous-jacente
    // (ignoré sans erreur par les modèles qui ne le supportent pas).
    return {
      supportsReasoning,
      reasoningPolicy: 'disabled',
      reasoningRequestParameters: { reasoning: { enabled: false } },
      balisesRaisonnement: balises,
    };
  }

  // Infermatic (et tout futur fournisseur sans paramètre natif documenté) :
  // pas de moyen fiable de couper le raisonnement à la source, donc
  // politique 'hidden' — filtrage systématique de la réponse ci-dessous.
  return { supportsReasoning, reasoningPolicy: 'hidden', balisesRaisonnement: balises };
}

/**
 * Champs de réponse connus pour porter du raisonnement brut chez un
 * fournisseur ou un autre (API OpenAI-like "reasoning_content", unifié
 * OpenRouter "reasoning"/"reasoning_details", variantes "analysis"/
 * "thinking") — jamais lus pour construire la réponse visible, toujours
 * retirés avant que l'objet ne puisse remonter plus loin dans la pile.
 */
const CHAMPS_RAISONNEMENT_A_IGNORER = [
  'reasoning',
  'reasoning_content',
  'reasoning_details',
  'analysis',
  'thinking',
] as const;

/**
 * Applique la politique de raisonnement à un message brut d'API, en place :
 * retire les champs dédiés au raisonnement (jamais transmis au frontend) et
 * nettoie le texte visible des balises de raisonnement déclarées par le
 * profil du modèle — repli pour les modèles qui l'injectent dans content
 * malgré la désactivation native. Seules ces balises explicitement connues
 * sont retirées : pas de regex générique qui risquerait de supprimer de la
 * narration RP légitime (ex. un personnage qui "pense" ou "analyse" la
 * situation dans le récit).
 */
export function appliquerPolitiqueRaisonnement(
  message: Record<string, unknown> | null | undefined,
  profil: ProfilRaisonnementModele,
): void {
  if (profil.reasoningPolicy === 'visible') {
    // Invariant du logiciel : jamais de raisonnement visible en RP. Un
    // profil qui l'affirmerait serait un bug de configuration, pas un choix
    // à honorer.
    throw new Error('reasoningPolicy "visible" interdit : le raisonnement ne doit jamais atteindre le frontend RP.');
  }
  if (!message || typeof message !== 'object') return;
  for (const champ of CHAMPS_RAISONNEMENT_A_IGNORER) {
    delete message[champ];
  }
  if (typeof message.content === 'string') {
    message.content = nettoyerRaisonnementInterne(message.content, profil.balisesRaisonnement);
  }
}
