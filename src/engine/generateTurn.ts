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
import {
  embedderMessagesAnciens,
  formaterSouvenirs,
  formaterSouvenirsDebug,
  selectionnerSouvenirs,
  type Souvenir,
} from './searchHistorique';
import { searchHistoryLocal } from './narrative/historySearchEngine';
import { searchLoreLocal, loreHitsAsEntries } from './narrative/loreSearchEngine';
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
  rapportOk,
  validerAgentiviteHeuristique,
  validerReponseLLM,
  type RapportValidation,
} from './validator';
import { construireContextBlocks, debugContextBlocks, formaterContextBlocks, synchroniserMemoireNarrative } from './narrative/persistentMemory';
import { annulerMesureTokens, commencerMesureTokens, terminerMesureTokens } from './tokenUsageTelemetry';

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
  contextBlocks?: string[];
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
    // Narrative OS : fallback 100 % local, sans embeddings ni appel réseau.
    // On recherche dans tout le lore autorisé et dans l'historique ancien,
    // puis on n'injecte que quelques extraits courts et pertinents.
    const loreHits = searchLoreLocal(poolElyndor, texteRequete);
    const historyHits = searchHistoryLocal(messagesAnciens, texteRequete, 0);
    const loreElyndor = loreHitsAsEntries(loreHits);
    const souvenirs: Souvenir[] = historyHits.map((hit) => ({
      message: hit.message as Message,
      score: hit.score,
    }));

    return {
      metamoteursSelectionnes: [],
      loreElyndor,
      souvenirs,
      debugLore: {
        metamoteurs: [],
        loreElyndor: loreHits.map((hit) => formaterDebug(hit.entry.titre, hit.score)),
        souvenirs: formaterSouvenirsDebug(souvenirs),
      },
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
  const memoireNarrative = synchroniserMemoireNarrative(story);
  const storyV10: StoryState = { ...story, memoireNarrative };
  const { debugLore } = await calculerSelectionLore(storyV10, messageJoueur, appSettings);
  const contexte = construireContextBlocks(storyV10, messageJoueur);
  return {
    ...debugLore,
    contextBlocks: debugContextBlocks(contexte.blocks),
    memoireNarrative: memoireNarrative.evenements.length + ' événements indexés · ' + contexte.totalChars + ' caractères sélectionnés',
  };
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
  const memoireNarrative = story.memoireNarrative ?? synchroniserMemoireNarrative(story);
  const contexteV10 = construireContextBlocks({ ...story, memoireNarrative }, messageJoueur);

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
    contextBlocks: filtrer(formaterContextBlocks(contexteV10.blocks)),
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
  const storyMaj: StoryState = { ...story, ...maj, ...majLore };
  return { ...storyMaj, memoireNarrative: synchroniserMemoireNarrative(storyMaj) };
}

async function rafraichirEtatDeriveAvantTour(story: StoryState): Promise<StoryState> {
  try {
    return fusionnerEtatDerivePersistant(story, await getStory(story.meta.id));
  } catch {
    return story;
  }
}

function normaliserPourComparaison(texte: string): string {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9à-ÿ' ]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function motsSignificatifs(texte: string): Set<string> {
  const stop = new Set(['avec','dans','pour','mais','plus','comme','tout','elle','elles','leur','leurs','nous','vous','cette','ceci','cela','sans','sous','alors','encore','entre','apres','avant','vers','dont','tres','bien','fait','faire','etre','avait','sont','sera','ses','son','sur','une','des','les','que','qui','aux','par','pas']);
  return new Set(normaliserPourComparaison(texte).split(' ').filter((mot) => mot.length >= 4 && !stop.has(mot)));
}

function similariteJaccard(a: string, b: string): number {
  const A = motsSignificatifs(a);
  const B = motsSignificatifs(b);
  if (!A.size || !B.size) return 0;
  let communs = 0;
  for (const mot of A) if (B.has(mot)) communs++;
  const union = A.size + B.size - communs;
  return union ? communs / union : 0;
}

