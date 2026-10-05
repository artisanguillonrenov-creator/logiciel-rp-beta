import type { ChatMessage } from './openrouter';
import type { Fact, LoreEntry, Message, StoryMeta, StorySettings } from '../types';
import { LORE_CORE } from '../data/loreCore';
import { REGLES_IMMUABLES } from './rules';
import { IDENTITE_NARRATIVE } from './identiteNarrative';
import { INSTRUCTION_REGISTRE_GRAND_PUBLIC, INSTRUCTION_REGISTRE_ADULTE } from './contenuAdulte';

// Fenêtre de messages bruts envoyée systématiquement (L0).
export const NB_MESSAGES_RECENTS = 10;

// 32k caractères restent très conservateurs pour les modèles distants tout
// en donnant assez d'air au contexte utile. Le local garde un budget plus
// serré. Les allocations internes garantissent désormais les blocs
// prioritaires au lieu de tronquer aveuglément la fin du prompt.
export const BUDGET_SYSTEM_DISTANT = 32000;
export const BUDGET_SYSTEM_LOCAL = 12000;
export const BUDGET_MESSAGE_RECENT = 900;

function tronquerSilencieusement(texte: string, longueur: number): string {
  if (longueur <= 0) return '';
  if (texte.length <= longueur) return texte;
  if (longueur === 1) return '…';
  return `${texte.slice(0, Math.max(0, longueur - 1)).trimEnd()}…`;
}

function formaterFaits(faits: Fact[], budget = 3200): string {
  if (faits.length === 0) return 'Aucun fait clé enregistré pour l’instant.';
  return tronquerSilencieusement(
    faits.map((f) => `- [${f.type}] ${f.texte}${f.resolue ? ' (résolu)' : ''}`).join('\n'),
    budget,
  );
}

interface ResultatBlocEntrees {
  texte: string;
  injectees: string[];
  tronquees: string[];
  excluesBudget: string[];
}

function coutEnteteEntree(entry: LoreEntry): number {
  return `### ${entry.titre}\n`.length + 2;
}

/**
 * Répartit le budget entre les entrées au lieu de remplir le prompt avec les
 * premières puis d'abandonner silencieusement les suivantes.
 *
 * `garantirToutes` est utilisé pour le contrat narratif V2.1 et le socle
 * canon : chaque entrée reçoit au moins un extrait, quitte à être compactée.
 */
function formaterEntrees(
  entries: LoreEntry[],
  titre: string,
  budget: number,
  options: { garantirToutes?: boolean; minContenu?: number; maxContenu?: number } = {},
): ResultatBlocEntrees {
  if (entries.length === 0 || budget <= 0) {
    return { texte: '', injectees: [], tronquees: [], excluesBudget: entries.map((e) => e.titre) };
  }

  const enteteSection = `\n\n[${titre}]\n`;
  if (enteteSection.length >= budget) {
    return { texte: '', injectees: [], tronquees: [], excluesBudget: entries.map((e) => e.titre) };
  }

  const garantirToutes = options.garantirToutes ?? false;
  const minContenuDemande = Math.max(40, options.minContenu ?? 160);
  const maxContenu = Math.max(minContenuDemande, options.maxContenu ?? 650);
  let restant = budget - enteteSection.length;
  const totalEntetes = entries.reduce((total, entry) => total + coutEnteteEntree(entry), 0);
  const minContenuGaranti = garantirToutes
    ? Math.max(24, Math.min(minContenuDemande, Math.floor(Math.max(0, restant - totalEntetes) / entries.length)))
    : minContenuDemande;
  const blocs: string[] = [];
  const injectees: string[] = [];
  const tronquees: string[] = [];
  const excluesBudget: string[] = [];

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const enteteEntree = `### ${entry.titre}\n`;
    const restantes = entries.slice(i + 1);
    const reserveRestantes = garantirToutes
      ? restantes.reduce((total, e) => total + coutEnteteEntree(e) + minContenuGaranti, 0)
      : 0;
    const disponibleContenu = Math.min(maxContenu, restant - enteteEntree.length - reserveRestantes);

    if (disponibleContenu < (garantirToutes ? 24 : minContenuDemande)) {
      excluesBudget.push(entry.titre, ...restantes.map((e) => e.titre));
      break;
    }

    const contenu = tronquerSilencieusement(entry.contenu, disponibleContenu);
    const bloc = `${enteteEntree}${contenu}`;
    blocs.push(bloc);
    injectees.push(entry.titre);
    if (contenu.length < entry.contenu.length) tronquees.push(entry.titre);
    restant -= bloc.length + 2;

    if (restant <= 0) {
      excluesBudget.push(...entries.slice(i + 1).map((e) => e.titre));
      break;
    }
  }

  return {
    texte: blocs.length ? `${enteteSection}${blocs.join('\n\n')}` : '',
    injectees,
    tronquees,
    excluesBudget,
  };
}

