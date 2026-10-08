import type { AppSettings, Message, StoryState } from '../types';
import { calculerDebugLore, calculerSelectionLore, construireCtxBase, corpusCanonHistoire, moteurAFenetreEtroite, type ResultatTour } from './generateTurn';
import {
  construireMessages,
  maxTokensPourLongueur,
  temperaturePourCreativite,
  BUDGET_SYSTEM_LOCAL,
  BUDGET_SYSTEM_DISTANT,
  RAPPEL_REGISTRE_ADULTE,
} from './promptBuilder';
import { configurationLLM } from './openrouter';
import { genererReponseComplete } from './completionReponse';
import { annulerMesureTokens, commencerMesureTokens, terminerMesureTokens } from './mesureTokens';
import { modeleOverridePourFournisseur } from './llmProvider';
import { ErreurProfilContenu, validerProfilContenuHeuristique } from './contenuAdulte';
import {
  INSTRUCTION_OUVERTURE,
  ecartsContratOuverture,
  instructionInterpellation,
  ouvertureSansInterpellation,
  requeteLoreOuverture,
} from './controleOuverture';
import { preparerTour } from './ficheScene';
import { validerGestesDuJoueur } from './controlesCoherence';
import { filtrerTextePourProfil } from './contenuAdulte';
import { verifierEntitesCanoniques } from './verificationCanon';
import {
  appliquerPatchLocal,
  reponseFaitParlerLeJoueur,
  retirerRepliqueDuJoueur,
  validerAgentiviteHeuristique,
  type RapportValidation,
} from './validator';

const MARGE_TOKENS_OUVERTURE = 300;
const MAX_TOKENS_INTERPELLATION = 300;

function raisonsEchec(rapport: RapportValidation): string[] {
  return rapport.checks.filter((c) => !c.ok).map((c) => c.raison);
}

function genererId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Moteur d'ouverture v11.5 (V13) : la scène d'ouverture suit un contrat
 * explicite (lieu ancré, situation déjà en cours, un PNJ qui interpelle le
 * joueur) avec le lore du lieu en priorité canon — la sélection est donc
 * déterministe, le lieu et ses pouvoirs d'abord. Si la première tentative
 * s'écarte du contrat, une seconde passe réécrit toute la scène avec la
 * liste des écarts ; une entité majeure inventée qui subsiste est
 * remplacée par un terme générique.
 */
