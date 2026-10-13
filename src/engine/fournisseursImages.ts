import type { AppSettings } from '../types';
import type { FormatImage } from './contratVisuel';
import {
  ErreurImagesIndisponibles,
  MAX_REFERENCES_IMAGE,
  MAX_VISAGES_POD,
  extraireImageReponse,
  genererImageElyndorCloud,
  type GenerateurImage,
  type RequeteImage,
} from './elyndorCloudImages';
import { genererImageOpenAI, tailleImageOpenAI } from './openAiImages';
import { TAILLES_PORTRAIT, TAILLES_SCENE } from '../concepteur/reglagesVisuels';

/**
 * Adaptateurs de fournisseurs d'images et leurs CAPACITÉS. Le moteur visuel
 * central ne connaît que ce contrat : il n'envoie un paramètre que si le
 * fournisseur l'accepte et explique chaque paramètre écarté. Aucun nom de
 * modèle n'influence le contenu ou le style de la requête ici.
 */

const ORIGIN = 'https://openrouter.ai/api/v1';

export interface CapacitesGenerateur {
  fournisseur: 'elyndor-cloud' | 'openai' | 'openrouter' | 'test';
  nom: string;
  /** declaree : contrat connu de l'application ; detectee : lue chez le fournisseur ; inconnue : non vérifiée. */
  source: 'declaree' | 'detectee' | 'inconnue';
  negatif: boolean;
  graine: boolean;
  pas: boolean;
  guidance: boolean;
  modules: boolean;
  poidsReference: boolean;
  references: {
    supportees: boolean;
    max: number;
    maxVisages: number;
    /** Rôles que le fournisseur distingue (vide : images transmises sans rôle). */
    roles: Array<'personnage' | 'scene' | 'race'>;
  };
  /** Tailles acceptées par format ; null : dimensions imposées par le fournisseur. */
  tailles: Record<FormatImage, readonly string[]> | null;
  /** Longueur maximale du prompt (caractères) si le fournisseur en annonce une. */
  longueurMaxPrompt?: number;
  remarques: string[];
}

export interface AdaptateurImage {
  id: CapacitesGenerateur['fournisseur'];
  nom: string;
  capacites(): Promise<CapacitesGenerateur>;
  executer: GenerateurImage;
}

export function capacitesElyndorCloud(): CapacitesGenerateur {
  return {
    fournisseur: 'elyndor-cloud',
    nom: 'Elyndor Cloud (pod)',
    source: 'declaree',
    negatif: true, graine: true, pas: true, guidance: true, modules: true, poidsReference: true,
    references: { supportees: true, max: MAX_REFERENCES_IMAGE, maxVisages: MAX_VISAGES_POD, roles: ['personnage', 'scene', 'race'] },
    tailles: { '16:9': TAILLES_SCENE, '3:4': TAILLES_PORTRAIT },
    remarques: [
      'Capacités déclarées par le protocole du serveur Elyndor ; les modules absents du pod sont ignorés par lui (disponibilité non vérifiée par l’application).',
    ],
  };
}

export function capacitesOpenAI(modele: string): CapacitesGenerateur {
  return {
    fournisseur: 'openai',
    nom: `OpenAI (${modele})`,
    source: 'declaree',
    negatif: false, graine: false, pas: false, guidance: false, modules: false, poidsReference: false,
    references: { supportees: true, max: 4, maxVisages: 4, roles: [] },
    tailles: null,
    remarques: [
      `Dimensions imposées : ${tailleImageOpenAI(modele, '16:9')} (scène), ${tailleImageOpenAI(modele, '3:4')} (portrait).`,
      'Les références sont transmises en édition d’image, sans rôle distinct.',
    ],
  };
}

/** Capacités lues dans `supported_parameters` d'OpenRouter : seul ce qui est annoncé est promis. */
export function capacitesOpenRouter(modele: string, prisEnCharge: Record<string, unknown> | string[]): CapacitesGenerateur {
  const cles = new Set(Array.isArray(prisEnCharge) ? prisEnCharge : Object.keys(prisEnCharge));
  return {
    fournisseur: 'openrouter',
    nom: `OpenRouter (${modele})`,
    source: 'detectee',
    negatif: cles.has('negative_prompt'),
    graine: cles.has('seed'),
    pas: cles.has('steps'),
    guidance: cles.has('guidance') || cles.has('guidance_scale'),
    modules: false,
    poidsReference: false,
    references: { supportees: cles.has('input_references'), max: 4, maxVisages: 4, roles: [] },
    tailles: null,
    remarques: [`Paramètres annoncés : ${[...cles].join(', ') || 'aucun'}.`],
  };
}

