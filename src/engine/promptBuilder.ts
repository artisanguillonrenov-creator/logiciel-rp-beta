import type { ChatMessage } from './openrouter';
import type { Fact, LoreEntry, Message, StoryMeta, StorySettings } from '../types';
import { REGLES_IMMUABLES } from './rules';
import { IDENTITE_NARRATIVE } from './identiteNarrative';
import { INSTRUCTION_REGISTRE_GRAND_PUBLIC, INSTRUCTION_REGISTRE_ADULTE } from './contenuAdulte';

// Les modèles locaux ont une fenêtre plus étroite que les modèles distants.
// Ces plafonds sont exprimés en caractères, volontairement conservateurs :
// ils laissent de la place à la réponse et évitent de dépasser la fenêtre
// après tokenisation, qui varie selon le fournisseur.
export const BUDGET_SYSTEM_DISTANT = 24000;
export const BUDGET_SYSTEM_LOCAL = 12000;

// Budget global réservé au fil de conversation brut (message joueur courant
// compris). Il remplace l'ancienne frontière arbitraire « 10 messages » et
// l'ancienne coupe de 900 caractères par message.
export const BUDGET_CONVERSATION_DISTANT = 18000;
export const BUDGET_CONVERSATION_LOCAL = 9000;

function tronquer(texte: string, longueur: number): string {
  if (longueur <= 0) return '';
  if (texte.length <= longueur) return texte;
  // Troncature interne silencieuse : ne jamais injecter un marqueur technique
  // du type « contexte tronqué » dans le prompt, car le modèle peut le répéter.
  return texte.slice(0, longueur).trimEnd();
}

/**
 * Sélectionne un suffixe de messages complets selon un budget global.
 * Aucun message retenu n'est tronqué. Si le dernier message dépasse à lui
 * seul le budget, il est tout de même conservé intégralement : la continuité
 * immédiate prime sur une coupe arbitraire au milieu d'une scène.
 */
export function selectionnerMessagesRecents(messages: Message[], budgetCaracteres: number): Message[] {
  if (messages.length === 0) return [];

  const selection: Message[] = [];
  let total = 0;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    const cout = message.content.length + 32; // petite marge pour rôle/structure du payload

    if (selection.length > 0 && total + cout > budgetCaracteres) break;

    selection.unshift(message);
    total += cout;

    if (total >= budgetCaracteres) break;
  }

  return selection;
}

export function budgetMessagesRecents(messageJoueur: string, budgetConversation: number): number {
  return Math.max(0, budgetConversation - messageJoueur.length - 64);
}

function formaterFaits(faits: Fact[], budget = 3200): string {
  if (faits.length === 0) return 'Aucun fait clé enregistré pour l’instant.';
  return tronquer(faits.map((f) => `- [${f.type}] ${f.texte}${f.resolue ? ' (résolu)' : ''}`).join('\n'), budget);
}

function formaterLore(entries: LoreEntry[], titre: string, budget: number, longueurEntree: number): string {
  if (entries.length === 0 || budget <= 0) return '';
  const blocs: string[] = [];
  let restant = budget;
  for (const entry of entries) {
    const bloc = `### ${entry.titre}\n${tronquer(entry.contenu, longueurEntree)}`;
    if (bloc.length > restant && blocs.length > 0) break;
    blocs.push(tronquer(bloc, restant));
    restant -= blocs.at(-1)!.length + 2;
    if (restant <= 80) break;
  }
  return blocs.length ? `\n\n[${titre}]\n${blocs.join('\n\n')}` : '';
}

function instructionLongueur(longueur: StorySettings['longueur']): string {
  switch (longueur) {
    case 'courte': return 'Réponses très courtes, une à deux répliques.';
    case 'longue': return 'Réponses développées, exploration sensorielle plus riche quand la scène le justifie.';
    default: return 'Réponses de longueur moyenne, adaptées au rythme du message du joueur.';
  }
}

export function libelleViolence(niveau: StorySettings['violence']): string {
  switch (niveau) {
    case 'faible': return 'suggérée plutôt que montrée, jamais le centre de la scène';
    case 'eleve': return 'pleinement montrée, sans retenue quand la scène l’appelle';
    case 'extreme': return 'graphique et frontale, sans atténuation, quand la scène l’appelle';
    default: return 'présente et décrite quand la scène l’appelle, sans excès systématique';
  }
}

