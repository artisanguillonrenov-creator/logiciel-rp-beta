import elyndorRaw from '../data/elyndorLore.json';
import type { AppSettings, Message, StoryState } from '../types';
import {
  chargerLoreElyndor,
  prioriserLoreCanon,
  selectionnerLoreElyndorSemantique,
  type OptionsSelectionLore,
} from './loreLoader';
import {
  construireMessagesAvecDiagnostic,
  construireSystemPrompt,
  maxTokensPourLongueur,
  temperaturePourCreativite,
  NB_MESSAGES_RECENTS,
  BUDGET_SYSTEM_LOCAL,
  BUDGET_SYSTEM_DISTANT,
  type ContexteConstruction,
  type DiagnosticPrompt,
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
  filtrerTextePourProfil,
  plafonnerCurseurs,
  texteCompatibleAvecProfil,
  validerProfilContenuHeuristique,
} from './contenuAdulte';
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
import { adapterApplicationVersContexteV21 } from './noyauV21/adapterApplication';
import { executerKernelV21, type SortieKernelV21 } from './noyauV21/kernel';
import { formaterNarrativeContractV21 } from './noyauV21/narrativeContractPrompt';
import { validerReponseAvecContratV21 } from './noyauV21/validationReponseV21';

const MARGE_TOKENS_ETAT = 350;
const TITRE_CONTRAT_KERNEL_V21 = '[NOYAU V2.1] Contrat narratif du tour';

const LORE_ELYNDOR = chargerLoreElyndor(elyndorRaw as any);

/** Corpus canon (lore statique compris) pour verifierEntitesCanoniques. */
export function corpusCanonHistoire(story: StoryState, messageJoueur: string): string {
  return corpusCanon(story, messageJoueur, LORE_ELYNDOR);
}

function genererId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface DebugLore {
  metamoteurs: string[];
  loreElyndor: string[];
  souvenirs: string[];
  // Mémoire narrative (V13) : blocs retenus pour le tour et taille de l'index.
  blocsContexte?: string[];
  memoireNarrative?: string;
}

export interface ResultatTour {
  story: StoryState;
  aEteCorrige: boolean;
  debugLore: DebugLore;
}

interface PreparationKernelV21 {
  sortie: SortieKernelV21;
  personnageJoueurId: string;
  entreePrompt: {
    id: string;
    titre: string;
    contenu: string;
  };
  diagnosticAdaptateur: {
    noyauStructureDisponible: boolean;
    participants: number;
    evenements: number;
    personnages: number;
    relations: number;
    reputations: number;
    engagements: number;
    connaissances: number;
    affirmations: number;
    filsNarratifs: number;
    donneesAbsentesNonInventees: string[];
  };
}

function preparerKernelV21(
  story: StoryState,
  messageJoueur: string,
  appSettings: AppSettings,
): PreparationKernelV21 {
  const adaptation = adapterApplicationVersContexteV21(story, {
    messageJoueur,
    appSettings,
  });
  const personnageJoueurId = adaptation.diagnostic.personnageJoueurId;
  const sortie = executerKernelV21({
    contexte: adaptation.contexte,
    moteurs: {
      m03: { personnageJoueurId },
      m07: { personnageJoueurId },
      m09: { personnageJoueurId },
    },
  });

  return {
    sortie,
    personnageJoueurId,
    entreePrompt: {
      id: 'noyau-v21-contrat-tour',
      titre: TITRE_CONTRAT_KERNEL_V21,
      contenu: formaterNarrativeContractV21(sortie.contrat, sortie.coordination.modeSortie),
    },
    diagnosticAdaptateur: {
      noyauStructureDisponible: adaptation.diagnostic.noyauStructureDisponible,
      participants: adaptation.diagnostic.participants,
      evenements: adaptation.diagnostic.evenements,
      personnages: adaptation.diagnostic.personnages,
      relations: adaptation.diagnostic.relations,
      reputations: adaptation.diagnostic.reputations,
      engagements: adaptation.diagnostic.engagements,
      connaissances: adaptation.diagnostic.connaissances,
      affirmations: adaptation.diagnostic.affirmations,
      filsNarratifs: adaptation.diagnostic.filsNarratifs,
      donneesAbsentesNonInventees: adaptation.diagnostic.donneesAbsentesNonInventees,
    },
  };
}

