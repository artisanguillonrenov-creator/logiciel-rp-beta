import assert from 'node:assert/strict';
import test from 'node:test';
import type { AppSettings } from '../src/types';
import type { RequeteImage } from '../src/engine/elyndorCloudImages';
import { dimensionsCloudflare, MODELE_CLOUDFLARE } from '../src/engine/cloudflareImages';
import { corpsRequeteHorde } from '../src/engine/aiHordeImages';
import { adaptateurSelonReglages, capacitesCloudflare, capacitesHorde } from '../src/engine/fournisseursImages';
import { creerDepotReglages } from '../src/storage/settingsRepository';

const REQUETE: RequeteImage = {
  prompt: 'Marché médiéval, une elfe noire devant une halle',
  negatif: 'neon signs',
  references: [{ role: 'personnage', image: 'data:image/png;base64,AA==' }],
  format: '16:9',
  size: '1344x768',
  seed: 42,
  guidance: 5,
  steps: 24,
};
const BASE: AppSettings = { openRouterApiKey: 'test-texte', model: 'openrouter/free', profilContenu: 'grand_public' };

test('Cloudflare: endpoint fixe, dimensions validées et quatre références au plus', () => {
  assert.equal(MODELE_CLOUDFLARE, '@cf/black-forest-labs/flux-2-klein-4b');
  assert.deepEqual(dimensionsCloudflare(REQUETE), { width: 1344, height: 768 });
  assert.throws(() => dimensionsCloudflare({ ...REQUETE, size: '9999x5' }), /Dimensions incompatibles/);
  const caps = capacitesCloudflare();
  assert.equal(caps.references.max, 4);
  assert.equal(caps.pas, false);
  assert.equal(caps.negatif, false);
});

test('AI Horde: paramètres communautaires, contrôle du contenu, aucun envoi de références', () => {
  const anonyme = corpsRequeteHorde(REQUETE, false, '', true);
  assert.equal(anonyme.nsfw, false);
  assert.equal(anonyme.censor_nsfw, true);
  assert.equal(anonyme.shared, true);
  assert.equal(anonyme.params.width, 768);
  assert.equal(anonyme.params.height, 448);
  assert.ok(anonyme.prompt.includes(' ### neon signs'));
  assert.equal('source_image' in anonyme, false);
  const perso = corpsRequeteHorde(REQUETE, true, 'un-modele', false);
  assert.equal(perso.nsfw, true);
  assert.equal(perso.shared, false);
  assert.deepEqual(perso.models, ['un-modele']);
  assert.equal(capacitesHorde().references.supportees, false);
});

test('Le narrateur OpenRouter reste indépendant du fournisseur image choisi', () => {
  const cf = adaptateurSelonReglages({ ...BASE, fournisseurImages: 'cloudflare', cloudflareAccountId: 'a'.repeat(32), cloudflareApiKey: 'test-cf' });
  assert.equal(cf.id, 'cloudflare');
  const horde = adaptateurSelonReglages({ ...BASE, fournisseurImages: 'aihorde' });
  assert.equal(horde.id, 'aihorde');
  assert.throws(() => adaptateurSelonReglages({ ...BASE, fournisseurImages: 'cloudflare' }), /Account ID/);
  assert.equal(BASE.model, 'openrouter/free');
});

test('Cloudflare et AI Horde: clés sorties des réglages publics et préservées par le coffre', async () => {
  const publics = new Map<string,string>();
  let secrets: any = null;
  const depot = creerDepotReglages({
    getItem: async (k) => publics.get(k) ?? null,
    setItem: async (k,v) => { publics.set(k,v); },
  }, {
    lire: async () => secrets,
    ecrire: async (cles) => { secrets = { ...cles }; },
  }, BASE);
  await depot.enregistrer({ ...BASE, fournisseurImages: 'cloudflare', cloudflareAccountId: 'a'.repeat(32), cloudflareApiKey: 'SECRET-CF', aiHordeApiKey: 'SECRET-HORDE' });
  const raw = [...publics.values()].join(' ');
  assert.ok(!raw.includes('SECRET-CF'));
  assert.ok(!raw.includes('SECRET-HORDE'));
  assert.equal(secrets.cloudflareApiKey, 'SECRET-CF');
  assert.equal(secrets.aiHordeApiKey, 'SECRET-HORDE');
  const relu = await depot.lire();
  assert.equal(relu.cloudflareApiKey, 'SECRET-CF');
  assert.equal(relu.aiHordeApiKey, 'SECRET-HORDE');
});
