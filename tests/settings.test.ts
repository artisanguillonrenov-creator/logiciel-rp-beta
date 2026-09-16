import assert from 'node:assert/strict';
import test from 'node:test';
import { creerDepotReglages, type ClesApi } from '../src/storage/settingsRepository';
import { stockageCles as clesWeb } from '../src/storage/apiKeysStore.web';

const defauts = { openRouterApiKey: '', model: 'modele', profilContenu: 'grand_public' as const };

function environnement() {
  let raw: string | null = null;
  let cles: ClesApi | null = null;
  let coffreIndisponible = false;
  const stockage = { getItem: async () => raw, setItem: async (_cle: string, valeur: string) => { raw = valeur; } };
  const coffre = {
    lire: async () => cles,
    ecrire: async (valeur: ClesApi) => {
      if (coffreIndisponible) throw new Error('Coffre indisponible');
      cles = structuredClone(valeur);
    },
  };
  return {
    depot: creerDepotReglages(stockage, coffre, defauts), stockage, coffre,
    ancien: (valeur: object) => { raw = JSON.stringify(valeur); },
    raw: () => raw,
    panne: (valeur: boolean) => { coffreIndisponible = valeur; },
  };
}

test('migration des trois clés hors des réglages sans changer les préférences', async () => {
  const e = environnement();
  const settings = { ...defauts, openRouterApiKey: 'cle-or', infermaticApiKey: 'cle-infermatic', embeddingsApiKey: 'cle-embeddings', moteurInference: 'infermatic', modeConcepteur: true, betaAcceptee: true };
  e.ancien(settings);
  assert.deepEqual(await e.depot.lire(), settings);
  assert.ok(!e.raw()!.includes('cle-'));
  assert.ok(!e.raw()!.includes('ApiKey'));
  const reprise = creerDepotReglages(e.stockage, e.coffre, defauts);
  assert.deepEqual(await reprise.lire(), settings);
});

test('une panne du coffre conserve la copie historique ; aucune sauvegarde en clair de secours', async () => {
  const e = environnement();
  e.ancien({ ...defauts, openRouterApiKey: 'ancienne' });
  e.panne(true);
  await assert.rejects(e.depot.lire(), /Coffre indisponible/);
  assert.ok(e.raw()!.includes('ancienne'));
  await assert.rejects(e.depot.enregistrer({ ...defauts, openRouterApiKey: 'nouvelle' }));
  assert.ok(!e.raw()!.includes('nouvelle'));
  e.panne(false);
  assert.equal((await e.depot.lire()).openRouterApiKey, 'ancienne');
});

test('une migration interrompue ne ressuscite pas une clé supprimée du coffre', async () => {
  const e = environnement();
  e.ancien({ ...defauts, openRouterApiKey: 'ancienne' });
  await e.coffre.ecrire({ openRouterApiKey: '' });
  assert.equal((await e.depot.lire()).openRouterApiKey, '');
  assert.ok(!e.raw()!.includes('ancienne'));
});

test('les clés peuvent être remplacées puis supprimées sans conserver de valeur historique', async () => {
  const e = environnement();
  await e.depot.enregistrer({ ...defauts, openRouterApiKey: 'nouvelle', infermaticApiKey: 'autre' });
  assert.equal((await e.depot.lire()).openRouterApiKey, 'nouvelle');
  await e.depot.enregistrer(defauts);
  assert.equal((await e.depot.lire()).openRouterApiKey, '');
  assert.equal((await e.depot.lire()).infermaticApiKey, undefined);
});

test('web : session par défaut, conservation durable explicite, retrait effectif au désengagement', async () => {
  function stockageMemoire() {
    const valeurs = new Map<string, string>();
    return { getItem: (cle: string) => valeurs.get(cle) ?? null, setItem: (cle: string, valeur: string) => { valeurs.set(cle, valeur); }, removeItem: (cle: string) => { valeurs.delete(cle); }, clear: () => valeurs.clear(), get length() { return valeurs.size; }, key: (index: number) => [...valeurs.keys()][index] ?? null };
  }
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: stockageMemoire() });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: stockageMemoire() });
  try {
    await clesWeb.ecrire({ openRouterApiKey: 'test' }, false);
    assert.equal(localStorage.length, 0);
    assert.equal((await clesWeb.lire())?.openRouterApiKey, 'test');
    sessionStorage.clear();
    assert.equal(await clesWeb.lire(), null);
    await clesWeb.ecrire({ openRouterApiKey: 'durable' }, true);
    assert.equal(sessionStorage.length, 0);
    assert.equal((await clesWeb.lire())?.openRouterApiKey, 'durable');
    await clesWeb.ecrire({ openRouterApiKey: 'session' }, false);
    assert.equal(localStorage.length, 0);
    sessionStorage.clear();
    assert.equal(await clesWeb.lire(), null);
  } finally {
    Reflect.deleteProperty(globalThis, 'sessionStorage');
    Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
