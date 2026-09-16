import metamoteursRaw from '../data/metamoteurs.json';
import elyndorRaw from '../data/elyndorLore.json';
import type { AppSettings, Message, StoryState } from '../types';
import {
  chargerLoreElyndor,
  chargerMetamoteurs,
  selectionnerLoreElyndorSemantique,
  selectionnerMetamoteursSemantique,
  type OptionsSelectionLore,
} from './loreLoader';
import {
  construireMessages,
  construireSystemPrompt,
  maxTokensPourLongueur,
  temperaturePourCreativite,
  NB_MESSAGES_RECENTS,
  type ContexteConstruction,
} from './promptBuilder';
import { configurationLLM, appellerModele } from './openrouter';
import { modeleOverridePourFournisseur } from './llmProvider';
import { embeddingsDisponibles, obtenirEmbeddings } from './embeddings';
import { assurerEmbeddings } from '../storage/embeddingsStore';
import { mettreAJourMemoire } from './memory';
import { convertirLoreEmergentPourSelection, mettreAJourLoreEmergent } from './emergentLore';
import { convertirPluginsPourSelection } from './plugins';
import { getPlugins, getStory } from '../storage/storage';
import { fusionnerEtatDerivePersistant } from './derivedState';
import { detecterStagnation, formaterDirection, mettreAJourDirecteur } from './storyDirector';
import { formaterMonde, mettreAJourMonde } from './worldSimulation';
import { formaterEngagementsEtRelations, mettreAJourSocial } from './socialDynamics';
import {
  embedderMessagesAnciens,
  formaterSouvenirs,
  formaterSouvenirsDebug,
  selectionnerSouvenirs,
  type Souvenir,
} from './searchHistorique';
import {
  ENTREES_ADULTE_UNIQUEMENT,
  ErreurProfilContenu,
  INSTRUCTION_REGISTRE_GRAND_PUBLIC,
  plafonnerCurseurs,
  validerProfilContenuHeuristique,
} from './contenuAdulte';
import {
  appliquerPatchLocal,
  determinerStrategie,
  fusionnerRapports,
  reparerReponse,
  reponseFaitParlerLeJoueur,
  retirerRepliqueDuJoueur,
  validerAgentiviteHeuristique,
  validerReponseLLM,
} from './validator';

const METAMOTEUR_REGISTRE = '[MÉTA] Registre et Style Narratif';

const METAMOTEURS = chargerMetamoteurs(metamoteursRaw as any);
const LORE_ELYNDOR = chargerLoreElyndor(elyndorRaw as any);

function genererId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface DebugLore {
  metamoteurs: string[];
  loreElyndor: string[];
  souvenirs: string[];
}

export interface ResultatTour {
  story: StoryState;
  aEteCorrige: boolean;
  debugLore: DebugLore;
}

function formaterDebug(titre: string, score?: number): string {
  return score === undefined ? titre : `${titre} (${score.toFixed(2)})`;
}

// Texte embeddé pour la sélection sémantique — volontairement compact
// (contrairement à l'ancien scan par mots-clés qui devait couvrir tout
// l'historique pour ne rien manquer, un embedding capture le sens même
// d'une formulation différente : le résumé et les faits clés suffisent à
// porter ce qui a été établi plus tôt, pas besoin d'y rejouer tous les
// messages bruts).
function construireTexteRequete(story: StoryState, messageJoueur: string): string {
  return [
    story.meta.personnageDescription,
    story.meta.pointDeDepart,
    story.meta.contexte.lieu,
    story.meta.contexte.ambiance,
    story.meta.contexte.objectifs,
    story.memoire.resume,
    ...story.memoire.faits.map((f) => f.texte),
    ...story.messages.slice(-4).map((m) => m.content),
    messageJoueur,
  ]
    .filter(Boolean)
    .join('\n');
}

interface SelectionLore {
  metamoteursSelectionnes: ReturnType<typeof selectionnerMetamoteursSemantique>;
  loreElyndor: ReturnType<typeof selectionnerLoreElyndorSemantique>;
  souvenirs: Souvenir[];
  debugLore: DebugLore;
}

