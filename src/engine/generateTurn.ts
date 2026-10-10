import elyndorRaw from '../data/elyndorLore.json';
import type { AppSettings, DiagnosticTour, LoreEntry, Message, StoryState } from '../types';
import type { ParametresAtelier } from '../concepteur/configuration';
import { reglagesNarrateurDefaut, samplersPourRequete } from '../concepteur/reglagesNarrateur';
import { controlerLongueurNarration } from './controleLongueurNarration';
import { deltaAssocieAuTexte, exigerNarrationValide, preparerNarrationPourPublication } from './controlePublicationNarration';
import { lireConfigurationAtelier } from '../concepteur/depotConfiguration';
import { lireLoreAtelier } from '../concepteur/lorebookStore';
import { appliquerLorePublie } from '../concepteur/lorebookModele';
import {
  chargerLoreElyndor,
  extraireAncresCanoniques,
  type OptionsSelectionLore,
} from './loreLoader';
import {
  construireMessages,
  construireSystemPrompt,
  maxTokensPourLongueur,
  temperaturePourCreativite,
  selectionnerMessagesRecents,
  budgetMessagesRecents,
  BUDGET_SYSTEM_LOCAL,
  BUDGET_SYSTEM_DISTANT,
  BUDGET_CONVERSATION_LOCAL,
  BUDGET_CONVERSATION_DISTANT,
  type ContexteConstruction,
} from './promptBuilder';
import { configurationLLM } from './openrouter';
import { modeleOverridePourFournisseur } from './llmProvider';
import { reglagesSontElyndorCloud } from './elyndorCloud';
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
import { rechercherSouvenirsLexical } from './rechercheLexicale';
import { construirePassages, selectionnerPassages } from './passagesLore';
import { preparerTour, type PreparationTour } from './ficheScene';
import { validerGestesDuJoueur, validerRolesCanon } from './controlesCoherence';
import { ROLES_CANON } from './canonElyndor';
import { prenomRole, rolesDeLaVille } from './rolesCanon';
import { appellerModele } from './elyndorCloudClient';
import { genererNarrationAvecCloture } from './clotureNarration';
import { genererDeltaEtatSepare } from './deltaEtatSepare';
import { annulerMesureTokens, commencerMesureTokens, terminerMesureTokens } from './mesureTokens';
import {
  ajouterEtapeDiagnostic,
  annulerDiagnosticTour,
  commencerDiagnosticTour,
  mesurerEtapeDiagnostic,
  terminerDiagnosticTour,
} from './diagnosticTour';
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
  instructionRegistreAdulte,
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
  validerAgentiviteHeuristique,
  validerReponseLLM,
  type RapportValidation,
} from './validator';

async function parametresDeLaSession(settings: AppSettings): Promise<ParametresAtelier | undefined> {
  // Les valeurs de production restent actives aussi côté joueur : pas seulement
  // dans le mode diagnostic du concepteur. Les profils Test/Benchmark sont privés.
  const config = await lireConfigurationAtelier().catch(() => null);
  return config?.profils[settings.modeConcepteur ? config.profilActif : 'production'];
}
const LORE_ELYNDOR_BASE = chargerLoreElyndor(elyndorRaw as any);
let LORE_ELYNDOR = LORE_ELYNDOR_BASE;

/** Charge les fiches réellement publiées avant CHAQUE sélection narrative. */
async function assurerLorePublie() {
  const etat = await lireLoreAtelier();
  LORE_ELYNDOR = appliquerLorePublie(LORE_ELYNDOR_BASE, etat);
  return LORE_ELYNDOR;
}

/**
 * Fenêtre étroite : modèle sur l'appareil ou serveur du réseau local. Le pod
 * Elyndor Cloud (fenêtre de 24 576 jetons, voir infra/runpod/start.sh) reçoit
 * les budgets larges : avec les budgets étroits, l'en-tête occupait presque
 * tout le prompt et la mémoire et le lore n'avaient plus que quelques
 * centaines de caractères.
 */
export function moteurAFenetreEtroite(appSettings: AppSettings): boolean {
  if (appSettings.moteurInference === 'local') return true;
  return appSettings.moteurInference === 'serveur' && !reglagesSontElyndorCloud(appSettings);
}

function budgetConversationPourApp(appSettings: AppSettings): number {
  return moteurAFenetreEtroite(appSettings) ? BUDGET_CONVERSATION_LOCAL : BUDGET_CONVERSATION_DISTANT;
}

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
  diagnosticTour?: DiagnosticTour;
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

