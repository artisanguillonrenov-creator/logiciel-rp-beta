import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import 'fake-indexeddb/auto';
import { creerNouvelleHistoire } from '../src/engine/story';
import { creerStockageSQLite } from '../src/storage/storyDatabaseSqlite';
import { creerStockageIndexedDB } from '../src/storage/storyDatabase.web';
import { creerDepotHistoires, ErreurStockage } from '../src/storage/storyRepository';
import { migrerHistoire } from '../src/storage/storyMigration';
import { differencesMessages, reconstituerHistoire, serialiserHistoire, type StockageHistoires } from '../src/storage/storySerialization';

function histoire(id = 'histoire-test', nombre = 3) {
  const h = creerNouvelleHistoire({
    personnageNom: 'William', personnageDescription: 'Voyageur', pointDeDepart: 'Paris',
    raceOrigineId: 'humains', sexe: 'Homme',
    contexte: { lieu: 'Paris', ambiance: 'Mystérieuse', dateChronique: '', objectifs: '' },
    settings: { creativite: 'moyenne', longueur: 'moyenne', ton: 'sombre_realiste', violence: 'modere', romance: 'aucun', humour: 'faible', liberteJoueur: 'elevee', rythme: 'normal' },
  });
  h.meta.id = id;
  h.messages = Array.from({ length: nombre }, (_, i) => ({ id: `m-${i}`, role: i % 2 ? 'assistant' as const : 'user' as const, content: `Message ${i}`, timestamp: i }));
  return h;
}

function ancienStockage() {
  const valeurs = new Map<string, string>();
  return {
    valeurs,
    getAllKeys: async () => [...valeurs.keys()],
    getItem: async (cle: string) => valeurs.get(cle) ?? null,
    removeItem: async (cle: string) => { valeurs.delete(cle); },
  };
}

// Même SQL que l'adaptateur Expo, exécuté contre SQLite réel. Seul le pont
// asynchrone natif est remplacé ; l'APK reste à vérifier sur appareil.
function sqlite() {
  const db = new DatabaseSync(':memory:');
  const tx = {
    getFirstAsync: async (sql: string, ...params: any[]) => db.prepare(sql).get(...params) ?? null,
    getAllAsync: async (sql: string, ...params: any[]) => db.prepare(sql).all(...params),
    runAsync: async (sql: string, ...params: any[]) => db.prepare(sql).run(...params),
  };
  const ouvrir = async () => ({
    ...tx,
    execAsync: async (sql: string) => { db.exec(sql); },
    withExclusiveTransactionAsync: async (action: (transaction: typeof tx) => Promise<void>) => {
      db.exec('BEGIN');
      try { await action(tx); db.exec('COMMIT'); }
      catch (erreur) { db.exec('ROLLBACK'); throw erreur; }
    },
  });
  return { db, stockage: creerStockageSQLite(ouvrir as unknown as Parameters<typeof creerStockageSQLite>[0]) };
}

let numeroBase = 0;
const idb = () => creerStockageIndexedDB(`test-histoires-${++numeroBase}`);