export async function listerModelesImagesOpenRouter(): Promise<Array<{ id: string; nom: string }>> {
  const reponse = await fetch(ORIGIN + '/images/models');
  if (!reponse.ok) throw new ErreurImagesIndisponibles('Catalogue image OpenRouter indisponible.');
  const data = await reponse.json();
  return (Array.isArray(data?.data) ? data.data : [])
    .filter((item: any) => typeof item.id === 'string')
    .map((item: any) => ({ id: item.id, nom: item.name || item.id }));
}

/** Lecture gratuite du catalogue (aucune génération). */
export async function lireParametresOpenRouter(id: string): Promise<Record<string, unknown>> {
  if (!/^[a-z0-9][\w.-]*\/[\w.:-]+$/i.test(id)) throw new Error('Identifiant de modèle invalide.');
  const reponse = await fetch(ORIGIN + '/images/models/' + id + '/endpoints');
  if (!reponse.ok) throw new ErreurImagesIndisponibles('Capacités du modèle image indisponibles.');
  const data = await reponse.json();
  const endpoint = Array.isArray(data?.endpoints) ? data.endpoints[0] : null;
  if (!endpoint) throw new ErreurImagesIndisponibles('Aucun endpoint image disponible.');
  return endpoint.supported_parameters || {};
}

/** Corps OpenRouter : uniquement les champs annoncés par le modèle. */
export function requeteOpenRouterImage(req: RequeteImage, modele: string, capacites: CapacitesGenerateur, prisEnCharge: Record<string, unknown> | string[]): Record<string, unknown> {
  const cles = new Set(Array.isArray(prisEnCharge) ? prisEnCharge : Object.keys(prisEnCharge));
  const data: Record<string, unknown> = { model: modele, prompt: req.prompt, n: 1 };
  if (cles.has('aspect_ratio')) data.aspect_ratio = req.format;
  if (capacites.graine && typeof req.seed === 'number') data.seed = req.seed;
  if (capacites.negatif && req.negatif) data.negative_prompt = req.negatif;
  if (cles.has('size') && req.size) data.size = req.size;
  if (capacites.references.supportees && req.references.length) {
    data.input_references = req.references.slice(0, capacites.references.max).map((r) => ({ type: 'image_url', image_url: { url: r.image } }));
  }
  return data;
}

/**
 * Adaptateur du fournisseur explicitement choisi. Aucune bascule silencieuse
 * vers un autre fournisseur, payant ou non, et aucun démarrage de pod.
 */
export function adaptateurSelonReglages(settings: AppSettings): AdaptateurImage {
  if (settings.fournisseurImages === 'runpod') {
    return { id: 'elyndor-cloud', nom: 'Elyndor Cloud', capacites: async () => capacitesElyndorCloud(), executer: genererImageElyndorCloud };
  }
  if (settings.fournisseurImages === 'openai') {
    if (settings.autoriserImagesPayantes !== true) throw new ErreurImagesIndisponibles('Images OpenAI bloquées : autorise explicitement la génération payante.');
    const modele = settings.modeleImagesOpenAI || 'gpt-image-1-mini';
    return { id: 'openai', nom: 'OpenAI', capacites: async () => capacitesOpenAI(modele), executer: genererImageOpenAI(settings.openAiApiKey || '', modele) };
  }
  if (settings.fournisseurImages !== 'openrouter') throw new ErreurImagesIndisponibles('Images désactivées : aucun générateur sélectionné.');
  const cle = settings.openRouterApiKey || '';
  const modele = settings.modeleImages || '';
  if (!cle || !modele) throw new ErreurImagesIndisponibles('Renseigne une clé et un modèle image OpenRouter.');
  if (settings.autoriserImagesPayantes !== true) {
    throw new ErreurImagesIndisponibles('Images OpenRouter bloquées : active volontairement les appels payants.');
  }
  let parametres: Promise<Record<string, unknown>> | null = null;
  const lire = () => (parametres ??= lireParametresOpenRouter(modele));
  return {
    id: 'openrouter',
    nom: 'OpenRouter',
    capacites: async () => capacitesOpenRouter(modele, await lire()),
    executer: async (req, signal) => {
      const prisEnCharge = await lire();
      const body = requeteOpenRouterImage(req, modele, capacitesOpenRouter(modele, prisEnCharge), prisEnCharge);
      const reponse = await fetch(ORIGIN + '/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cle },
        body: JSON.stringify(body),
        signal,
      });
      if (!reponse.ok) throw new ErreurImagesIndisponibles('Erreur image OpenRouter HTTP ' + reponse.status);
      const img = extraireImageReponse(await reponse.json());
      if (!img) throw new ErreurImagesIndisponibles('OpenRouter ne renvoie aucune image exploitable.');
      return img;
    },
  };
}
