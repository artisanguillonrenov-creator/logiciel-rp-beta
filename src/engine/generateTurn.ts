import elyndorRaw from '../data/elyndorLore.json';
import type { AppSettings, Message, StoryState } from '../types';
import {
  chargerLoreElyndor,
  prioriserLoreCanon,
  selectionnerLoreElyndorSemantique,
  type OptionsSelectionLore,
} from './loreLoader';
import {
  construireMessages,
  construireSystemPrompt,
  maxTokensPourLongueur,
  temperaturePourCreativite,
  NB_MESSAGES_RECENTS,
  BUDGET_SYSTEM_LOCAL,
  BUDGET_SYSTEM_DISTANT,
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
import { rechercherLoreLexical, rechercherSouvenirsLexical } from './rechercheLexicale';
import { annulerMesureTokens, commencerMesureTokens, terminerMesureTokens } from './mesureTokens';
import { contradictionProbable, corpusCanon, validerRepetitionHeuristique, verifierEntitesCanoniques } from './verificationCanon';
import { annulerTour, assurerNoyau, construireContexteNoyau, diagnosticNoyau, extraireEnveloppeEtat, validerTour } from './noyauNarratif';
import {
  construireBlocsContexte,
  debugBlocsContexte,
  formaterBlocsContexte,
  synchroniserMemoireNarrative,
  type ResultatBlocs,
} from './memoireNarrative';
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
  instructionRegistreAdulte,
  validerAbsenceMineurs,
  filtrerTextePourProfil,
  plafonnerCurseurs,
  texteCompatibleAvecProfil,
  validerProfilContenuHeuristique,
} from './contenuAdulte';
import {
  construireContratNarratifNatif,
  debugContratNarratif,
} from './narrativeBehaviorKernel';
import {
  appliquerPatchLocal,
  determinerStrategie,
  fusionnerRapports,
  rapportOk,
  reparerReponse,
  reponseFaitParlerLeJoueur,
  retirerRepliqueDuJoueur,
  validerAgentiviteHeuristique,
  validerReponseLLM,
} from './validator';

const MARGE_TOKENS_ETAT = 350;
const LORE_ELYNDOR = chargerLoreElyndor(elyndorRaw as any);

/** Corpus canon (lore statique compris) pour verifierEntitesCanoniques. */
export function corpusCanonHistoire(story: StoryState, messageJoueur: string): string {
  return corpusCanon(story, messageJoueur, LORE_ELYNDOR);
}

function genererId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface DebugLore {
  // Conservé sous ce nom pour compatibilité de l'UI de debug. Ce champ ne
  // contient plus des entrées de lore [MÉTA], mais les responsabilités
  // natives M01–M15 effectivement mobilisées par le tour.
  metamoteurs: string[];
  loreElyndor: string[];
  souvenirs: string[];
  blocsContexte?: string[];
  memoireNarrative?: string;
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
  loreElyndor: ReturnType<typeof selectionnerLoreElyndorSemantique>;
  souvenirs: Souvenir[];
  debugLore: DebugLore;
}

/**
 * Sélection sémantique réservée aux données qui sont réellement du contenu
 * à retrouver (lore et ancien historique). M01–M15 ne passent plus ici :
 * le noyau comportemental existe même sans embeddings.
 */
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
    const loreElyndor = prioriserLoreCanon(
      texteRequete,
      rechercherLoreLexical(poolElyndor, texteRequete),
      LORE_ELYNDOR,
    );
    const souvenirs = rechercherSouvenirsLexical(messagesAnciens, texteRequete);
    return {
      loreElyndor,
      souvenirs,
      debugLore: {
        metamoteurs: [],
        loreElyndor: loreElyndor.map((e) => formaterDebug(e.titre, e.score)),
        souvenirs: formaterSouvenirsDebug(souvenirs),
      },
    };
  }

  const [vecteursElyndor, { vecteurs: [vecteurRequete] }, vecteursMessagesAnciens] = await Promise.all([
    assurerEmbeddings(
      poolElyndor.map((e) => ({ id: e.id, contenu: e.contenu })),
      appSettings,
    ),
    obtenirEmbeddings([texteRequete], appSettings),
    embedderMessagesAnciens(messagesAnciens, appSettings),
  ]);

  const loreElyndor = prioriserLoreCanon(
    texteRequete,
    selectionnerLoreElyndorSemantique(
      poolElyndor,
      texteRequete,
      vecteurRequete,
      vecteursElyndor,
      undefined,
      optionsLoreElyndor,
    ),
    LORE_ELYNDOR,
  );
  const souvenirs = selectionnerSouvenirs(messagesAnciens, vecteurRequete, vecteursMessagesAnciens);

  return {
    loreElyndor,
    souvenirs,
    debugLore: {
      metamoteurs: [],
      loreElyndor: loreElyndor.map((e) => formaterDebug(e.titre, e.score)),
      souvenirs: formaterSouvenirsDebug(souvenirs),
    },
  };
}

