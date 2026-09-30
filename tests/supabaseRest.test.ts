import assert from 'node:assert/strict';
import test from 'node:test';
import { creerClientCloud, ErreurCloud, type SessionCloud } from '../src/cloud/supabaseRest';

const config = { url: 'https://projet.supabase.co', cle: 'sb_publishable_test' };

function stockageMemoire(initiale: SessionCloud | null = null) {
  let s = initiale;
  return { lire: async () => s, ecrire: async (n: SessionCloud | null) => { s = n; }, valeur: () => s };
}

const jetons = (acces: string) => ({ access_token: acces, refresh_token: `r-${acces}`, expires_in: 3600, user: { id: 'u1', email: 'a@b.fr', user_metadata: { full_name: 'Ael' } } });

test('connexion par e-mail : session stockée, clé publishable envoyée', async () => {
  const stockage = stockageMemoire();
  let requete: { url: string; init?: RequestInit } | undefined;
  const client = creerClientCloud(config, stockage, async (url, init) => { requete = { url: String(url), init }; return Response.json(jetons('A')); });
  const session = await client.connexion('a@b.fr', 'secret1');
  assert.equal(requete?.url, 'https://projet.supabase.co/auth/v1/token?grant_type=password');
  assert.equal((requete?.init?.headers as Record<string, string>).apikey, 'sb_publishable_test');
  assert.equal(session.utilisateur.nom, 'Ael');
  assert.equal(stockage.valeur()?.accessToken, 'A');
});

test('identifiants refusés : message traduit', async () => {
  const client = creerClientCloud(config, stockageMemoire(), async () => Response.json({ error_description: 'Invalid login credentials' }, { status: 400 }));
  await assert.rejects(client.connexion('a@b.fr', 'mauvais'), /E-mail ou mot de passe incorrect/);
});

test('jeton expirant : rafraîchi avant la requête ; jeton révoqué : session effacée', async () => {
  const expire: SessionCloud = { accessToken: 'vieux', refreshToken: 'r', expireLe: Date.now() + 1000, utilisateur: { id: 'u1' } };
  const appels: string[] = [];
  const client = creerClientCloud(config, stockageMemoire(expire), async (url, init) => {
    appels.push(`${String(url)} ${(init?.headers as Record<string, string>)?.Authorization ?? ''}`);
    if (String(url).includes('refresh_token')) return Response.json(jetons('neuf'));
    return Response.json([]);
  });
  await client.depotDistant('u1').index(['story:a']);
  assert.match(appels[0], /grant_type=refresh_token/);
  assert.match(appels[1], /Bearer neuf$/);

  const stockage = stockageMemoire(expire);
  const revoque = creerClientCloud(config, stockage, async () => Response.json({ msg: 'Invalid Refresh Token' }, { status: 400 }));
  await assert.rejects(revoque.depotDistant('u1').index(), ErreurCloud);
  assert.equal(stockage.valeur(), null);
});

test('index léger : lecture des dates seules, slots filtrés et analysés', async () => {
  const session: SessionCloud = { accessToken: 'A', refreshToken: 'r', expireLe: Date.now() + 3_600_000, utilisateur: { id: 'u1' } };
  let url = '';
  const client = creerClientCloud(config, stockageMemoire(session), async (u) => {
    url = decodeURIComponent(String(u));
    return Response.json([
      { slot_key: 'story:a', meta: JSON.stringify({ updatedAt: 42 }), at: null, deleted: null },
      { slot_key: 'manifest:v1', meta: null, at: '7', deleted: { b: 9 } },
    ]);
  });
  const index = await client.depotDistant('u1').index(['story:a', 'manifest:v1']);
  assert.match(url, /select=slot_key,updated_at,meta:payload->story->>meta/);
  assert.match(url, /user_id=eq\.u1&slot_key=in\.\("story:a","manifest:v1"\)/);
  assert.equal(index.get('story:a')?.at, 42);
  assert.deepEqual(index.get('manifest:v1')?.deleted, { b: 9 });
});

test('envoi : upsert sur (user_id, slot_key) sans renvoyer la ligne', async () => {
  const session: SessionCloud = { accessToken: 'A', refreshToken: 'r', expireLe: Date.now() + 3_600_000, utilisateur: { id: 'u1' } };
  let requete: { url: string; init?: RequestInit } | undefined;
  const client = creerClientCloud(config, stockageMemoire(session), async (url, init) => { requete = { url: String(url), init }; return new Response(null, { status: 201 }); });
  await client.depotDistant('u1').envoyer('story:a', { version: 1 });
  assert.match(requete!.url, /cloud_saves\?on_conflict=user_id,slot_key$/);
  assert.match((requete!.init!.headers as Record<string, string>).Prefer, /merge-duplicates/);
  assert.equal(JSON.parse(String(requete!.init!.body)).slot_key, 'story:a');
});

test('retour de la connexion Google : jetons du fragment vérifiés auprès de Supabase', async () => {
  const stockage = stockageMemoire();
  const client = creerClientCloud(config, stockage, async (url) => {
    assert.match(String(url), /\/auth\/v1\/user$/);
    return Response.json({ id: 'g1', email: 'g@b.fr', user_metadata: { name: 'Gaëlle' } });
  });
  const session = await client.terminerConnexionOAuth('#access_token=AT&refresh_token=RT&expires_in=3600&token_type=bearer');
  assert.equal(session?.utilisateur.id, 'g1');
  assert.equal(stockage.valeur()?.refreshToken, 'RT');
});
