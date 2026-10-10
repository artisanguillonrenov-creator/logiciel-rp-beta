import type { AppSettings } from '../types';

/**
 * Connexion unique du narrateur Elyndor.
 *
 * L'application ne laisse plus l'utilisateur choisir un fournisseur, une clé
 * API, un modèle local ou un serveur réseau. Ces valeurs sont donc définies
 * une seule fois ici afin d'éviter les divergences entre les écrans et le
 * moteur narratif.
 */
/**
 * Pod Runpod (RTX 5090) qui sert la narration (port 8000, llama.cpp +
 * Cydonia 24B Q4_K_M), les images (port 7860, Lustify SDXL et ses modules) et
 * les embeddings (port 7860, bge-m3). Installé sur un volume réseau
 * (infra/runpod/install-5090.sh) : le pod s'arrête seul après 90 min
 * d'inactivité et redémarre sans réinstallation.
 *
 * L'identifiant du pod change quand Runpod le migre sur une autre machine
 * (GPU indisponible au redémarrage). Il est donc lu au démarrage dans
 * `public/elyndor-cloud.json`, publié avec la version web sur GitHub Pages :
 * après une migration, il suffit de modifier ce fichier, sans nouvelle
 * version de l'app. La valeur intégrée sert de repli.
 */
export const ELYNDOR_CLOUD_POD_PAR_DEFAUT = 'wdnoskwvqju6r6';
export const URL_CONFIG_POD_ELYNDOR_CLOUD = 'https://artisanguillonrenov-creator.github.io/logiciel-rp-beta/elyndor-cloud.json';
const DELAI_CONFIG_POD_MS = 4000;

let podCourant = ELYNDOR_CLOUD_POD_PAR_DEFAUT;
let chargementPod: Promise<string> | null = null;
let configPodChargee = false;
let sourcePod: 'integre' | 'publie' | 'concepteur' = 'integre';
let revisionPod = 0;

/** Origine du pod réellement utilisé par les trois services. */
export function originePodElyndorCloud(): 'integre' | 'publie' | 'concepteur' { return sourcePod; }

const FORME_ID_POD = /^[a-z0-9]{8,32}$/;

export function podElyndorCloud(): string {
  return podCourant;
}

/** Fixe le pod (identifiant Runpod valide) ; renvoie false si l'identifiant est rejeté. */
export function definirPodElyndorCloud(id: string, origine: 'integre' | 'publie' | 'concepteur' = 'integre'): boolean {
  if (!FORME_ID_POD.test(id)) return false;
  revisionPod += 1;
  podCourant = id;
  sourcePod = origine;
  chargementPod = Promise.resolve(id);
  configPodChargee = true;
  return true;
}

/** Contenu attendu : {"pod": "identifiant"}. */
export function lirePodDepuisConfig(config: unknown): string | null {
  const pod = (config as { pod?: unknown } | null)?.pod;
  return typeof pod === 'string' && FORME_ID_POD.test(pod.trim()) ? pod.trim() : null;
}

/**
 * Lit une seule fois la configuration publiée ; en cas d'échec (hors ligne,
 * fichier absent ou invalide), garde le pod intégré. Ne lève jamais.
 */
/**
 * Résolution : pod local concepteur > configuration publique > valeur intégrée.
 * La lecture locale a lieu avant le réseau, y compris lors d'un lancement froid.
 * Un changement manuel en cours de lecture ne peut pas être écrasé par une réponse tardive.
 */
export function assurerPodElyndorCloud(lecteur: typeof fetch = fetch): Promise<string> {
  if (configPodChargee && chargementPod) return chargementPod;
  if (!chargementPod) {
    const revisionAuDepart = revisionPod;
    chargementPod = (async () => {
      try {
        const { lirePodConcepteur } = require('../concepteur/podStore') as typeof import('../concepteur/podStore');
        const personnalise = await lirePodConcepteur();
        if (revisionPod !== revisionAuDepart) return podCourant;
        if (personnalise && FORME_ID_POD.test(personnalise)) {
          podCourant = personnalise;
          sourcePod = 'concepteur';
          return podCourant;
        }
      } catch {
        // Stockage inaccessible : retour au pod publié.
      }
      const controleur = new AbortController();
      const minuteur = setTimeout(() => controleur.abort(), DELAI_CONFIG_POD_MS);
      try {
        const reponse = await lecteur(`${URL_CONFIG_POD_ELYNDOR_CLOUD}?t=${Date.now()}`, {
          signal: controleur.signal, cache: 'no-store',
        });
        const pod = reponse.ok ? lirePodDepuisConfig(await reponse.json()) : null;
        if (revisionPod === revisionAuDepart && pod) {
          podCourant = pod; sourcePod = 'publie';
        }
      } catch {
        // Repli non destructif sur le pod déjà connu.
      } finally { clearTimeout(minuteur); }
      return podCourant;
    })().then((pod) => {
      configPodChargee = true;
      return pod;
    });
  }
  return chargementPod;
}

/** Relecture de la configuration distante ; l'override local reste prioritaire. */
export async function rafraichirPodElyndorCloud(lecteur: typeof fetch = fetch): Promise<string> {
  revisionPod += 1;
  chargementPod = null;
  configPodChargee = false;
  return assurerPodElyndorCloud(lecteur);
}

