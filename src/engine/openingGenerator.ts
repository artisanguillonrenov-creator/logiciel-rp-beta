import type { AppSettings, Message, StoryState } from '../types';
import { calculerSelectionLore, construireCtxBase } from './generateTurn';
import {
  construireMessages,
  maxTokensPourLongueur,
  temperaturePourCreativite,
  BUDGET_SYSTEM_LOCAL,
  BUDGET_SYSTEM_DISTANT,
  type ContexteConstruction,
} from './promptBuilder';
import { configurationLLM, appellerModele } from './openrouter';
import { modeleOverridePourFournisseur } from './llmProvider';
import { ErreurProfilContenu, validerProfilContenuHeuristique } from './contenuAdulte';
import {
  appliquerPatchLocal,
  reponseFaitParlerLeJoueur,
  retirerRepliqueDuJoueur,
  validerAgentiviteHeuristique,
} from './validator';
import { verifierEntitesCanoniques } from './canonGuard';
import { assurerNarrativeCoreV12, construireContexteNarratifV12 } from './narrative/narrativeCoreV12';
import { annulerMesureTokens, commencerMesureTokens, terminerMesureTokens } from './tokenUsageTelemetry';

function genererId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normaliser(texte: string): string {
  return (texte || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * La recherche d'ouverture n'est plus aléatoire : elle vise d'abord le
 * territoire et les autorités canoniques du lieu choisi, puis les éléments
 * directement utiles à la situation de départ.
 */
function construireTexteRequeteOuverture(story: StoryState): string {
  const contexte = story.meta.contexte ?? { lieu: '', ambiance: '', dateChronique: '', objectifs: '' };
  return [
    "[RECHERCHE D'OUVERTURE — PRIORITÉ CANON]",
    contexte.lieu && `Lieu exact : ${contexte.lieu}`,
    story.meta.pointDeDepart && `Situation de départ : ${story.meta.pointDeDepart}`,
    contexte.ambiance && `Ambiance : ${contexte.ambiance}`,
    contexte.objectifs && `Objectifs : ${contexte.objectifs}`,
    story.meta.personnageDescription && `Personnage joueur : ${story.meta.personnageDescription}`,
    'Priorités de recherche : territoire et pouvoir local, souverain ou autorité canonique, factions/guildes/religions applicables, règles sociales et lois du lieu, PNJ canonique directement pertinent, dangers ou tensions propres à cette situation.',
  ].filter(Boolean).join('\n');
}

const INSTRUCTION_OUVERTURE = `Tu écris LA TOUTE PREMIÈRE SCÈNE de l'histoire, avant que {{user}} n'ait dit ou fait quoi que ce soit. Cette ouverture doit immédiatement donner l'impression que le monde existait avant l'arrivée du joueur et qu'une situation est déjà en cours.

CONTRAT D'OUVERTURE OBLIGATOIRE :
1. Ancre clairement le lieu choisi et fais sentir son ambiance par quelques détails concrets et sensoriels.
2. Mets en scène la situation de départ : quelque chose se passe déjà. Évite une introduction statique ou encyclopédique.
3. Choisis le PREMIER INTERLOCUTEUR le plus pertinent pour cette situation. Si le lore fournit un PNJ canonique naturellement présent, utilise-le. Sinon, crée uniquement un personnage local mineur cohérent (garde, marchand, voyageur, employé, habitant, etc.). N'invente jamais pour cela un nouveau royaume, souverain, grande guilde, religion ou institution majeure nommée.
4. Ce personnage doit remarquer {{user}} et l'INTERPELLER directement dans cette première réponse avec au moins une vraie réplique de dialogue. Il doit avoir une raison concrète de parler : demander, avertir, provoquer, vendre, contrôler, solliciter, signaler un danger, transmettre une information ou réagir à la situation.
5. Termine à un moment où {{user}} peut répondre ou agir naturellement. Ne parle jamais, ne pense jamais et n'agis jamais à sa place.
6. Respecte strictement le lore pertinent fourni dans le contexte. En cas de doute sur une autorité, un souverain, une faction, une loi ou une institution, reste générique plutôt que d'inventer un nom.
7. Intègre le lore dans la scène sans le réciter ni l'expliquer comme une fiche.
8. Évite les ouvertures génériques (« Bienvenue, aventurier ») et n'utilise pas « Que faites-vous ? » comme unique accroche.

Le texte final doit être uniquement la scène narrative, sans titre technique, sans liste et sans explication de ces règles.`;

function verifierContratOuverture(
  texte: string,
  story: StoryState,
  requeteCanon: string,
  appSettings: AppSettings,
): string[] {
  const raisons: string[] = [];

  const agentivite = validerAgentiviteHeuristique(texte, story.meta.personnageNom);
  if (!agentivite.ok) raisons.push(...agentivite.checks.filter((c) => !c.ok).map((c) => c.raison));

  const canon = verifierEntitesCanoniques(texte, story, requeteCanon);
  if (!canon.ok) raisons.push(...canon.checks.filter((c) => !c.ok).map((c) => c.raison));

  const profil = validerProfilContenuHeuristique(texte, appSettings.profilContenu);
  if (!profil.ok) raisons.push(...profil.checks.filter((c) => !c.ok).map((c) => c.raison));

  const dialogues = texte.match(/[«“"][^»”"\n]{2,}[»”"]/g) ?? [];
  const dialoguesNormalises = normaliser(dialogues.join(' '));
  const nomJoueur = normaliser(story.meta.personnageNom);

  if (dialogues.length === 0) {
    raisons.push("Aucun personnage n'interpelle réellement le joueur : l'ouverture doit contenir au moins une réplique de dialogue d'un PNJ présent dans la scène.");
  } else if (
    !dialoguesNormalises.includes(' tu ') &&
    !dialoguesNormalises.startsWith('tu ') &&
    !dialoguesNormalises.includes(' vous ') &&
    !dialoguesNormalises.startsWith('vous ') &&
    !dialoguesNormalises.includes(' toi ') &&
    !dialoguesNormalises.includes(' votre ') &&
    !(nomJoueur && dialoguesNormalises.includes(nomJoueur))
  ) {
    raisons.push("La réplique existe mais ne semble pas s'adresser au joueur : le premier interlocuteur doit l'interpeller directement ou lui donner une raison immédiate de répondre.");
  }

  if (texte.trim().length < 180) {
    raisons.push("L'ouverture est trop courte pour installer à la fois le lieu, l'ambiance, la situation active et l'interaction initiale.");
  }
  if (/(^|[.!?]\s+)(bienvenue|salutations?)(\s+(aventurier|voyageur|étranger))?/i.test(texte)) {
    raisons.push('Évite une salutation générique de type « Bienvenue, aventurier » : commence par une scène déjà en mouvement.');
  }
  if (/(que faites-vous|qu'allez-vous faire|que vas-tu faire)\s*\??\s*$/i.test(texte.trim()) && dialogues.length === 0) {
    raisons.push("Ne termine pas par une simple question générique : crée d'abord une interaction concrète avec un personnage de la scène.");
  }

  return [...new Set(raisons)].slice(0, 6);
}

export async function genererMessageOuverture(story: StoryState, appSettings: AppSettings): Promise<Message> {
  const debutMs = Date.now();
  const storyV12 = assurerNarrativeCoreV12(story);
  const texteRequete = construireTexteRequeteOuverture(storyV12);

  // Déterministe : le lore canonique le plus pertinent doit être le même pour
  // la même situation. La variation vient ensuite du modèle, pas d'un tirage
  // aléatoire qui peut retirer le royaume ou l'autorité utile.
  const selection = await calculerSelectionLore(storyV12, texteRequete, appSettings, { aleatoire: false });
  const ctxV10 = construireCtxBase(storyV12, INSTRUCTION_OUVERTURE, appSettings, selection);
  const contexteV12 = construireContexteNarratifV12(storyV12, texteRequete);
  const ctxBase: ContexteConstruction = {
    ...ctxV10,
    contextBlocks: [ctxV10.contextBlocks, contexteV12.text].filter(Boolean).join('\n\n'),
    etatMonde: [ctxV10.etatMonde, contexteV12.worldText].filter(Boolean).join('\n\n'),
    engagementsEtRelations: [ctxV10.engagementsEtRelations, contexteV12.socialText].filter(Boolean).join('\n\n'),
    // Aucun State Delta à l'ouverture : le joueur n'a encore rien fait.
    v12Directive: undefined,
  };

  const modelePourAppel = modeleOverridePourFournisseur(
    appSettings,
    storyV12.meta.modeleOverride,
    storyV12.meta.modeleOverrideFournisseur,
  ) || configurationLLM(appSettings).model;
  const temperature = storyV12.meta.temperatureOverride ?? temperaturePourCreativite(storyV12.settings.creativite);
  const maxTokens = maxTokensPourLongueur(storyV12.settings.longueur);
  const budgetSysteme = appSettings.moteurInference === 'local' ? BUDGET_SYSTEM_LOCAL : BUDGET_SYSTEM_DISTANT;

  commencerMesureTokens();
  let contenu = await appellerModele({
    ...configurationLLM(appSettings, modelePourAppel),
    messages: construireMessages(ctxBase, { budgetSysteme }),
    temperature,
    maxTokens,
  });

  const raisons = verifierContratOuverture(contenu, storyV12, texteRequete, appSettings);
  if (raisons.length > 0) {
    const correction = `\n\n[CORRECTION OBLIGATOIRE DE L'OUVERTURE]\nLa première tentative ne respecte pas entièrement le contrat d'ouverture. Réécris LA SCÈNE ENTIÈRE sans commenter la correction. Corrige précisément :\n- ${raisons.join('\n- ')}\nConserve le lieu, la situation, le lore canonique et le style choisis.`;
    try {
      contenu = await appellerModele({
        ...configurationLLM(appSettings, modelePourAppel),
        messages: construireMessages({ ...ctxBase, messageJoueur: INSTRUCTION_OUVERTURE + correction }, { budgetSysteme }),
        temperature,
        maxTokens,
      });
    } catch {
      // La première réponse reste disponible et passe les garde-fous locaux.
    }
  }

  const canonFinal = verifierEntitesCanoniques(contenu, storyV12, texteRequete);
  if (!canonFinal.ok) contenu = appliquerPatchLocal(contenu, canonFinal);

  if (reponseFaitParlerLeJoueur(contenu, storyV12.meta.personnageNom)) {
    const nettoyee = retirerRepliqueDuJoueur(contenu, storyV12.meta.personnageNom);
    if (nettoyee) contenu = nettoyee;
  }

  if (!validerProfilContenuHeuristique(contenu, appSettings.profilContenu).ok) {
    annulerMesureTokens();
    throw new ErreurProfilContenu("Scène d'ouverture générée hors des limites du profil Grand public.");
  }

  const usageTokens = terminerMesureTokens();
  return {
    id: genererId(),
    role: 'assistant',
    content: contenu.trim(),
    timestamp: Date.now(),
    dureeGenerationMs: Date.now() - debutMs,
    usageTokens,
  };
}
