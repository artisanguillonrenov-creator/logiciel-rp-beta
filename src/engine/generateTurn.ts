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
  filtrerTextePourProfil,
  plafonnerCurseurs,
  texteCompatibleAvecProfil,
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

function construireTexteRequete(story: StoryState, messageJoueur: string, appSettings: AppSettings): string {
  const profil = appSettings.profilContenu;
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
    .filter((texte): texte is string => !!texte && texteCompatibleAvecProfil(texte, profil))
    .join('\n');
}

interface SelectionLore {
  metamoteursSelectionnes: ReturnType<typeof selectionnerMetamoteursSemantique>;
  loreElyndor: ReturnType<typeof selectionnerLoreElyndorSemantique>;
  souvenirs: Souvenir[];
  debugLore: DebugLore;
}

export async function calculerSelectionLore(
  story: StoryState,
  messageJoueur: string,
  appSettings: AppSettings,
  optionsLoreElyndor?: OptionsSelectionLore,
): Promise<SelectionLore> {
  const profil = appSettings.profilContenu;
  const profilAdulte = profil === 'adulte';
  const texteRequete = construireTexteRequete(story, messageJoueur, appSettings);
  const plugins = await getPlugins();

  const metamoteursDisponibles = profilAdulte
    ? METAMOTEURS
    : METAMOTEURS.filter(
        (e) => e.titre !== METAMOTEUR_REGISTRE && texteCompatibleAvecProfil(`${e.titre}\n${e.contenu}`, profil),
      );

  const poolElyndorBrut = [
    ...LORE_ELYNDOR,
    ...convertirLoreEmergentPourSelection(story.loreEmergent),
    ...convertirPluginsPourSelection(plugins),
  ];
  const poolElyndor = profilAdulte
    ? poolElyndorBrut
    : poolElyndorBrut.filter(
        (e) => !ENTREES_ADULTE_UNIQUEMENT.includes(e.titre) && texteCompatibleAvecProfil(`${e.titre}\n${e.contenu}`, profil),
      );

  const messagesAnciensBruts = story.messages.slice(0, Math.max(0, story.messages.length - NB_MESSAGES_RECENTS));
  const messagesAnciens = profilAdulte
    ? messagesAnciensBruts
    : messagesAnciensBruts.filter((m) => texteCompatibleAvecProfil(m.content, profil));

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
      metamoteursDisponibles.map((e) => ({ id: e.id, contenu: e.contenu })),
      appSettings,
    ),
    assurerEmbeddings(
      poolElyndor.map((e) => ({ id: e.id, contenu: e.contenu })),
      appSettings,
    ),
    obtenirEmbeddings([texteRequete], appSettings),
    embedderMessagesAnciens(messagesAnciens, appSettings),
  ]);

  const metamoteursSelectionnes = selectionnerMetamoteursSemantique(
    metamoteursDisponibles,
    vecteurRequete,
    vecteursMetamoteurs,
  );
  const loreElyndor = selectionnerLoreElyndorSemantique(
    poolElyndor,
    texteRequete,
    vecteurRequete,
    vecteursElyndor,
    undefined,
    optionsLoreElyndor,
  );
  const souvenirs = selectionnerSouvenirs(messagesAnciens, vecteurRequete, vecteursMessagesAnciens);

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

export async function calculerDebugLore(story: StoryState, messageJoueur: string, appSettings: AppSettings): Promise<DebugLore> {
  const { debugLore } = await calculerSelectionLore(story, messageJoueur, appSettings);
  return debugLore;
}