function lignesDiagnosticKernelV21(preparation: PreparationKernelV21): string[] {
  const d = preparation.sortie.diagnostic;
  const a = preparation.diagnosticAdaptateur;
  const absentes = a.donneesAbsentesNonInventees.length
    ? ` · absentes non inventées: ${a.donneesAbsentesNonInventees.join(', ')}`
    : '';
  return [
    `[KERNEL V2.1] ${d.moteursExecutes.length} moteurs exécutés · ${d.moteursContributeurs.length} contributeurs · ${d.nombreTransitionsProposees} transition(s) proposée(s) · ${d.nombreAlertes} alerte(s) · sortie ${d.modeSortie}`,
    `[ADAPTATEUR V2.1] ${a.personnages} personnage(s) · ${a.evenements} événement(s) · ${a.relations} relation(s) · ${a.engagements} engagement(s) · ${a.connaissances} connaissance(s)${absentes}`,
  ];
}

function formaterDebug(titre: string, score?: number): string {
  return score === undefined ? titre : `${titre} (${score.toFixed(2)})`;
}

function textesCompatibles(textes: Array<string | undefined>, appSettings: AppSettings): string[] {
  return textes.filter(
    (texte): texte is string => !!texte && texteCompatibleAvecProfil(texte, appSettings.profilContenu),
  );
}

/**
 * Requête ciblée pour le lore : priorité à ce qui se passe maintenant, au
 * lieu de diluer le signal dans toute la fiche personnage, tout le résumé et
 * tous les faits de l'histoire.
 */
function construireRequeteLore(story: StoryState, messageJoueur: string, appSettings: AppSettings): string {
  return textesCompatibles([
    messageJoueur,
    story.meta.contexte.lieu,
    ...story.messages.slice(-2).map((m) => m.content),
    story.meta.contexte.objectifs,
  ], appSettings).join('\n');
}

/** La mémoire historique reçoit une requête distincte, centrée sur l'échange. */
function construireRequeteSouvenirs(story: StoryState, messageJoueur: string, appSettings: AppSettings): string {
  return textesCompatibles([
    messageJoueur,
    ...story.messages.slice(-4).map((m) => m.content),
    story.meta.contexte.lieu,
  ], appSettings).join('\n');
}

interface SelectionLore {
  // Compatibilité avec le constructeur de prompt : les anciens métamoteurs
  // ne sont plus sélectionnés ici. Le seul élément injecté dans ce canal est
  // le contrat compact produit par le Kernel V2.1 au moment du tour.
  metamoteursSelectionnes: Array<{
    id: string;
    titre: string;
    contenu: string;
    score?: number;
  }>;
  loreElyndor: ReturnType<typeof selectionnerLoreElyndorSemantique>;
  souvenirs: Souvenir[];
  debugLore: DebugLore;
  modeRecherche: string;
  raisonRepli?: string;
}

function selectionLexicale(
  poolElyndor: ReturnType<typeof chargerLoreElyndor>,
  messagesAnciens: Message[],
  requeteLore: string,
  requeteSouvenirs: string,
  modeRecherche: string,
  raisonRepli?: string,
): SelectionLore {
  const loreElyndor = prioriserLoreCanon(
    requeteLore,
    rechercherLoreLexical(poolElyndor, requeteLore),
    LORE_ELYNDOR,
  );
  const souvenirs = rechercherSouvenirsLexical(messagesAnciens, requeteSouvenirs);

  return {
    metamoteursSelectionnes: [],
    loreElyndor,
    souvenirs,
    debugLore: {
      metamoteurs: [],
      loreElyndor: loreElyndor.map((e) => formaterDebug(e.titre, e.score)),
      souvenirs: formaterSouvenirsDebug(souvenirs),
    },
    modeRecherche,
    raisonRepli,
  };
}