/**
 * Calcule la sélection de métamoteurs et de lore Elyndor pertinents à la
 * scène par similarité sémantique (brief Phase 2 — remplace la
 * correspondance de mots-clés). Les embeddings du lore sont mis en cache
 * localement (voir embeddingsStore) : après le premier tour, seul le texte
 * de la requête du tour en cours nécessite un appel réseau.
 */
export async function calculerSelectionLore(
  story: StoryState,
  messageJoueur: string,
  appSettings: AppSettings,
  optionsLoreElyndor?: OptionsSelectionLore,
): Promise<SelectionLore> {
  const texteRequete = construireTexteRequete(story, messageJoueur);
  // Pipeline de lore émergent (brief Phase 2) : les entrées "permanent"
  // (PNJ récurrents, lieux, factions... validées par reconfirmation)
  // rejoignent le pool sélectionnable au même titre que le lorebook
  // Elyndor statique. Les packs de contenu installés (plugins "esprit",
  // distribution brief Phase 2) font de même.
  const plugins = await getPlugins();
  const poolElyndor = [
    ...LORE_ELYNDOR,
    ...convertirLoreEmergentPourSelection(story.loreEmergent),
    ...convertirPluginsPourSelection(plugins),
  ];

  // Filet de sécurité pour la continuité (brief : compenser les manques du
  // pipeline de mémoire) : messages plus anciens que la fenêtre récente déjà
  // envoyée brute, candidats à la recherche sémantique de secours — voir
  // src/engine/searchHistorique.ts.
  const messagesAnciens = story.messages.slice(0, Math.max(0, story.messages.length - NB_MESSAGES_RECENTS));

  // La recherche sémantique (lore + historique) dépend d'un fournisseur
  // d'embeddings réseau (OpenRouter ou la clé de secours) — elle n'a pas
  // d'équivalent en mode local (expo-litert-lm ne fait que de la
  // génération de texte). Sans aucune des deux clés — le cas du joueur en
  // mode local, entièrement hors-ligne — on ne tente même pas l'appel : on
  // continue sans lore ni historique retrouvés plutôt que de faire
  // échouer tout le tour pour un enrichissement optionnel.
  if (!embeddingsDisponibles(appSettings)) {
    return {
      metamoteursSelectionnes: [],
      loreElyndor: [],
      souvenirs: [],
      debugLore: { metamoteurs: [], loreElyndor: [], souvenirs: [] },
    };
  }

  const [vecteursMetamoteurs, vecteursElyndor, { vecteurs: [vecteurRequete] }, vecteursMessagesAnciens] = await Promise.all([
    assurerEmbeddings(
      METAMOTEURS.map((e) => ({ id: e.id, contenu: e.contenu })),
      appSettings,
    ),
    assurerEmbeddings(
      poolElyndor.map((e) => ({ id: e.id, contenu: e.contenu })),
      appSettings,
    ),
    obtenirEmbeddings([texteRequete], appSettings),
    embedderMessagesAnciens(messagesAnciens, appSettings),
  ]);

  let metamoteursSelectionnes = selectionnerMetamoteursSemantique(METAMOTEURS, vecteurRequete, vecteursMetamoteurs);
  let loreElyndor = selectionnerLoreElyndorSemantique(
    poolElyndor,
    texteRequete,
    vecteurRequete,
    vecteursElyndor,
    undefined,
    optionsLoreElyndor,
  );
  const souvenirs = selectionnerSouvenirs(messagesAnciens, vecteurRequete, vecteursMessagesAnciens);

  // Contrôle d'âge (brief Phase 2) : retire le registre explicite et les
  // entrées Elyndor réservées à l'adulte du contexte envoyé au modèle —
  // le plafonnement est imposé ici, pas seulement suggéré par une consigne.
  if (appSettings.profilContenu === 'grand_public') {
    metamoteursSelectionnes = metamoteursSelectionnes.filter((e) => e.titre !== METAMOTEUR_REGISTRE);
    loreElyndor = loreElyndor.filter((e) => !ENTREES_ADULTE_UNIQUEMENT.includes(e.titre));
  }

  return {
    metamoteursSelectionnes,
    loreElyndor,
    souvenirs,
    debugLore: {
      metamoteurs: metamoteursSelectionnes.map((e) => formaterDebug(e.titre, e.score)),
      loreElyndor: loreElyndor.map((e) => formaterDebug(e.titre, e.score)),
      souvenirs: formaterSouvenirsDebug(souvenirs),
    },
  };
}

