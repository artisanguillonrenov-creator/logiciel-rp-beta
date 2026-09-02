import metamoteursRaw from '../data/metamoteurs.json';
import elyndorRaw from '../data/elyndorLore.json';
import type { AppSettings, Message, StoryState } from '../types';
import {
  chargerLoreElyndor,
  chargerMetamoteurs,
  selectionnerLoreElyndorSemantique,
  selectionnerMetamoteursSemantique,
} from './loreLoader';
import {
  construireMessages,
  construireSystemPrompt,
  maxTokensPourLongueur,
  temperaturePourCreativite,
  NB_MESSAGES_RECENTS,
  type ContexteConstruction,
} from './promptBuilder';
import { appellerModele } from './openrouter';
import { obtenirEmbeddings } from './embeddings';
import { assurerEmbeddings } from '../storage/embeddingsStore';
import { doitMettreAJourMemoire, mettreAJourMemoire } from './memory';
import { convertirLoreEmergentPourSelection, mettreAJourLoreEmergent } from './emergentLore';
import { convertirPluginsPourSelection } from './plugins';
import { getPlugins } from '../storage/storage';
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
  INSTRUCTION_REGISTRE_GRAND_PUBLIC,
  plafonnerCurseurs,
  validerProfilContenuHeuristique,
} from './contenuAdulte';
import {
  appliquerPatchLocal,
  determinerStrategie,
  fusionnerRapports,
  reparerReponse,
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
function construireCtxBase(
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

// Les cinq pipelines périodiques (mémoire, lore émergent, directeur, monde,
// social) tournent toujours ensemble, à la même cadence — factorisé pour
// être appelable soit depuis genererTour (quand le seuil de messages est
// atteint), soit à la demande depuis les réglages concepteur
// (forcerMiseAJourEtat, sans attendre ce seuil).
async function executerMisesAJourPeriodiques(
  appSettings: AppSettings,
  story: StoryState,
  messages: Message[],
): Promise<Pick<StoryState, 'memoire' | 'loreEmergent' | 'directeur' | 'monde' | 'social'>> {
  const depuisIndex = story.memoire.dernierMessageIndexMaj;
  const [memoire, loreEmergent, directeur, monde, social] = await Promise.all([
    mettreAJourMemoire({
      appSettings,
      memoireActuelle: story.memoire,
      messages,
      personnageNom: story.meta.personnageNom,
    }),
    mettreAJourLoreEmergent({ appSettings, existants: story.loreEmergent, messages, depuisIndex }),
    mettreAJourDirecteur({ appSettings, directeurActuel: story.directeur, messages, depuisIndex }),
    mettreAJourMonde({ appSettings, mondeActuel: story.monde, messages, depuisIndex }),
    mettreAJourSocial({ appSettings, socialActuel: story.social, messages, depuisIndex }),
  ]);
  return { memoire, loreEmergent, directeur, monde, social };
}

/**
 * Réglages concepteur (Ajouts_A_Integrer.md #6) : force les cinq pipelines
 * périodiques à tourner immédiatement, sans attendre le seuil de 8 messages
 * — pour observer l'effet d'un tour sans en jouer sept de plus.
 */
export async function forcerMiseAJourEtat(story: StoryState, appSettings: AppSettings): Promise<StoryState> {
  const maj = await executerMisesAJourPeriodiques(appSettings, story, story.messages);
  return { ...story, ...maj };
}

/**
 * Flux de génération d'un tour (brief section 5, sélection mise à jour
 * Phase 2) : message joueur → sélection sémantique des métamoteurs et du
 * lore pertinents → construction du contexte → appel API → vérification
 * basique → une nouvelle tentative si violation → affichage. Puis mise à
 * jour périodique de la mémoire.
 */
export async function genererTour(
  story: StoryState,
  appSettings: AppSettings,
  messageJoueur: string,
): Promise<ResultatTour> {
  const { metamoteursSelectionnes, loreElyndor, souvenirs, debugLore } = await calculerSelectionLore(
    story,
    messageJoueur,
    appSettings,
  );

  const ctxBase = construireCtxBase(story, messageJoueur, appSettings, { metamoteursSelectionnes, loreElyndor, souvenirs });

  // Réglages de prompt avancés (réglages concepteur) : override par
  // histoire du modèle/de la température, sinon les valeurs globales
  // habituelles.
  const modelePourAppel = story.meta.modeleOverride?.trim() || appSettings.model;
  const temperature = story.meta.temperatureOverride ?? temperaturePourCreativite(story.settings.creativite);
  const maxTokens = maxTokensPourLongueur(story.settings.longueur);

  let reponse = await appellerModele({
    apiKey: appSettings.openRouterApiKey,
    model: modelePourAppel,
    moteurInference: appSettings.moteurInference,
    messages: construireMessages(ctxBase),
    temperature,
    maxTokens,
  });

  const heuristique = validerAgentiviteHeuristique(reponse);
  const profilContenuCheck = validerProfilContenuHeuristique(reponse, appSettings.profilContenu);
  const llm = await validerReponseLLM({
    apiKey: appSettings.openRouterApiKey,
    model: modelePourAppel,
    moteurInference: appSettings.moteurInference,
    reponse,
    faits: ctxBase.faits,
    meta: story.meta,
  });
  const rapport = fusionnerRapports(heuristique, profilContenuCheck, llm);

  // Suite de validation complète (brief Phase 2) : la stratégie de
  // réparation dépend de la gravité constatée — patch local (déterministe,
  // sans appel modèle) → repair ciblé → régénération partielle (même
  // consigne, contexte complet) → régénération complète. Un seul passage de
  // réparation par tour, quelle que soit la stratégie choisie (pas de
  // boucle de correction sans fin).
  const strategie = determinerStrategie(rapport);
  let aEteCorrige = strategie !== 'aucune';

  // La réparation est un raffinement, pas une condition pour que le joueur
  // reçoive une réponse : si l'appel de correction lui-même échoue (réseau,
  // réponse vide...), on garde la réponse initiale non corrigée plutôt que
  // de faire échouer tout le tour pour un souci secondaire — même logique
  // que validerReponseLLM, qui n'interrompt jamais la génération sur un
  // échec du vérificateur.
  if (strategie === 'patch_local') {
    reponse = appliquerPatchLocal(reponse, rapport);
  } else if (strategie === 'repair' || strategie === 'regeneration_partielle') {
    try {
      reponse = await reparerReponse({
        apiKey: appSettings.openRouterApiKey,
        model: modelePourAppel,
        moteurInference: appSettings.moteurInference,
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
        apiKey: appSettings.openRouterApiKey,
        model: modelePourAppel,
        moteurInference: appSettings.moteurInference,
        messages: construireMessages({ ...ctxBase, noteCorrection }),
        temperature,
        maxTokens,
      });
    } catch {
      aEteCorrige = false;
    }
  }

  const messageUtilisateur: Message = {
    id: genererId(),
    role: 'user',
    content: messageJoueur,
    timestamp: Date.now(),
  };
  const messageAssistant: Message = {
    id: genererId(),
    role: 'assistant',
    content: reponse,
    timestamp: Date.now(),
  };

  const messages = [...story.messages, messageUtilisateur, messageAssistant];
  let etatPeriodique: Pick<StoryState, 'memoire' | 'loreEmergent' | 'directeur' | 'monde' | 'social'> = {
    memoire: story.memoire,
    loreEmergent: story.loreEmergent,
    directeur: story.directeur,
    monde: story.monde,
    social: story.social,
  };
  if (doitMettreAJourMemoire(messages, story.memoire.dernierMessageIndexMaj)) {
    etatPeriodique = await executerMisesAJourPeriodiques(appSettings, story, messages);
  }

  return {
    story: { ...story, messages, ...etatPeriodique },
    aEteCorrige,
    debugLore,
  };
}

/**
 * Régénère uniquement la dernière réponse du narrateur (bouton "régénérer"),
 * en repartant du dernier message du joueur.
 */
export async function regenererDernierTour(story: StoryState, appSettings: AppSettings): Promise<ResultatTour> {
  const messages = [...story.messages];
  const dernier = messages[messages.length - 1];
  if (!dernier || dernier.role !== 'assistant') {
    throw new Error('Aucune réponse à régénérer.');
  }
  const avantDernier = messages[messages.length - 2];
  if (!avantDernier || avantDernier.role !== 'user') {
    throw new Error('Aucun message joueur associé à régénérer.');
  }

  const storySansDernierEchange: StoryState = {
    ...story,
    messages: messages.slice(0, -2),
    memoire: {
      ...story.memoire,
      dernierMessageIndexMaj: Math.min(story.memoire.dernierMessageIndexMaj, messages.length - 2),
    },
    directeur: {
      ...story.directeur,
      dernierBeatIndex: Math.min(story.directeur.dernierBeatIndex, messages.length - 2),
    },
  };

  return genererTour(storySansDernierEchange, appSettings, avantDernier.content);
}