function debugMemoireNarrative(nbEvenements: number, blocs: ResultatBlocs): Pick<DebugLore, 'blocsContexte' | 'memoireNarrative'> {
  return {
    blocsContexte: debugBlocsContexte(blocs.blocs),
    memoireNarrative: `${nbEvenements} événements indexés · ${blocs.totalCaracteres} caractères sélectionnés`,
  };
}

export async function calculerDebugLore(story: StoryState, messageJoueur: string, appSettings: AppSettings): Promise<DebugLore> {
  const { debugLore } = await calculerSelectionLore(story, messageJoueur, appSettings);
  const storyNoyau = assurerNoyau(story);
  const contrat = construireContratNarratifNatif(storyNoyau, messageJoueur, appSettings.profilContenu);
  const evenements = synchroniserMemoireNarrative(storyNoyau);
  return {
    ...debugLore,
    metamoteurs: debugContratNarratif(contrat),
    ...debugMemoireNarrative(evenements.length, construireBlocsContexte(storyNoyau, messageJoueur, evenements)),
  };
}

export function construireCtxBase(
  story: StoryState,
  messageJoueur: string,
  appSettings: AppSettings,
  selection: Pick<SelectionLore, 'loreElyndor' | 'souvenirs'>,
  blocs: ResultatBlocs = construireBlocsContexte(story, messageJoueur),
  // Faux pour la scène d'ouverture : pas de delta d'état machine à demander.
  avecNoyau = true,
): ContexteConstruction {
  const storyNoyau = avecNoyau ? assurerNoyau(story) : story;
  const noyau = avecNoyau ? construireContexteNoyau(storyNoyau as ReturnType<typeof assurerNoyau>, messageJoueur) : null;
  const contrat = construireContratNarratifNatif(storyNoyau, messageJoueur, appSettings.profilContenu);
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

  // Une seule source est injectée pour chaque domaine. Le noyau structuré
  // est prioritaire ; les anciens états servent uniquement de repli lors de
  // l'ouverture ou si aucun état noyau pertinent n'existe encore.
  const mondeNoyau = filtrer(noyau?.texteMonde);
  const socialNoyau = filtrer(noyau?.texteSocial);

  return {
    meta: metaSecurisee,
    settings: plafonnerCurseurs(story.settings, profil),
    profilContenu: profil,
    resume: filtrer(story.memoire.resume),
    faits,
    loreElyndor: selection.loreElyndor,
    messagesRecents,
    messageJoueur,
    contratNarratif: filtrer(contrat.texte),
    instructionRegistreOverride: profilAdulte ? undefined : INSTRUCTION_REGISTRE_GRAND_PUBLIC,
    registreAdulte: profilAdulte ? instructionRegistreAdulte(story.settings) : undefined,
    directionNarrative: filtrer(directionNarrative),
    etatMonde: mondeNoyau || filtrer(formaterMonde(story.monde)),
    engagementsEtRelations: socialNoyau || filtrer(formaterEngagementsEtRelations(story.social)),
    souvenirs: filtrer(formaterSouvenirs(selection.souvenirs, nomPersonnage)),
    blocsContexte: filtrer([noyau?.texte, formaterBlocsContexte(blocs.blocs)].filter(Boolean).join('\n\n')),
    directiveEtat: noyau?.directive,
  };
}

export async function construirePromptDebug(
  story: StoryState,
  messageJoueur: string,
  appSettings: AppSettings,
): Promise<string> {
  const { loreElyndor, souvenirs } = await calculerSelectionLore(story, messageJoueur, appSettings);
  return construireSystemPrompt(construireCtxBase(story, messageJoueur, appSettings, { loreElyndor, souvenirs }));
}