// TODO(debug): à retirer après la bêta.
// Calcule la sélection de lore indépendamment de l'appel API, pour que
// l'écran puisse l'afficher même si la génération échoue ensuite.
export async function calculerDebugLore(story: StoryState, messageJoueur: string, appSettings: AppSettings): Promise<DebugLore> {
  const { debugLore } = await calculerSelectionLore(story, messageJoueur, appSettings);
  return debugLore;
}

// Assemble le contexte envoyé au prompt builder — factorisé pour être
// partagé entre genererTour (l'appel réel) et construirePromptDebug
// (réglages concepteur : affiche le prompt système sans appeler le modèle).
export function construireCtxBase(
  story: StoryState,
  messageJoueur: string,
  appSettings: AppSettings,
  selection: Pick<SelectionLore, 'metamoteursSelectionnes' | 'loreElyndor' | 'souvenirs'>,
): ContexteConstruction {
  return {
    meta: story.meta,
    // Contrôle d'âge : violence/romance plafonnés côté logiciel quand le
    // profil est GRAND_PUBLIC, quel que soit le réglage choisi pour
    // l'histoire — voir src/engine/contenuAdulte.ts.
    settings: plafonnerCurseurs(story.settings, appSettings.profilContenu),
    resume: story.memoire.resume,
    // Les faits archivés (L5, non reconfirmés depuis longtemps) restent
    // stockés mais ne sont plus injectés systématiquement — voir
    // src/engine/memory.ts.
    faits: story.memoire.faits.filter((f) => f.niveau !== 'archive'),
    metamoteursSelectionnes: selection.metamoteursSelectionnes,
    loreElyndor: selection.loreElyndor,
    messagesRecents: story.messages,
    messageJoueur,
    instructionRegistreOverride:
      appSettings.profilContenu === 'grand_public' ? INSTRUCTION_REGISTRE_GRAND_PUBLIC : undefined,
    // Story Director / Scene Director (brief Phase 2) : oriente la
    // prochaine réponse vers l'arc en cours et relance la scène en cas de
    // stagnation, sans jamais être visible du joueur.
    directionNarrative: formaterDirection(
      story.directeur,
      detecterStagnation(story.directeur, story.messages.length),
    ),
    // World Simulation + State Machine (brief Phase 2) : zones actives,
    // état établi et conséquences de déclencheurs en attente.
    etatMonde: formaterMonde(story.monde),
    // Engagements + dynamiques sociales (brief Phase 2) : promesses/dettes/
    // contrats non résolus et relations notables avec les PNJ.
    engagementsEtRelations: formaterEngagementsEtRelations(story.social),
    // Filet de sécurité pour la continuité : messages anciens retrouvés par
    // recherche sémantique — voir src/engine/searchHistorique.ts.
    souvenirs: formaterSouvenirs(selection.souvenirs, story.meta.personnageNom),
  };
}

/**
 * Réglages concepteur (Ajouts_A_Integrer.md #6) : construit le prompt
 * système exact qui serait envoyé au modèle pour ce message, sans appeler
 * l'API — pour l'inspecter tel quel plutôt que de le deviner.
 */
export async function construirePromptDebug(
  story: StoryState,
  messageJoueur: string,
  appSettings: AppSettings,
): Promise<string> {
  const { metamoteursSelectionnes, loreElyndor, souvenirs } = await calculerSelectionLore(story, messageJoueur, appSettings);
  return construireSystemPrompt(construireCtxBase(story, messageJoueur, appSettings, { metamoteursSelectionnes, loreElyndor, souvenirs }));
}

// Ces fonctions restent disponibles pour la commande concepteur « mise à
// jour forcée ». Le flux joueur normal ne les attend plus : le
// AutomationKernel exécute désormais mémoire/directeur/monde/social/lore
// après la sauvegarde du tour.
async function executerMisesAJourPeriodiques(
  appSettings: AppSettings,
  story: StoryState,
  messages: Message[],
): Promise<Pick<StoryState, 'memoire' | 'directeur' | 'monde' | 'social'>> {
  const depuisIndex = story.memoire.dernierMessageIndexMaj;
  const [memoire, directeur, monde, social] = await Promise.all([
    mettreAJourMemoire({
      appSettings,
      memoireActuelle: story.memoire,
      messages,
      personnageNom: story.meta.personnageNom,
    }),
    mettreAJourDirecteur({ appSettings, directeurActuel: story.directeur, messages, depuisIndex }),
    mettreAJourMonde({ appSettings, mondeActuel: story.monde, messages, depuisIndex }),
    mettreAJourSocial({ appSettings, socialActuel: story.social, messages, depuisIndex }),
  ]);
  return { memoire, directeur, monde, social };
}