export async function genererMessageOuverture(story: StoryState, appSettings: AppSettings): Promise<Message> {
  const debutMs = Date.now();
  const texteRequete = requeteLoreOuverture(story.meta);
  const selection = await calculerSelectionLore(story, texteRequete, appSettings, { aleatoire: false });
  // Fiche de scène (ville, lieu, personnages fixés par le lore) comme pour
  // un tour normal ; pas de noyau ni de bloc d'état à l'ouverture.
  const ficheScene = filtrerTextePourProfil(preparerTour(story, texteRequete).fiche, appSettings.profilContenu);
  const ctxOuverture = (instruction: string) => ({
    ...construireCtxBase(story, instruction, appSettings, selection, undefined, false),
    ficheScene,
  });
  // Profil Adulte : l'instruction d'ouverture, lue en dernier, rappelle le
  // registre ; le point de départ du scénario (prose soignée) est réécrit
  // dans ce registre au lieu d'être recopié.
  const instructionOuverture = appSettings.profilContenu === 'adulte'
    ? `${INSTRUCTION_OUVERTURE}\n\nREGISTRE : réécris la situation de départ dans le registre ci-dessous, sans recopier les phrases du scénario.${RAPPEL_REGISTRE_ADULTE}`
    : INSTRUCTION_OUVERTURE;
  const ctxBase = ctxOuverture(instructionOuverture);

  const modelePourAppel = modeleOverridePourFournisseur(
    appSettings,
    story.meta.modeleOverride,
    story.meta.modeleOverrideFournisseur,
  ) || configurationLLM(appSettings).model;
  const temperature = story.meta.temperatureOverride ?? temperaturePourCreativite(story.settings.creativite);
  // Marge : la réplique qui interpelle le joueur arrivait après la
  // description et tombait sous le plafond.
  const maxTokens = maxTokensPourLongueur(story.settings.longueur) + MARGE_TOKENS_OUVERTURE;
  const budgetSysteme = moteurAFenetreEtroite(appSettings) ? BUDGET_SYSTEM_LOCAL : BUDGET_SYSTEM_DISTANT;
  const canon = corpusCanonHistoire(story, texteRequete);
  const ecarts = (texte: string) => [...new Set([
    ...raisonsEchec(validerAgentiviteHeuristique(texte, story.meta.personnageNom)),
    ...raisonsEchec(verifierEntitesCanoniques(texte, canon)),
    ...raisonsEchec(validerProfilContenuHeuristique(texte, appSettings.profilContenu)),
    ...ecartsContratOuverture(texte, story.meta.personnageNom),
    // Ce que le scénario annonce (point de départ) reste permis.
    ...raisonsEchec(validerGestesDuJoueur(texte, story.meta.pointDeDepart ?? '', story.meta.personnageNom)),
  ])].slice(0, 6);

  commencerMesureTokens();
  // Pas de bloc d'état à l'ouverture : seule la phrase coupée est complétée.
  let contenu = await genererReponseComplete({
    ...configurationLLM(appSettings, modelePourAppel),
    storyId: story.meta.id,
    messages: construireMessages(ctxBase, { budgetSysteme }),
    temperature,
    maxTokens,
  }, undefined, false);

  const aCorriger = ecarts(contenu);
  if (aCorriger.length) {
    const correction = `\n\n[CORRECTION OBLIGATOIRE DE L'OUVERTURE]\nLa première tentative ne respecte pas entièrement le contrat d'ouverture. Réécris LA SCÈNE ENTIÈRE sans commenter la correction. Corrige précisément :\n- ${aCorriger.join('\n- ')}\nConserve le lieu, la situation, le lore canonique et le style choisis.`;
    try {
      contenu = await genererReponseComplete({
        ...configurationLLM(appSettings, modelePourAppel),
        storyId: story.meta.id,
        messages: construireMessages(ctxOuverture(instructionOuverture + correction), { budgetSysteme }),
        temperature,
        maxTokens,
      }, undefined, false);
    } catch {
      // La première version reste utilisable : mieux vaut une ouverture
      // imparfaite qu'un écran vide.
    }
  }

  // Quoi qu'il arrive, un personnage interpelle le joueur pour lancer l'histoire.
  if (ouvertureSansInterpellation(contenu, story.meta.personnageNom)) {
    try {
      const suite = await genererReponseComplete({
        ...configurationLLM(appSettings, modelePourAppel),
        storyId: story.meta.id,
        messages: construireMessages(ctxOuverture(instructionInterpellation(contenu)), { budgetSysteme }),
        temperature,
        maxTokens: MAX_TOKENS_INTERPELLATION,
      }, undefined, false);
      if (!ouvertureSansInterpellation(suite, story.meta.personnageNom)) contenu = `${contenu.trim()}\n\n${suite.trim()}`;
    } catch {
      // La scène reste utilisable sans cette suite.
    }
  }

  const canonFinal = verifierEntitesCanoniques(contenu, canon);
  if (!canonFinal.ok) contenu = appliquerPatchLocal(contenu, canonFinal);
  if (reponseFaitParlerLeJoueur(contenu, story.meta.personnageNom)) {
    contenu = retirerRepliqueDuJoueur(contenu, story.meta.personnageNom) || contenu;
  }

  // Même verrou fail-closed que genererTour (voir generateTurn.ts) : un
  // dépassement du profil GRAND_PUBLIC est un échec de génération —
  // CreateScreen.valider() dégrade déjà vers l'écran vide habituel.
  if (!validerProfilContenuHeuristique(contenu, appSettings.profilContenu).ok) {
    annulerMesureTokens();
    throw new ErreurProfilContenu("Scène d'ouverture générée hors des limites du profil Grand public.");
  }

  return {
    id: genererId(),
    role: 'assistant',
    content: contenu.trim(),
    timestamp: Date.now(),
    dureeGenerationMs: Date.now() - debutMs,
    usageTokens: terminerMesureTokens(),
  };
}


/**
 * Régénère la scène d'ouverture (bouton « Régénérer » du chat) : elle n'a pas
 * de message joueur associé, elle est donc réécrite par le moteur d'ouverture.
 */
export async function regenererOuverture(story: StoryState, appSettings: AppSettings): Promise<ResultatTour> {
  const sansOuverture: StoryState = { ...story, messages: [] };
  const ouverture = await genererMessageOuverture(sansOuverture, appSettings);
  const debugLore = await calculerDebugLore(sansOuverture, requeteLoreOuverture(story.meta), appSettings);
  return { story: { ...sansOuverture, messages: [ouverture] }, aEteCorrige: false, debugLore };
}