function formaterSection(titre: string, contenu: string, budget: number): string {
  if (!contenu.trim() || budget <= 0) return '';
  const entete = `\n\n[${titre}]\n`;
  if (entete.length >= budget) return '';
  return `${entete}${tronquerSilencieusement(contenu, budget - entete.length)}`;
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
  // Compatibilité de structure : ce canal transporte désormais le seul
  // NarrativeContract produit par le Kernel V2.1, jamais les 15 textes legacy.
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
  blocsContexte?: string;
  registreAdulte?: string;
  directiveEtat?: string;
}

export interface OptionsPrompt {
  budgetSysteme?: number;
}

export interface DiagnosticPrompt {
  caracteres: number;
  budget: number;
  metamoteursSelectionnes: number;
  metamoteursInjectes: string[];
  metamoteursTronques: string[];
  metamoteursExclusBudget: string[];
  loreSelectionne: number;
  loreInjecte: string[];
  loreTronque: string[];
  loreExclusBudget: string[];
  promptTronque: boolean;
}

export interface ResultatPrompt {
  prompt: string;
  diagnostic: DiagnosticPrompt;
}

export function construireSystemPromptAvecDiagnostic(
  ctx: ContexteConstruction,
  options: OptionsPrompt = {},
): ResultatPrompt {
  const budget = options.budgetSysteme ?? BUDGET_SYSTEM_DISTANT;
  const entete = `Tu es le narrateur d'un jeu de rôle textuel. Le logiciel qui t'entoure porte l'autorité sur les règles, la mémoire et l'état du monde ; tu fournis uniquement le langage narratif, dans le respect strict de ce qui suit.

${IDENTITE_NARRATIVE}

${REGLES_IMMUABLES}${ctx.registreAdulte ? `\n\n${ctx.registreAdulte}` : ''}${ctx.directiveEtat ? `\n\n${ctx.directiveEtat}` : ''}

${LORE_CORE}

[PERSONNAGE DE {{user}}]
Nom : ${tronquerSilencieusement(ctx.meta.personnageNom, 180)}
Description : ${tronquerSilencieusement(ctx.meta.personnageDescription, 750)}
Point de départ de l'histoire : ${tronquerSilencieusement(ctx.meta.pointDeDepart, 650)}${formaterContexte(ctx.meta)}
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
${ctx.noteCorrection ? `\n[CORRECTION REQUISE]\n${tronquerSilencieusement(ctx.noteCorrection, 900)}\n` : ''}${ctx.instructionRegistreOverride ? `\n${ctx.instructionRegistreOverride}\n` : ''}`;

  const disponible = Math.max(0, budget - entete.length);
  const bContrat = Math.floor(disponible * 0.34);
  const bLoreObligatoire = Math.floor(disponible * 0.18);
  const bLoreOptionnel = Math.floor(disponible * 0.10);
  const bBlocs = Math.floor(disponible * 0.12);
  const bFaits = Math.floor(disponible * 0.08);
  const bResume = Math.floor(disponible * 0.06);
  const bEtat = Math.floor(disponible * 0.07);
  const bSouvenirs = Math.max(0, disponible - bContrat - bLoreObligatoire - bLoreOptionnel - bBlocs - bFaits - bResume - bEtat);

  const loreObligatoire = ctx.loreElyndor.filter((e) => e.score === undefined);
  const idsObligatoires = new Set(loreObligatoire.map((e) => e.id));
  const loreOptionnel = ctx.loreElyndor.filter((e) => !idsObligatoires.has(e.id));

  // Depuis la V2.1, ce canal contient un seul contrat compact. L'ancienne
  // limite de 620 caractères, conçue pour répartir 15 textes de métamoteurs,
  // tronquait le contrat et supprimait parfois ses contraintes décisives.
  const contrat = formaterEntrees(
    ctx.metamoteursSelectionnes,
    'CONTRAT NARRATIF KERNEL V2.1',
    bContrat,
    { garantirToutes: true, minContenu: 240, maxContenu: Math.max(240, bContrat) },
  );
  const loreCanon = formaterEntrees(
    loreObligatoire,
    'LORE ELYNDOR — SOCLE ET ANCRES CANON',
    bLoreObligatoire,
    { garantirToutes: true, minContenu: 140, maxContenu: 520 },
  );
  const lorePertinent = formaterEntrees(
    loreOptionnel,
    'LORE ELYNDOR PERTINENT',
    bLoreOptionnel,
    { garantirToutes: false, minContenu: 170, maxContenu: 430 },
  );

  const resume = formaterSection(
    "RÉSUMÉ DE L'HISTOIRE JUSQU'ICI",
    ctx.resume || "L'histoire commence tout juste, aucun résumé pour l'instant.",
    bResume,
  );
  const faits = formaterSection('FAITS CLÉS ÉTABLIS', formaterFaits(ctx.faits, bFaits), bFaits);
  const blocs = formaterSection('MÉMOIRE NARRATIVE PERTINENTE', ctx.blocsContexte ?? '', bBlocs);
  const etat = formaterSection(
    'ÉTAT ACTUEL ET DIRECTION',
    [ctx.etatMonde, ctx.engagementsEtRelations, ctx.directionNarrative].filter(Boolean).join('\n\n'),
    bEtat,
  );
  const souvenirs = ctx.souvenirs ? tronquerSilencieusement(ctx.souvenirs, bSouvenirs) : '';

  // Priorité matérielle : règles + Lore Core garantis, contrat Kernel,
  // ancres/socle canon, état/mémoire, puis lore secondaire et souvenirs.
  const brut = `${entete}${contrat.texte}${loreCanon.texte}${faits}${etat}${blocs}${resume}${lorePertinent.texte}${souvenirs}`;
  const prompt = tronquerSilencieusement(brut, budget);
  const promptTronque = prompt.length < brut.length;

  return {
    prompt,
    diagnostic: {
      caracteres: prompt.length,
      budget,
      metamoteursSelectionnes: ctx.metamoteursSelectionnes.length,
      metamoteursInjectes: contrat.injectees,
      metamoteursTronques: contrat.tronquees,
      metamoteursExclusBudget: contrat.excluesBudget,
      loreSelectionne: ctx.loreElyndor.length,
      loreInjecte: [...loreCanon.injectees, ...lorePertinent.injectees],
      loreTronque: [...loreCanon.tronquees, ...lorePertinent.tronquees],
      loreExclusBudget: [...loreCanon.excluesBudget, ...lorePertinent.excluesBudget],
      promptTronque,
    },
  };
}

export function construireSystemPrompt(ctx: ContexteConstruction, options: OptionsPrompt = {}): string {
  return construireSystemPromptAvecDiagnostic(ctx, options).prompt;
}

export interface ResultatMessagesPrompt {
  messages: ChatMessage[];
  diagnostic: DiagnosticPrompt;
}

export function construireMessagesAvecDiagnostic(
  ctx: ContexteConstruction,
  options: OptionsPrompt = {},
): ResultatMessagesPrompt {
  const { prompt, diagnostic } = construireSystemPromptAvecDiagnostic(ctx, options);
  const recents = ctx.messagesRecents.slice(-NB_MESSAGES_RECENTS).map((m) => ({
    role: m.role,
    content: tronquerSilencieusement(m.content, BUDGET_MESSAGE_RECENT),
  } as ChatMessage));
  return {
    messages: [
      { role: 'system', content: prompt },
      ...recents,
      { role: 'user', content: tronquerSilencieusement(ctx.messageJoueur, 2000) },
    ],
    diagnostic,
  };
}

export function construireMessages(ctx: ContexteConstruction, options: OptionsPrompt = {}): ChatMessage[] {
  return construireMessagesAvecDiagnostic(ctx, options).messages;
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
