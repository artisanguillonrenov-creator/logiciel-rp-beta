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
  maxTokensPourLongueur,
  temperaturePourCreativite,
} from './promptBuilder';
import { appellerModele } from './openrouter';
import { obtenirEmbeddings } from './embeddings';
import { assurerEmbeddings } from '../storage/embeddingsStore';
import { doitMettreAJourMemoire, mettreAJourMemoire } from './memory';
import { convertirLoreEmergentPourSelection, mettreAJourLoreEmergent } from './emergentLore';
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
  // Elyndor statique.
  const poolElyndor = [...LORE_ELYNDOR, ...convertirLoreEmergentPourSelection(story.loreEmergent)];

  const [vecteursMetamoteurs, vecteursElyndor, { vecteurs: [vecteurRequete] }] = await Promise.all([
    assurerEmbeddings(
      METAMOTEURS.map((e) => ({ id: e.id, contenu: e.contenu })),
      appSettings,
    ),
    assurerEmbeddings(
      poolElyndor.map((e) => ({ id: e.id, contenu: e.contenu })),
      appSettings,
    ),
    obtenirEmbeddings([texteRequete], appSettings),
  ]);

  let metamoteursSelectionnes = selectionnerMetamoteursSemantique(METAMOTEURS, vecteurRequete, vecteursMetamoteurs);
  let loreElyndor = selectionnerLoreElyndorSemantique(
    poolElyndor,
    texteRequete,
    vecteurRequete,
    vecteursElyndor,
  );

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
    debugLore: {
      metamoteurs: metamoteursSelectionnes.map((e) => formaterDebug(e.titre, e.score)),
      loreElyndor: loreElyndor.map((e) => formaterDebug(e.titre, e.score)),
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
  const { metamoteursSelectionnes, loreElyndor, debugLore } = await calculerSelectionLore(
    story,
    messageJoueur,
    appSettings,
  );

  const ctxBase = {
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
    metamoteursSelectionnes,
    loreElyndor,
    messagesRecents: story.messages,
    messageJoueur,
    instructionRegistreOverride:
      appSettings.profilContenu === 'grand_public' ? INSTRUCTION_REGISTRE_GRAND_PUBLIC : undefined,
  };

  const temperature = temperaturePourCreativite(story.settings.creativite);
  const maxTokens = maxTokensPourLongueur(story.settings.longueur);

  let reponse = await appellerModele({
    apiKey: appSettings.openRouterApiKey,
    model: appSettings.model,
    messages: construireMessages(ctxBase),
    temperature,
    maxTokens,
  });

  const heuristique = validerAgentiviteHeuristique(reponse);
  const profilContenuCheck = validerProfilContenuHeuristique(reponse, appSettings.profilContenu);
  const llm = await validerReponseLLM({
    apiKey: appSettings.openRouterApiKey,
    model: appSettings.model,
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

  if (strategie === 'patch_local') {
    reponse = appliquerPatchLocal(reponse, rapport);
  } else if (strategie === 'repair' || strategie === 'regeneration_partielle') {
    reponse = await reparerReponse({
      apiKey: appSettings.openRouterApiKey,
      model: appSettings.model,
      reponse,
      rapport,
      partiel: strategie === 'regeneration_partielle',
    });
  } else if (strategie === 'regeneration_complete') {
    const noteCorrection = `La tentative précédente a été rejetée pour la ou les raisons suivantes : ${rapport.checks
      .filter((c) => !c.ok)
      .map((c) => c.raison)
      .join(' ')} Corrige ces points dans ta nouvelle réponse, sans les mentionner explicitement au joueur.`;
    reponse = await appellerModele({
      apiKey: appSettings.openRouterApiKey,
      model: appSettings.model,
      messages: construireMessages({ ...ctxBase, noteCorrection }),
      temperature,
      maxTokens,
    });
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
  let memoire = story.memoire;
  let loreEmergent = story.loreEmergent;
  if (doitMettreAJourMemoire(messages, memoire.dernierMessageIndexMaj)) {
    // Même curseur, même cadence que la mémoire pour les deux pipelines.
    const depuisIndex = memoire.dernierMessageIndexMaj;
    [memoire, loreEmergent] = await Promise.all([
      mettreAJourMemoire({
        appSettings,
        memoireActuelle: memoire,
        messages,
        personnageNom: story.meta.personnageNom,
      }),
      mettreAJourLoreEmergent({
        appSettings,
        existants: loreEmergent,
        messages,
        depuisIndex,
      }),
    ]);
  }

  return {
    story: { ...story, messages, memoire, loreEmergent },
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
  };

  return genererTour(storySansDernierEchange, appSettings, avantDernier.content);
}