export async function calculerSelectionLore(
  story: StoryState,
  messageJoueur: string,
  appSettings: AppSettings,
  optionsLoreElyndor?: OptionsSelectionLore,
): Promise<SelectionLore> {
  const profil = appSettings.profilContenu;
  const profilAdulte = profil === 'adulte';
  const requeteLore = construireRequeteLore(story, messageJoueur, appSettings);
  const requeteSouvenirs = construireRequeteSouvenirs(story, messageJoueur, appSettings);
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
    return selectionLexicale(
      poolElyndor as ReturnType<typeof chargerLoreElyndor>,
      messagesAnciens,
      requeteLore,
      requeteSouvenirs,
      'lexicale · aucune configuration embeddings',
    );
  }

  try {
    const [vecteursElyndor, resultatRequetes, vecteursMessagesAnciens] = await Promise.all([
      assurerEmbeddings(
        poolElyndor.map((e) => ({ id: e.id, contenu: e.contenu })),
        appSettings,
      ),
      obtenirEmbeddings([requeteLore, requeteSouvenirs], appSettings),
      embedderMessagesAnciens(messagesAnciens, appSettings),
    ]);

    const [vecteurLore, vecteurSouvenirs] = resultatRequetes.vecteurs;
    const loreElyndor = prioriserLoreCanon(
      requeteLore,
      selectionnerLoreElyndorSemantique(
        poolElyndor,
        requeteLore,
        vecteurLore,
        vecteursElyndor,
        undefined,
        optionsLoreElyndor,
      ),
      LORE_ELYNDOR,
    );
    const souvenirs = selectionnerSouvenirs(messagesAnciens, vecteurSouvenirs, vecteursMessagesAnciens);

    return {
      metamoteursSelectionnes: [],
      loreElyndor,
      souvenirs,
      debugLore: {
        metamoteurs: [],
        loreElyndor: loreElyndor.map((e) => formaterDebug(e.titre, e.score)),
        souvenirs: formaterSouvenirsDebug(souvenirs),
      },
      modeRecherche: `sémantique · ${resultatRequetes.fournisseur}`,
    };
  } catch (erreur) {
    const raison = erreur instanceof Error ? erreur.message : 'échec embeddings non identifié';
    return selectionLexicale(
      poolElyndor as ReturnType<typeof chargerLoreElyndor>,
      messagesAnciens,
      requeteLore,
      requeteSouvenirs,
      'lexicale · repli après échec embeddings',
      raison,
    );
  }
}

function debugMemoireNarrative(
  nbEvenements: number,
  blocs: ResultatBlocs,
  selection?: SelectionLore,
  diagnostic?: DiagnosticPrompt,
): Pick<DebugLore, 'blocsContexte' | 'memoireNarrative'> {
  const kernelActif = diagnostic?.metamoteursInjectes.includes(TITRE_CONTRAT_KERNEL_V21) ?? false;
  const details = diagnostic && selection
    ? kernelActif
      ? ` · recherche ${selection.modeRecherche} · prompt ${diagnostic.caracteres}/${diagnostic.budget} caractères · Kernel V2.1 injecté · lore ${diagnostic.loreSelectionne} sélectionnées/${diagnostic.loreInjecte.length} injectées`
      : ` · recherche ${selection.modeRecherche} · prompt ${diagnostic.caracteres}/${diagnostic.budget} caractères · contrat narratif absent · lore ${diagnostic.loreSelectionne} sélectionnées/${diagnostic.loreInjecte.length} injectées`
    : '';
  const lignes = debugBlocsContexte(blocs.blocs);
  if (selection && diagnostic) {
    lignes.push(`[CONTEXTE] ${selection.modeRecherche} · prompt ${diagnostic.caracteres}/${diagnostic.budget}`);
    if (selection.raisonRepli) lignes.push(`[REPLI] ${selection.raisonRepli}`);
    if (!kernelActif && diagnostic.metamoteursExclusBudget.length) {
      lignes.push(`[BUDGET] ${diagnostic.metamoteursExclusBudget.length} contrat(s) narratif(s) non injecté(s)`);
    }
    if (diagnostic.loreExclusBudget.length) {
      lignes.push(`[BUDGET] ${diagnostic.loreExclusBudget.length} entrée(s) lore non injectée(s)`);
    }
  }
  return {
    blocsContexte: lignes,
    memoireNarrative: `${nbEvenements} événements indexés · ${blocs.totalCaracteres} caractères sélectionnés${details}`,
  };
}

