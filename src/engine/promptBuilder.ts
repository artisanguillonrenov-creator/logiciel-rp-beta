import type { ChatMessage } from './openrouter';
import { BUDGET_LORE_PASSAGES } from './passagesLore';
import type { Fact, LoreEntry, Message, StoryMeta, StorySettings } from '../types';
import { LORE_CORE } from '../data/loreCore';
import { REGLES_IMMUABLES } from './rules';
import { IDENTITE_NARRATIVE } from './identiteNarrative';
import { INSTRUCTION_REGISTRE_GRAND_PUBLIC, INSTRUCTION_REGISTRE_ADULTE } from './contenuAdulte';

// Les modèles locaux ont une fenêtre plus étroite que les modèles distants.
// Ces plafonds sont exprimés en caractères, volontairement conservateurs :
// ils laissent de la place à la réponse et évitent de dépasser la fenêtre
// après tokenisation, qui varie selon le fournisseur.
//
// Distant = Elyndor Cloud (fenêtre de 24 576 jetons). Le budget système
// inclut les 15 métamoteurs envoyés en entier (~41 000 caractères), l'en-tête
// (~12 000), les parts des deux moteurs de recherche (2 × 2 500) et ~6 000
// pour le résumé, les faits et l'état du monde. Mesuré avec le tokenizer
// d'Euryale : 58 000 + 13 000 caractères = 20 262 jetons (3,44 car./jeton) ;
// 64 000 laisse ~1 000 jetons de marge après la réponse la plus longue.
export const BUDGET_SYSTEM_DISTANT = 64000;
export const BUDGET_SYSTEM_LOCAL = 12000;

// Budget global réservé au fil de conversation brut (message joueur courant
// compris). Il remplace l'ancienne frontière arbitraire « 10 messages » et
// l'ancienne coupe de 900 caractères par message.
export const BUDGET_CONVERSATION_DISTANT = 13000;
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

// Cibles en mots cohérentes avec maxTokensPourLongueur (≈ 0,7 mot par jeton
// en français) : la réponse tient dans le plafond avec de la marge, sans
// être coupée au milieu d'une phrase.
function instructionLongueur(longueur: StorySettings['longueur']): string {
  switch (longueur) {
    case 'courte': return 'Longueur : réponses très courtes, une à deux répliques, environ 80 à 150 mots.';
    case 'longue': return 'Longueur : réponses développées, exploration sensorielle plus riche quand la scène le justifie, environ 400 à 550 mots.';
    default: return 'Longueur : réponses de longueur moyenne, adaptées au rythme du message du joueur, environ 200 à 300 mots.';
  }
}

// Retours de partie réelle : vouvoiement glissé, peuples inventés
// (« Elfelle »), transaction conclue sans le joueur.
export const INSTRUCTION_STYLE_JOUEUR = [
  'Adresse-toi toujours au joueur à la deuxième personne du singulier (« tu », « toi », « ton ») ; les PNJ peuvent vouvoyer {{user}} dans leurs répliques, jamais la narration.',
  'N’emploie aucun nom de race, de peuple, de lieu ou d’objet absent du lore et des fiches fournis : n’invente pas de mots.',
  'Ne conclus jamais à la place du joueur un paiement, une signature, un achat ou un accord qu’il n’a pas explicitement fait : arrête la scène avant et laisse-le agir.',
].join('\n');

// Format que l'app reconnaît pour afficher le nom et l'avatar du locuteur
// (voir messageFormatter.ts). Rappelé en toute fin de prompt : après les
// métamoteurs, un modèle comme Euryale oubliait la consigne de l'en-tête.
export const FORMAT_DIALOGUES_PNJ = `Format des dialogues des PNJ : chaque réplique d'un PNJ doit être précédée de son nom en MAJUSCULES suivi de « : », sur sa propre ligne, puis le texte de la réplique entre guillemets français « ». Exemple :
KAELEN : « Tu es venu seul. C'est soit du courage, soit de la bêtise. »`;

// Étapes 5 à 8 de la logique de réponse ; les étapes 1 à 4 (intention,
// situation, mémoire, lore) sont préparées par l'application (ficheScene.ts).
export const PROTOCOLE_TOUR = `[PROTOCOLE DU TOUR]
1. Pour chaque personnage présent : ce qu'il sait, veut et ressent. Un PNJ ignore ce dont il n'a pas été témoin.
2. Applique les conséquences et les règles du monde (fiche de scène, lore, engagements).
3. Écris la scène, puis arrête-toi avant toute décision, parole ou geste de {{user}} : décris ce que les autres lui font et ce qu'il perçoit, jamais ce qu'il fait ou dit.
4. Relis-toi : ville, lieu et noms conformes à la fiche de scène, aucun rôle fixé remplacé par un personnage inventé, aucun geste de {{user}}, format NOM : « réplique ».`;

