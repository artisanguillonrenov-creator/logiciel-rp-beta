import assert from 'node:assert/strict';
import test from 'node:test';
import { validerIdentifiantPod } from '../src/concepteur/podStore';
import { diagnostiquerPod } from '../src/concepteur/diagnosticPod';
import {
  ELYNDOR_CLOUD_POD_PAR_DEFAUT,
  assurerPodElyndorCloud, definirPodElyndorCloud,
  podElyndorCloud, originePodElyndorCloud,
  urlNarrationElyndorCloud, urlServeurImagesElyndorCloud,
} from '../src/engine/elyndorCloud';

test('atelier RunPod : seuls les identifiants, jamais les URL arbitraires, sont admis', () => {
  assert.equal(validerIdentifiantPod('  Ab12CD34ef56 '), 'ab12cd34ef56');
  for (const invalide of ['https://example.org/v1', 'x-8000.proxy.runpod.net',
    '../evil', 'abc', '!', '', '8_abcdef', 'a'.repeat(33)]) {
    assert.throws(() => validerIdentifiantPod(invalide));
  }
});

test('atelier RunPod : changement local recible les trois services sous le même pod canonique', async () => {
  assert.equal(definirPodElyndorCloud('abcd1234ef56', 'concepteur'), true);
  assert.equal(originePodElyndorCloud(), 'concepteur');
  assert.equal(podElyndorCloud(), 'abcd1234ef56');
  assert.equal(urlNarrationElyndorCloud(), 'https://abcd1234ef56-8000.proxy.runpod.net/v1');
  assert.equal(urlServeurImagesElyndorCloud(), 'https://abcd1234ef56-7860.proxy.runpod.net/v1');
  assert.equal(await assurerPodElyndorCloud(async () => { throw new Error('Pas de réseau attendu.'); }),
    'abcd1234ef56');
  definirPodElyndorCloud(ELYNDOR_CLOUD_POD_PAR_DEFAUT);
});

test('atelier RunPod : diagnostic GET uniquement sans texte généré ni secrets', async () => {
  const urls: string[] = [];
  const lecteur = (async (url: string, init?: RequestInit) => {
    urls.push(String(url));
    assert.equal(init?.method, 'GET');
    assert.equal(init?.body, undefined);
    if (String(url).endsWith('/health')) {
      return Response.json({ status: 'ok', embeddings: true, ip_adapter: false });
    }
    if (String(url).includes('-8000.')) {
      return Response.json({ data: [{ id: 'cydonia-24b' }] });
    }
    return Response.json({ data: [{ id: 'chroma1-hd' }, { id: 'bge-m3' }] });
  }) as typeof fetch;
  const r = await diagnostiquerPod('pod98765', lecteur);
  assert.deepEqual(r.services.map((x) => x.statut), ['pret', 'pret', 'pret']);
  assert.deepEqual(r.services.map((x) => x.service), ['narration', 'images', 'embeddings']);
  assert.ok(urls.every((x) => /^https:\/\/pod98765-(8000|7860)\.proxy\.runpod\.net\//.test(x)));
  assert.equal(urls.length, 3);
  assert.ok(!JSON.stringify(r).includes('apiKey'));
});

test('atelier RunPod : pod hors ligne annoncé indisponible, sans fausse réussite', async () => {
  const lecteur = (async () => new Response('bad gateway', { status: 502 })) as typeof fetch;
  const r = await diagnostiquerPod('pod98765', lecteur);
  assert.ok(r.services.every((x) => x.statut === 'indisponible'));
});