export function libelleRomance(niveau: StorySettings['romance']): string {
  switch (niveau) {
    case 'aucun': return "absente — pas d'intrigue amoureuse ni de tension romantique";
    case 'faible': return 'en toile de fond seulement, jamais le sujet principal de la scène';
    case 'eleve': return 'pleinement développée quand la scène l’appelle';
    default: return 'présente et développée quand la scène l’appelle, sans excès systématique';
  }
}

function libelleHumour(niveau: StorySettings['humour']): string {
  switch (niveau) {
    case 'aucun': return "aucun — registre sérieux en permanence, pas de trait d'esprit";
    case 'faible': return "occasionnel, discret, jamais au détriment du sérieux de la scène";
    case 'eleve': return 'assumé, présent dans le ton et les répliques quand la scène le permet';
    default: return 'présent avec mesure, sans forcer le trait';
  }
}

function libelleLiberteJoueur(niveau: StorySettings['liberteJoueur']): string {
  switch (niveau) {
    case 'faible': return "le narrateur guide fermement l'intrigue ; les initiatives du joueur sont intégrées mais l'arc prévu prime";
    case 'moderee': return "le narrateur propose une direction mais s'ajuste aux choix marquants du joueur";
    case 'totale': return "aucun scénario imposé : le joueur décide entièrement de la direction, le narrateur ne fait que réagir";
    default: return "le joueur a une large marge de manœuvre ; le narrateur s'adapte à ses choix sans les contraindre";
  }
}

function libelleRythme(niveau: StorySettings['rythme']): string {
  switch (niveau) {
    case 'lent': return "prends ton temps : détails, ambiance, scènes qui respirent avant que l'intrigue n'avance";
    case 'rapide': return "avance vite : va à l'essentiel, enchaîne les événements sans t'attarder sur les transitions";
    default: return "un rythme équilibré, ni précipité ni étiré";
  }
}

function libelleTon(ton: StorySettings['ton']): string {
  switch (ton) {
    case 'heroique_epique': return 'Héroïque et épique — aventures grandioses, enjeux qui dépassent le personnage, souffle inspirant.';
    case 'mysterieux_intrigant': return 'Mystérieux et intrigant — secrets, complots, révélations dosées, tension permanente.';
    case 'leger_aventureux': return "Léger et aventureux — ton détendu, exploration et découverte plutôt que noirceur.";
    default: return 'Sombre et réaliste — ambiance immersive, dure et crédible.';
  }
}

function formaterContexte(meta: StoryMeta): string {
  const { lieu, ambiance, dateChronique, objectifs } = meta.contexte;
  const lignes = [lieu && `Lieu : ${lieu}`, ambiance && `Ambiance : ${ambiance}`, dateChronique && `Période : ${dateChronique}`, objectifs && `Objectifs du personnage : ${objectifs}`].filter(Boolean);
  return lignes.length ? `\n\n[CONTEXTE DE L'HISTOIRE]\n${lignes.join('\n')}` : '';
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
  instructionRegistreOverride?: string;
  directionNarrative?: string;
  etatMonde?: string;
  engagementsEtRelations?: string;
  souvenirs?: string;
  // Blocs de la mémoire narrative (voir memoireNarrative.ts), déjà formatés.
  blocsContexte?: string;
  // Registre du profil Adulte, juste après les règles immuables.
  registreAdulte?: string;
  // Consigne machine ajoutée juste après les règles (noyau narratif V12).
  directiveEtat?: string;
}

export interface OptionsPrompt {
  budgetSysteme?: number;
  budgetConversation?: number;
}