for (const [nom, creer] of [
  ['SQLite', () => sqlite().stockage],
  ['IndexedDB', idb],
] as const) {
  test(`${nom} : ajout, édition, réaction, suppression et rechargement de 1 000 messages`, async () => {
    const stockage = creer();
    const h = histoire('longue', 1000);
    await stockage.ecrire(serialiserHistoire(h));
    assert.deepEqual(reconstituerHistoire((await stockage.lire('longue'))!), h);
    h.messages[10].content = 'Réplique corrigée';
    h.messages[30].epingle = true;
    h.messages[30].reaction = '❤️';
    h.messages[31].reponseAId = h.messages[30].id;
    h.messages.splice(50, 1);
    h.messages.push({ id: 'nouveau', role: 'assistant', content: 'Suite', timestamp: 1001 });
    await stockage.ecrire(serialiserHistoire(h));
    assert.deepEqual(reconstituerHistoire((await stockage.lire('longue'))!), h);
    assert.deepEqual(await stockage.lister(), [h.meta]);
  });

  test(`${nom} : les branches partageant des IDs de message sont isolées`, async () => {
    const stockage = creer();
    const originale = histoire('originale');
    const branche = histoire('branche');
    branche.messages[0].content = 'Un autre choix';
    await stockage.ecrire(serialiserHistoire(originale));
    await stockage.ecrire(serialiserHistoire(branche));
    await stockage.supprimer('branche');
    assert.equal(await stockage.lire('branche'), null);
    assert.deepEqual(reconstituerHistoire((await stockage.lire('originale'))!), originale);
    assert.equal((await stockage.lister()).length, 1);
  });

  test(`${nom} : migration avec index absent, reprise et renommage sans changer la date`, async () => {
    const ancien = ancienStockage();
    const stockage = creer();
    const h = histoire();
    ancien.valeurs.set(`@rp_beta/story/${h.meta.id}`, JSON.stringify(h));
    const depot = creerDepotHistoires(ancien, stockage, migrerHistoire);
    assert.deepEqual(await depot.lire(h.meta.id), h);
    assert.equal(ancien.valeurs.size, 0);
    await depot.renommer(h.meta.id, '  Retour à Paris  ');
    const reprise = creerDepotHistoires(ancien, stockage, migrerHistoire);
    assert.equal((await reprise.lire(h.meta.id))?.meta.titre, 'Retour à Paris');
    assert.equal((await reprise.lire(h.meta.id))?.meta.updatedAt, h.meta.updatedAt);
  });

  test(`${nom} : deux sauvegardes simultanées ne perdent aucune histoire dans l'index`, async () => {
    const depot = creerDepotHistoires(ancienStockage(), creer(), migrerHistoire);
    await Promise.all([depot.enregistrer(histoire('a')), depot.enregistrer(histoire('b'))]);
    assert.deepEqual((await depot.lister()).map((h) => h.id).sort(), ['a', 'b']);
  });

  test(`${nom} : une ancienne copie restante ne remplace jamais une histoire déjà migrée`, async () => {
    const ancien = ancienStockage();
    const stockage = creer();
    const h = histoire();
    ancien.valeurs.set(`@rp_beta/story/${h.meta.id}`, JSON.stringify(h));
    const recente = structuredClone(h);
    recente.messages[0].content = 'État le plus récent';
    await stockage.ecrire(serialiserHistoire(recente));
    const depot = creerDepotHistoires(ancien, stockage, migrerHistoire);
    assert.deepEqual(await depot.lire(h.meta.id), recente);
    await depot.supprimer(h.meta.id);
    const reprise = creerDepotHistoires(ancien, stockage, migrerHistoire);
    assert.equal(await reprise.lire(h.meta.id), null);
  });
}

test('la migration échouée conserve la source et peut être retentée', async () => {
  const ancien = ancienStockage();
  const stockage = idb();
  const h = histoire();
  const cle = `@rp_beta/story/${h.meta.id}`;
  ancien.valeurs.set(cle, JSON.stringify(h));
  let echouer = true;
  const depot = creerDepotHistoires(ancien, {
    ...stockage,
    ecrire: async (...args) => {
      if (echouer) throw new Error('Disque plein');
      return stockage.ecrire(...args);
    },
  }, migrerHistoire);
  await assert.rejects(depot.lire(h.meta.id), ErreurStockage);
  assert.equal(ancien.valeurs.get(cle), JSON.stringify(h));
  echouer = false;
  assert.deepEqual(await depot.lire(h.meta.id), h);
  assert.equal(ancien.valeurs.has(cle), false);
});

