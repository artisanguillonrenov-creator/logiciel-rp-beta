import type { AppSettings, EtatScene, Message, StoryState } from '../types';
import { appellerModele, configurationLLM } from './openrouter';

/**
 * État de la scène tenu par l'application : ville, lieu, personnages
 * présents. Le noyau V12 attendait ces informations d'un bloc machine que le
 * narrateur devait ajouter à chaque réponse ; Euryale ne l'écrit jamais, d'où
 * un lieu figé et une horloge bloquée. Ici, un petit appel en arrière-plan,
 * après l'affichage de la réponse, relève le nouvel état.
 */
const MAX_PRESENTS = 8;
const MINUTES_MAX_PAR_TOUR = 12 * 60;

export function detecterCapitale(texte: string | undefined, capitales: string[]): string | undefined {
  if (!texte) return undefined;
  return capitales.find((c) => new RegExp(`\\b${c}\\b`, 'i').test(texte));
}

/** État courant, ou déduit du lieu et du point de départ pour une histoire sans état. */
export function lireEtatScene(story: StoryState, capitales: string[]): EtatScene {
  if (story.scene) return story.scene;
  const recents = [...story.messages].reverse().map((m) => m.content);
  return {
    ville: [...recents, story.meta.contexte.lieu, story.meta.pointDeDepart].map((t) => detecterCapitale(t, capitales)).find(Boolean),
    lieu: story.meta.contexte.lieu || undefined,
    presents: [],
    majMessageIndex: 0,
  };
}

export interface ReleveScene {
  scene: EtatScene;
  minutesEcoulees: number;
}

function texteSur(valeur: unknown, max: number): string | undefined {
  const t = typeof valeur === 'string' ? valeur.replace(/\s+/g, ' ').trim() : '';
  return t ? t.slice(0, max) : undefined;
}

/** Valide la sortie du modèle : ville reconnue, présents bornés, durée plausible. */
export function interpreterReleve(brut: string, actuel: EtatScene, capitales: string[], nbMessages: number, personnageNom: string): ReleveScene | null {
  const match = brut.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let objet: any;
  try {
    objet = JSON.parse(match[0]);
  } catch {
    return null;
  }
  const villeProposee = texteSur(objet.ville, 40);
  const ville = (villeProposee && detecterCapitale(villeProposee, capitales)) || actuel.ville;
  const nomJoueur = personnageNom.trim().toLowerCase();
  const presents = Array.isArray(objet.presents)
    ? [...new Set(objet.presents.map((p: unknown) => texteSur(p, 60)).filter((p: string | undefined): p is string => !!p && p.toLowerCase() !== nomJoueur))].slice(0, MAX_PRESENTS) as string[]
    : actuel.presents;
  const minutes = Math.round(Number(objet.minutesEcoulees));
  return {
    scene: { ville, lieu: texteSur(objet.lieu, 120) ?? actuel.lieu, presents, majMessageIndex: nbMessages },
    minutesEcoulees: Number.isFinite(minutes) ? Math.min(MINUTES_MAX_PAR_TOUR, Math.max(0, minutes)) : 0,
  };
}

const CONSIGNE_RELEVE = `Tu tiens l'état de la scène d'un jeu de rôle. À partir de l'état précédent et des derniers échanges, donne l'état À LA FIN du dernier message du narrateur.
Réponds UNIQUEMENT avec ce JSON strict :
{"ville": "capitale où se trouve le personnage du joueur", "lieu": "lieu précis actuel (ex. comptoir de la Guilde des Aventuriers, chambre de l'auberge)", "presents": ["personnages présents dans la scène, hors personnage du joueur"], "minutesEcoulees": 0}
- Change le lieu seulement si le récit établit un déplacement.
- minutesEcoulees : durée plausible écoulée pendant ces échanges (quelques minutes pour un dialogue, davantage pour un trajet ou une nuit).
- N'invente rien qui ne soit pas dans le texte.`;

export async function releverEtatScene(options: {
  appSettings: AppSettings;
  actuel: EtatScene;
  messages: Message[];
  capitales: string[];
  personnageNom: string;
  storyId?: string;
}): Promise<ReleveScene | null> {
  const { appSettings, actuel, messages, capitales, personnageNom, storyId } = options;
  const nouveaux = messages.slice(actuel.majMessageIndex).slice(-4);
  if (!nouveaux.length) return null;
  const transcript = nouveaux
    .map((m) => `${m.role === 'user' ? personnageNom : 'Narrateur'} : ${m.content.slice(0, 1500)}`)
    .join('\n');
  const etatPrecedent = JSON.stringify({ ville: actuel.ville ?? null, lieu: actuel.lieu ?? null, presents: actuel.presents });
  const sortie = await appellerModele({
    ...configurationLLM(appSettings),
    storyId,
    temperature: 0.1,
    maxTokens: 160,
    diagnosticLabel: 'État de scène',
    messages: [
      { role: 'system', content: CONSIGNE_RELEVE },
      { role: 'user', content: `Personnage du joueur : ${personnageNom}\nÉtat précédent : ${etatPrecedent}\n\nDerniers échanges :\n${transcript}` },
    ],
  });
  return interpreterReleve(sortie, actuel, capitales, messages.length, personnageNom);
}