function validerRepetitionLocale(reponse: string, story: StoryState): RapportValidation {
  const paragraphes = reponse
    .split(/\n{2,}/)
    .map((p) => normaliserPourComparaison(p))
    .filter((p) => p.length >= 45);
  const vus = new Set<string>();
  for (const paragraphe of paragraphes) {
    if (vus.has(paragraphe)) {
      return {
        ok: false,
        checks: [{
          nom: 'repetition_contradiction',
          ok: false,
          gravite: 'modere',
          raison: 'Un paragraphe est répété presque à l’identique dans la même réponse.',
        }],
      };
    }
    vus.add(paragraphe);
  }

  const derniersNarrateurs = story.messages.filter((m) => m.role === 'assistant').slice(-2);
  for (const ancien of derniersNarrateurs) {
    if (ancien.content.length >= 180 && reponse.length >= 180 && similariteJaccard(reponse, ancien.content) >= 0.78) {
      return {
        ok: false,
        checks: [{
          nom: 'repetition_contradiction',
          ok: false,
          gravite: 'modere',
          raison: 'La nouvelle réponse répète fortement une réponse récente au lieu de faire avancer la scène.',
        }],
      };
    }
  }
  return rapportOk();
}

function necessiteAuditLLM(reponse: string, story: StoryState): boolean {
  // Signaux rares de retcon ou de changement rétroactif : dans ces cas, le
  // contrôle sémantique LLM reste utile. Tout le reste reste local/gratuit.
  if (story.memoire.faits.length === 0) return false;
  const texte = normaliserPourComparaison(reponse);
  const motifsRetcon = [
    'en realite il n avait jamais',
    'en realite elle n avait jamais',
    'contrairement a ce qui avait ete etabli',
    'revenu d entre les morts',
    'revenue d entre les morts',
    'n etait finalement pas mort',
    'n etait finalement pas morte',
    'tout ce qui precedait etait une illusion',
  ];
  return motifsRetcon.some((motif) => texte.includes(motif));
}

export async function genererTour(
  story: StoryState,
  appSettings: AppSettings,
  messageJoueur: string,
  reponseAId?: string,
): Promise<ResultatTour> {
  const debutMs = Date.now();
  const storyChargee = await rafraichirEtatDeriveAvantTour(story);
  const storyCourante: StoryState = { ...storyChargee, memoireNarrative: synchroniserMemoireNarrative(storyChargee) };
  const contexteV10Debug = construireContextBlocks(storyCourante, messageJoueur);

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
  const budgetPrompt = appSettings.moteurInference === 'local' ? BUDGET_SYSTEM_LOCAL : BUDGET_SYSTEM_DISTANT;

  commencerMesureTokens();
  let reponse = await appellerModele({
    ...configurationLLM(appSettings, modelePourAppel),
    messages: construireMessages(ctxBase, { budgetSysteme: budgetPrompt }),
    temperature,
    maxTokens,
  });

  const heuristique = validerAgentiviteHeuristique(reponse, storyCourante.meta.personnageNom);
  const profilContenuCheck = validerProfilContenuHeuristique(reponse, appSettings.profilContenu);
  const repetitionLocale = validerRepetitionLocale(reponse, storyCourante);
  const rapportLocal = fusionnerRapports(heuristique, profilContenuCheck, repetitionLocale);

  // V8 : 1 seul appel IA par tour dans le cas normal. Le second appel de
  // validation n'est lancé que pour un signal sémantique rare que les
  // contrôles déterministes ne peuvent pas trancher correctement.
  const llm = rapportLocal.ok && necessiteAuditLLM(reponse, storyCourante)
    ? await validerReponseLLM({
        ...configurationLLM(appSettings, modelePourAppel),
        reponse,
        faits: ctxBase.faits,
        meta: ctxBase.meta,
      })
    : rapportOk();
  const rapport = fusionnerRapports(rapportLocal, llm);

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
        messages: construireMessages({ ...ctxBase, noteCorrection }, { budgetSysteme: budgetPrompt }),
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
    annulerMesureTokens();
    throw new ErreurProfilContenu(
      "Cette réponse ne respecte pas les limites du profil Grand public et n'a pas pu être corrigée automatiquement. Réessaie avec une formulation différente.",
    );
  }

  const usageTokens = terminerMesureTokens();

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
    usageTokens,
  };

  const messages = [...storyCourante.messages, messageUtilisateur, messageAssistant];
  const storyAvecMessages: StoryState = { ...storyCourante, messages };
  const memoireNarrative = synchroniserMemoireNarrative(storyAvecMessages);

  return {
    story: { ...storyAvecMessages, memoireNarrative },
    aEteCorrige,
    debugLore: {
      ...debugLore,
      contextBlocks: debugContextBlocks(contexteV10Debug.blocks),
      memoireNarrative: memoireNarrative.evenements.length + ' événements indexés · ' + contexteV10Debug.totalChars + ' caractères envoyés en Context Blocks',
    },
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
