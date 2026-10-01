import type { ChatMessage } from '../openrouter';
import type { Fact, LoreEntry, Message, ProfilContenu, StoryMeta, StorySettings } from '../types';
import { REGLES_IMMUABLES } from './rules';
import { IDENTITE_NARRATIVE } from './identiteNarrative';

// Fenêtre de messages bruts envoyée systématiquement (L0). Exportée : sert
// aussi de frontière pour la recherche sémantique de secours dans
// l'historique (src/engine/searchHistorique.ts).
export const NB_MESSAGES_RECENTS = 10;
export const BUDGET_SYSTEM_DISTANT = 24000;
export const BUDGET_SYSTEM_LOCAL = 12000;
export const BUDGET_MESSAGE_RECENT = 900;

function tronquer(texte: string, longueur: number): string {
  if (!texte || longueur <= 0) return '';
  if (texte.length <= longueur) return texte;
  if (longueur <= 34) return texte.slice(0, longueur);
  return `${texte.slice(0, longueur - 34).trimEnd()}\n[… contexte tronqué …]`;
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
    const retenu = tronquer(bloc, restant);
    if (!retenu) break;
    blocs.push(retenu);
    restant -= retenu.length + 2;
    if (restant <= 80) break;
  }
  return blocs.length ? `\n\n[${titre}]\n${blocs.join('\n\n')}` : '';
}

function instructionLongueur(longueur: StorySettings['longueur']): string {
  switch (longueur) {
    case 'courte': return 'Réponse courte et dense ; ne crée pas d’action supplémentaire pour remplir.';
    case 'longue': return 'Réponse développée et sensorielle lorsque la scène le justifie, sans confisquer plusieurs décisions au joueur.';
    default: return 'Réponse de longueur moyenne, adaptée à la matière réelle de la scène.';
  }
}

export function libelleViolence(niveau: StorySettings['violence']): string {
  switch (niveau) {
    case 'faible': return 'faible : rester sobre même si un conflit existe';
    case 'eleve': return 'élevée : pleinement perceptible lorsqu’une scène violente l’exige';
    case 'extreme': return 'maximale : frontale et très détaillée uniquement lorsque la scène violente et le profil l’autorisent';
    default: return 'modérée : présente lorsqu’elle est pertinente, sans escalade automatique';
  }
}

export function libelleRomance(niveau: StorySettings['romance']): string {
  switch (niveau) {
    case 'aucun': return 'absente : aucune attraction ou romance inventée';
    case 'faible': return 'faible : en arrière-plan lorsque le lien existe réellement';
    case 'eleve': return 'élevée : pleinement développée dans une relation réciproque et pertinente';
    default: return 'modérée : développée lorsque la relation et la scène le justifient';
  }
}

function libelleHumour(niveau: StorySettings['humour']): string {
  switch (niveau) {
    case 'aucun': return 'aucun humour ajouté';
    case 'faible': return 'occasionnel et discret';
    case 'eleve': return 'assumé lorsque la scène et les personnages s’y prêtent';
    default: return 'présent avec mesure, sans forcer chaque voix';
  }
}

function libelleLiberteJoueur(niveau: StorySettings['liberteJoueur']): string {
  switch (niveau) {
    case 'faible': return 'orientation narrative marquée, mais aucune décision, parole ou intention du joueur n’est inventée';
    case 'moderee': return 'direction proposée, ajustée aux choix du joueur sans les remplacer';
    case 'totale': return 'aucune direction imposée : le monde réagit aux initiatives du joueur';
    default: return 'large marge de manœuvre : proposer sans contraindre les décisions';
  }
}

function libelleRythme(niveau: StorySettings['rythme']): string {
  switch (niveau) {
    case 'lent': return 'lent : développer le moment sans faire avancer artificiellement le temps fictif';
    case 'rapide': return 'rapide : aller à l’essentiel sans supprimer les conséquences nécessaires';
    default: return 'équilibré : laisser respirer ou avancer selon la scène';
  }
}

function libelleTon(ton: StorySettings['ton']): string {
  switch (ton) {
    case 'heroique_epique': return 'Héroïque et épique.';
    case 'mysterieux_intrigant': return 'Mystérieux et intrigant.';
    case 'leger_aventureux': return 'Léger et aventureux.';
    default: return 'Sombre et réaliste.';
  }
}

function formaterContexte(meta: StoryMeta): string {
  const { lieu, ambiance, dateChronique, objectifs } = meta.contexte;
  const lignes = [
    lieu && `Lieu : ${lieu}`,
    ambiance && `Ambiance : ${ambiance}`,
    dateChronique && `Période : ${dateChronique}`,
    objectifs && `Objectifs : ${objectifs}`,
  ].filter(Boolean);
  return lignes.length ? `\n\n[CONTEXTE DE L'HISTOIRE]\n${lignes.join('\n')}` : '';
}

export interface ContexteConstruction {
  meta: StoryMeta;
  settings: StorySettings;
  profilContenu?: ProfilContenu;
  resume: string;
  faits: Fact[];
  loreElyndor: LoreEntry[];
  messagesRecents: Message[];
  messageJoueur: string;
  contratNarratif?: string;
  noteCorrection?: string;
  instructionRegistreOverride?: string;
  directionNarrative?: string;
  etatMonde?: string;
  engagementsEtRelations?: string;
  souvenirs?: string;
  blocsContexte?: string;
  registreAdulte?: string;
  directiveEtat?: string;
}

