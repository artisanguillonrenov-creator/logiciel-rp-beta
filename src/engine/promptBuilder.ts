import type { ChatMessage } from './openrouter';
import type { Fact, LoreEntry, Message, StoryMeta, StorySettings } from '../types';
import { REGLES_IMMUABLES } from './rules';

// Fenêtre de messages bruts envoyée systématiquement (L0). Exportée : sert
// aussi de frontière pour la recherche sémantique de secours dans
// l'historique (src/engine/searchHistorique.ts) — ne chercher que dans ce
// qui est hors de cette fenêtre, pour ne pas dupliquer ce que le modèle
// voit déjà brut.
export const NB_MESSAGES_RECENTS = 10;

function formaterFaits(faits: Fact[]): string {
  if (faits.length === 0) return 'Aucun fait clé enregistré pour l’instant.';
  return faits
    .map((f) => `- [${f.type}] ${f.texte}${f.resolue ? ' (résolu)' : ''}`)
    .join('\n');
}

function formaterLore(entries: LoreEntry[], titre: string): string {
  if (entries.length === 0) return '';
  const bloc = entries.map((e) => `### ${e.titre}\n${e.contenu}`).join('\n\n');
  return `\n\n[${titre}]\n${bloc}`;
}

function instructionLongueur(longueur: StorySettings['longueur']): string {
  switch (longueur) {
    case 'courte':
      return 'Réponses très courtes, une à deux répliques.';
    case 'longue':
      return 'Réponses développées, exploration sensorielle plus riche quand la scène le justifie.';
    default:
      return 'Réponses de longueur moyenne, adaptées au rythme du message du joueur.';
  }
}

function libelleCurseur(niveau: StorySettings['violence']): string {
  switch (niveau) {
    case 'faible':
      return 'suggérée plutôt que montrée, jamais le centre de la scène';
    case 'eleve':
      return 'pleinement montrée, sans retenue quand la scène l’appelle';
    default:
      return 'présente et décrite quand la scène l’appelle, sans excès systématique';
  }
}

function formaterContexte(meta: StoryMeta): string {
  const { lieu, ambiance, dateChronique, objectifs } = meta.contexte;
  const lignes = [
    lieu && `Lieu : ${lieu}`,
    ambiance && `Ambiance : ${ambiance}`,
    dateChronique && `Période : ${dateChronique}`,
    objectifs && `Objectifs du personnage : ${objectifs}`,
  ].filter(Boolean);
  if (lignes.length === 0) return '';
  return `\n\n[CONTEXTE DE L'HISTOIRE]\n${lignes.join('\n')}`;
}

export interface ContexteConstruction {
  meta: StoryMeta;
  settings: StorySettings;
  resume: string;
  faits: Fact[];
  metamoteursSelectionnes: LoreEntry[];
  loreElyndor: LoreEntry[];
  messagesRecents: Message[];
  messageJoueur: string;
  noteCorrection?: string;
  // Contrôle d'âge (brief Phase 2) : remplace les instructions de registre
  // explicite quand le profil de l'appareil est GRAND_PUBLIC — voir
  // src/engine/contenuAdulte.ts. Injectée en dernier pour primer sur tout
  // ce qui précède.
  instructionRegistreOverride?: string;
  // Story Director / Scene Director (brief Phase 2) : orientation d'arc,
  // tension et rappel des éléments en suspens — voir formaterDirection dans
  // src/engine/storyDirector.ts. Pré-formaté, bloc entier ou chaîne vide.
  directionNarrative?: string;
  // World Simulation + State Machine (brief Phase 2) : zones actives/proches,
  // état établi (flags) et conséquences de déclencheurs à faire apparaître —
  // voir formaterMonde dans src/engine/worldSimulation.ts.
  etatMonde?: string;
  // Engagements + dynamiques sociales (brief Phase 2) : promesses/dettes/
  // contrats en attente et relations notables avec les PNJ — voir
  // formaterEngagementsEtRelations dans src/engine/socialDynamics.ts.
  engagementsEtRelations?: string;
  // Filet de sécurité pour la continuité : messages bruts plus anciens que
  // la fenêtre récente, retrouvés par recherche sémantique quand un détail
  // pertinent n'a pas été capté comme fait par le pipeline de mémoire —
  // voir formaterSouvenirs dans src/engine/searchHistorique.ts.
  souvenirs?: string;
}

export function construireSystemPrompt(ctx: ContexteConstruction): string {
  const metamoteursTexte = formaterLore(ctx.metamoteursSelectionnes, 'MÉTAMOTEURS ACTIFS POUR CETTE SCÈNE');
  const loreTexte = formaterLore(ctx.loreElyndor, 'LORE ELYNDOR PERTINENT');

  return `Tu es le narrateur d'un jeu de rôle textuel. Le logiciel qui t'entoure porte l'autorité sur les règles, la mémoire et l'état du monde ; tu fournis uniquement le langage narratif, dans le respect strict de ce qui suit.

${REGLES_IMMUABLES}

[PERSONNAGE DE {{user}}]
Nom : ${ctx.meta.personnageNom}
Description : ${ctx.meta.personnageDescription}
Point de départ de l'histoire : ${ctx.meta.pointDeDepart}
${formaterContexte(ctx.meta)}

[RÉSUMÉ DE L'HISTOIRE JUSQU'ICI]
${ctx.resume || "L'histoire commence tout juste, aucun résumé pour l'instant."}

[FAITS CLÉS ÉTABLIS]
${formaterFaits(ctx.faits)}
${metamoteursTexte}${loreTexte}${ctx.etatMonde ?? ''}${ctx.engagementsEtRelations ?? ''}${ctx.souvenirs ?? ''}${ctx.directionNarrative ?? ''}

[STYLE]
${instructionLongueur(ctx.settings.longueur)}
Violence : ${libelleCurseur(ctx.settings.violence)}.
Romance : ${libelleCurseur(ctx.settings.romance)}.
${ctx.noteCorrection ? `\n[CORRECTION REQUISE]\n${ctx.noteCorrection}\n` : ''}
${ctx.instructionRegistreOverride ? `\n${ctx.instructionRegistreOverride}\n` : ''}`;
}

export function construireMessages(ctx: ContexteConstruction): ChatMessage[] {
  const systemPrompt = construireSystemPrompt(ctx);
  const recents: ChatMessage[] = ctx.messagesRecents
    .slice(-NB_MESSAGES_RECENTS)
    .map((m) => ({ role: m.role, content: m.content }));

  return [
    { role: 'system', content: systemPrompt },
    ...recents,
    { role: 'user', content: ctx.messageJoueur },
  ];
}

export function temperaturePourCreativite(creativite: StorySettings['creativite']): number {
  switch (creativite) {
    case 'faible':
      return 0.5;
    case 'elevee':
      return 1.1;
    default:
      return 0.85;
  }
}

export function maxTokensPourLongueur(longueur: StorySettings['longueur']): number {
  switch (longueur) {
    case 'courte':
      return 350;
    case 'longue':
      return 1100;
    default:
      return 650;
  }
}
