import { dateMeta, type DepotDistant, type EntreeDistante } from './synchronisation';

// Client Supabase minimal (Auth + PostgREST) en fetch pur : pas de
// dépendance supplémentaire, même code sur Android, iOS et le web, et
// testable sans réseau. Couvre exactement ce que la V13 utilisait.

export interface ConfigSupabase {
  url: string;
  cle: string;
}

export interface SessionCloud {
  accessToken: string;
  refreshToken: string;
  // Date d'expiration de l'accessToken (ms).
  expireLe: number;
  utilisateur: { id: string; email?: string; nom?: string; avatar?: string };
}

export interface StockageSession {
  lire(): Promise<SessionCloud | null>;
  ecrire(session: SessionCloud | null): Promise<void>;
}

export class ErreurCloud extends Error {
  readonly statut?: number;

  constructor(message: string, statut?: number) {
    super(message);
    this.name = 'ErreurCloud';
    this.statut = statut;
  }
}

// Messages GoTrue les plus courants, traduits.
function messageAuth(brut: string, statut: number): string {
  const m = brut.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou mot de passe incorrect.';
  if (m.includes('email not confirmed')) return 'Adresse e-mail pas encore confirmée : ouvre le lien reçu par e-mail.';
  if (m.includes('user already registered')) return 'Un compte existe déjà avec cette adresse : connecte-toi.';
  if (m.includes('password should be')) return 'Mot de passe trop court (6 caractères minimum).';
  if (statut === 429) return 'Trop de tentatives : patiente une minute puis réessaie.';
  return brut || `Erreur du service de compte (${statut}).`;
}

async function lireJson(reponse: Response): Promise<any> {
  try {
    return await reponse.json();
  } catch {
    return null;
  }
}

function sessionDepuis(data: any): SessionCloud {
  const user = data?.user ?? {};
  const meta = user.user_metadata ?? {};
  return {
    accessToken: String(data.access_token),
    refreshToken: String(data.refresh_token),
    expireLe: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    utilisateur: {
      id: String(user.id),
      email: user.email ?? undefined,
      nom: meta.full_name || meta.name || undefined,
      avatar: meta.avatar_url || meta.picture || undefined,
    },
  };
}

export function creerClientCloud(config: ConfigSupabase, stockage: StockageSession, effectuerFetch: typeof fetch = (...a) => fetch(...a)) {
  let session: SessionCloud | null = null;
  let chargee = false;
  let rafraichissement: Promise<SessionCloud | null> | null = null;

  const entetesBase = { apikey: config.cle, 'Content-Type': 'application/json' };

  async function appelerAuth(chemin: string, corps: unknown, jeton?: string): Promise<any> {
    let reponse: Response;
    try {
      reponse = await effectuerFetch(`${config.url}/auth/v1/${chemin}`, {
        method: 'POST',
        headers: { ...entetesBase, ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) },
        body: JSON.stringify(corps ?? {}),
      });
    } catch {
      throw new ErreurCloud('Service de compte injoignable. Vérifie ta connexion.');
    }
    const data = await lireJson(reponse);
    if (!reponse.ok) {
      throw new ErreurCloud(messageAuth(String(data?.msg ?? data?.error_description ?? data?.message ?? ''), reponse.status), reponse.status);
    }
    return data;
  }

  async function definir(nouvelle: SessionCloud | null): Promise<void> {
    session = nouvelle;
    chargee = true;
    await stockage.ecrire(nouvelle);
  }

  async function sessionCourante(): Promise<SessionCloud | null> {
    if (!chargee) {
      session = await stockage.lire();
      chargee = true;
    }
    return session;
  }

  /** Session valide (jeton rafraîchi s'il expire dans la minute), ou null. */
  async function sessionValide(): Promise<SessionCloud | null> {
    const s = await sessionCourante();
    if (!s) return null;
    if (s.expireLe - Date.now() > 60_000) return s;
    if (!rafraichissement) {
      rafraichissement = (async () => {
        try {
          const data = await appelerAuth('token?grant_type=refresh_token', { refresh_token: s.refreshToken });
          const nouvelle = sessionDepuis(data);
          await definir(nouvelle);
          return nouvelle;
        } catch (e) {
          // Jeton révoqué ou expiré : il faut se reconnecter.
          if (e instanceof ErreurCloud && e.statut && e.statut >= 400 && e.statut < 500) await definir(null);
          throw e;
        } finally {
          rafraichissement = null;
        }
      })();
    }
    return rafraichissement;
  }

  async function rest(chemin: string, init: RequestInit = {}): Promise<Response> {
    const s = await sessionValide();
    if (!s) throw new ErreurCloud('Connecte-toi pour synchroniser.', 401);
    let reponse: Response;
    try {
      reponse = await effectuerFetch(`${config.url}/rest/v1/${chemin}`, {
        ...init,
        headers: { ...entetesBase, Authorization: `Bearer ${s.accessToken}`, ...(init.headers as Record<string, string> | undefined) },
      });
    } catch {
      throw new ErreurCloud('Cloud Elyndor injoignable. Vérifie ta connexion.');
    }
    if (!reponse.ok) {
      const data = await lireJson(reponse);
      throw new ErreurCloud(`Erreur du cloud Elyndor (${reponse.status})${data?.message ? ` : ${data.message}` : ''}`, reponse.status);
    }
    return reponse;
  }

  return {
    sessionCourante,
    sessionValide,

    async connexion(email: string, motDePasse: string): Promise<SessionCloud> {
      const s = sessionDepuis(await appelerAuth('token?grant_type=password', { email, password: motDePasse }));
      await definir(s);
      return s;
    },

    /** Renvoie la session si le projet n'exige pas de confirmer l'e-mail, sinon null. */
    async inscription(email: string, motDePasse: string, redirection?: string): Promise<SessionCloud | null> {
      const chemin = `signup${redirection ? `?redirect_to=${encodeURIComponent(redirection)}` : ''}`;
      const data = await appelerAuth(chemin, { email, password: motDePasse });
      if (!data?.access_token) return null;
      const s = sessionDepuis(data);
      await definir(s);
      return s;
    },

    /** Adresse de connexion Google (web) : Supabase revient avec les jetons dans le fragment d'URL. */
    urlConnexionGoogle(redirection: string): string {
      return `${config.url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirection)}`;
    },

    /** Termine une connexion OAuth à partir du fragment « #access_token=… ». */
    async terminerConnexionOAuth(fragment: string): Promise<SessionCloud | null> {
      const p = new URLSearchParams(fragment.replace(/^#/, ''));
      const accessToken = p.get('access_token');
      const refreshToken = p.get('refresh_token');
      if (!accessToken || !refreshToken) return null;
      let reponse: Response;
      try {
        reponse = await effectuerFetch(`${config.url}/auth/v1/user`, { headers: { ...entetesBase, Authorization: `Bearer ${accessToken}` } });
      } catch {
        throw new ErreurCloud('Service de compte injoignable. Vérifie ta connexion.');
      }
      const user = await lireJson(reponse);
      if (!reponse.ok || !user?.id) throw new ErreurCloud('Connexion Google non confirmée. Réessaie.', reponse.status);
      const s = sessionDepuis({ access_token: accessToken, refresh_token: refreshToken, expires_in: p.get('expires_in'), user });
      await definir(s);
      return s;
    },

    async deconnexion(): Promise<void> {
      const s = await sessionCourante();
      try {
        if (s) await appelerAuth('logout', {}, s.accessToken);
      } catch {
        // La session locale est effacée quoi qu'il arrive.
      } finally {
        await definir(null);
      }
    },

    async majProfil(): Promise<void> {
      const s = await sessionValide();
      if (!s) return;
      await rest('profiles?on_conflict=id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ id: s.utilisateur.id, display_name: s.utilisateur.nom || s.utilisateur.email || null, avatar_url: s.utilisateur.avatar || null, updated_at: new Date().toISOString() }),
      });
    },

    depotDistant(utilisateur: string): DepotDistant {
      return creerDepotDistant(rest, utilisateur);
    },
  };
}