/**
 * Requêtes du moteur de recherche du lore, consulté après la mémoire de
 * l'histoire et guidé par l'intention du joueur (ficheScene.ts) :
 * - message : ce que le joueur fait ou demande, avec la ville et le lieu
 *   visé — prioritaire (« allons à la guilde » doit trouver la guilde de Paris) ;
 * - scène : la mémoire de l'histoire (résumé, faits établis) et la dernière
 *   réponse du narrateur.
 * La fiche du personnage et le point de départ, très longs, noyaient la
 * demande du joueur et n'y figurent plus.
 */
function construireRequetesLore(story: StoryState, messageJoueur: string, appSettings: AppSettings, preparation: PreparationTour) {
  const profil = appSettings.profilContenu;
  const garder = (textes: (string | false | undefined)[]) => textes
    .filter((texte): texte is string => !!texte && texteCompatibleAvecProfil(texte, profil))
    .join('\n');
  const { ville, intention } = preparation;
  const derniereReponse = [...story.messages].reverse().find((m) => m.role === 'assistant')?.content;
  return {
    message: garder([ville && `Ville : ${ville}`, intention.lieu && `Lieu visé : ${intention.lieu.libelle}`, ...intention.fiches, messageJoueur]),
    scene: garder([ville && `Ville : ${ville}`, story.memoire.resume, ...story.memoire.faits.map((f) => f.texte), derniereReponse]),
  };
}

interface SelectionLore {
  loreElyndor: LoreEntry[];
  souvenirs: Souvenir[];
  debugLore: DebugLore;
}


