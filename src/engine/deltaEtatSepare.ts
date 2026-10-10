import { appellerModele, type AppelModeleOptions } from './elyndorCloudClient';
import { extraireEnveloppeEtat } from './noyauNarratif';

/**
 * L'état machine est extrait APRES validation de la narration visible.
 * Ce budget concerne uniquement cet appel indépendant : il ne peut pas
 * augmenter max_tokens du récit ni la fourchette Court/Moyen/Long.
 */
export const BUDGET_ETAT_TECHNIQUE = 900;

export interface EntreeDeltaEtat {
  narrationValidee: string;
  messageJoueur: string;
  contexteCanonique: string;
  storyId?: string;
}

export function optionsDeltaEtatSepare(entree: EntreeDeltaEtat): AppelModeleOptions {
  return {
    apiKey: '',
    model: '',
    storyId: entree.storyId,
    temperature: 0.1,
    maxTokens: BUDGET_ETAT_TECHNIQUE,
    diagnosticLabel: 'STATE DELTA — extraction séparée après publication validée',
    messages: [
      {
        role: 'system',
        content: `Tu es le moteur d'extraction d'état d'Elyndor, pas son narrateur.
La narration a déjà été validée : tu ne dois ni la réécrire, ni la continuer.
Retourne exclusivement un objet JSON compact, sans balises ni Markdown.
Décris UNIQUEMENT les faits établis par l'action du joueur et la narration validée.
Le canon préalable sert à identifier les changements, pas à inventer des événements.
Champs possibles (omettre les listes vides) :
events[{type,summary,actors,targets,location,witnesses,importance,public}],
stateChanges[{subject,predicate,from,to,confidence}],
knowledgeTransfers[{knower,fact,source,type,confidence}],
relationshipSignals[{from,to,trust,respect,fear,affection,hostility,reason}],
reputationSignals[{subject,faction,delta,reason,knownByPublic}],
commitments[{type,party,description,status}],
narrativeDebts[{type,source,target,summary,urgency}],
npcStates[{name,beliefs,desires,intentions}],
timeAdvanceMinutes, scene{location,changed}.
N'invente aucun changement qui ne résulte pas du texte réellement retenu.
En cas de doute, omets le champ concerné.`,
      },
      {
        role: 'user',
        content: `CANON AVANT LE TOUR :
${entree.contexteCanonique.slice(0, 7000)}

MESSAGE DU JOUEUR :
${entree.messageJoueur}

NARRATION FINALE VALIDÉE, SOURCE D'AUTORITÉ :
${entree.narrationValidee}

Extrais maintenant uniquement le JSON de l'état correspondant.`,
      },
    ],
  };
}

/** Accepte JSON brut, bloc encadré ou code fence ; ne valide jamais du texte narratif. */
export function lireDeltaEtatSepare(brut: string): Record<string, unknown> | null {
  const enveloppe = extraireEnveloppeEtat(brut);
  const source = enveloppe.trouve ? enveloppe.delta : brut.trim()
    .replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/, '');
  try {
    const objet: unknown = typeof source === 'string' ? JSON.parse(source) : source;
    if (!objet || typeof objet !== 'object' || Array.isArray(objet)) return null;
    const cles = ['events', 'stateChanges', 'knowledgeTransfers', 'relationshipSignals',
      'reputationSignals', 'commitments', 'narrativeDebts', 'npcStates', 'timeAdvanceMinutes', 'scene'];
    return cles.some(k => Object.prototype.hasOwnProperty.call(objet, k))
      ? objet as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

/** Échec de l'IA technique : le noyau fera son repli heuristique, sans toucher au récit. */
export async function genererDeltaEtatSepare(
  entree: EntreeDeltaEtat,
  appel: (options: AppelModeleOptions) => Promise<string> = appellerModele,
): Promise<Record<string, unknown> | null> {
  try {
    return lireDeltaEtatSepare(await appel(optionsDeltaEtatSepare(entree)));
  } catch {
    return null;
  }
}