export type ClientCloud = ReturnType<typeof creerClientCloud>;

const COLONNES_LEGERES = 'slot_key,updated_at,meta:payload->story->>meta,at:payload->>updatedAt,deleted:payload->deletedStories';
const PAR_REQUETE = 40;
const HISTOIRES_PAR_REQUETE = 8;

function paquets<T>(liste: T[], taille: number): T[][] {
  const resultat: T[][] = [];
  for (let i = 0; i < liste.length; i += taille) resultat.push(liste.slice(i, i + taille));
  return resultat;
}

function filtreSlots(slots: string[]): string {
  return `&slot_key=in.(${slots.map((s) => `"${s.replace(/"/g, '')}"`).map(encodeURIComponent).join(',')})`;
}

export function creerDepotDistant(rest: (chemin: string, init?: RequestInit) => Promise<Response>, utilisateur: string): DepotDistant {
  const filtreUtilisateur = `user_id=eq.${encodeURIComponent(utilisateur)}`;
  // Repli V13 : si le serveur refuse la lecture partielle du JSON, on relit
  // les lignes complètes.
  let lectureLegere = true;

  async function lignesCompletes(slots?: string[]): Promise<{ slot_key: string; payload: any }[]> {
    const resultat: { slot_key: string; payload: any }[] = [];
    for (const paquet of slots ? paquets(slots, PAR_REQUETE) : [null]) {
      const reponse = await rest(`cloud_saves?select=slot_key,payload&${filtreUtilisateur}${paquet ? filtreSlots(paquet) : ''}`);
      resultat.push(...((await reponse.json()) ?? []));
    }
    return resultat;
  }

  return {
    async index(slots) {
      const index = new Map<string, EntreeDistante>();
      if (lectureLegere) {
        try {
          for (const paquet of slots ? paquets(slots, PAR_REQUETE) : [null]) {
            const reponse = await rest(`cloud_saves?select=${COLONNES_LEGERES}&${filtreUtilisateur}${paquet ? filtreSlots(paquet) : ''}`);
            for (const r of (await reponse.json()) ?? []) {
              index.set(r.slot_key, { at: dateMeta(r.meta), valueAt: Number(r.at || 0) || 0, deleted: r.deleted || null });
            }
          }
          return index;
        } catch (e) {
          if (!(e instanceof ErreurCloud) || !e.statut || e.statut === 401) throw e;
          lectureLegere = false;
        }
      }
      for (const r of await lignesCompletes(slots)) {
        const p = r.payload || {};
        index.set(r.slot_key, { at: p.story ? dateMeta(p.story.meta) : 0, valueAt: Number(p.updatedAt || 0) || 0, deleted: p.deletedStories || null });
      }
      return index;
    },

    async charger(slots) {
      const resultat: { slot_key: string; payload: any }[] = [];
      for (const paquet of paquets(slots, HISTOIRES_PAR_REQUETE)) resultat.push(...(await lignesCompletes(paquet)));
      return resultat;
    },

    async envoyer(slot, payload) {
      await rest('cloud_saves?on_conflict=user_id,slot_key', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ user_id: utilisateur, slot_key: slot, payload, updated_at: new Date().toISOString() }),
      });
    },

    async supprimer(slot) {
      await rest(`cloud_saves?${filtreUtilisateur}&slot_key=eq.${encodeURIComponent(slot)}`, { method: 'DELETE' });
    },
  };
}
