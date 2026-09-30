import type { AppSettings, Message, StoryState } from '../types';
import { calculerSelectionLore, construireCtxBase, corpusCanonHistoire } from './generateTurn';
import {
  construireMessages,
  maxTokensPourLongueur,
  temperaturePourCreativite,
  BUDGET_SYSTEM_LOCAL,
  BUDGET_SYSTEM_DISTANT,
} from './promptBuilder';
import { configurationLLM, appellerModele } from './openrouter';
import { annulerMesureTokens, commencerMesureTokens, terminerMesureTokens } from './mesureTokens';
import { modeleOverridePourFournisseur } from './llmProvider';
import { ErreurProfilContenu, validerProfilContenuHeuristique } from './contenuAdulte';
import { INSTRUCTION_OUVERTURE, ecartsContratOuverture, requeteLoreOuverture } from './controleOuverture';
import { verifierEntitesCanoniques } from './verificationCanon';
import {
  appliquerPatchLocal,
  reponseFaitParlerLeJoueur,
  retirerRepliqueDuJoueur,
  validerAgentiviteHeuristique,
  type RapportValidation,
} from './validator';

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
  const ctxBase = construireCtxBase(story, INSTRUCTION_OUVERTURE, appSettings, selection, undefined, false);

  const modelePourAppel = modeleOverridePourFournisseur(
    appSettings,
    story.meta.modeleOverride,
    story.meta.modeleOverrideFournisseur,
  ) || configurationLLM(appSettings).model;
  const temperature = story.meta.temperatureOverride ?? temperaturePourCreativite(story.settings.creativite);
  const maxTokens = maxTokensPourLongueur(story.settings.longueur);
  const budgetSysteme = appSettings.moteurInference === 'local' || appSettings.moteurInference === 'serveur' ? BUDGET_SYSTEM_LOCAL : BUDGET_SYSTEM_DISTANT;
  const canon = corpusCanonHistoire(story, texteRequete);
  const ecarts = (texte: string) => [...new Set([
    ...raisonsEchec(validerAgentiviteHeuristique(texte, story.meta.personnageNom)),
    ...raisonsEchec(verifierEntitesCanoniques(texte, canon)),
    ...raisonsEchec(validerProfilContenuHeuristique(texte, appSettings.profilContenu)),
    ...ecartsContratOuverture(texte, story.meta.personnageNom),
  ])].slice(0, 6);

  commencerMesureTokens();
  let contenu = await appellerModele({
    ...configurationLLM(appSettings, modelePourAppel),
    messages: construireMessages(ctxBase, { budgetSysteme }),
    temperature,
    maxTokens,
  });

  const aCorriger = ecarts(contenu);
  if (aCorriger.length) {
    const correction = `\n\n[CORRECTION OBLIGATOIRE DE L'OUVERTURE]\nLa première tentative ne respecte pas entièrement le contrat d'ouverture. Réécris LA SCÈNE ENTIÈRE sans commenter la correction. Corrige précisément :\n- ${aCorriger.join('\n- ')}\nConserve le lieu, la situation, le lore canonique et le style choisis.`;
    try {
      contenu = await appellerModele({
        ...configurationLLM(appSettings, modelePourAppel),
        messages: construireMessages(construireCtxBase(story, INSTRUCTION_OUVERTURE + correction, appSettings, selection, undefined, false), { budgetSysteme }),
        temperature,
        maxTokens,
      });
    } catch {
      // La première version reste utilisable : mieux vaut une ouverture
      // imparfaite qu'un écran vide.
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
