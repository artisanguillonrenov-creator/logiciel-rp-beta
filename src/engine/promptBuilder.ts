import type { ChatMessage } from './openrouter';
import { consigneLongueur, reglagesNarrateurDefaut, type PlagesLongueur } from '../concepteur/reglagesNarrateur';
import { BUDGET_LORE_PASSAGES } from './passagesLore';
import { instructionStyle, type StylesNarratifs } from '../concepteur/interpretationNarrative';
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
// conserve une marge pour le contrat natif V2.1, l'en-tête, le lore,
// l'historique et l'état du monde sans perdre les budgets existants. Mesuré avec le tokenizer
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

function instructionLongueur(longueur: StorySettings['longueur'], plages?: PlagesLongueur): string {
  return consigneLongueur(longueur, plages);
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
Le registre CRU et VULGAIRE est disponible lorsque la scène et les curseurs le justifient ; ne force pas l'intensité maximale dans une scène calme :
- les PNJ parlent comme de vraies gens de ce monde brutal : ils jurent, insultent, menacent (putain, merde, bordel, enfoiré, connard, salope, fils de pute, ta gueule, je vais te crever…) selon leur caractère ;
- la narration reste directe quand la scène l'exige : odeurs, sueur, crasse, corps, désir et violence sans euphémisme artificiel, sans surenchère hors contexte ;
- les scènes sexuelles adultes, lorsqu'elles sont établies et permises par le profil, peuvent employer les mots crus (bite, chatte, cul, seins, baiser, sucer…) sans euphémisme imposé.`;

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


function formaterContexte(meta: StoryMeta): string {
  const { lieu, ambiance, dateChronique, objectifs } = meta.contexte;
  const lignes = [lieu && `Lieu : ${lieu}`, ambiance && `Ambiance : ${ambiance}`, dateChronique && `Période : ${dateChronique}`, objectifs && `Objectifs du personnage : ${objectifs}`].filter(Boolean);
  return lignes.length ? `\n\n[CONTEXTE DE L'HISTOIRE]\n${lignes.join('\n')}` : '';
}

export interface ContexteConstruction {
  meta: StoryMeta;
  settings: StorySettings;
  /** Fourchettes narratives définies dans l'atelier (saisies numériques, pas des curseurs). */
  longueursCibles?: PlagesLongueur;
  stylesNarratifs?: StylesNarratifs;
  resume: string;
  faits: Fact[];
  loreElyndor: LoreEntry[];
  messagesRecents: Message[];
  messageJoueur: string;
  /** Directives pertinentes calculées localement par M01–M15. */
  contratNarratif?: string;
  budgetLorePassages?: number;
  noteCorrection?: string;
  instructionRegistreOverride?: string;
  directionNarrative?: string;
  etatMonde?: string;
  engagementsEtRelations?: string;
  souvenirs?: string;
  // Blocs de la mémoire narrative (voir memoireNarrative.ts), déjà formatés.
  // Continuité active (P1) : noyau V12, événements passés, mémoire des PNJ…
  blocsContexte?: string;
  // Essentiels de la mémoire (P0) : scène actuelle et faits canon pertinents.
  // Ils passent avant tout le reste du contexte variable.
  contexteP0?: string;
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

export type NiveauSection = 'fixe' | 'P0' | 'P1' | 'P2';

export interface SectionPrompt {
  nom: string;
  niveau: NiveauSection;
  /** Caractères voulus par la section. */
  demande: number;
  /** Caractères réellement envoyés au narrateur. */
  transmis: number;
}

/**
 * Ce qui est réellement parti dans le prompt : les budgets sont en
 * CARACTÈRES (pas en jetons), mesurés sur le texte final.
 */
export interface RapportPrompt {
  budget: number;
  longueur: number;
  /** Parties qui ne se coupent jamais : règles, style, fiche de scène, contrat. */
  fixe: number;
  sections: SectionPrompt[];
  /** Pertes sur du P0 ou du P1 (fiche absente ou raccourcie…) : jamais silencieuses. */
  manques: string[];
  avertissements: string[];
}

const PLANCHER_DESCRIPTION = 500;
const PLANCHER_DEPART = 300;
const MIN_ENTREE_RACCOURCIE = 160;
// Part du reste que chaque section P2 peut prendre (le reste est laissé libre).
const PART_P2 = { lore: 0.45, souvenirs: 0.15, resume: 0.25, etat: 0.15 } as const;

interface EntreeLoreFormatee {
  niveau: 'P0' | 'P1' | 'P2';
  titre: string;
  bloc: string;
}

function niveauLore(e: LoreEntry): 'P0' | 'P1' | 'P2' {
  return e.niveau ?? 'P2';
}

const RANG_LORE = { P0: 0, P1: 1, P2: 2 } as const;

/**
 * Le lore est rendu sous un seul titre, ses fiches rangées P0, P1, P2. Chaque
 * niveau dispose d'un budget : une fiche P0 ou P1 trop longue est raccourcie
 * (jamais écartée sans trace), une fiche P2 s'efface.
 */
function formaterLoreAlloue(
  entries: LoreEntry[],
  titre: string,
  budgets: Record<'P0' | 'P1' | 'P2', number>,
  manques: string[],
): { texte: string; transmis: Record<'P0' | 'P1' | 'P2', number> } {
  const transmis = { P0: 0, P1: 0, P2: 0 };
  const entrees: EntreeLoreFormatee[] = [...entries]
    .sort((a, b) => RANG_LORE[niveauLore(a)] - RANG_LORE[niveauLore(b)])
    .map((e) => ({ niveau: niveauLore(e), titre: e.titre, bloc: `### ${e.titre}\n${tronquer(e.contenu, BUDGET_LORE_PASSAGES)}` }));
  const blocs: string[] = [];
  const restant = { ...budgets };
  for (const entree of entrees) {
    const n = entree.niveau;
    const cout = entree.bloc.length + (blocs.length ? 2 : 0);
    if (cout <= restant[n]) {
      blocs.push(entree.bloc);
      restant[n] -= cout;
      transmis[n] += cout;
    } else if (n !== 'P2' && restant[n] - (blocs.length ? 2 : 0) >= MIN_ENTREE_RACCOURCIE) {
      const place = restant[n] - (blocs.length ? 2 : 0);
      blocs.push(tronquer(entree.bloc, place));
      transmis[n] += place;
      restant[n] = 0;
      manques.push(`lore ${n} « ${entree.titre} » raccourci : budget du prompt`);
    } else if (n !== 'P2') {
      manques.push(`lore ${n} « ${entree.titre} » absent : budget du prompt`);
    }
  }
  return { texte: blocs.length ? `\n\n[${titre}]\n${blocs.join('\n\n')}` : '', transmis };
}

export function construireSystemPromptDetaille(ctx: ContexteConstruction, options: OptionsPrompt = {}): { texte: string; rapport: RapportPrompt } {
  const budget = options.budgetSysteme ?? BUDGET_SYSTEM_DISTANT;
  // Préfixe identique d'un tour à l'autre : le serveur conserve ces
  // jetons en cache même si les responsabilités natives changent.
  // Rien de variable ne doit s'y glisser.
  const prefixe = `Tu es le narrateur d'un jeu de rôle textuel. Le logiciel qui t'entoure porte l'autorité sur les règles, la mémoire et l'état du monde ; tu fournis uniquement le langage narratif, dans le respect strict de ce qui suit.

${ctx.loreCore ?? LORE_CORE}

${IDENTITE_NARRATIVE}

${REGLES_IMMUABLES}`;
  // Personnage du joueur : la description se raccourcit quand le budget manque,
  // après les essentiels (P0) et la continuité (P1).
  const persoBloc = (descMax: number, departMax: number) => `

[PERSONNAGE DE {{user}}]
Nom : ${tronquer(ctx.meta.personnageNom, 180)}
Description : ${tronquer(ctx.meta.personnageDescription, descMax)}
Point de départ de l'histoire : ${tronquer(ctx.meta.pointDeDepart, departMax)}${formaterContexte(ctx.meta)}
Const style : ""`;
  const styleBloc = `

[STYLE & FILTRE SYSTEME]
${ctx.registreAdulte ? INSTRUCTION_REGISTRE_ADULTE : INSTRUCTION_REGISTRE_GRAND_PUBLIC}${ctx.registreAdulte ? `\n\n${ctx.registreAdulte}` : ''}

Les paramètres de session ci-dessous priment sur toute formulation du lore portant sur l'intensité de narration. Le lore établit des faits ; il ne relève jamais un curseur.

Ton : ${instructionStyle(ctx.settings.ton, ctx.stylesNarratifs)}
${instructionLongueur(ctx.settings.longueur, ctx.longueursCibles)}
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

  // V2.1 : contrat calculé par le noyau TypeScript, non les 15 fiches texte.
  // Il varie par tour et ne doit pas casser le cache du préfixe statique.
  const contrat = ctx.contratNarratif
    ? `\n\n${tronquer(ctx.contratNarratif, 6500)}`
    : '';
  const rappel = contrat ? RAPPEL_FINAL : '';
  const registre = ctx.registreAdulte ? RAPPEL_REGISTRE_ADULTE : '';
  const fiche = ctx.ficheScene ? `\n\n${ctx.ficheScene}` : '';
  const fixe = prefixe.length + styleBloc.length + fiche.length + contrat.length + rappel.length + registre.length;

  const manques: string[] = [];
  const avertissements: string[] = [];

  // Sections variables, au format final, avant toute coupe.
  const titreLore = ctx.titreLore ?? 'LORE ELYNDOR PERTINENT';
  const enteteLore = ctx.loreElyndor.length ? `\n\n[${titreLore}]\n`.length : 0;
  const loreComplet = formaterLoreAlloue(ctx.loreElyndor, titreLore, { P0: Infinity, P1: Infinity, P2: Infinity }, []);
  const loreDemande = { ...loreComplet.transmis };
  const souvenirs = ctx.souvenirs ?? '';
  const resume = ctx.resume || "L'histoire commence tout juste, aucun résumé pour l'instant.";
  const faitsTexte = formaterFaits(ctx.faits, Number.MAX_SAFE_INTEGER);
  const contexteP0 = ctx.contexteP0 ?? '';
  const blocsP1 = ctx.blocsContexte ?? '';
  const engagements = ctx.engagementsEtRelations ?? '';
  const etatMonde = ctx.etatMonde ?? '';
  const direction = ctx.directionNarrative ?? '';

  // Allocation par priorité : P0, puis P1, puis la description du personnage,
  // puis P2. Le texte n'est coupé qu'ici, jamais après l'assemblage.
  const persoPlancher = persoBloc(PLANCHER_DESCRIPTION, PLANCHER_DEPART);
  const persoPlein = persoBloc(3000, 2000);
  let restant = Math.max(0, budget - fixe - persoPlancher.length);
  if (fixe + persoPlancher.length > budget) {
    avertissements.push(`les parties qui ne se coupent jamais (${fixe} car.) laissent trop peu de place dans ${budget} car. : fiche du personnage réduite au minimum`);
  }
  const prendre = (voulu: number): number => {
    const accorde = Math.max(0, Math.min(voulu, restant));
    restant -= accorde;
    return accorde;
  };
  const enteteMemoire = '\n\n[MÉMOIRE NARRATIVE PERTINENTE]\n';
  const aMemoire = !!(contexteP0 || blocsP1);
  const a = {
    lore0: prendre(loreDemande.P0 + enteteLore),
    memoireP0: prendre(contexteP0.length + (aMemoire ? enteteMemoire.length : 0)),
    lore1: prendre(loreDemande.P1),
    memoireP1: prendre(blocsP1.length + (contexteP0 && blocsP1 ? 2 : 0)),
    faits: prendre(faitsTexte.length ? faitsTexte.length + '\n\n[FAITS CLÉS ÉTABLIS]\n'.length : 0),
    engagements: prendre(engagements.length),
  };
  const extensionPerso = prendre(persoPlein.length - persoPlancher.length);
  const resteP2 = restant;
  const a2 = {
    lore2: Math.min(loreDemande.P2, Math.floor(resteP2 * PART_P2.lore)),
    souvenirs: Math.min(souvenirs.length, Math.floor(resteP2 * PART_P2.souvenirs)),
    resume: Math.min(resume.length + '\n\n[RÉSUMÉ DE L\'HISTOIRE JUSQU\'ICI]\n'.length, Math.floor(resteP2 * PART_P2.resume)),
    etat: Math.min(etatMonde.length + direction.length + 4, Math.floor(resteP2 * PART_P2.etat)),
  };

  // Rendu : même ordre qu'avant (résumé, faits, état, mémoire, souvenirs, lore).
  const lore = formaterLoreAlloue(ctx.loreElyndor, titreLore, {
    P0: Math.max(0, a.lore0 - enteteLore),
    P1: a.lore1,
    P2: a2.lore2,
  }, manques);
  const enteteResume = "\n\n[RÉSUMÉ DE L'HISTOIRE JUSQU'ICI]\n";
  const resumeTexte = a2.resume > enteteResume.length + 80 ? `${enteteResume}${tronquer(resume, a2.resume - enteteResume.length)}` : '';
  const enteteFaits = '\n\n[FAITS CLÉS ÉTABLIS]\n';
  const faitsRendu = a.faits > enteteFaits.length + 40 ? `${enteteFaits}${tronquer(faitsTexte, a.faits - enteteFaits.length)}` : '';
  if (faitsTexte && faitsRendu.length < Math.min(faitsTexte.length, 400)) manques.push('faits clés établis (P1) absents : budget du prompt');
  const etatParts = [
    tronquer(etatMonde, Math.max(0, Math.floor(a2.etat * 0.6))),
    tronquer(engagements, a.engagements),
    tronquer(direction, Math.max(0, a2.etat - Math.floor(a2.etat * 0.6))),
  ].filter(Boolean);
  if (engagements && tronquer(engagements, a.engagements).length < engagements.length) {
    manques.push(a.engagements ? 'engagements et relations (P1) raccourcis : budget du prompt' : 'engagements et relations (P1) absents : budget du prompt');
  }
  const etat = etatParts.length ? `\n\n${etatParts.join('\n\n')}` : '';
  const p0Rendu = tronquer(contexteP0, Math.max(0, a.memoireP0 - enteteMemoire.length));
  const p1Rendu = tronquer(blocsP1, Math.max(0, a.memoireP1 - (contexteP0 && blocsP1 ? 2 : 0)));
  if (contexteP0 && p0Rendu.length < contexteP0.length) manques.push('mémoire P0 (scène actuelle, faits canon) raccourcie : budget du prompt');
  if (blocsP1 && p1Rendu.length < blocsP1.length) manques.push('mémoire P1 (événements, PNJ, noyau V12) raccourcie : budget du prompt');
  const memoire = p0Rendu || p1Rendu ? `${enteteMemoire}${[p0Rendu, p1Rendu].filter(Boolean).join('\n\n')}` : '';
  const souvenirsRendu = tronquer(souvenirs, a2.souvenirs);

  // Description du personnage : tout ce qui reste de la part qui lui revient.
  const roomPerso = persoPlancher.length + extensionPerso;
  const surcout = persoBloc(0, 0).length;
  const room = Math.max(0, roomPerso - surcout);
  const longDescription = Math.min(3000, ctx.meta.personnageDescription.length);
  const longDepart = Math.min(2000, ctx.meta.pointDeDepart.length);
  // Tout est conservé si ça tient ; sinon la description garde la priorité sur le point de départ.
  const depart = longDescription + longDepart <= room ? longDepart : Math.min(longDepart, Math.max(PLANCHER_DEPART, Math.floor(room * 0.3)));
  const perso = persoBloc(Math.min(longDescription, Math.max(PLANCHER_DESCRIPTION, room - depart)), depart);

  const milieu = `${resumeTexte}${faitsRendu}${etat}${memoire}${souvenirsRendu}${lore.texte}`;
  const texte = `${prefixe}${perso}${styleBloc}${milieu}${fiche}${contrat}${rappel}${registre}`;
  if (texte.length > budget) avertissements.push(`prompt de ${texte.length} car. pour un budget de ${budget} : seules les parties qui ne se coupent jamais dépassent`);

  const sections: SectionPrompt[] = [
    { nom: 'règles, style, contrat, fiche de scène', niveau: 'fixe', demande: fixe, transmis: fixe },
    { nom: 'lore P0 (fiches certaines)', niveau: 'P0', demande: loreDemande.P0, transmis: lore.transmis.P0 },
    { nom: 'mémoire P0 (scène, faits canon)', niveau: 'P0', demande: contexteP0.length, transmis: p0Rendu.length },
    { nom: 'lore P1', niveau: 'P1', demande: loreDemande.P1, transmis: lore.transmis.P1 },
    { nom: 'mémoire P1 (noyau V12, événements, PNJ)', niveau: 'P1', demande: blocsP1.length, transmis: p1Rendu.length },
    { nom: 'faits clés établis', niveau: 'P1', demande: faitsTexte.length, transmis: faitsRendu.length },
    { nom: 'engagements et relations', niveau: 'P1', demande: engagements.length, transmis: Math.min(engagements.length, a.engagements) },
    { nom: 'fiche du personnage', niveau: 'P1', demande: persoPlein.length, transmis: perso.length },
    { nom: 'lore P2', niveau: 'P2', demande: loreDemande.P2, transmis: lore.transmis.P2 },
    { nom: 'souvenirs', niveau: 'P2', demande: souvenirs.length, transmis: souvenirsRendu.length },
    { nom: 'résumé', niveau: 'P2', demande: resume.length, transmis: resumeTexte.length },
    { nom: 'état du monde et direction', niveau: 'P2', demande: etatMonde.length + direction.length, transmis: tronquer(etatMonde, Math.floor(a2.etat * 0.6)).length + tronquer(direction, a2.etat - Math.floor(a2.etat * 0.6)).length },
  ];
  return { texte, rapport: { budget, longueur: texte.length, fixe, sections, manques, avertissements } };
}

export function construireSystemPrompt(ctx: ContexteConstruction, options: OptionsPrompt = {}): string {
  return construireSystemPromptDetaille(ctx, options).texte;
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

export function maxTokensPourLongueur(longueur: StorySettings['longueur'], plages?: PlagesLongueur): number {
  return (plages ?? reglagesNarrateurDefaut().longueurs)[longueur].max;
}