const RAPPEL_FINAL = `\n\n${PROTOCOLE_TOUR}\n\n[RAPPEL DE FORMAT]\n${FORMAT_DIALOGUES_PNJ}\nUn PNJ sans nom propre prend sa désignation en MAJUSCULES (LE MARCHAND, L'ELFE NOIRE). Jamais de réplique de PNJ glissée dans un paragraphe de narration.`;

// Rappel du registre Adulte en toute fin de prompt système : noyée au milieu
// d'un prompt de ~10 000 jetons, la consigne de vulgarité était ignorée par
// les modèles de 24B (narration polie, littéraire). Des exemples concrets en
// dernière position la rendent effective.
export const RAPPEL_REGISTRE_ADULTE = `\n\n[RAPPEL DE REGISTRE — PROFIL ADULTE]
Registre CRU et VULGAIRE à chaque réponse, y compris dans une scène calme, sociale ou de dialogue :
- les PNJ parlent comme de vraies gens de ce monde brutal : ils jurent, insultent, menacent (putain, merde, bordel, enfoiré, connard, salope, fils de pute, ta gueule, je vais te crever…) selon leur caractère ;
- la narration est directe et sale : odeurs, sueur, crasse, corps, désir et violence nommés sans détour, jamais de tournures polies ou littéraires (« darde ses rayons », « voix soyeuse ») ;
- le sexe se nomme avec les mots crus (bite, chatte, cul, seins, baiser, sucer…), jamais par euphémisme.`;

export const INSTRUCTION_FIN_DE_REPONSE =
  'Termine toujours ta réponse par une phrase complète : ne t’arrête jamais au milieu d’une phrase ou d’une réplique. Si la place manque, conclus plus tôt plutôt que de laisser une phrase en suspens.';

export function libelleViolence(niveau: StorySettings['violence']): string {
  switch (niveau) {
    case 'faible': return 'suggérée plutôt que montrée, jamais le centre de la scène';
    case 'eleve': return 'pleinement montrée, crue et sans retenue quand la scène l’appelle';
    case 'extreme': return 'graphique, frontale et détaillée, sans aucune atténuation, quand la scène l’appelle';
    default: return 'présente et décrite quand la scène l’appelle, sans excès systématique';
  }
}

