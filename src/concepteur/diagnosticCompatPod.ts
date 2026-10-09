import { assurerPodElyndorCloud, ELYNDOR_CLOUD_MODELE, podElyndorCloud, urlNarrationElyndorCloud } from '../engine/elyndorCloud';
import { CLES_SAMPLERS, SAMPLERS_LLAMA_CPP, type CleSampler } from './reglagesNarrateur';

/**
 * Diagnostic à la demande, sans changement de configuration du pod ou du narrateur.
 * HTTP 200 signifie seulement que l'API a accepté le JSON, jamais que le
 * paramètre a effectivement influencé l'échantillonnage.
 */
export type EtatSonde = 'accepte' | 'rejete' | 'indetermine' | 'non_teste';
export interface SondeSampler {
  cle: CleSampler;
  valeur: number;
  etat: EtatSonde;
  statutHttp?: number;
  detail: string;
  dureeMs?: number;
}
export interface ObservationAPI {
  disponible: boolean;
  statutHttp?: number;
  detail: string;
}
export interface RapportCompatibilitePod {
  pod: string;
  url: string;
  modeleConfigure: string;
  modeleAnnonce: string | null;
  identiteBinaire: string | null;
  sante: ObservationAPI;
  catalogue: ObservationAPI;
  tokenisation: ObservationAPI;
  tokensTemoin: number | null;
  generationTemoin: ObservationAPI;
  sondes: SondeSampler[];
  interrompu: boolean;
  motifArret: string | null;
  commenceA: number;
  termineA: number;
}

export interface OptionsDiagnosticPod {
  signal?: AbortSignal;
  progression?: (rapport: RapportCompatibilitePod, etape: string) => void;
  /** Injection pour tests isolés, sans réseau ni dépense GPU. */
  requete?: typeof fetch;
  preparer?: () => Promise<unknown>;
  adresse?: () => string;
  identifiant?: () => string;
}

const PHRASE_TEMOIN = 'Bonjour, élève ! « Élyndor » 🐉';
const MESSAGE_TEMOIN = [{ role: 'user', content: 'Réponds simplement bonjour.' }];
const COUPURE_COURTE_MS = 8000;
const COUPURE_GENERATION_MS = 25000;

function descriptionErreur(erreur: unknown): string {
  if (erreur instanceof Error && erreur.name === 'AbortError') return 'Requête interrompue ou délai dépassé.';
  return erreur instanceof Error ? erreur.message.slice(0, 160) : 'Erreur réseau.';
}

async function demander(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit,
  delaiMs: number,
  signal?: AbortSignal,
): Promise<{ statutHttp: number; ok: boolean; donnees: unknown; detail: string }> {
  if (signal?.aborted) throw new Error('Diagnostic annulé.');
  const controleur = new AbortController();
  const annuler = () => controleur.abort();
  signal?.addEventListener('abort', annuler, { once: true });
  const minuterie = setTimeout(annuler, delaiMs);
  try {
    const reponse = await fetcher(url, { ...init, signal: controleur.signal });
    // Même si le serveur répond avec du HTML (502/524), le diagnostic ne plante pas.
    const texte = await reponse.text();
    let donnees: unknown = null;
    try { donnees = JSON.parse(texte); } catch { /* HTML ou corps vide */ }
    const objet = donnees && typeof donnees === 'object' ? donnees as Record<string, any> : null;
    const message = objet?.error?.message ?? objet?.message;
    const detail = typeof message === 'string' ? message.slice(0, 160) : (reponse.ok ? 'Réponse HTTP acceptée.' : 'Erreur HTTP ' + reponse.status);
    return { statutHttp: reponse.status, ok: reponse.ok, donnees, detail };
  } finally {
    clearTimeout(minuterie);
    signal?.removeEventListener('abort', annuler);
  }
}

