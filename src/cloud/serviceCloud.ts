import { AppState, Platform } from 'react-native';
import { CONFIG_CLOUD } from './configCloud';
import { depotLocal } from './depotLocal';
import { stockageSession } from './sessionStore';
import { creerClientCloud, ErreurCloud, type SessionCloud } from './supabaseRest';
import { envoyerModifications, synchroniserInitial, type EtatDetectionSuppressions } from './synchronisation';

// Service de compte et de synchronisation (V13) : connexion, synchronisation
// complète à l'ouverture et à la connexion, puis vérification locale toutes
// les 15 s — aucun appel réseau tant que rien n'a changé — et envoi quand
// l'application passe en arrière-plan.

export interface EtatCloud {
  pret: boolean;
  utilisateur: SessionCloud['utilisateur'] | null;
  statut: 'inactif' | 'synchronisation' | 'a_jour' | 'erreur';
  derniereSynchro?: number;
  erreur?: string;
  // Incrémentée quand des données locales ont été remplacées par le cloud :
  // les écrans qui listent les histoires se rechargent.
  revision: number;
}

const INTERVALLE_MS = 15_000;

const client = creerClientCloud(CONFIG_CLOUD, stockageSession);
let etat: EtatCloud = { pret: false, utilisateur: null, statut: 'inactif', revision: 0 };
const auditeurs = new Set<(e: EtatCloud) => void>();
let minuteur: ReturnType<typeof setInterval> | null = null;
let utilisateurActif: string | null = null;
let occupe = false;
let demarrage: Promise<void> | null = null;
const garde: EtatDetectionSuppressions = { baseVideSuspecte: false };

function publier(maj: Partial<EtatCloud>): void {
  etat = { ...etat, ...maj };
  for (const a of auditeurs) {
    try {
      a(etat);
    } catch {
      // Un écran défaillant ne bloque pas les autres.
    }
  }
}

export function lireEtatCloud(): EtatCloud {
  return etat;
}

export function abonnerCloud(auditeur: (e: EtatCloud) => void): () => void {
  auditeurs.add(auditeur);
  auditeur(etat);
  return () => {
    auditeurs.delete(auditeur);
  };
}

function messageErreur(e: unknown): string {
  return e instanceof Error ? e.message : 'Synchronisation impossible pour le moment.';
}

async function executer(action: (utilisateur: string) => Promise<boolean>): Promise<void> {
  const utilisateur = utilisateurActif;
  if (!utilisateur || occupe) return;
  occupe = true;
  try {
    const change = await action(utilisateur);
    publier({ statut: 'a_jour', derniereSynchro: Date.now(), erreur: undefined, ...(change ? { revision: etat.revision + 1 } : {}) });
  } catch (e) {
    publier({ statut: 'erreur', erreur: messageErreur(e) });
    if (e instanceof ErreurCloud && e.statut === 401 && !(await client.sessionCourante())) arreter(null);
  } finally {
    occupe = false;
  }
}

function envoyerEnAttente(): Promise<void> {
  return executer((u) => envoyerModifications(u, depotLocal, client.depotDistant(u), garde));
}

let abonnementAppState: { remove(): void } | null = null;

function arreter(utilisateur: SessionCloud['utilisateur'] | null): void {
  if (minuteur) clearInterval(minuteur);
  minuteur = null;
  abonnementAppState?.remove();
  abonnementAppState = null;
  utilisateurActif = null;
  publier({ utilisateur, statut: 'inactif' });
}

async function lancer(session: SessionCloud): Promise<void> {
  if (utilisateurActif === session.utilisateur.id) return;
  utilisateurActif = session.utilisateur.id;
  publier({ utilisateur: session.utilisateur, statut: 'synchronisation', erreur: undefined });
  client.majProfil().catch(() => {});
  await executer((u) => synchroniserInitial(u, depotLocal, client.depotDistant(u)));
  if (utilisateurActif !== session.utilisateur.id) return;
  if (minuteur) clearInterval(minuteur);
  minuteur = setInterval(() => void envoyerEnAttente(), INTERVALLE_MS);
  abonnementAppState?.remove();
  abonnementAppState = AppState.addEventListener('change', (statut) => {
    if (statut !== 'active') void envoyerEnAttente();
  });
}

/** À appeler une fois au démarrage de l'application. */
export function demarrerCloud(): Promise<void> {
  if (!demarrage) {
    demarrage = (async () => {
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hash.includes('access_token=')) {
          // Retour de la connexion Google : les jetons arrivent dans le fragment.
          const fragment = window.location.hash;
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          await client.terminerConnexionOAuth(fragment);
        }
        const session = await client.sessionValide().catch(() => client.sessionCourante());
        publier({ pret: true });
        if (session) await lancer(session);
      } catch (e) {
        publier({ pret: true, statut: 'erreur', erreur: messageErreur(e) });
      }
    })();
  }
  return demarrage;
}

export async function connexionCloud(email: string, motDePasse: string): Promise<void> {
  await lancer(await client.connexion(email.trim(), motDePasse));
}

/** Vrai si le compte est prêt ; faux s'il faut d'abord confirmer l'adresse e-mail. */
export async function inscriptionCloud(email: string, motDePasse: string): Promise<boolean> {
  const redirection = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin + window.location.pathname : undefined;
  const session = await client.inscription(email.trim(), motDePasse, redirection);
  if (!session) return false;
  await lancer(session);
  return true;
}

export const connexionGoogleDisponible = Platform.OS === 'web';

export function connexionGoogleCloud(): void {
  if (typeof window === 'undefined') return;
  window.location.assign(client.urlConnexionGoogle(window.location.origin + window.location.pathname));
}

export async function deconnexionCloud(): Promise<void> {
  await envoyerEnAttente().catch(() => {});
  await client.deconnexion();
  arreter(null);
}

export async function synchroniserMaintenant(): Promise<void> {
  if (!utilisateurActif) return;
  publier({ statut: 'synchronisation' });
  // Synchronisation complète : récupère aussi ce qui a changé ailleurs.
  await executer((u) => synchroniserInitial(u, depotLocal, client.depotDistant(u)));
}