export function construireSystemPrompt(ctx: ContexteConstruction, options: OptionsPrompt = {}): string {
  const budget = options.budgetSysteme ?? BUDGET_SYSTEM_DISTANT;
  const entete = `Tu es le narrateur d'un jeu de rôle textuel. Le logiciel qui t'entoure porte l'autorité sur les règles, la mémoire et l'état du monde ; tu fournis uniquement le langage narratif, dans le respect strict de ce qui suit.

${IDENTITE_NARRATIVE}

${REGLES_IMMUABLES}${ctx.registreAdulte ? `\n\n${ctx.registreAdulte}` : ''}${ctx.directiveEtat ? `\n\n${ctx.directiveEtat}` : ''}

[PERSONNAGE DE {{user}}]
Nom : ${tronquer(ctx.meta.personnageNom, 180)}
Description : ${tronquer(ctx.meta.personnageDescription, 750)}
Point de départ de l'histoire : ${tronquer(ctx.meta.pointDeDepart, 650)}${formaterContexte(ctx.meta)}
Const style : ""

[STYLE & FILTRE SYSTEME]
${ctx.registreAdulte ? INSTRUCTION_REGISTRE_ADULTE : INSTRUCTION_REGISTRE_GRAND_PUBLIC}

Ton : ${libelleTon(ctx.settings.ton)}
${instructionLongueur(ctx.settings.longueur)}
Rythme : ${libelleRythme(ctx.settings.rythme)}.
Liberté du joueur : ${libelleLiberteJoueur(ctx.settings.liberteJoueur)}.
Violence : ${libelleViolence(ctx.settings.violence)}.
Romance : ${libelleRomance(ctx.settings.romance)}.
Humour : ${libelleHumour(ctx.settings.humour)}.

Format des dialogues des PNJ : chaque réplique d'un PNJ doit être précédée de son nom en MAJUSCULES suivi de « : », sur sa propre ligne, puis le texte de la réplique entre guillemets français « ». Exemple :
KAELEN : « Tu es venu seul. C'est soit du courage, soit de la bêtise. »
Narration/action restent hors de ces lignes (entre astérisques si besoin). N'utilise jamais cette étiquette pour {{user}} : tu n'écris jamais ses paroles (règle 1).
${ctx.noteCorrection ? `\n[CORRECTION REQUISE]\n${tronquer(ctx.noteCorrection, 900)}\n` : ''}${ctx.instructionRegistreOverride ? `\n${ctx.instructionRegistreOverride}\n` : ''}`;

  const resume = `\n\n[RÉSUMÉ DE L'HISTOIRE JUSQU'ICI]\n${tronquer(ctx.resume || "L'histoire commence tout juste, aucun résumé pour l'instant.", Math.floor(budget * 0.08))}`;
  const faits = `\n\n[FAITS CLÉS ÉTABLIS]\n${formaterFaits(ctx.faits, Math.floor(budget * 0.10))}`;
  const blocs = ctx.blocsContexte ? `\n\n[MÉMOIRE NARRATIVE PERTINENTE]\n${tronquer(ctx.blocsContexte, Math.floor(budget * 0.14))}` : '';
  const lore = formaterLore(ctx.loreElyndor, 'LORE ELYNDOR PERTINENT', Math.floor(budget * 0.20), 650);
  const etat = tronquer([ctx.etatMonde, ctx.engagementsEtRelations, ctx.directionNarrative].filter(Boolean).join('\n\n'), Math.floor(budget * 0.14));
  const souvenirs = tronquer(ctx.souvenirs ?? '', Math.floor(budget * 0.06));
  const socle = formaterLore(ctx.metamoteursSelectionnes, 'MÉTAMOTEURS ACTIFS POUR CETTE SCÈNE', Math.floor(budget * 0.30), 900);

  // L'en-tête (règles, personnage) et le style ne sont jamais tronqués :
  // auparavant, un prompt trop long perdait sa fin, donc le style et la
  // consigne de correction. Seul le milieu est rogné, par la fin — les
  // métamoteurs, règles de mise en scène générales, partent en premier.
  const milieu = tronquer(
    `${resume}${faits}${blocs}${lore}${etat}${souvenirs}${socle}`,
    Math.max(0, budget - entete.length),
  );
  return tronquer(`${entete}${milieu}`, budget);
}

export function construireMessages(ctx: ContexteConstruction, options: OptionsPrompt = {}): ChatMessage[] {
  const systemPrompt = construireSystemPrompt(ctx, options);
  const budgetConversation = options.budgetConversation ?? BUDGET_CONVERSATION_DISTANT;
  const budgetRecents = budgetMessagesRecents(ctx.messageJoueur, budgetConversation);
  const recents = selectionnerMessagesRecents(ctx.messagesRecents, budgetRecents).map((m) => ({
    role: m.role,
    content: m.content,
  } as ChatMessage));

  return [{ role: 'system', content: systemPrompt }, ...recents, { role: 'user', content: ctx.messageJoueur }];
}

export function temperaturePourCreativite(creativite: StorySettings['creativite']): number {
  switch (creativite) { case 'faible': return 0.5; case 'elevee': return 1.1; default: return 0.85; }
}

export function maxTokensPourLongueur(longueur: StorySettings['longueur']): number {
  switch (longueur) { case 'courte': return 350; case 'longue': return 1100; default: return 650; }
}