function observer(resultat: { statutHttp: number; ok: boolean; detail: string }): ObservationAPI {
  return { disponible: resultat.ok, statutHttp: resultat.statutHttp, detail: resultat.detail };
}

async function consulter(
  fetcher: typeof fetch, url: string, init: RequestInit, signal?: AbortSignal,
): Promise<{ observation: ObservationAPI; donnees: unknown }> {
  try {
    const retour = await demander(fetcher, url, init, COUPURE_COURTE_MS, signal);
    return { observation: observer(retour), donnees: retour.donnees };
  } catch (e) {
    return { observation: { disponible: false, detail: descriptionErreur(e) }, donnees: null };
  }
}

function valeurSonde(cle: CleSampler): number {
  // Sonde active sur les interrupteurs normalement neutres, sans valeur extrême.
  const particuliers: Partial<Record<CleSampler, number>> = {
    mirostat: 2, xtc_probability: 0.1, dynatemp_range: 0.1,
    top_p: 0.85, top_k: 30, min_p: 0.06,
  };
  return particuliers[cle] ?? SAMPLERS_LLAMA_CPP[cle].defaut;
}

function nouvelleSonde(cle: CleSampler): SondeSampler {
  return { cle, valeur: valeurSonde(cle), etat: 'non_teste', detail: 'Non testé.' };
}

function corpsSonde(champ?: CleSampler, valeur?: number): string {
  return JSON.stringify({
    model: ELYNDOR_CLOUD_MODELE,
    messages: MESSAGE_TEMOIN,
    temperature: 0.7,
    max_tokens: 3,
    stream: false,
    ...(champ ? { [champ]: valeur } : {}),
  });
}

function voir(rapport: RapportCompatibilitePod, options: OptionsDiagnosticPod, etape: string) {
  options.progression?.({
    ...rapport,
    sondes: rapport.sondes.map(s => ({ ...s })),
  }, etape);
}