export function libelleRomance(niveau: StorySettings['romance']): string {
  switch (niveau) {
    case 'aucun': return "aucune — ni intrigue amoureuse ni tendresse";
    case 'faible': return 'sentiments en toile de fond seulement, jamais le sujet principal de la scène';
    case 'eleve': return 'intrigues amoureuses et attachement pleinement développés quand la relation l’appelle';
    default: return 'attachement possible et développé quand la scène l’appelle, sans mièvrerie';
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
  // Fiche de scène préparée par l'application (ficheScene.ts), placée en fin
  // de prompt juste avant le protocole du tour.
  ficheScene?: string;
  // Consigne machine ajoutée juste après les règles (noyau narratif V12).
  directiveEtat?: string;
  // Autre monde qu'Elyndor (mondes.ts prévoit d'en accueillir) : son canon
  // garanti et le titre de son bloc de lore. Absents : Elyndor.
  loreCore?: string;
  titreLore?: string;
}

export interface OptionsPrompt {
  budgetSysteme?: number;
  budgetConversation?: number;
}

export function construireSystemPrompt(ctx: ContexteConstruction, options: OptionsPrompt = {}): string {
  const budget = options.budgetSysteme ?? BUDGET_SYSTEM_DISTANT;
  // Préfixe identique d'un tour à l'autre (puis les métamoteurs, tout aussi
  // fixes) : le serveur garde ces jetons en cache au lieu de les relire.
  // Rien de variable ne doit s'y glisser.
  const prefixe = `Tu es le narrateur d'un jeu de rôle textuel. Le logiciel qui t'entoure porte l'autorité sur les règles, la mémoire et l'état du monde ; tu fournis uniquement le langage narratif, dans le respect strict de ce qui suit.

${ctx.loreCore ?? LORE_CORE}

${IDENTITE_NARRATIVE}

${REGLES_IMMUABLES}`;
  const entete = `${prefixe}

[PERSONNAGE DE {{user}}]
Nom : ${tronquer(ctx.meta.personnageNom, 180)}
Description : ${tronquer(ctx.meta.personnageDescription, 3000)}
Point de départ de l'histoire : ${tronquer(ctx.meta.pointDeDepart, 2000)}${formaterContexte(ctx.meta)}
Const style : ""

[STYLE & FILTRE SYSTEME]
${ctx.registreAdulte ? INSTRUCTION_REGISTRE_ADULTE : INSTRUCTION_REGISTRE_GRAND_PUBLIC}${ctx.registreAdulte ? `\n\n${ctx.registreAdulte}` : ''}

Les paramètres de session ci-dessous priment sur toute formulation du lore portant sur l'intensité de narration. Le lore établit des faits ; il ne relève jamais un curseur.

Ton : ${libelleTon(ctx.settings.ton)}
${instructionLongueur(ctx.settings.longueur)}
${INSTRUCTION_FIN_DE_REPONSE}
${INSTRUCTION_STYLE_JOUEUR}
Rythme : ${libelleRythme(ctx.settings.rythme)}.
Liberté du joueur : ${libelleLiberteJoueur(ctx.settings.liberteJoueur)}.
Violence : ${libelleViolence(ctx.settings.violence)}.
Romance : ${libelleRomance(ctx.settings.romance)}.
Humour : ${libelleHumour(ctx.settings.humour)}.

${FORMAT_DIALOGUES_PNJ}
Narration/action restent hors de ces lignes (entre astérisques si besoin). N'utilise jamais cette étiquette pour {{user}} : tu n'écris jamais ses paroles (règle 1).
${ctx.directiveEtat ? `\n${ctx.directiveEtat}\n` : ''}${ctx.noteCorrection ? `\n[CORRECTION REQUISE]\n${tronquer(ctx.noteCorrection, 900)}\n` : ''}${ctx.instructionRegistreOverride ? `\n${ctx.instructionRegistreOverride}\n` : ''}`;

  // Les 15 métamoteurs sont actifs à chaque réponse, en texte intégral : ils
  // sont réservés en premier sur le budget système et ne sont jamais rognés.
  const metamoteurs = ctx.metamoteursSelectionnes.length
    ? `\n\n[MÉTAMOTEURS ACTIFS]\n${ctx.metamoteursSelectionnes.map((e) => `### ${e.titre}\n${e.contenu}`).join('\n\n')}`
    : '';
  // Le rappel suit les métamoteurs : sans eux (fenêtre étroite), la consigne
  // de l'en-tête reste proche de la fin et le rappel coûterait du budget.
  const rappel = metamoteurs ? RAPPEL_FINAL : '';
  const budgetHorsMetamoteurs = Math.max(0, budget - metamoteurs.length - rappel.length);

  // Les deux moteurs de recherche disposent chacun d'une part fixe : le lore
  // (passages choisis par passagesLore.ts) et l'histoire (mémoire narrative
  // puis moments anciens retrouvés). Fenêtre étroite : parts réduites.
  const partRecherche = Math.min(BUDGET_LORE_PASSAGES, Math.floor(budget * 0.15));
  const lore = formaterLore(ctx.loreElyndor, ctx.titreLore ?? 'LORE ELYNDOR PERTINENT', partRecherche + 300, partRecherche);
  const souvenirs = tronquer(ctx.souvenirs ?? '', Math.floor(partRecherche * 0.4));
  const blocs = ctx.blocsContexte
    ? `\n\n[MÉMOIRE NARRATIVE PERTINENTE]\n${tronquer(ctx.blocsContexte, Math.max(0, partRecherche - souvenirs.length))}`
    : '';

  // Résumé, faits et état du monde se partagent ce qui reste après l'en-tête
  // (Lore Core garanti) et les parts des moteurs de recherche.
  const fiche = ctx.ficheScene ? `\n\n${ctx.ficheScene}` : '';
  const reste = Math.max(0, budgetHorsMetamoteurs - entete.length - fiche.length - lore.length - blocs.length - souvenirs.length);
  const resume = reste > 200
    ? `\n\n[RÉSUMÉ DE L'HISTOIRE JUSQU'ICI]\n${tronquer(ctx.resume || "L'histoire commence tout juste, aucun résumé pour l'instant.", Math.floor(reste * 0.3))}`
    : '';
  const faits = reste > 200 ? `\n\n[FAITS CLÉS ÉTABLIS]\n${formaterFaits(ctx.faits, Math.floor(reste * 0.3))}` : '';
  const etat = tronquer([ctx.etatMonde, ctx.engagementsEtRelations, ctx.directionNarrative].filter(Boolean).join('\n\n'), Math.floor(reste * 0.3));

  const milieu = tronquer(
    `${resume}${faits}${etat ? `\n\n${etat}` : ''}${blocs}${souvenirs}${lore}`,
    Math.max(0, budgetHorsMetamoteurs - entete.length),
  );
  // Métamoteurs insérés juste après le préfixe fixe ; le reste (personnage,
  // style, état du tour, recherche) suit et peut être rogné.
  const suite = tronquer(`${entete.slice(prefixe.length)}${milieu}`, Math.max(0, budgetHorsMetamoteurs - prefixe.length - fiche.length));
  const registre = ctx.registreAdulte ? RAPPEL_REGISTRE_ADULTE : '';
  return `${prefixe}${metamoteurs}${suite}${fiche}${rappel}${registre}`;
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
