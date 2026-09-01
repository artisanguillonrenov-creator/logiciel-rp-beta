import type { AppSettings, BeatNarratif, DirecteurState, Message, NiveauTension } from '../types';
import { appellerModele } from './openrouter';

const NIVEAUX_TENSION: NiveauTension[] = ['calme', 'montante', 'climax', 'retombee'];

// Nombre de messages sans nouveau beat narratif au-delà duquel la scène est
// jugée stagnante — plus large que la cadence de mise à jour du directeur
// (voir generateTurn.ts) pour ne pas signaler une fausse stagnation dès le
// premier cycle sans développement notable.
const SEUIL_STAGNATION = 12;

function idBeat(): string {
  return `beat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface SortieDirecteur {
  arcActuel: string;
  tension: NiveauTension;
  beatMajeur: boolean;
  nouveauxBeats: string[];
  beatsResolus: string[];
}

async function analyserDirecteur(
  appSettings: AppSettings,
  transcript: string,
  directeurActuel: DirecteurState,
): Promise<SortieDirecteur | null> {
  const beatsOuvertsTexte = directeurActuel.beats
    .filter((b) => !b.paye)
    .map((b) => `- (id: ${b.id}) ${b.description}`)
    .join('\n') || 'Aucun.';

  try {
    const sortie = await appellerModele({
      apiKey: appSettings.openRouterApiKey,
      model: appSettings.model,
      temperature: 0.3,
      maxTokens: 400,
      messages: [
        {
          role: 'system',
          content: `Tu es le directeur narratif d'un jeu de rôle textuel : tu n'écris rien pour le joueur, tu observes la scène récente pour évaluer où en est l'histoire. Réponds UNIQUEMENT avec un JSON strict :
{"arcActuel": "résumé en une phrase de ce qui pousse l'histoire en ce moment", "tension": "calme|montante|climax|retombee", "beatMajeur": true/false, "nouveauxBeats": ["élément planté à payer plus tard, en une phrase", ...], "beatsResolus": ["id des éléments en attente ci-dessous qui viennent d'être payés", ...]}

"beatMajeur" est vrai seulement si un développement significatif fait avancer l'intrigue (révélation, décision qui engage, complication, tournant) — pas une simple réplique ou description.
"nouveauxBeats" : uniquement des éléments explicitement plantés dans le texte (un secret évoqué, une menace annoncée, une promesse) qui appellent une suite. Liste vide si rien.
"beatsResolus" : reprends les id ci-dessous seulement si le texte règle explicitement cet élément.

Éléments en attente de payoff :
${beatsOuvertsTexte}`,
        },
        { role: 'user', content: transcript },
      ],
    });

    const match = sortie.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    return {
      arcActuel: typeof parsed.arcActuel === 'string' ? parsed.arcActuel.trim() : directeurActuel.arcActuel,
      tension: NIVEAUX_TENSION.includes(parsed.tension) ? parsed.tension : directeurActuel.tension,
      beatMajeur: parsed.beatMajeur === true,
      nouveauxBeats: Array.isArray(parsed.nouveauxBeats)
        ? parsed.nouveauxBeats.filter((b: unknown) => typeof b === 'string' && b.trim())
        : [],
      beatsResolus: Array.isArray(parsed.beatsResolus)
        ? parsed.beatsResolus.filter((b: unknown) => typeof b === 'string')
        : [],
    };
  } catch {
    return null;
  }
}

export interface MiseAJourDirecteurOptions {
  appSettings: AppSettings;
  directeurActuel: DirecteurState;
  messages: Message[];
  depuisIndex: number;
}

/**
 * Story Director / Scene Director (brief Phase 2) : à la même cadence que
 * la mémoire et le lore émergent, évalue l'arc en cours, la tension et les
 * éléments plantés en attente de payoff — sans jamais écrire de texte
 * narratif lui-même, seulement l'état qui orientera la prochaine réponse
 * (voir formaterDirection dans ce fichier, injecté par generateTurn.ts).
 */
export async function mettreAJourDirecteur({
  appSettings,
  directeurActuel,
  messages,
  depuisIndex,
}: MiseAJourDirecteurOptions): Promise<DirecteurState> {
  const nouveauxMessages = messages.slice(depuisIndex);
  if (nouveauxMessages.length === 0) return directeurActuel;

  const transcript = nouveauxMessages
    .map((m) => `${m.role === 'user' ? 'Joueur' : 'Narrateur'} : ${m.content}`)
    .join('\n');

  const analyse = await analyserDirecteur(appSettings, transcript, directeurActuel);
  if (!analyse) return directeurActuel;

  const beats: BeatNarratif[] = directeurActuel.beats.map((b) =>
    analyse.beatsResolus.includes(b.id) ? { ...b, paye: true } : b,
  );
  analyse.nouveauxBeats.forEach((description) => {
    beats.push({ id: idBeat(), description, planteAuMessage: messages.length, paye: false });
  });

  return {
    arcActuel: analyse.arcActuel,
    tension: analyse.tension,
    dernierBeatIndex: analyse.beatMajeur ? messages.length : directeurActuel.dernierBeatIndex,
    beats,
  };
}

/** Stagnation : trop de messages depuis le dernier développement notable. */
export function detecterStagnation(directeur: DirecteurState, nbMessages: number): boolean {
  return nbMessages - directeur.dernierBeatIndex >= SEUIL_STAGNATION;
}

/**
 * Formate l'état du directeur en instruction pour le modèle — jamais visible
 * du joueur, uniquement une orientation pour la prochaine réponse.
 */
export function formaterDirection(directeur: DirecteurState, stagnation: boolean): string {
  // Rien à dire tant que le directeur n'a pas encore tourné une première
  // fois (début d'histoire) — évite d'injecter un bloc creux ("Tension
  // actuelle : calme.") avant qu'il y ait quoi que ce soit à orienter.
  if (!directeur.arcActuel && directeur.beats.length === 0 && !stagnation) return '';

  const lignes = [
    directeur.arcActuel && `Arc en cours : ${directeur.arcActuel}`,
    `Tension actuelle : ${directeur.tension}.`,
  ].filter(Boolean);

  const beatsOuverts = directeur.beats.filter((b) => !b.paye);
  if (beatsOuverts.length > 0) {
    lignes.push(
      `Éléments en suspens à garder en tête pour un futur payoff (pas besoin de tous les résoudre maintenant) : ${beatsOuverts
        .map((b) => b.description)
        .join(' ; ')}`,
    );
  }

  if (stagnation) {
    lignes.push(
      "Aucun développement notable de l'intrigue depuis plusieurs échanges : introduis une complication, un événement ou une décision qui fait avancer l'histoire dans cette réponse, sans le signaler explicitement au joueur.",
    );
  }

  return `\n\n[DIRECTION NARRATIVE]\n${lignes.join('\n')}`;
}