/** Après effacement de l'override, revenir au pod publié (ou au repli intégré). */
export async function revenirAuPodPublieElyndorCloud(lecteur: typeof fetch = fetch): Promise<string> {
  revisionPod += 1;
  podCourant = ELYNDOR_CLOUD_POD_PAR_DEFAUT;
  sourcePod = 'integre';
  chargementPod = null;
  configPodChargee = false;
  return assurerPodElyndorCloud(lecteur);
}
/** Narration (llama.cpp, API OpenAI). */
export function urlNarrationElyndorCloud(): string {
  return `https://${podCourant}-8000.proxy.runpod.net/v1`;
}

/** Images et embeddings (serveur FastAPI du port 7860). */
export function urlServeurImagesElyndorCloud(): string {
  return `https://${podCourant}-7860.proxy.runpod.net/v1`;
}

/** Valeur des réglages : marqueur stable, l'adresse réelle dépend du pod courant. */
export const ELYNDOR_CLOUD_REGLAGE_URL = 'elyndor-cloud';
/** Alias exposé par llama-server (--alias). */
export const ELYNDOR_CLOUD_MODELE = 'cydonia-24b-elyndor';
/**
 * Embeddings de la recherche sémantique (ObjectBox) : bge-m3, servi par le
 * même pod que les images (port 7860). null = recherche lexicale seule.
 */
export const ELYNDOR_CLOUD_MODELE_EMBEDDINGS: string | null = 'bge-m3';

/**
 * Normalise aussi les anciennes sauvegardes. Les anciens secrets sont vidés :
 * aucune connexion OpenRouter, Infermatic, locale ou serveur local ne doit
 * pouvoir être réactivée depuis un réglage hérité.
 *
 * Le moteur `serveur` reste uniquement comme détail de compatibilité interne
 * avec le client OpenAI-compatible déjà éprouvé. Il ne correspond plus à un
 * mode sélectionnable dans l'application.
 */
export function verrouillerSurElyndorCloud(settings: AppSettings): AppSettings {
  return {
    ...settings,
    openRouterApiKey: '',
    model: ELYNDOR_CLOUD_MODELE,
    infermaticApiKey: undefined,
    infermaticModel: undefined,
    embeddingsApiKey: undefined,
    conserverClesWeb: false,
    moteurInference: 'serveur',
    serveurLocalUrl: ELYNDOR_CLOUD_REGLAGE_URL,
    serveurLocalModele: ELYNDOR_CLOUD_MODELE,
    serveurLocalApiKey: undefined,
    // Réglages hérités de l'ancien générateur d'images tiers : jamais relus.
    // Les images dépendent uniquement du pod Elyndor Cloud (elyndorCloudImages.ts).
    genererImagesActive: false,
    modeleImagesGratuit: false,
  };
}

/**
 * Vérifie la forme canonique complète, pas seulement la cible réseau. Cela
 * force la migration à effacer aussi les anciens modèles, clés de secours et
 * options OpenRouter qui pourraient encore dormir dans une installation mise
 * à jour.
 */
export function reglagesSontElyndorCloud(settings: AppSettings): boolean {
  return settings.moteurInference === 'serveur'
    && settings.model === ELYNDOR_CLOUD_MODELE
    && settings.serveurLocalUrl === ELYNDOR_CLOUD_REGLAGE_URL
    && settings.serveurLocalModele === ELYNDOR_CLOUD_MODELE
    && !settings.serveurLocalApiKey
    && !settings.openRouterApiKey
    && !settings.infermaticApiKey
    && !settings.infermaticModel
    && !settings.embeddingsApiKey
    && settings.conserverClesWeb !== true
    && settings.genererImagesActive !== true
    && settings.modeleImagesGratuit !== true;
}

/**
 * Réintroduit les fournisseurs sans restaurer de vieilles clés effacées.
 * Les anciennes installations verrouillées cloud passent en mode texte gratuit
 * pour éviter tout redémarrage facturable du pod après mise à jour.
 */
export function normaliserReglagesFournisseurs(valeur: AppSettings): AppSettings {
  const ancienCloud = !valeur.fournisseurNarration && valeur.moteurInference === 'serveur'
    && (valeur.serveurLocalUrl === ELYNDOR_CLOUD_REGLAGE_URL || !valeur.serveurLocalUrl)
    && (!valeur.serveurLocalModele || valeur.serveurLocalModele === ELYNDOR_CLOUD_MODELE);
  const mode = ancienCloud ? 'openrouter' : (valeur.moteurInference || 'openrouter');
  return {
    ...valeur,
    moteurInference: mode,
    fournisseurNarration: valeur.fournisseurNarration || (ancienCloud ? 'openrouter' : mode === 'openai' ? 'openai' : mode === 'openrouter' ? 'openrouter' : 'serveur'),
    model: ancienCloud || !valeur.model ? 'openrouter/free' : valeur.model,
    openRouterApiKey: valeur.openRouterApiKey || '',
    openAiModel: valeur.openAiModel || 'gpt-4.1-mini',
    fournisseurImages: valeur.fournisseurImages || 'desactive',
    modeleImages: valeur.modeleImages || '',
    modeleImagesOpenAI: valeur.modeleImagesOpenAI || 'gpt-image-1-mini',
    autoriserImagesPayantes: valeur.autoriserImagesPayantes === true,
    fournisseurEmbeddings: valeur.fournisseurEmbeddings || 'desactive',
  };
}