export async function calculerSelectionLore(
  story: StoryState,
  messageJoueur: string,
  appSettings: AppSettings,
  optionsLoreElyndor?: OptionsSelectionLore,
  reglagesAtelier?: ParametresAtelier,
): Promise<SelectionLore> {
  const debutRecherche = Date.now();
  const loreCourant = await assurerLorePublie();
  const profil = appSettings.profilContenu;
  const profilAdulte = profil === 'adulte';
  const texteRequete = construireTexteRequete(story, messageJoueur, appSettings);
  const plugins = await getPlugins();

  const poolElyndorBrut = [
    ...loreCourant,
    ...convertirLoreEmergentPourSelection(story.loreEmergent),
    ...convertirPluginsPourSelection(plugins),
  ];
  const poolElyndor = profilAdulte
    ? poolElyndorBrut
    : poolElyndorBrut.filter(
        (e) => !ENTREES_ADULTE_UNIQUEMENT.includes(e.titre) && texteCompatibleAvecProfil(`${e.titre}\n${e.contenu}`, profil),
      );

  // Moteur de recherche du lore : tous les passages de toutes les entrées
  // sont notés, seuls les meilleurs partent au narrateur (BUDGET_LORE_PASSAGES).
  const passagesLore = construirePassages(poolElyndor);
  const preparation = preparerTour(story, messageJoueur);
  const requetesLore = construireRequetesLore(story, messageJoueur, appSettings, preparation);
  // Fiches du lieu visé (Guilde des Aventuriers, Maîtresses de Guilde…) :
  // traitées comme des noms cités, leur meilleur passage remonte d'office.
  const ancresLore = new Set([
    ...extraireAncresCanoniques(`${requetesLore.message}\n${requetesLore.scene}`, poolElyndor).map((e) => e.id),
    ...poolElyndor.filter((e) => preparation.intention.fiches.some((f) => e.titre.includes(f))).map((e) => e.id),
  ]);

  // La frontière entre contexte direct et recherche historique n'est plus
  // un nombre fixe de messages. Elle dépend du budget réel de conversation
  // du moteur utilisé. Tout ce qui ne tient pas dans le contexte direct
  // devient automatiquement consultable par la recherche historique.
  const budgetConversation = budgetConversationPourApp(appSettings);
  const messagesRecentsDirects = selectionnerMessagesRecents(
    story.messages,
    budgetMessagesRecents(messageJoueur, budgetConversation),
  );
  const messagesAnciensBruts = story.messages.slice(
    0,
    Math.max(0, story.messages.length - messagesRecentsDirects.length),
  );
  const messagesAnciens = profilAdulte
    ? messagesAnciensBruts
    : messagesAnciensBruts.filter((m) => texteCompatibleAvecProfil(m.content, profil));

  // Les embeddings améliorent le classement, mais ils ne doivent jamais
  // empêcher un tour narratif. Ce repli local reste disponible aussi bien
  // lorsqu'aucun fournisseur n'est configuré que lorsqu'un endpoint
  // d'embeddings configuré refuse ou échoue pendant l'appel.
  const selectionLexicale = (raison: string, statut: 'ok' | 'repli' = 'repli'): SelectionLore => {
    const loreElyndor = selectionnerPassages(passagesLore, requetesLore.scene, {
      requeteMessage: requetesLore.message,
      ancres: ancresLore,
      aleatoire: optionsLoreElyndor?.aleatoire,
      budget: reglagesAtelier?.budgetLorePassages,
    });
    const souvenirs = rechercherSouvenirsLexical(messagesAnciens, texteRequete, reglagesAtelier?.maxSouvenirs);
    ajouterEtapeDiagnostic(
      'Recherche lore et historique',
      'recherche',
      statut,
      Date.now() - debutRecherche,
      raison,
      [
        'voie : lexicale locale',
        `${poolElyndor.length} entrées lore candidates (${passagesLore.length} passages)`,
        `${messagesAnciens.length} messages anciens consultables`,
        `${loreElyndor.length} entrées lore retenues`,
        `${souvenirs.length} souvenirs retenus`,
      ],
    );
    return {
      loreElyndor,
      souvenirs,
      debugLore: {
        metamoteurs: [],
        loreElyndor: loreElyndor.map((e) => formaterDebug(e.titre, e.score)),
        souvenirs: formaterSouvenirsDebug(souvenirs),
      },
    };
  };

  if (!embeddingsDisponibles(appSettings)) return selectionLexicale('Embeddings indisponibles : repli lexical.');

  try {
    const [vecteursElyndor, { vecteurs: [vecteurRequete, vecteurScene, vecteurMessage] }, vecteursMessagesAnciens] = await Promise.all([
      assurerEmbeddings(
        passagesLore.map((p) => ({ id: p.id, contenu: `${p.titre}\n${p.contenu}` })),
        appSettings,
        'Lore Elyndor (passages)',
      ),
      obtenirEmbeddings([texteRequete, requetesLore.scene, requetesLore.message], appSettings, 'Requête de recherche'),
      embedderMessagesAnciens(messagesAnciens, appSettings),
    ]);

    const loreElyndor = selectionnerPassages(passagesLore, requetesLore.scene, {
      vecteurRequete: vecteurScene ?? vecteurRequete,
      requeteMessage: requetesLore.message,
      vecteurMessage,
      vecteursPassages: vecteursElyndor,
      ancres: ancresLore,
      aleatoire: optionsLoreElyndor?.aleatoire,
      budget: reglagesAtelier?.budgetLorePassages,
    });
    const souvenirs = selectionnerSouvenirs(messagesAnciens, vecteurRequete, vecteursMessagesAnciens, reglagesAtelier?.maxSouvenirs);

    ajouterEtapeDiagnostic(
      'Recherche lore et historique',
      'recherche',
      'ok',
      Date.now() - debutRecherche,
      undefined,
      [
        'voie : sémantique bge-m3 + ObjectBox/cosinus',
        `${poolElyndor.length} entrées lore candidates (${passagesLore.length} passages)`,
        `${messagesAnciens.length} messages anciens consultables`,
        `${loreElyndor.length} entrées lore retenues`,
        `${souvenirs.length} souvenirs retenus`,
        ...loreElyndor.slice(0, 8).map((e) => `lore → ${formaterDebug(e.titre, e.score)}`),
      ],
    );

    return {
      loreElyndor,
      souvenirs,
      debugLore: {
        metamoteurs: [],
        loreElyndor: loreElyndor.map((e) => formaterDebug(e.titre, e.score)),
        souvenirs: formaterSouvenirsDebug(souvenirs),
      },
    };
  } catch (erreur) {
    return selectionLexicale(
      `Échec de la voie sémantique : ${erreur instanceof Error ? erreur.message : 'erreur inconnue'}`,
      'repli',
    );
  }
}

function debugMemoireNarrative(nbEvenements: number, blocs: ResultatBlocs): Pick<DebugLore, 'blocsContexte' | 'memoireNarrative'> {
  return {
    blocsContexte: debugBlocsContexte(blocs.blocs),
    memoireNarrative: `${nbEvenements} événements indexés · ${blocs.totalCaracteres} caractères sélectionnés`,
  };
}