async function mettreAJourLoreEmergentSeul(
  appSettings: AppSettings,
  story: StoryState,
  messages: Message[],
): Promise<Pick<StoryState, 'loreEmergent' | 'loreEmergentDernierIndex'>> {
  const loreEmergent = await mettreAJourLoreEmergent({
    appSettings,
    existants: story.loreEmergent,
    messages,
    depuisIndex: story.loreEmergentDernierIndex ?? 0,
    personnageNom: story.meta.personnageNom,
  });
  return { loreEmergent, loreEmergentDernierIndex: messages.length };
}

/**
 * Réglages concepteur : force les pipelines dérivés immédiatement. Cette
 * action reste volontairement synchrone car l'utilisateur concepteur attend
 * précisément le résultat de cette commande de diagnostic.
 */
export async function forcerMiseAJourEtat(story: StoryState, appSettings: AppSettings): Promise<StoryState> {
  const [maj, majLore] = await Promise.all([
    executerMisesAJourPeriodiques(appSettings, story, story.messages),
    mettreAJourLoreEmergentSeul(appSettings, story, story.messages),
  ]);
  return { ...story, ...maj, ...majLore };
}

async function rafraichirEtatDeriveAvantTour(story: StoryState): Promise<StoryState> {
  try {
    return fusionnerEtatDerivePersistant(story, await getStory(story.meta.id));
  } catch {
    // Une lecture de synchronisation ne doit pas transformer une panne de
    // stockage secondaire en panne de narration : la sauvegarde normale
    // signalera l'erreur ensuite si le stockage est réellement indisponible.
    return story;
  }
}

/**
 * Flux critique d'un tour : sélection du contexte → génération → validation
 * → ajout des deux messages. Les pipelines dérivés ne sont plus exécutés ici.
 * La sauvegarde confirmée publie ensuite la révision au AutomationKernel,
 * qui traite mémoire, directeur, monde, social et lore émergent en arrière-
 * plan avec garde de révision.
 */
