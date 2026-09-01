import type { Fact, MemoryState, Message } from '../types';
import { appellerModele } from './openrouter';

// Cadence de régénération de la mémoire simplifiée (brief section 3 :
// "résumé glissant régénéré tous les N messages" + "liste de faits clés").
// Les deux sont mis à jour ensemble pour rester simple côté beta.
export const NB_MESSAGES_AVANT_MAJ = 8;

export function doitMettreAJourMemoire(messages: Message[], dernierMessageIndexMaj: number): boolean {
  return messages.length - dernierMessageIndexMaj >= NB_MESSAGES_AVANT_MAJ;
}

export interface MiseAJourMemoireOptions {
  apiKey: string;
  model: string;
  memoireActuelle: MemoryState;
  messages: Message[];
  personnageNom: string;
}

function idFait(): string {
  return `fait-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Régénère résumé + faits clés à partir de la mémoire précédente et des
 * messages ajoutés depuis. Volontairement simple (pas de récupération
 * sémantique/temporelle/relationnelle comme dans le schéma final) : un seul
 * appel modèle qui produit un résumé mis à jour et une liste de faits.
 */
export async function mettreAJourMemoire({
  apiKey,
  model,
  memoireActuelle,
  messages,
  personnageNom,
}: MiseAJourMemoireOptions): Promise<MemoryState> {
  const nouveauxMessages = messages.slice(memoireActuelle.dernierMessageIndexMaj);
  const transcript = nouveauxMessages
    .map((m) => `${m.role === 'user' ? personnageNom : 'Narrateur'} : ${m.content}`)
    .join('\n');

  const faitsActuelsTexte = memoireActuelle.faits.length
    ? memoireActuelle.faits.map((f) => `- [${f.type}]${f.resolue ? ' (résolu)' : ''} ${f.texte}`).join('\n')
    : 'Aucun.';

  try {
    const sortie = await appellerModele({
      apiKey,
      model,
      temperature: 0.2,
      maxTokens: 500,
      messages: [
        {
          role: 'system',
          content: `Tu es le module de mémoire d'un logiciel de jeu de rôle. Tu ne racontes rien : tu maintiens une mémoire structurée. Réponds UNIQUEMENT avec un objet JSON strict de la forme :
{"resume": "...", "faits": [{"type": "personnage|lieu|promesse|autre", "texte": "...", "resolue": false}]}

Règles :
- "resume" : résumé glissant de l'histoire jusqu'ici (quelques phrases denses), en partant du résumé précédent et en intégrant les nouveaux événements.
- "faits" : liste complète et à jour des faits clés à retenir (personnages rencontrés, lieux visités, promesses/engagements faits ou non tenus). Reprends les faits précédents toujours valides, marque "resolue": true pour une promesse tenue ou une question close, retire ce qui est devenu obsolète, ajoute les nouveaux faits.
- Reste factuel, sans interprétation ni ajout non présent dans le texte.`,
        },
        {
          role: 'user',
          content: `RÉSUMÉ PRÉCÉDENT :\n${memoireActuelle.resume || '(aucun)'}\n\nFAITS PRÉCÉDENTS :\n${faitsActuelsTexte}\n\nNOUVEAUX ÉCHANGES À INTÉGRER :\n${transcript}`,
        },
      ],
    });

    const match = sortie.match(/\{[\s\S]*\}/);
    if (!match) return memoireActuelle;
    const parsed = JSON.parse(match[0]);
    const faits: Fact[] = Array.isArray(parsed.faits)
      ? parsed.faits.map((f: any) => ({
          id: idFait(),
          type: ['personnage', 'lieu', 'promesse', 'autre'].includes(f.type) ? f.type : 'autre',
          texte: String(f.texte ?? ''),
          resolue: Boolean(f.resolue),
        }))
      : memoireActuelle.faits;

    return {
      resume: typeof parsed.resume === 'string' ? parsed.resume : memoireActuelle.resume,
      faits,
      dernierMessageIndexMaj: messages.length,
    };
  } catch {
    // Échec de mise à jour : on garde l'ancienne mémoire et on retentera
    // à la prochaine occasion (l'index n'avance pas).
    return memoireActuelle;
  }
}