export async function calculerDebugLore(story: StoryState, messageJoueur: string, appSettings: AppSettings): Promise<DebugLore> {
  const reglagesAtelier = await parametresDeLaSession(appSettings);
  const { debugLore } = await calculerSelectionLore(story, messageJoueur, appSettings, undefined, reglagesAtelier);
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
  // Faux pour la scène d'ouverture : aucun tour à intégrer, donc pas de bloc
  // d'état machine à demander au narrateur.
  avecNoyau = true,
  reglagesAtelier?: ParametresAtelier,
): ContexteConstruction {
  const storyNoyau = avecNoyau ? assurerNoyau(story) : story;
  const noyau = avecNoyau ? construireContexteNoyau(assurerNoyau(story), messageJoueur) : null;
  const contrat = construireContratNarratifNatif(storyNoyau, messageJoueur, appSettings.profilContenu);
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
    longueursCibles: reglagesAtelier?.narrateur.longueurs,
    stylesNarratifs: reglagesAtelier?.narrateur.styles,
    resume: filtrer(story.memoire.resume),
    faits,
    loreElyndor: selection.loreElyndor,
    messagesRecents,
    messageJoueur,
    contratNarratif: filtrer(contrat.texte),
    budgetLorePassages: reglagesAtelier?.budgetLorePassages,
    registreAdulte: profilAdulte ? instructionRegistreAdulte(story.settings) : undefined,
    directionNarrative: filtrer(directionNarrative),
    etatMonde: filtrer([formaterMonde(story.monde), noyau?.texteMonde].filter(Boolean).join('\n\n')),
    engagementsEtRelations: filtrer([formaterEngagementsEtRelations(story.social), noyau?.texteSocial].filter(Boolean).join('\n\n')),
    souvenirs: filtrer(formaterSouvenirs(selection.souvenirs, nomPersonnage)),
    blocsContexte: filtrer([noyau?.texte, formaterBlocsContexte(blocs.blocs)].filter(Boolean).join('\n\n')),
    directiveEtat: noyau?.directive,
    // Étapes 1 à 4 de la logique de réponse : fiche préparée par l'application.
    ficheScene: avecNoyau ? filtrer(preparerTour(story, messageJoueur).fiche) : undefined,
  };
}

/** Place laissée à la consigne visuelle et aux derniers messages dans la fenêtre du pod. */
export const BUDGET_SYSTEM_ILLUSTRATION = 56000;

/**
 * Contexte du narrateur pour illustrer la scène qu'il vient d'écrire : même
 * lore, même mémoire, même fiche de scène que pour répondre au joueur (le
 * dernier message du joueur sert de requête, la dernière réponse du
 * narrateur guide la recherche). Le préfixe et les métamoteurs restent
 * identiques : le serveur les reprend de son cache.
 */
export async function construireContexteNarrateurPourIllustration(story: StoryState, appSettings: AppSettings): Promise<string> {
  const messageJoueur = [...story.messages].reverse().find((m) => m.role === 'user')?.content ?? story.meta.pointDeDepart ?? '';
  const evenements = synchroniserMemoireNarrative(story);
  const storyCourante = assurerNoyau(story, evenements);
  const reglagesAtelier = await parametresDeLaSession(appSettings);
  const selection = await calculerSelectionLore(storyCourante, messageJoueur, appSettings, undefined, reglagesAtelier);
  const blocs = construireBlocsContexte(storyCourante, messageJoueur, evenements);
  const ctx = construireCtxBase(storyCourante, messageJoueur, appSettings, selection, blocs, true, reglagesAtelier);
  // Pas de bloc d'état machine : la réponse attendue est la direction artistique.
  return construireSystemPrompt(
    { ...ctx, directiveEtat: undefined },
    { budgetSysteme: moteurAFenetreEtroite(appSettings) ? BUDGET_SYSTEM_LOCAL : BUDGET_SYSTEM_ILLUSTRATION },
  );
}

export async function construirePromptDebug(
  story: StoryState,
  messageJoueur: string,
  appSettings: AppSettings,
): Promise<string> {
  const reglagesAtelier = await parametresDeLaSession(appSettings);
  const { loreElyndor, souvenirs } = await calculerSelectionLore(story, messageJoueur, appSettings, undefined, reglagesAtelier);
  return construireSystemPrompt(construireCtxBase(story, messageJoueur, appSettings, { loreElyndor, souvenirs }, undefined, true, reglagesAtelier));
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
      storyId: story.meta.id,
    }),
    mettreAJourDirecteur({ appSettings, directeurActuel: story.directeur, messages: messagesSecurises, depuisIndex, storyId: story.meta.id }),
    mettreAJourMonde({ appSettings, mondeActuel: story.monde, messages: messagesSecurises, depuisIndex, storyId: story.meta.id }),
    mettreAJourSocial({ appSettings, socialActuel: story.social, messages: messagesSecurises, depuisIndex, storyId: story.meta.id }),
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
    storyId: story.meta.id,
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