function debugAvecInjection(
  selection: SelectionLore,
  diagnostic: DiagnosticPrompt,
  nbEvenements: number,
  blocs: ResultatBlocs,
): DebugLore {
  const loreParTitre = new Map(
    selection.loreElyndor.map((e) => [e.titre, formaterDebug(e.titre, e.score)]),
  );
  const memoire = debugMemoireNarrative(nbEvenements, blocs, selection, diagnostic);
  return {
    metamoteurs: diagnostic.metamoteursInjectes,
    loreElyndor: diagnostic.loreInjecte.map((titre) => loreParTitre.get(titre) ?? titre),
    souvenirs: selection.debugLore.souvenirs,
    ...memoire,
  };
}

export async function calculerDebugLore(story: StoryState, messageJoueur: string, appSettings: AppSettings): Promise<DebugLore> {
  const selection = await calculerSelectionLore(story, messageJoueur, appSettings);
  const kernel = preparerKernelV21(story, messageJoueur, appSettings);
  const evenements = synchroniserMemoireNarrative(story);
  const blocs = construireBlocsContexte(story, messageJoueur, evenements);
  const ctx = construireCtxBase(
    story,
    messageJoueur,
    appSettings,
    {
      metamoteursSelectionnes: [kernel.entreePrompt],
      loreElyndor: selection.loreElyndor,
      souvenirs: selection.souvenirs,
    },
    blocs,
  );
  const budgetPrompt = appSettings.moteurInference === 'local' || appSettings.moteurInference === 'serveur'
    ? BUDGET_SYSTEM_LOCAL
    : BUDGET_SYSTEM_DISTANT;
  const { diagnostic } = construireMessagesAvecDiagnostic(ctx, { budgetSysteme: budgetPrompt });
  const debug = debugAvecInjection(selection, diagnostic, evenements.length, blocs);
  return {
    ...debug,
    metamoteurs: kernel.sortie.diagnostic.moteursExecutes.map((moteur) => `${moteur} · Kernel V2.1`),
    blocsContexte: [...(debug.blocsContexte ?? []), ...lignesDiagnosticKernelV21(kernel)],
  };
}

