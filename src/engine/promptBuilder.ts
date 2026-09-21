import type { ChatMessage } from './openrouter';
import type { Fact, LoreEntry, Message, StoryMeta, StorySettings } from '../types';
import { REGLES_IMMUABLES } from './rules';
import { NARRATIVE_IDENTITY } from './narrative/behaviorKernel';

// Narrative OS V1 : fenêtre immédiate courte. L'historique ancien reste
// récupérable via la mémoire/recherche, au lieu d'être renvoyé brut à chaque tour.
export const NB_MESSAGES_RECENTS = 4;

// Budgets stricts pour que le coût dépende de la scène courante et non de la
// longueur totale de l'histoire. Exprimés en caractères pour rester indépendants
// du tokenizer et du fournisseur.
export const BUDGET_SYSTEM_DISTANT = 7000;
export const BUDGET_SYSTEM_LOCAL = 5000;
export const BUDGET_MESSAGE_RECENT = 520;

function tronquer(texte: string, longueur: number): string {
  if (texte.length <= longueur) return texte;
  return `${texte.slice(0, Math.max(0, longueur - 22)).trimEnd()}\n[… tronqué …]`;
}

function formaterFaits(faits: Fact[], budget: number): string {
  if (faits.length === 0) return 'Aucun fait clé enregistré pour l’instant.';
  return tronquer(
    faits.map((f) => `- [${f.type}] ${f.texte}${f.resolue ? ' (résolu)' : ''}`).join('\n'),
    budget,
  );
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
    default: return 'un rythme équilibré, ni précipité ni étiré';
  }
}

function libelleTon(ton: StorySettings['ton']): string {
  switch (ton) {
    case 'heroique_epique': return 'Héroïque et épique — aventures grandioses, enjeux qui dépassent le personnage, souffle inspirant.';
    case 'mysterieux_intrigant': return 'Mystérieux et intrigant — secrets, complots, révélations dosées, tension permanente.';
    case 'leger_aventureux': return 'Léger et aventureux — ton détendu, exploration et découverte plutôt que noirceur.';
    default: return 'Sombre et réaliste — ambiance immersive, dure et crédible.';
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
}

export interface OptionsPrompt {
  budgetSysteme?: number;
}

export function construireSystemPrompt(ctx: ContexteConstruction, options: OptionsPrompt = {}): string {
  const budget = options.budgetSysteme ?? BUDGET_SYSTEM_DISTANT;

  // Les 15 métamoteurs restent calculés par le moteur pour compatibilité/debug,
  // mais ne sont plus recopiés dans le prompt. Le noyau compact + les règles
  // immuables portent le contrat comportemental ; le logiciel porte l'état.
  const lore = formaterLore(
    ctx.loreElyndor,
    'LORE PERTINENT POUR CETTE SCÈNE',
    Math.floor(budget * 0.22),
    520,
  );
  const etat = tronquer(
    [ctx.etatMonde, ctx.engagementsEtRelations, ctx.directionNarrative].filter(Boolean).join('\n\n'),
    Math.floor(budget * 0.14),
  );
  const souvenirs = tronquer(ctx.souvenirs ?? '', Math.floor(budget * 0.10));
  const resume = tronquer(
    ctx.resume || "L'histoire commence tout juste, aucun résumé pour l'instant.",
    Math.floor(budget * 0.10),
  );
  const faits = formaterFaits(ctx.faits, Math.floor(budget * 0.12));

  const fixe = `${NARRATIVE_IDENTITY}\n\n${REGLES_IMMUABLES}\n\n[PERSONNAGE DE {{user}}]\nNom : ${tronquer(ctx.meta.personnageNom, 180)}\nDescription : ${tronquer(ctx.meta.personnageDescription, 750)}\nPoint de départ : ${tronquer(ctx.meta.pointDeDepart, 650)}${formaterContexte(ctx.meta)}\n\n[RÉSUMÉ UTILE]\n${resume}\n\n[FAITS CLÉS ÉTABLIS]\n${faits}`;

  const style = `\n\n[STYLE]\nTon : ${libelleTon(ctx.settings.ton)}\n${instructionLongueur(ctx.settings.longueur)}\nRythme : ${libelleRythme(ctx.settings.rythme)}.\nLiberté du joueur : ${libelleLiberteJoueur(ctx.settings.liberteJoueur)}.\nViolence : ${libelleViolence(ctx.settings.violence)}.\nRomance : ${libelleRomance(ctx.settings.romance)}.\nHumour : ${libelleHumour(ctx.settings.humour)}.\n\nDialogues PNJ : NOM EN MAJUSCULES : « réplique ». Narration/action hors de ces lignes. Ne jamais utiliser cette étiquette pour {{user}}.\n${ctx.noteCorrection ? `\n[CORRECTION REQUISE]\n${tronquer(ctx.noteCorrection, 900)}\n` : ''}${ctx.instructionRegistreOverride ? `\n${ctx.instructionRegistreOverride}\n` : ''}`;

  return tronquer(`${fixe}${lore}${etat ? `\n\n[ÉTAT / CONSÉQUENCES]\n${etat}` : ''}${souvenirs}${style}`, budget);
}

export function construireMessages(ctx: ContexteConstruction, options: OptionsPrompt = {}): ChatMessage[] {
  const systemPrompt = construireSystemPrompt(ctx, options);
  const recents = ctx.messagesRecents.slice(-NB_MESSAGES_RECENTS).map((m) => ({
    role: m.role,
    content: tronquer(m.content, BUDGET_MESSAGE_RECENT),
  } as ChatMessage));
  return [
    { role: 'system', content: systemPrompt },
    ...recents,
    { role: 'user', content: tronquer(ctx.messageJoueur, 1600) },
  ];
}

export function temperaturePourCreativite(creativite: StorySettings['creativite']): number {
  switch (creativite) {
    case 'faible': return 0.5;
    case 'elevee': return 1.1;
    default: return 0.85;
  }
}

export function maxTokensPourLongueur(longueur: StorySettings['longueur']): number {
  switch (longueur) {
    case 'courte': return 350;
    case 'longue': return 1100;
    default: return 650;
  }
}
