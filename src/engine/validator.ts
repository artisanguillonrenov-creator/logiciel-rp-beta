import type { Fact, StoryMeta, ValidationResult } from '../types';
import { appellerModele } from './openrouter';

// Tournures qui trahissent une décision prise à la place du joueur —
// violation de la règle 7 (l'IA ne contrôle jamais le joueur) et de
// [MÉTA] Agentivité du Joueur. Vérification locale, gratuite, avant tout
// appel réseau supplémentaire.
const TOURNURES_INTERDITES = [
  'tu décides de',
  'tu décides que',
  'tu choisis de',
  'tu choisis que',
  'tu acceptes de',
  'tu refuses de',
  'tu penses que',
  'tu te dis que',
  'tu ressens le besoin de',
  'tu es convaincu',
  'tu préfères',
  'tu optes pour',
  'tu te sens obligé',
  'tu réalises que tu dois',
];

export function validerAgentiviteHeuristique(reponse: string): ValidationResult {
  const texte = reponse.toLowerCase();
  const raisons = TOURNURES_INTERDITES.filter((t) => texte.includes(t)).map(
    (t) => `Tournure suspecte détectée : "${t}" (décision imposée au joueur).`,
  );
  return { ok: raisons.length === 0, raisons };
}

export interface ValidationLLMOptions {
  apiKey: string;
  model: string;
  reponse: string;
  faits: Fact[];
  meta: StoryMeta;
}

/**
 * Vérification basique complémentaire via le modèle lui-même : continuité,
 * respect du canon, absence de contradiction. Pas de réparation
 * sophistiquée — juste un signal exploitable pour une nouvelle tentative.
 */
export async function validerReponseLLM({
  apiKey,
  model,
  reponse,
  faits,
  meta,
}: ValidationLLMOptions): Promise<ValidationResult> {
  const faitsTexte = faits.length
    ? faits.map((f) => `- [${f.type}] ${f.texte}`).join('\n')
    : 'Aucun fait établi.';

  try {
    const sortie = await appellerModele({
      apiKey,
      model,
      temperature: 0,
      maxTokens: 200,
      messages: [
        {
          role: 'system',
          content: `Tu es un vérificateur automatique, pas un narrateur. Réponds UNIQUEMENT avec un objet JSON strict, sans texte autour, de la forme :
{"ok": true|false, "raisons": ["..."]}

Le texte à vérifier est une réponse de narrateur de jeu de rôle. Personnage du joueur : ${meta.personnageNom} (${meta.personnageDescription}).

Faits établis à respecter :
${faitsTexte}

Marque ok=false si le texte à vérifier :
- contredit un fait établi ci-dessus,
- renomme ou dénature un personnage fiché,
- décrit une action, une parole ou une pensée du joueur (${meta.personnageNom}) que rien n'indique qu'il a initiée lui-même.
Sinon, ok=true.`,
        },
        { role: 'user', content: reponse },
      ],
    });

    const match = sortie.match(/\{[\s\S]*\}/);
    if (!match) return { ok: true, raisons: [] };
    const parsed = JSON.parse(match[0]);
    return {
      ok: Boolean(parsed.ok),
      raisons: Array.isArray(parsed.raisons) ? parsed.raisons : [],
    };
  } catch {
    // En cas d'échec du vérificateur (réseau, parsing), on ne bloque pas
    // la génération : la vérification heuristique reste le filet minimal.
    return { ok: true, raisons: [] };
  }
}

export function fusionnerValidations(...resultats: ValidationResult[]): ValidationResult {
  return {
    ok: resultats.every((r) => r.ok),
    raisons: resultats.flatMap((r) => r.raisons),
  };
}