export function construireCtxBase(
  story: StoryState,
  messageJoueur: string,
  appSettings: AppSettings,
  selection: Pick<SelectionLore, 'metamoteursSelectionnes' | 'loreElyndor' | 'souvenirs'>,
): ContexteConstruction {
  const profil = appSettings.profilContenu;
  const profilAdulte = profil === 'adulte';
  const filtrer = (texte: string | undefined) => filtrerTextePourProfil(texte, profil);
  const nomPersonnage = filtrer(story.meta.personnageNom) || 'Personnage';
  const metaSecurisee = profilAdulte
    ? story.meta
    : {
        ...story.meta,
        personnageNom: nomPersonnage,
        personnageDescription: filtrer(story.meta.personnageDescription),
        pointDeDepart: filtrer(story.meta.pointDeDepart),
        contexte: {
          ...story.meta.contexte,
          lieu: filtrer(story.meta.contexte.lieu),
          ambiance: filtrer(story.meta.contexte.ambiance),
          dateChronique: filtrer(story.meta.contexte.dateChronique),
          objectifs: filtrer(story.meta.contexte.objectifs),
        },
      };
  const faits = story.memoire.faits
    .filter((f) => f.niveau !== 'archive')
    .filter((f) => profilAdulte || texteCompatibleAvecProfil(f.texte, profil));
  const messagesRecents = profilAdulte
    ? story.messages
    : story.messages.filter((m) => texteCompatibleAvecProfil(m.content, profil));
  const directionNarrative = formaterDirection(
    story.directeur,
    detecterStagnation(story.directeur, story.messages.length),
  );

  return {
    meta: metaSecurisee,
    settings: plafonnerCurseurs(story.settings, profil),
    resume: filtrer(story.memoire.resume),
    faits,
    metamoteursSelectionnes: selection.metamoteursSelectionnes,
    loreElyndor: selection.loreElyndor,
    messagesRecents,
    messageJoueur,
    instructionRegistreOverride: profilAdulte ? undefined : INSTRUCTION_REGISTRE_GRAND_PUBLIC,
    directionNarrative: filtrer(directionNarrative),
    etatMonde: filtrer(formaterMonde(story.monde)),
    engagementsEtRelations: filtrer(formaterEngagementsEtRelations(story.social)),
    souvenirs: filtrer(formaterSouvenirs(selection.souvenirs, nomPersonnage)),
  };
}

export async function construirePromptDebug(
  story: StoryState,
  messageJoueur: string,
  appSettings: AppSettings,
): Promise<string> {
  const { metamoteursSelectionnes, loreElyndor, souvenirs } = await calculerSelectionLore(story, messageJoueur, appSettings);
  return construireSystemPrompt(construireCtxBase(story, messageJoueur, appSettings, { metamoteursSelectionnes, loreElyndor, souvenirs }));
}

function messagesPourProfil(messages: Message[], appSettings: AppSettings): Message[] {
  if (appSettings.profilContenu === 'adulte') return messages;
  return messages.map((message) => ({
    ...message,
    content: filtrerTextePourProfil(message.content, appSettings.profilContenu) || '[Contenu antérieur masqué par le profil Grand public.]',
  }));
}

async function executerMisesAJourPeriodiques(
  appSettings: AppSettings,
  story: StoryState,
  messages: Message[],
): Promise<Pick<StoryState, 'memoire' | 'directeur' | 'monde' | 'social'>> {
  const depuisIndex = story.memoire.dernierMessageIndexMaj;
  const messagesSecurises = messagesPourProfil(messages, appSettings);
  const personnageNom = filtrerTextePourProfil(story.meta.personnageNom, appSettings.profilContenu) || 'Personnage';
  const [memoire, directeur, monde, social] = await Promise.all([
    mettreAJourMemoire({
      appSettings,
      memoireActuelle: story.memoire,
      messages: messagesSecurises,
      personnageNom,
    }),
    mettreAJourDirecteur({ appSettings, directeurActuel: story.directeur, messages: messagesSecurises, depuisIndex }),
    mettreAJourMonde({ appSettings, mondeActuel: story.monde, messages: messagesSecurises, depuisIndex }),
    mettreAJourSocial({ appSettings, socialActuel: story.social, messages: messagesSecurises, depuisIndex }),
  ]);
  return { memoire, directeur, monde, social };
}

async function mettreAJourLoreEmergentSeul(
  appSettings: AppSettings,
  story: StoryState,
  messages: Message[],
): Promise<Pick<StoryState, 'loreEmergent' | 'loreEmergentDernierIndex'>> {
  const messagesSecurises = messagesPourProfil(messages, appSettings);
  const personnageNom = filtrerTextePourProfil(story.meta.personnageNom, appSettings.profilContenu) || 'Personnage';
  const loreEmergent = await mettreAJourLoreEmergent({
    appSettings,
    existants: story.loreEmergent,
    messages: messagesSecurises,
    depuisIndex: story.loreEmergentDernierIndex ?? 0,
    personnageNom,
  });
  return { loreEmergent, loreEmergentDernierIndex: messages.length };
}

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
    return story;
  }
}

export async function genererTour(
  story: StoryState,
  appSettings: AppSettings,
  messageJoueur: string,
  reponseAId?: string,
): Promise<ResultatTour> {
  const debutMs = Date.now();
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
    meta: ctxBase.meta,
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

  return {
    story: { ...storyCourante, messages },
    aEteCorrige,
    debugLore,
  };
}

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
