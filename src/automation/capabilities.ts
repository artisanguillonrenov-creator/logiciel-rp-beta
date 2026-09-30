import type { AppSettings, MoteurInference } from '../types';

export interface AutomationEnvironment {
  plateforme: 'web' | 'native';
  modeleLocalPresent?: boolean;
}

export interface AppCapabilities {
  fournisseur: MoteurInference;
  narration: boolean;
  embeddings: boolean;
  images: boolean;
  avatars: boolean;
  traduction: boolean;
  inferenceLocale: boolean;
  contenuAdulte: boolean;
  concepteur: boolean;
  raisons: Partial<Record<'narration' | 'embeddings' | 'images' | 'traduction' | 'inferenceLocale', string>>;
}

function nonVide(valeur: string | undefined): boolean {
  return !!valeur?.trim();
}

/**
 * Résout les capacités réelles de l'application à partir des réglages.
 * L'interface et les routines peuvent donc prendre la même décision au lieu
 * de réimplémenter chacune leurs propres conditions.
 */
export function calculerCapacites(
  settings: AppSettings,
  env: AutomationEnvironment = { plateforme: 'native' },
): AppCapabilities {
  const fournisseur = settings.moteurInference ?? 'openrouter';
  const cleOpenRouter = nonVide(settings.openRouterApiKey);
  const cleInfermatic = nonVide(settings.infermaticApiKey);
  const modeleOpenRouter = nonVide(settings.model);
  const modeleInfermatic = nonVide(settings.infermaticModel);
  const modeleLocalPresent = env.plateforme === 'native' && env.modeleLocalPresent === true;

  const narration = fournisseur === 'local'
    ? modeleLocalPresent
    : fournisseur === 'infermatic'
      ? cleInfermatic && modeleInfermatic
      : cleOpenRouter && modeleOpenRouter;

  // Le pipeline embeddings sait utiliser Infermatic quand il est le
  // fournisseur actif, OpenRouter sinon, ou la clé embeddings de secours.
  const embeddings = nonVide(settings.embeddingsApiKey)
    || (fournisseur === 'infermatic' ? cleInfermatic : cleOpenRouter);

  const fournisseurImages = settings.fournisseurImages ?? (fournisseur === 'chatgpt' ? 'chatgpt' : 'openrouter');
  // ChatGPT Images réutilise la session Codex déjà connectée ; OpenRouter garde
  // son comportement historique avec clé API. La validité de la session
  // ChatGPT est vérifiée au moment de l'appel réseau.
  const images = settings.genererImagesActive === true && (fournisseurImages === 'chatgpt' || cleOpenRouter);
  const langue = settings.langueInterface?.trim().toLowerCase() || 'fr';
  const traduction = langue === 'fr' || narration;

  const raisons: AppCapabilities['raisons'] = {};
  if (!narration) {
    raisons.narration = fournisseur === 'local'
      ? 'Aucun modèle local prêt sur cet appareil.'
      : fournisseur === 'infermatic'
        ? 'Clé ou modèle Infermatic manquant.'
        : 'Clé ou modèle OpenRouter manquant.';
  }
  if (!embeddings) raisons.embeddings = 'Aucun fournisseur d’embeddings disponible.';
  if (!images) raisons.images = settings.genererImagesActive
    ? (fournisseurImages === 'chatgpt' ? 'Connecte ChatGPT dans Réglages.' : 'La génération d’images nécessite une clé OpenRouter.')
    : 'La génération d’images est désactivée.';
  if (!traduction) raisons.traduction = 'La langue active nécessite un narrateur disponible pour traduire.';
  if (fournisseur === 'local' && !modeleLocalPresent) raisons.inferenceLocale = 'Modèle local absent ou plateforme web.';

  return {
    fournisseur,
    narration,
    embeddings,
    images,
    avatars: images,
    traduction,
    inferenceLocale: modeleLocalPresent,
    contenuAdulte: settings.profilContenu === 'adulte',
    concepteur: settings.modeConcepteur === true,
    raisons,
  };
}