export async function genererTour(
  story: StoryState,
  appSettings: AppSettings,
  messageJoueur: string,
  reponseAId?: string,
): Promise<ResultatTour> {
  const debutMs = Date.now();

  // Le Kernel peut avoir terminé le post-traitement du tour précédent alors
  // que l'écran détient encore sa copie. On récupère uniquement les champs
  // dérivés si le transcript persisté est strictement identique.
  const storyCourante = await rafraichirEtatDeriveAvantTour(story);

  const { metamoteursSelectionnes, loreElyndor, souvenirs, debugLore } = await calculerSelectionLore(
    storyCourante,
    messageJoueur,
    appSettings,
  );

  const ctxBase = construireCtxBase(storyCourante, messageJoueur, appSettings, { metamoteursSelectionnes, loreElyndor, souvenirs });

  const modelePourAppel = modeleOverridePourFournisseur(
    appSettings,
    storyCourante.meta.modeleOverride,
    storyCourante.meta.modeleOverrideFournisseur,
  ) || configurationLLM(appSettings).model;
  const temperature = storyCourante.meta.temperatureOverride ?? temperaturePourCreativite(storyCourante.settings.creativite);
  const maxTokens = maxTokensPourLongueur(storyCourante.settings.longueur);

  let reponse = await appellerModele({
    ...configurationLLM(appSettings, modelePourAppel),
    messages: construireMessages(ctxBase),
    temperature,
    maxTokens,
  });

  const heuristique = validerAgentiviteHeuristique(reponse, storyCourante.meta.personnageNom);
  const profilContenuCheck = validerProfilContenuHeuristique(reponse, appSettings.profilContenu);
  const llm = await validerReponseLLM({
    ...configurationLLM(appSettings, modelePourAppel),
    reponse,
    faits: ctxBase.faits,
    meta: storyCourante.meta,
  });
  const rapport = fusionnerRapports(heuristique, profilContenuCheck, llm);

  const strategie = determinerStrategie(rapport);
  let aEteCorrige = strategie !== 'aucune';

  if (strategie === 'patch_local') {
    reponse = appliquerPatchLocal(reponse, rapport);
  } else if (strategie === 'repair' || strategie === 'regeneration_partielle') {
    try {
      reponse = await reparerReponse({
        ...configurationLLM(appSettings, modelePourAppel),
        reponse,
        rapport,
        partiel: strategie === 'regeneration_partielle',
      });
    } catch {
      aEteCorrige = false;
    }
  } else if (strategie === 'regeneration_complete') {
    const noteCorrection = `La tentative précédente a été rejetée pour la ou les raisons suivantes : ${rapport.checks
      .filter((c) => !c.ok)
      .map((c) => c.raison)
      .join(' ')} Corrige ces points dans ta nouvelle réponse, sans les mentionner explicitement au joueur.`;
    try {
      reponse = await appellerModele({
        ...configurationLLM(appSettings, modelePourAppel),
        messages: construireMessages({ ...ctxBase, noteCorrection }),
        temperature,
        maxTokens,
      });
    } catch {
      aEteCorrige = false;
    }
  }

  if (reponseFaitParlerLeJoueur(reponse, storyCourante.meta.personnageNom)) {
    const nettoyee = retirerRepliqueDuJoueur(reponse, storyCourante.meta.personnageNom);
    if (nettoyee) reponse = nettoyee;
  }

  if (!validerProfilContenuHeuristique(reponse, appSettings.profilContenu).ok) {
    throw new ErreurProfilContenu(
      "Cette réponse ne respecte pas les limites du profil Grand public et n'a pas pu être corrigée automatiquement. Réessaie avec une formulation différente.",
    );
  }

  const messageUtilisateur: Message = {
    id: genererId(),
    role: 'user',
    content: messageJoueur,
    timestamp: Date.now(),
    reponseAId,
  };
  const messageAssistant: Message = {
    id: genererId(),
    role: 'assistant',
    content: reponse,
    timestamp: Date.now(),
    dureeGenerationMs: Date.now() - debutMs,
  };

  const messages = [...storyCourante.messages, messageUtilisateur, messageAssistant];

  // Point de bascule V3 : aucun appel mémoire/directeur/monde/social/lore
  // après la réponse. Le résultat peut être affiché et sauvegardé tout de
  // suite ; saveStory() déclenchera story.postprocess derrière.
  return {
    story: { ...storyCourante, messages },
    aEteCorrige,
    debugLore,
  };
}

/**
 * Régénère uniquement la dernière réponse du narrateur. On synchronise
 * d'abord les champs dérivés avec le stockage, puis on rembobine le dernier
 * échange et ses curseurs avant de repasser par le même flux critique.
 */
export async function regenererDernierTour(story: StoryState, appSettings: AppSettings): Promise<ResultatTour> {
  const storyCourante = await rafraichirEtatDeriveAvantTour(story);
  const messages = [...storyCourante.messages];
  const dernier = messages[messages.length - 1];
  if (!dernier || dernier.role !== 'assistant') {
    throw new Error('Aucune réponse à régénérer.');
  }
  const avantDernier = messages[messages.length - 2];
  if (!avantDernier || avantDernier.role !== 'user') {
    throw new Error('Aucun message joueur associé à régénérer.');
  }

  const storySansDernierEchange: StoryState = {
    ...storyCourante,
    messages: messages.slice(0, -2),
    memoire: {
      ...storyCourante.memoire,
      dernierMessageIndexMaj: Math.min(storyCourante.memoire.dernierMessageIndexMaj, messages.length - 2),
    },
    directeur: {
      ...storyCourante.directeur,
      dernierBeatIndex: Math.min(storyCourante.directeur.dernierBeatIndex, messages.length - 2),
    },
    loreEmergentDernierIndex: Math.min(storyCourante.loreEmergentDernierIndex ?? 0, messages.length - 2),
  };

  return genererTour(storySansDernierEchange, appSettings, avantDernier.content);
}