/** L'utilisateur doit démarrer explicitement ce diagnostic depuis le panneau Technique. */
export async function lancerDiagnosticCompatibilitePod(options: OptionsDiagnosticPod = {}): Promise<RapportCompatibilitePod> {
  const fetcher = options.requete ?? fetch;
  const preparer = options.preparer ?? assurerPodElyndorCloud;
  const rapport: RapportCompatibilitePod = {
    pod: options.identifiant?.() ?? podElyndorCloud(),
    url: '',
    modeleConfigure: ELYNDOR_CLOUD_MODELE,
    modeleAnnonce: null,
    identiteBinaire: null,
    sante: { disponible: false, detail: 'Non testé.' },
    catalogue: { disponible: false, detail: 'Non testé.' },
    tokenisation: { disponible: false, detail: 'Non testé.' },
    tokensTemoin: null,
    generationTemoin: { disponible: false, detail: 'Non testé.' },
    sondes: CLES_SAMPLERS.map(nouvelleSonde),
    interrompu: false,
    motifArret: null,
    commenceA: Date.now(),
    termineA: 0,
  };
  try {
    if (options.signal?.aborted) throw new Error('Diagnostic annulé.');
    await preparer();
    rapport.pod = options.identifiant?.() ?? podElyndorCloud();
    const racine = (options.adresse?.() ?? urlNarrationElyndorCloud()).replace(/\/v1\/?$/, '');
    rapport.url = racine;
    voir(rapport, options, 'Vérification du serveur');
    const [sante, catalogue, props] = await Promise.all([
      consulter(fetcher, racine + '/health', { method: 'GET' }, options.signal),
      consulter(fetcher, racine + '/v1/models', { method: 'GET' }, options.signal),
      consulter(fetcher, racine + '/props', { method: 'GET' }, options.signal),
    ]);
    rapport.sante = sante.observation;
    rapport.catalogue = catalogue.observation;
    const modeles = (catalogue.donnees as { data?: Array<{ id?: unknown }> } | null)?.data;
    const annonce = Array.isArray(modeles) ? modeles[0]?.id : null;
    rapport.modeleAnnonce = typeof annonce === 'string' ? annonce : null;
    const chemin = (props.donnees as { model_path?: unknown } | null)?.model_path;
    rapport.identiteBinaire = typeof chemin === 'string' ? chemin.split(/[\\/]/).pop() ?? null : null;

    if (options.signal?.aborted) throw new Error('Diagnostic annulé.');
    voir(rapport, options, 'Test du tokenizer');
    const tok = await consulter(fetcher, racine + '/tokenize', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: PHRASE_TEMOIN, add_special: false, parse_special: false }),
    }, options.signal);
    const tokens = (tok.donnees as { tokens?: unknown } | null)?.tokens;
    if (tok.observation.disponible && Array.isArray(tokens) && tokens.length > 0 &&
      tokens.every(t => typeof t === 'number' && Number.isSafeInteger(t) && t >= 0)) {
      rapport.tokensTemoin = tokens.length;
      rapport.tokenisation = { ...tok.observation, detail: tokens.length + ' tokens exacts pour la phrase témoin.' };
    } else {
      rapport.tokenisation = { ...tok.observation, disponible: false,
        detail: tok.observation.disponible ? 'Réponse sans identifiants de tokens valides.' : tok.observation.detail };
    }

    if (options.signal?.aborted) throw new Error('Diagnostic annulé.');
    voir(rapport, options, 'Test de génération minimal');
    try {
      const base = await demander(fetcher, racine + '/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpsSonde(),
      }, COUPURE_GENERATION_MS, options.signal);
      const choix = (base.donnees as { choices?: unknown } | null)?.choices;
      rapport.generationTemoin = { disponible: base.ok && Array.isArray(choix) && choix.length > 0,
        statutHttp: base.statutHttp,
        detail: base.ok && (!Array.isArray(choix) || choix.length === 0) ?
          'HTTP 200 mais réponse sans choix de génération.' : base.detail };
    } catch (e) {
      rapport.generationTemoin = { disponible: false, detail: descriptionErreur(e) };
    }
    if (!rapport.generationTemoin.disponible) {
      rapport.motifArret = 'Génération de référence indisponible : aucune sonde sampler lancée.';
      return rapport;
    }

    for (const cle of CLES_SAMPLERS) {
      if (options.signal?.aborted) throw new Error('Diagnostic annulé.');
      voir(rapport, options, 'Sonde ' + cle);
      const debut = Date.now();
      const valeur = valeurSonde(cle);
      let sonde: SondeSampler;
      try {
        const retour = await demander(fetcher, racine + '/v1/chat/completions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corpsSonde(cle, valeur),
        }, COUPURE_GENERATION_MS, options.signal);
        const choix = (retour.donnees as { choices?: unknown } | null)?.choices;
        const accepte = retour.ok && Array.isArray(choix) && choix.length > 0;
        const rejete = retour.statutHttp === 400 || retour.statutHttp === 422;
        sonde = {
          cle, valeur, statutHttp: retour.statutHttp,
          etat: accepte ? 'accepte' : rejete ? 'rejete' : 'indetermine',
          detail: accepte ? 'HTTP accepté ; application et effet NON démontrés.' : retour.detail,
          dureeMs: Date.now() - debut,
        };
      } catch (e) {
        sonde = { cle, valeur, etat: 'indetermine', detail: descriptionErreur(e), dureeMs: Date.now() - debut };
      }
      rapport.sondes = rapport.sondes.map(s => s.cle === cle ? sonde : s);
      voir(rapport, options, 'Résultat ' + cle);
    }
    return rapport;
  } catch (erreur) {
    rapport.interrompu = true;
    rapport.motifArret = descriptionErreur(erreur);
    return rapport;
  } finally {
    rapport.termineA = Date.now();
    voir(rapport, options, rapport.interrompu ? 'Diagnostic interrompu' : 'Diagnostic terminé');
  }
}