test('sauvegarde en attente : capture immuable avant que l’UI modifie les objets', async () => {
  const depot = creerDepotHistoires(ancienStockage(), idb(), migrerHistoire);
  const h = histoire();
  const attente = depot.enregistrer(h);
  h.messages[0].content = 'Modification après appel';
  h.meta.titre = 'Après appel';
  await attente;
  const relue = await depot.lire(h.meta.id);
  assert.equal(relue?.messages[0].content, 'Message 0');
  assert.equal(relue?.meta.titre, undefined);
});

test('migration v1 complète ; schéma futur et JSON invalide préservés sans effacement', async () => {
  const v1: any = histoire();
  delete v1.version;
  delete v1.social;
  delete v1.monde;
  delete v1.directeur;
  v1.memoire.faits = [{ id: 'fait-1', contenu: 'Une promesse' }];
  const migree = migrerHistoire(v1);
  assert.equal(migree.version, 9);
  assert.equal(migree.memoire.faits[0].niveau, 'canon');
  assert.deepEqual(migree.social, { engagements: [], relations: [] });
  for (const contenu of ['{cassé', JSON.stringify({ ...histoire(), version: 999 })]) {
    const ancien = ancienStockage();
    ancien.valeurs.set('@rp_beta/story/histoire-test', contenu);
    const depot = creerDepotHistoires(ancien, idb(), migrerHistoire);
    await assert.rejects(depot.lister(), ErreurStockage);
    assert.equal(ancien.valeurs.get('@rp_beta/story/histoire-test'), contenu);
  }
});

test('les deltas excluent tous les messages inchangés', () => {
  const h = histoire();
  const avant = serialiserHistoire(h);
  h.messages.push({ id: 'm-3', role: 'assistant', content: 'Suite', timestamp: 3 });
  const apres = serialiserHistoire(h);
  assert.deepEqual(differencesMessages(avant.messages, apres.messages), { ecrire: [apres.messages[3]], supprimer: [] });
  h.messages[0].id = 'm-3';
  assert.throws(() => serialiserHistoire(h), /dupliqués/);
});

test('SQLite ne réécrit pas les messages inchangés et annule tout en cas de panne', async () => {
  const { stockage, db } = sqlite();
  const h = histoire();
  await stockage.ecrire(serialiserHistoire(h));
  db.exec("CREATE TRIGGER messages_stables BEFORE UPDATE ON messages WHEN OLD.contenu = NEW.contenu AND OLD.position = NEW.position BEGIN SELECT RAISE(ABORT, 'Réécriture inutile'); END;");
  await stockage.ecrire(serialiserHistoire(h));
  db.exec("CREATE TRIGGER panne BEFORE INSERT ON messages WHEN NEW.id = 'panne' BEGIN SELECT RAISE(ABORT, 'Disque plein'); END;");
  const modifiee = structuredClone(h);
  modifiee.meta.titre = 'Ne doit pas être validé';
  modifiee.messages.push({ id: 'panne', role: 'user', content: 'Action', timestamp: 4 });
  await assert.rejects(stockage.ecrire(serialiserHistoire(modifiee)));
  assert.deepEqual(reconstituerHistoire((await stockage.lire(h.meta.id))!), h);
  db.close();
});

test('IndexedDB attend la fin de transaction et annule métadonnées et messages ensemble', async () => {
  const stockage = idb();
  const h = histoire();
  await stockage.ecrire(serialiserHistoire(h));
  const put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
    const resultat = put.apply(this, args);
    if (this.name === 'messages') this.transaction.abort();
    return resultat;
  };
  try {
    const modifiee = structuredClone(h);
    modifiee.meta.titre = 'Ne doit pas être validé';
    modifiee.messages[0].content = 'Échange interrompu';
    await assert.rejects(stockage.ecrire(serialiserHistoire(modifiee)));
    assert.deepEqual(reconstituerHistoire((await stockage.lire(h.meta.id))!), h);
  } finally { IDBObjectStore.prototype.put = put; }
});