function messagesPourProfil(messages: Message[], appSettings: AppSettings): Message[] {
  if (appSettings.profilContenu === 'adulte') return messages;
  return messages.map((message) => ({
    ...message,
    content: filtrerTextePourProfil(message.content, appSettings.profilContenu)
      || '[Contenu antérieur masqué par le profil Grand public.]',
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
  const storyRafraichie = await rafraichirEtatDeriveAvantTour(story);
  const evenements = synchroniserMemoireNarrative(storyRafraichie);
  const storyCourante = assurerNoyau(storyRafraichie, evenements);

  const { loreElyndor, souvenirs, debugLore } = await calculerSelectionLore(
    storyCourante,
    messageJoueur,
    appSettings,
  );
  const contrat = construireContratNarratifNatif(storyCourante, messageJoueur, appSettings.profilContenu);
  debugLore.metamoteurs = debugContratNarratif(contrat);

  const blocs = construireBlocsContexte(storyCourante, messageJoueur, evenements);
  const ctxBase = construireCtxBase(storyCourante, messageJoueur, appSettings, { loreElyndor, souvenirs }, blocs);

  const modelePourAppel = modeleOverridePourFournisseur(
    appSettings,
    storyCourante.meta.modeleOverride,
    storyCourante.meta.modeleOverrideFournisseur,
  ) || configurationLLM(appSettings).model;
  const temperature = storyCourante.meta.temperatureOverride ?? temperaturePourCreativite(storyCourante.settings.creativite);
  const maxTokens = maxTokensPourLongueur(storyCourante.settings.longueur) + MARGE_TOKENS_ETAT;
  const budgetPrompt = appSettings.moteurInference === 'local' || appSettings.moteurInference === 'serveur'
    ? BUDGET_SYSTEM_LOCAL
    : BUDGET_SYSTEM_DISTANT;

  commencerMesureTokens();
  const premiere = extraireEnveloppeEtat(await appellerModele({
    ...configurationLLM(appSettings, modelePourAppel),
    messages: construireMessages(ctxBase, { budgetSysteme: budgetPrompt }),
    temperature,
    maxTokens,
  }));
  let reponse = premiere.texte;
  let deltaEtat = premiere.delta;

  const canon = corpusCanonHistoire(storyCourante, messageJoueur);
  const controlesLocaux = fusionnerRapports(
    validerAgentiviteHeuristique(reponse, storyCourante.meta.personnageNom),
    validerProfilContenuHeuristique(reponse, appSettings.profilContenu),
    validerAbsenceMineurs(reponse),
    validerRepetitionHeuristique(reponse, storyCourante),
    verifierEntitesCanoniques(reponse, canon),
  );
  const llm = controlesLocaux.ok && contradictionProbable(reponse, storyCourante)
    ? await validerReponseLLM({
        ...configurationLLM(appSettings, modelePourAppel),
        reponse,
        faits: ctxBase.faits,
        meta: ctxBase.meta,
      })
    : rapportOk();
  const rapport = fusionnerRapports(controlesLocaux, llm);

  const strategie = determinerStrategie(rapport);
  let aEteCorrige = strategie !== 'aucune';

  if (strategie === 'patch_local') {
    reponse = appliquerPatchLocal(reponse, rapport);
  } else if (strategie === 'repair' || strategie === 'regeneration_partielle') {
    try {
      reponse = extraireEnveloppeEtat(await reparerReponse({
        ...configurationLLM(appSettings, modelePourAppel),
        reponse,
        rapport,
        partiel: strategie === 'regeneration_partielle',
      })).texte;
    } catch {
      aEteCorrige = false;
    }
  } else if (strategie === 'regeneration_complete') {
    const noteCorrection = `La tentative précédente a été rejetée pour la ou les raisons suivantes : ${rapport.checks
      .filter((c) => !c.ok)
      .map((c) => c.raison)
      .join(' ')} Corrige ces points dans ta nouvelle réponse, sans les mentionner explicitement au joueur.`;
    try {
      const regeneree = extraireEnveloppeEtat(await appellerModele({
        ...configurationLLM(appSettings, modelePourAppel),
        messages: construireMessages({ ...ctxBase, noteCorrection }, { budgetSysteme: budgetPrompt }),
        temperature,
        maxTokens,
      }));
      reponse = regeneree.texte;
      deltaEtat = regeneree.delta;
    } catch {
      aEteCorrige = false;
    }
  }

  const canonFinal = verifierEntitesCanoniques(reponse, canon);
  if (!canonFinal.ok) {
    reponse = appliquerPatchLocal(reponse, canonFinal);
    aEteCorrige = true;
  }

  if (reponseFaitParlerLeJoueur(reponse, storyCourante.meta.personnageNom)) {
    const nettoyee = retirerRepliqueDuJoueur(reponse, storyCourante.meta.personnageNom);
    if (nettoyee) reponse = nettoyee;
  }

  if (!validerAbsenceMineurs(reponse).ok) {
    annulerMesureTokens();
    throw new ErreurProfilContenu("Cette réponse a été bloquée : Elyndor n'écrit jamais de scène sexuelle impliquant un enfant ou un adolescent. Réessaie avec une autre orientation.");
  }
  if (!validerProfilContenuHeuristique(reponse, appSettings.profilContenu).ok) {
    annulerMesureTokens();
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
    usageTokens: terminerMesureTokens(),
  };

  const messages = [...storyCourante.messages, messageUtilisateur, messageAssistant];
  const storyFinale = validerTour(
    { ...storyCourante, messages },
    { messageJoueur: messageUtilisateur, messageNarrateur: messageAssistant, delta: deltaEtat, corrige: aEteCorrige },
  );
  const debugMemoire = debugMemoireNarrative(evenements.length, blocs);

  return {
    story: storyFinale,
    aEteCorrige,
    debugLore: {
      ...debugLore,
      ...debugMemoire,
      blocsContexte: [
        ...(debugMemoire.blocsContexte ?? []),
        ...diagnosticNoyau(storyFinale),
      ],
    },
  };
}

export async function regenererDernierTour(story: StoryState, appSettings: AppSettings): Promise<ResultatTour> {
  const rafraichie = await rafraichirEtatDeriveAvantTour(story);
  const storyCourante = annulerTour(rafraichie, rafraichie.messages.at(-1)?.id ?? '');
  const messages = [...storyCourante.messages];
  const dernier = messages[messages.length - 1];
  if (!dernier || dernier.role !== 'assistant') throw new Error('Aucune réponse à régénérer.');
  const avantDernier = messages[messages.length - 2];
  if (!avantDernier || avantDernier.role !== 'user') throw new Error('Aucun message joueur associé à régénérer.');

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