export function construireCtxBase(
  story: StoryState,
  messageJoueur: string,
  appSettings: AppSettings,
  selection: Pick<SelectionLore, 'metamoteursSelectionnes' | 'loreElyndor' | 'souvenirs'>,
  blocs: ResultatBlocs = construireBlocsContexte(story, messageJoueur),
  // Faux pour la scène d'ouverture : aucun tour à intégrer, donc pas de bloc
  // d'état machine à demander au narrateur.
  avecNoyau = true,
): ContexteConstruction {
  const noyau = avecNoyau ? construireContexteNoyau(assurerNoyau(story), messageJoueur) : null;
  const profil = appSettings.profilContenu;
  const profilAdulte = profil === 'adulte';
  const filtrer = (texte: string | undefined) => filtrerTextePourProfil(texte ?? '', profil);
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
    registreAdulte: profilAdulte ? instructionRegistreAdulte(story.settings) : undefined,
    directionNarrative: filtrer(directionNarrative),
    etatMonde: filtrer([formaterMonde(story.monde), noyau?.texteMonde].filter(Boolean).join('\n\n')),
    engagementsEtRelations: filtrer([formaterEngagementsEtRelations(story.social), noyau?.texteSocial].filter(Boolean).join('\n\n')),
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
  const selection = await calculerSelectionLore(story, messageJoueur, appSettings);
  const kernel = preparerKernelV21(story, messageJoueur, appSettings);
  return construireSystemPrompt(construireCtxBase(
    story,
    messageJoueur,
    appSettings,
    {
      metamoteursSelectionnes: [kernel.entreePrompt],
      loreElyndor: selection.loreElyndor,
      souvenirs: selection.souvenirs,
    },
  ));
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
  const storyRafraichie = await rafraichirEtatDeriveAvantTour(story);
  const evenements = synchroniserMemoireNarrative(storyRafraichie);
  const storyCourante = assurerNoyau(storyRafraichie, evenements);

  const selection = await calculerSelectionLore(storyCourante, messageJoueur, appSettings);
  const kernel = preparerKernelV21(storyCourante, messageJoueur, appSettings);
  const { loreElyndor, souvenirs } = selection;
  const metamoteursSelectionnes = [kernel.entreePrompt];

  const blocs = construireBlocsContexte(storyCourante, messageJoueur, evenements);
  const ctxBase = construireCtxBase(
    storyCourante,
    messageJoueur,
    appSettings,
    { metamoteursSelectionnes, loreElyndor, souvenirs },
    blocs,
  );

  const modelePourAppel = modeleOverridePourFournisseur(
    appSettings,
    storyCourante.meta.modeleOverride,
    storyCourante.meta.modeleOverrideFournisseur,
  ) || configurationLLM(appSettings).model;
  const temperature = storyCourante.meta.temperatureOverride ?? temperaturePourCreativite(storyCourante.settings.creativite);
  // Marge pour le bloc d'état V12 ajouté après la narration : sans elle,
  // il rognait la scène ou arrivait coupé.
  const maxTokens = maxTokensPourLongueur(storyCourante.settings.longueur) + MARGE_TOKENS_ETAT;
  const budgetPrompt = appSettings.moteurInference === 'local' || appSettings.moteurInference === 'serveur'
    ? BUDGET_SYSTEM_LOCAL
    : BUDGET_SYSTEM_DISTANT;

  let constructionPrompt = construireMessagesAvecDiagnostic(ctxBase, { budgetSysteme: budgetPrompt });
  let diagnosticPrompt = constructionPrompt.diagnostic;

  commencerMesureTokens();
  const premiere = extraireEnveloppeEtat(await appellerModele({
    ...configurationLLM(appSettings, modelePourAppel),
    messages: constructionPrompt.messages,
    temperature,
    maxTokens,
  }));
  let reponse = premiere.texte;
  let deltaEtat = premiere.delta;

  const canon = corpusCanonHistoire(storyCourante, messageJoueur);
  const validationContratInitiale = validerReponseAvecContratV21({
    reponse,
    contrat: kernel.sortie.contrat,
    modeSortie: kernel.sortie.coordination.modeSortie,
  });
  const controlesLocaux = fusionnerRapports(
    validationContratInitiale.rapport,
    validerAgentiviteHeuristique(reponse, storyCourante.meta.personnageNom),
    validerProfilContenuHeuristique(reponse, appSettings.profilContenu),
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
  let correctionEchouee = false;

  if (strategie === 'patch_local') {
    reponse = appliquerPatchLocal(reponse, rapport);
    // Un delta produit avec la version rejetée de la narration ne peut pas être
    // considéré comme validé après une correction locale du texte.
    deltaEtat = undefined;
  } else if (strategie === 'repair' || strategie === 'regeneration_partielle') {
    try {
      reponse = extraireEnveloppeEtat(await reparerReponse({
        ...configurationLLM(appSettings, modelePourAppel),
        reponse,
        rapport,
        partiel: strategie === 'regeneration_partielle',
      })).texte;
      // Le réparateur ne reconstruit pas l'enveloppe d'état : on refuse donc
      // de réutiliser le delta de la proposition initialement rejetée.
      deltaEtat = undefined;
    } catch {
      aEteCorrige = false;
      correctionEchouee = true;
    }
  } else if (strategie === 'regeneration_complete') {
    const noteCorrection = `La tentative précédente a été rejetée pour la ou les raisons suivantes : ${rapport.checks
      .filter((c) => !c.ok)
      .map((c) => c.raison)
      .join(' ')} Corrige ces points dans ta nouvelle réponse, sans les mentionner explicitement au joueur.`;
    try {
      constructionPrompt = construireMessagesAvecDiagnostic(
        { ...ctxBase, noteCorrection },
        { budgetSysteme: budgetPrompt },
      );
      diagnosticPrompt = constructionPrompt.diagnostic;
      const regeneree = extraireEnveloppeEtat(await appellerModele({
        ...configurationLLM(appSettings, modelePourAppel),
        messages: constructionPrompt.messages,
        temperature,
        maxTokens,
      }));
      reponse = regeneree.texte;
      deltaEtat = regeneree.delta;
    } catch {
      aEteCorrige = false;
      correctionEchouee = true;
    }
  }

  if (correctionEchouee) {
    annulerMesureTokens();
    throw new Error("La réponse proposée a échoué à la validation et n'a pas pu être corrigée. Aucun état n'a été canonisé.");
  }

  // Dernier filet : une entité inventée qui a survécu à la correction est
  // remplacée par un terme générique plutôt que d'entrer dans l'histoire.
  const canonFinal = verifierEntitesCanoniques(reponse, canon);
  if (!canonFinal.ok) {
    reponse = appliquerPatchLocal(reponse, canonFinal);
    aEteCorrige = true;
    deltaEtat = undefined;
  }

  if (reponseFaitParlerLeJoueur(reponse, storyCourante.meta.personnageNom)) {
    const nettoyee = retirerRepliqueDuJoueur(reponse, storyCourante.meta.personnageNom);
    if (nettoyee) {
      reponse = nettoyee;
      aEteCorrige = true;
      deltaEtat = undefined;
    }
  }

  const validationContratFinale = validerReponseAvecContratV21({
    reponse,
    contrat: kernel.sortie.contrat,
    modeSortie: kernel.sortie.coordination.modeSortie,
  });
  const controlesFinaux = fusionnerRapports(
    validationContratFinale.rapport,
    validerAgentiviteHeuristique(reponse, storyCourante.meta.personnageNom),
    validerProfilContenuHeuristique(reponse, appSettings.profilContenu),
    validerRepetitionHeuristique(reponse, storyCourante),
    verifierEntitesCanoniques(reponse, canon),
  );

  if (!controlesFinaux.ok) {
    annulerMesureTokens();
    const raisons = controlesFinaux.checks
      .filter((check) => !check.ok)
      .map((check) => check.raison)
      .filter(Boolean)
      .join(' ');
    throw new Error(
      `La réponse finale ne respecte pas le contrat narratif V2.1 et n'a pas été canonisée.${raisons ? ` ${raisons}` : ''}`,
    );
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
  const debugFinal = debugAvecInjection(selection, diagnosticPrompt, evenements.length, blocs);

  return {
    story: storyFinale,
    aEteCorrige,
    debugLore: {
      ...debugFinal,
      metamoteurs: kernel.sortie.diagnostic.moteursExecutes.map((moteur) => `${moteur} · Kernel V2.1`),
      blocsContexte: [
        ...(debugFinal.blocsContexte ?? []),
        ...lignesDiagnosticKernelV21(kernel),
        '[VALIDATION V2.1] réponse conforme au contrat avant canonisation',
        ...diagnosticNoyau(storyFinale),
      ],
    },
  };
}

export async function regenererDernierTour(story: StoryState, appSettings: AppSettings): Promise<ResultatTour> {
  const rafraichie = await rafraichirEtatDeriveAvantTour(story);
  // Le tour régénéré ne doit pas laisser ses événements dans le noyau.
  const storyCourante = annulerTour(rafraichie, rafraichie.messages.at(-1)?.id ?? '');
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
