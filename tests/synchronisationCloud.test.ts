import assert from 'node:assert/strict';
import test from 'node:test';
import {
  empreinte,
  envoyerModifications,
  SLOT_MANIFESTE,
  SLOT_PERSONAS,
  SLOT_REGLAGES,
  synchroniserInitial,
  type DepotDistant,
  type DepotLocal,
  type EntreeDistante,
} from '../src/cloud/synchronisation';
import type { HistoireStockee } from '../src/storage/storySerialization';

const histoire = (id: string, updatedAt: number, texte = 'x'): HistoireStockee => ({
  id, meta: JSON.stringify({ id, updatedAt }), etat: '{}', messages: [{ id: 'm', position: 0, contenu: JSON.stringify({ texte }) }],
});

function local(histoires: HistoireStockee[] = []) {
  const stock = new Map(histoires.map((h) => [h.id, h]));
  const kv = new Map<string, unknown>();
  const suivis = new Map<string, { valeur: unknown; updatedAt: number }>();
  const depot: DepotLocal = {
    async entetes() { return new Map([...stock.values()].map((h) => [h.id, JSON.parse(h.meta).updatedAt])); },
    async lireHistoire(id) { return stock.get(id) ?? null; },
    async ecrireHistoire(h) { stock.set(h.id, h); },
    async supprimerHistoire(id) { stock.delete(id); },
    async lireSuivi(slot) { const s = suivis.get(slot); return s ? { ...s, empreinte: empreinte(s.valeur) } : null; },
    async ecrireSuivi(slot, valeur, updatedAt) { suivis.set(slot, { valeur, updatedAt }); return true; },
    async lire(cle, defaut) { return (kv.has(cle) ? kv.get(cle) : defaut) as any; },
    async ecrire(cle, valeur) { kv.set(cle, JSON.parse(JSON.stringify(valeur))); },
  };
  return { depot, stock, suivis };
}

function distant(lignes: Record<string, any> = {}) {
  const table = new Map(Object.entries(lignes));
  const journal: string[] = [];
  const depot: DepotDistant = {
    async index(slots) {
      journal.push(`index:${slots ? slots.length : 'tout'}`);
      const r = new Map<string, EntreeDistante>();
      for (const [slot, p] of table) {
        if (slots && !slots.includes(slot)) continue;
        r.set(slot, { at: p.story ? JSON.parse(p.story.meta).updatedAt : 0, valueAt: Number(p.updatedAt || 0), deleted: p.deletedStories || null });
      }
      return r;
    },
    async charger(slots) { journal.push(`charger:${slots.join(',')}`); return slots.filter((s) => table.has(s)).map((s) => ({ slot_key: s, payload: table.get(s) })); },
    async envoyer(slot, payload) { journal.push(`envoyer:${slot}`); table.set(slot, payload); },
    async supprimer(slot) { journal.push(`supprimer:${slot}`); table.delete(slot); },
  };
  return { depot, table, journal };
}

test('synchronisation initiale : le plus récent gagne dans chaque sens', async () => {
  const l = local([histoire('a', 100), histoire('b', 300)]);
  const d = distant({ 'story:a': { version: 1, story: histoire('a', 200, 'cloud') }, 'story:b': { version: 1, story: histoire('b', 250) }, 'story:c': { version: 1, story: histoire('c', 50) } });
  assert.equal(await synchroniserInitial('u', l.depot, d.depot), true);
  assert.equal(JSON.parse(l.stock.get('a')!.messages[0].contenu).texte, 'cloud');
  assert.ok(l.stock.has('c'));
  assert.equal(JSON.parse(d.table.get('story:b').story.meta).updatedAt, 300);
});

test('une histoire supprimée sur un autre appareil disparaît ici, même sans slot distant', async () => {
  const l = local([histoire('a', 100)]);
  const d = distant({ [SLOT_MANIFESTE]: { version: 1, deletedStories: { a: 500 }, updatedAt: 500 } });
  await synchroniserInitial('u', l.depot, d.depot);
  assert.equal(l.stock.has('a'), false);
  assert.ok(!d.journal.includes('envoyer:story:a'));
});

test('premier passage d’un appareil : les réglages du compte sont récupérés', async () => {
  const l = local();
  l.suivis.set(SLOT_REGLAGES, { valeur: { langueInterface: 'fr' }, updatedAt: 999 });
  const d = distant({ [SLOT_REGLAGES]: { version: 1, value: { langueInterface: 'en' }, updatedAt: 10 } });
  await synchroniserInitial('u', l.depot, d.depot);
  assert.deepEqual(l.suivis.get(SLOT_REGLAGES)?.valeur, { langueInterface: 'en' });
});

test('envoi périodique : rien sur le réseau tant que rien ne change, puis seulement le modifié', async () => {
  const l = local([histoire('a', 100), histoire('b', 100)]);
  const d = distant();
  const garde = { baseVideSuspecte: false };
  await synchroniserInitial('u', l.depot, d.depot);
  d.journal.length = 0;
  assert.equal(await envoyerModifications('u', l.depot, d.depot, garde), false);
  assert.equal(d.journal.length, 0);
  l.stock.set('b', histoire('b', 200));
  assert.equal(await envoyerModifications('u', l.depot, d.depot, garde), true);
  assert.ok(d.journal.includes('envoyer:story:b'));
  assert.ok(!d.journal.includes('envoyer:story:a'));
});

test('suppression locale : pierre tombale, slot retiré, manifeste envoyé', async () => {
  const l = local([histoire('a', 100), histoire('b', 100)]);
  const d = distant();
  const garde = { baseVideSuspecte: false };
  await synchroniserInitial('u', l.depot, d.depot);
  l.stock.delete('a');
  await envoyerModifications('u', l.depot, d.depot, garde);
  assert.equal(d.table.has('story:a'), false);
  assert.ok(Number(d.table.get(SLOT_MANIFESTE).deletedStories.a) > 0);
});

test('base locale soudain vide : aucune suppression au premier constat', async () => {
  const l = local([histoire('a', 100), histoire('b', 100)]);
  const d = distant();
  const garde = { baseVideSuspecte: false };
  await synchroniserInitial('u', l.depot, d.depot);
  l.stock.clear();
  assert.equal(await envoyerModifications('u', l.depot, d.depot, garde), false);
  assert.ok(d.table.has('story:a'));
});

test('les personas modifiés partent, pas les réglages inchangés', async () => {
  const l = local();
  l.suivis.set(SLOT_REGLAGES, { valeur: { model: 'm' }, updatedAt: 1 });
  l.suivis.set(SLOT_PERSONAS, { valeur: [], updatedAt: 1 });
  const d = distant();
  await synchroniserInitial('u', l.depot, d.depot);
  d.journal.length = 0;
  l.suivis.set(SLOT_PERSONAS, { valeur: [{ id: 'p' }], updatedAt: 2 });
  await envoyerModifications('u', l.depot, d.depot, { baseVideSuspecte: false });
  assert.ok(d.journal.includes(`envoyer:${SLOT_PERSONAS}`));
  assert.ok(!d.journal.includes(`envoyer:${SLOT_REGLAGES}`));
});