async function genererTourInterne(
  story: StoryState,
  appSettings: AppSettings,
  messageJoueur: string,
  reponseAId?: string,
): Promise<ResultatTour> {
  const debutMs = Date.now();
  const storyRafraichie = await mesurerEtapeDiagnostic(
    'Rafraîchir état dérivé',
    'préparation',
    () => rafraichirEtatDeriveAvantTour(story),
  );
  const debutMemoireNarrative = Date.now();
  const evenements = synchroniserMemoireNarrative(storyRafraichie);
  const storyCourante = assurerNoyau(storyRafraichie, evenements);
  ajouterEtapeDiagnostic(
    'Synchroniser mémoire narrative et noyau',
    'préparation',
    'ok',
    Date.now() - debutMemoireNarrative,
    undefined,
    [`${evenements.length} événements indexés`],
  );

  const reglagesAtelier = await parametresDeLaSession(appSettings);
  const { loreElyndor, souvenirs, debugLore } = await calculerSelectionLore(
    storyCourante,
    messageJoueur,
    appSettings,
    undefined,
    reglagesAtelier,
  );

  const contrat = construireContratNarratifNatif(storyCourante, messageJoueur, appSettings.profilContenu);
  debugLore.metamoteurs = debugContratNarratif(contrat);
  ajouterEtapeDiagnostic('Méta-moteurs V2.1 — contrat narratif', 'contexte', 'ok', 0, undefined,
    [`${contrat.contributions.filter((m) => m.actif).length}/15 responsabilités mobilisées`, ...debugLore.metamoteurs]);
  const debutContexte = Date.now();
  const blocs = construireBlocsContexte(storyCourante, messageJoueur, evenements);
  const ctxBase = construireCtxBase(storyCourante, messageJoueur, appSettings, { loreElyndor, souvenirs }, blocs, true, reglagesAtelier);
  ajouterEtapeDiagnostic(
    'Construire contexte du tour',
    'contexte',
    'ok',
    Date.now() - debutContexte,
    undefined,
    [`${blocs.blocs.length} blocs mémoire retenus`, `${blocs.totalCaracteres} caractères mémoire narrative`],
  );

  const modelePourAppel = modeleOverridePourFournisseur(
    appSettings,
    storyCourante.meta.modeleOverride,
    storyCourante.meta.modeleOverrideFournisseur,
  ) || configurationLLM(appSettings).model;
  const temperatureBase = storyCourante.meta.temperatureOverride ?? temperaturePourCreativite(storyCourante.settings.creativite);
  const temperature = Math.max(0, Math.min(2, temperatureBase + (reglagesAtelier?.temperatureDelta ?? 0)));
  // Aucun token supplémentaire : le plafond de sortie est exactement la
  // limite supérieure choisie par le concepteur pour le texte visible.
  const plageNarration = (reglagesAtelier?.narrateur.longueurs ??
    reglagesNarrateurDefaut().longueurs)[storyCourante.settings.longueur];
  const maxTokens = maxTokensPourLongueur(storyCourante.settings.longueur, reglagesAtelier?.narrateur.longueurs);
  const samplers = samplersPourRequete(reglagesAtelier?.narrateur);
  if (reglagesAtelier) ajouterEtapeDiagnostic('Configuration concepteur effective', 'préparation', 'ok', 0, undefined,
    [`Budget lore : ${reglagesAtelier.budgetLorePassages} caractères`, `Souvenirs : ${reglagesAtelier.maxSouvenirs}`,
     `Température effective : ${temperature}`, `Plafond narratif strict : ${maxTokens} tokens`]);
  const moteurEtroit = moteurAFenetreEtroite(appSettings);
  const budgetPrompt = moteurEtroit ? BUDGET_SYSTEM_LOCAL : BUDGET_SYSTEM_DISTANT;
  const budgetConversation = moteurEtroit ? BUDGET_CONVERSATION_LOCAL : BUDGET_CONVERSATION_DISTANT;
  const ctxNarration = { ...ctxBase, directiveEtat: undefined };
  const messagesNarrateur = construireMessages(ctxNarration, {
    budgetSysteme: budgetPrompt, budgetConversation,
  });
  const tailleSysteme = messagesNarrateur.find(m => m.role === 'system')?.content?.length ?? 0;
  const tailleHistorique = messagesNarrateur.filter(m => m.role !== 'system')
    .reduce((total, m) => total + (m.content?.length ?? 0), 0);
  ajouterEtapeDiagnostic('Budget de contexte effectivement construit', 'contexte', 'ok', 0, undefined, [
    `Prompt système : ${tailleSysteme} caractères`,
    `Historique envoyé : ${tailleHistorique} caractères`,
    `Messages envoyés : ${messagesNarrateur.length}`,
    `Limites de préparation : système ${budgetPrompt}, historique ${budgetConversation} caractères`,
    'Les caractères ne sont PAS les tokens réels du modèle.',
  ]);

  commencerMesureTokens();
  // Le récit seul est généré ici. Le STATE DELTA n'est demandé qu'après
  // validation stricte du texte final, via un autre appel indépendant.
  const premiere = extraireEnveloppeEtat(await mesurerEtapeDiagnostic(
    'Génération narrative principale',
    'génération',
    () => genererNarrationAvecCloture({
      ...configurationLLM(appSettings, modelePourAppel),
      storyId: storyCourante.meta.id,
      messages: messagesNarrateur,
      temperature,
      maxTokens,
      samplers,
      diagnosticLabel: 'Narration RP',
    }, plageNarration),
  ));
  let reponse = premiere.texte;
  let deltaEtat = premiere.delta;

  const canon = corpusCanonHistoire(storyCourante, messageJoueur);
  const debutValidationLocale = Date.now();
  // Verdict de chaque règle, respectée ou non, dans le diagnostic du tour :
  // c'est ce qui permet de vérifier que le modèle suit les règles codées.
  // Étape 8 : rôles fixés de la ville en cours et gestes du joueur.
  const preparationTour = preparerTour(storyCourante, messageJoueur);
  const rolesVille = rolesDeLaVille(ROLES_CANON, preparationTour.ville);
  const nomsConnus = [
    storyCourante.meta.personnageNom,
    ...(storyCourante.scene?.presents ?? []),
    ...storyCourante.loreEmergent.map((e) => e.titre),
    ...ROLES_CANON.map((r) => prenomRole(r)),
  ];
  const verdictsLocaux: Array<[string, RapportValidation]> = [
    ['Autonomie du joueur (règles 1 et 7)', validerAgentiviteHeuristique(reponse, storyCourante.meta.personnageNom)],
    ['Gestes du joueur (protocole du tour)', validerGestesDuJoueur(reponse, messageJoueur, storyCourante.meta.personnageNom)],
    ['Rôles fixés par le lore (fiche de scène)', validerRolesCanon(reponse, rolesVille, nomsConnus)],
    ['Profil de contenu', validerProfilContenuHeuristique(reponse, appSettings.profilContenu)],
    ['Répétitions', validerRepetitionHeuristique(reponse, storyCourante)],
    ['Canon et mots inventés (règles 2 et 5)', verifierEntitesCanoniques(reponse, canon)],
  ];
  const controlesLocaux = fusionnerRapports(...verdictsLocaux.map(([, rapportLocal]) => rapportLocal));
  ajouterEtapeDiagnostic(
    'Contrôles locaux',
    'validation',
    controlesLocaux.ok ? 'ok' : 'erreur',
    Date.now() - debutValidationLocale,
    controlesLocaux.ok ? undefined : controlesLocaux.checks.filter((x) => !x.ok).map((x) => x.raison).join(' | '),
    verdictsLocaux.map(([regle, rapportLocal]) => (rapportLocal.ok
      ? `respectée · ${regle}`
      : `ENFREINTE · ${regle} — ${rapportLocal.checks.filter((c) => !c.ok).map((c) => `[${c.nom}, ${c.gravite}] ${c.raison}`).join(' ; ')}`)),
  );
  // V13 : l'appel de validation au modèle (un second appel complet, très
  // coûteux sur un modèle local) n'a lieu que si les contrôles locaux sont
  // passés et que la réponse semble défaire un fait établi.
  const contradictionDetectee = controlesLocaux.ok && contradictionProbable(reponse, storyCourante);
  let llm = rapportOk();
  if (contradictionDetectee) {
    llm = await mesurerEtapeDiagnostic(
      'Validation LLM approfondie',
      'validation',
      () => validerReponseLLM({
        ...configurationLLM(appSettings, modelePourAppel),
        storyId: storyCourante.meta.id,
        reponse,
        faits: ctxBase.faits,
        meta: ctxBase.meta,
      }),
      (rapportLLM) => (rapportLLM.ok
        ? ['respectée · Contradictions avec les faits établis (règle 6)']
        : rapportLLM.checks.filter((c) => !c.ok).map((c) => `ENFREINTE · [${c.nom}, ${c.gravite}] ${c.raison}`)),
    );
  } else {
    ajouterEtapeDiagnostic(
      'Validation LLM approfondie',
      'validation',
      'ignoree',
      0,
      controlesLocaux.ok
        ? 'contradictionProbable() = false'
        : 'contrôles locaux déjà en échec',
    );
  }
  const rapport = fusionnerRapports(controlesLocaux, llm);

  const strategie = determinerStrategie(rapport);
  ajouterEtapeDiagnostic(
    'Choisir stratégie de correction',
    'validation',
    strategie === 'aucune' ? 'ignoree' : 'ok',
    0,
    strategie === 'aucune' ? 'Aucune correction nécessaire.' : `Stratégie : ${strategie}`,
  );
  let aEteCorrige = strategie !== 'aucune';

  if (strategie === 'patch_local') {
    const patchee = appliquerPatchLocal(reponse, rapport);
    deltaEtat = deltaAssocieAuTexte(reponse, patchee, deltaEtat);
    reponse = patchee;
  } else if (strategie === 'repair' || strategie === 'regeneration_partielle') {
    try {
      // La réparation ciblée ne produit PAS de nouveau STATE DELTA.
      // Ne jamais conserver le delta appartenant au récit d'origine.
      const patchee = extraireEnveloppeEtat(await reparerReponse({
        ...configurationLLM(appSettings, modelePourAppel),
        storyId: storyCourante.meta.id,
        reponse,
        rapport,
        partiel: strategie === 'regeneration_partielle',
      })).texte;
      deltaEtat = deltaAssocieAuTexte(reponse, patchee, deltaEtat);
      reponse = patchee;
    } catch {
      aEteCorrige = false;
    }
  } else if (strategie === 'regeneration_complete') {
    const noteCorrection = `La tentative précédente a été rejetée pour la ou les raisons suivantes : ${rapport.checks
      .filter((c) => !c.ok)
      .map((c) => c.raison)
      .join(' ')} Corrige ces points dans ta nouvelle réponse, sans les mentionner explicitement au joueur.`;
    try {
      // La V13 gardait ici le bloc d'état de la réponse rejetée et laissait
      // celui de la nouvelle apparaître dans le récit.
      const regeneree = extraireEnveloppeEtat(await genererNarrationAvecCloture({
        ...configurationLLM(appSettings, modelePourAppel),
        storyId: storyCourante.meta.id,
        messages: construireMessages({ ...ctxNarration, noteCorrection }, { budgetSysteme: budgetPrompt, budgetConversation }),
        temperature,
        maxTokens,
        samplers,
        diagnosticLabel: 'Narration RP — régénération complète',
      }, plageNarration));
      reponse = regeneree.texte;
      deltaEtat = regeneree.delta;
    } catch {
      aEteCorrige = false;
    }
  }

  // Un seul ordre de publication : corrections déterministes, longueur,
  // validations de toutes les protections, puis stockage. Aucun patch
  // silencieux ne peut intervenir après le dernier comptage.
  const nomsPourEtiquettes = [...nomsConnus, ...ROLES_CANON.map((r) => r.nom)];
  const avantMesure = preparerNarrationPourPublication(
    reponse, canon, storyCourante.meta.personnageNom, nomsPourEtiquettes,
  );
  deltaEtat = deltaAssocieAuTexte(reponse, avantMesure.texte, deltaEtat);
  if (avantMesure.modifie) aEteCorrige = true;
  reponse = avantMesure.texte;

  const longueurFinale = await mesurerEtapeDiagnostic(
    'Longueur et clôture de la narration',
    'validation',
    () => controlerLongueurNarration({
      texte: reponse, plage: plageNarration, temperature,
      storyId: storyCourante.meta.id, samplers,
      // Contrairement à un éditeur isolé, une régénération complète repart
      // du contexte canonique et fournit son PROPRE delta machine.
      // Toute variante écrite sans delta est traitée via le repli du noyau.
      reformuler: async (_texteRejete, plage) => {
        const nouvelle = extraireEnveloppeEtat(await appellerModele({
          ...configurationLLM(appSettings, modelePourAppel),
          storyId: storyCourante.meta.id,
          messages: construireMessages({
            ...ctxNarration,
            noteCorrection: `Recommence le tour ENTIER depuis le dernier message du joueur. La précédente tentative ne doit pas être continuée. Écris entre ${plage.min} et ${plage.max} tokens de narration visible, cible ${Math.round((plage.min + plage.max) / 2)} ; termine naturellement. Ne produis aucun bloc technique.`,
          }, { budgetSysteme: budgetPrompt, budgetConversation }),
          temperature,
          maxTokens: plage.max,
          samplers,
          diagnosticLabel: 'Narration RP — nouvelle génération contrôlée',
        }, plage));
        const propre = preparerNarrationPourPublication(
          nouvelle.texte, canon, storyCourante.meta.personnageNom, nomsPourEtiquettes,
        );
        deltaEtat = propre.modifie ? null : nouvelle.delta;
        aEteCorrige = true;
        return propre.texte;
      },
    }),
  );
  reponse = longueurFinale.texte;
  ajouterEtapeDiagnostic('Contrôle final des longueurs', 'validation',
    longueurFinale.conforme ? 'ok' : 'repli', 0,
    longueurFinale.conforme
      ? `${longueurFinale.tokens} tokens exacts, fourchette ${plageNarration.min}–${plageNarration.max}`
      : 'Comptage indisponible : fourchette non certifiée, clôture vérifiée.');

  // Vérifie le texte RÉEL affiché/enregistré après TOUTES les régénérations.
  // Pas de nouvelle correction en aval : elle invaliderait le comptage et
  // le delta de la version retenue.
  const profilFinal = validerProfilContenuHeuristique(reponse, appSettings.profilContenu);
  const rapportFinal = fusionnerRapports(
    validerAgentiviteHeuristique(reponse, storyCourante.meta.personnageNom),
    validerGestesDuJoueur(reponse, messageJoueur, storyCourante.meta.personnageNom),
    validerRolesCanon(reponse, rolesVille, nomsConnus),
    verifierEntitesCanoniques(reponse, canon),
    profilFinal,
  );
  ajouterEtapeDiagnostic(
    'Contrat de publication du texte définitif', 'validation',
    rapportFinal.ok ? 'ok' : 'erreur', 0,
    rapportFinal.ok ? undefined : rapportFinal.checks.filter((c) => !c.ok).map((c) => c.raison).join(' | '),
  );
  if (!profilFinal.ok) {
    throw new ErreurProfilContenu("Réponse refusée : elle ne respecte pas le profil de contenu. Réessaie ce tour.");
  }
  exigerNarrationValide(reponse, rapportFinal);

  // Le récit a passé ses contrôles et ne sera plus modifié. L'état machine
  // est extrait par un second appel, jamais dans le quota des tokens visibles.
  deltaEtat = await mesurerEtapeDiagnostic('Extraire l’état technique séparé', 'état', () =>
    genererDeltaEtatSepare({
      narrationValidee: reponse,
      messageJoueur,
      contexteCanonique: [ctxBase.etatMonde, ctxBase.engagementsEtRelations, ctxBase.ficheScene]
        .filter(Boolean).join('\n\n'),
      storyId: storyCourante.meta.id,
    }));

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
  const debutValidationEtat = Date.now();
  const storyFinale = validerTour(
    { ...storyCourante, messages },
    { messageJoueur: messageUtilisateur, messageNarrateur: messageAssistant, delta: deltaEtat, corrige: aEteCorrige },
  );
  ajouterEtapeDiagnostic(
    'Intégrer STATE DELTA au noyau',
    'état',
    deltaEtat ? 'ok' : 'repli',
    Date.now() - debutValidationEtat,
    deltaEtat ? undefined : 'Aucun delta exploitable : repli du noyau.',
  );
  const debugMemoire = debugMemoireNarrative(evenements.length, blocs);

  return {
    story: storyFinale,
    aEteCorrige,
    debugLore: { ...debugLore, ...debugMemoire, blocsContexte: [...(debugMemoire.blocsContexte ?? []), ...diagnosticNoyau(storyFinale)] },
  };
}

export async function genererTour(
  story: StoryState,
  appSettings: AppSettings,
  messageJoueur: string,
  reponseAId?: string,
): Promise<ResultatTour> {
  commencerDiagnosticTour(undefined, story.meta.id);
  try {
    const resultat = await genererTourInterne(story, appSettings, messageJoueur, reponseAId);
    const diagnosticTour = terminerDiagnosticTour();
    if (!diagnosticTour) return resultat;

    let attache = false;
    const messages = [...resultat.story.messages].reverse().map((message) => {
      if (!attache && message.role === 'assistant') {
        attache = true;
        return { ...message, diagnosticTour };
      }
      return message;
    }).reverse();

    return {
      ...resultat,
      story: { ...resultat.story, messages },
      debugLore: { ...resultat.debugLore, diagnosticTour },
    };
  } catch (erreur) {
    annulerMesureTokens();
    annulerDiagnosticTour();
    throw erreur;
  }
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
    scene: storyCourante.scene && {
      ...storyCourante.scene,
      majMessageIndex: Math.min(storyCourante.scene.majMessageIndex, messages.length - 2),
    },
  };

  return genererTour(storySansDernierEchange, appSettings, avantDernier.content);
}