export interface OptionsPrompt { budgetSysteme?: number; }

function construireStyle(ctx: ContexteConstruction): string {
  return `\n\n[STYLE]\nProfil : ${ctx.profilContenu === 'adulte' ? 'Adulte' : 'Grand public'}.
Ton : ${libelleTon(ctx.settings.ton)}
${instructionLongueur(ctx.settings.longueur)}
Rythme : ${libelleRythme(ctx.settings.rythme)}.
Liberté du joueur : ${libelleLiberteJoueur(ctx.settings.liberteJoueur)}.
Violence : ${libelleViolence(ctx.settings.violence)}.
Romance : ${libelleRomance(ctx.settings.romance)}.
Humour : ${libelleHumour(ctx.settings.humour)}.
Le niveau de rendu ne crée jamais un événement, un dommage, une attirance ou une volonté absents de la situation.

Format des dialogues des PNJ : chaque réplique d'un PNJ doit être précédée de son nom en MAJUSCULES suivi de « : », sur sa propre ligne, puis la réplique entre guillemets français « ». La narration reste hors de ces lignes. N'utilise jamais cette étiquette pour {{user}} et n'écris jamais ses paroles.`;
}

export function construireSystemPrompt(ctx: ContexteConstruction, options: OptionsPrompt = {}): string {
  const budget = options.budgetSysteme ?? BUDGET_SYSTEM_DISTANT;
  const style = construireStyle(ctx);
  const contrat = ctx.contratNarratif ? `\n\n${tronquer(ctx.contratNarratif, Math.floor(budget * 0.20))}` : '';
  const entete = `Tu es l'interprète narratif d'un jeu de rôle textuel. Le logiciel porte l'autorité sur les règles, la mémoire et l'état ; tu mets en scène ce cadre sans le remplacer.

${IDENTITE_NARRATIVE}

${REGLES_IMMUABLES}${contrat}${ctx.registreAdulte ? `\n\n${ctx.registreAdulte}` : ''}${ctx.directiveEtat ? `\n\n${ctx.directiveEtat}` : ''}

[PERSONNAGE DE {{user}}]
Nom : ${tronquer(ctx.meta.personnageNom, 180)}
Description : ${tronquer(ctx.meta.personnageDescription, 750)}
Point de départ : ${tronquer(ctx.meta.pointDeDepart, 650)}${formaterContexte(ctx.meta)}${ctx.noteCorrection ? `\n\n[CORRECTION REQUISE]\n${tronquer(ctx.noteCorrection, 900)}` : ''}${ctx.instructionRegistreOverride ? `\n\n${ctx.instructionRegistreOverride}` : ''}`;

  const reserve = entete.length + style.length;
  const disponible = Math.max(0, budget - reserve);
  const resume = `\n\n[RÉSUMÉ DE L'HISTOIRE JUSQU'ICI]\n${tronquer(ctx.resume || "L'histoire commence tout juste.", Math.floor(disponible * 0.10))}`;
  const faits = `\n\n[FAITS CLÉS ÉTABLIS]\n${formaterFaits(ctx.faits, Math.floor(disponible * 0.13))}`;
  const blocs = ctx.blocsContexte ? `\n\n[MÉMOIRE NARRATIVE PERTINENTE]\n${tronquer(ctx.blocsContexte, Math.floor(disponible * 0.24))}` : '';
  const lore = formaterLore(ctx.loreElyndor, 'LORE ELYNDOR PERTINENT', Math.floor(disponible * 0.25), 650);
  const etatTexte = [ctx.etatMonde, ctx.engagementsEtRelations, ctx.directionNarrative].filter(Boolean).join('\n\n');
  const etat = etatTexte ? `\n\n[ÉTAT ET CONTRAINTES PERTINENTES]\n${tronquer(etatTexte, Math.floor(disponible * 0.20))}` : '';
  const souvenirs = ctx.souvenirs ? `\n\n[SOUVENIRS RETROUVÉS]\n${tronquer(ctx.souvenirs, Math.floor(disponible * 0.08))}` : '';
  const milieu = tronquer(`${resume}${faits}${blocs}${lore}${etat}${souvenirs}`, disponible);

  // Les règles, le contrat et le style ont priorité sur le contexte expansible.
  return tronquer(`${entete}${milieu}${style}`, budget);
}

export function construireMessages(ctx: ContexteConstruction, options: OptionsPrompt = {}): ChatMessage[] {
  const systemPrompt = construireSystemPrompt(ctx, options);
  const recents = ctx.messagesRecents.slice(-NB_MESSAGES_RECENTS).map((m) => ({
    role: m.role,
    content: tronquer(m.content, BUDGET_MESSAGE_RECENT),
  } as ChatMessage));
  return [{ role: 'system', content: systemPrompt }, ...recents, { role: 'user', content: tronquer(ctx.messageJoueur, 2000) }];
}

export function temperaturePourCreativite(creativite: StorySettings['creativite']): number {
  switch (creativite) { case 'faible': return 0.5; case 'elevee': return 1.1; default: return 0.85; }
}

export function maxTokensPourLongueur(longueur: StorySettings['longueur']): number {
  switch (longueur) { case 'courte': return 350; case 'longue': return 1100; default: return 650; }
}
