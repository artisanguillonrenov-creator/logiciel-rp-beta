import assert from 'node:assert/strict';
import test from 'node:test';
import type { AppSettings } from '../src/types';
import {
  MODELES_NARRATION_CLOUDFLARE,
  convertirReponseCloudflare,
  construireRequeteTexteHorde,
  listerModelesNarrationHorde,
  promptNarrationHorde,
} from '../src/engine/fournisseursNarrationGratuits';
import { resoudreRouteTexte, activerReglagesFournisseurs } from '../src/engine/fournisseursRuntime';
import { appellerModele } from '../src/engine/elyndorCloudClient';
import { genererTexteHorde } from '../src/engine/fournisseursNarrationGratuits';
import { normaliserReglagesFournisseurs } from '../src/engine/elyndorCloud';

const BASE: AppSettings = { openRouterApiKey: 'cle-or', model: 'openrouter/free', moteurInference: 'openrouter',
  fournisseurNarration: 'openrouter', fournisseurImages: 'runpod', profilContenu: 'grand_public' };

test('les narrateurs existants et le fournisseur image restent intacts', () => {
  const initial = resoudreRouteTexte(BASE);
  assert.equal(initial.fournisseur, 'openrouter');
  assert.equal(initial.model, 'openrouter/free');
  const cf = resoudreRouteTexte({
    ...BASE, moteurInference: 'cloudflare', fournisseurNarration: 'cloudflare',
    modeleNarrationCloudflare: '@cf/zai-org/glm-4.7-flash', cloudflareAccountId: 'a'.repeat(32), cloudflareApiKey: 'jeton-cf',
  });
  assert.equal(cf.fournisseur, 'cloudflare');
  assert.equal(cf.model, '@cf/zai-org/glm-4.7-flash');
  assert.equal(cf.url, 'https://api.cloudflare.com/client/v4/accounts/'+'a'.repeat(32)+'/ai/run/@cf/zai-org/glm-4.7-flash');
  assert.equal(BASE.fournisseurImages, 'runpod');
  const horde = resoudreRouteTexte({
    ...BASE, moteurInference: 'aihorde', fournisseurNarration: 'aihorde',
    modeleNarrationHorde: 'exemple-actif', aiHordeApiKey: '',
  });
  assert.equal(horde.fournisseur, 'aihorde');
  assert.equal(horde.model, 'exemple-actif');
  assert.equal(horde.url, 'https://aihorde.net/api/v2/generate/text/async');
  assert.equal(horde.apiKey, '');
});

test('Cloudflare n’accepte ni modèle inconnu ni clé absente', () => {
  assert.ok(MODELES_NARRATION_CLOUDFLARE.length >= 3);
  const base = { ...BASE, moteurInference: 'cloudflare' as const, fournisseurNarration: 'cloudflare' as const,
    cloudflareAccountId: 'a'.repeat(32), cloudflareApiKey: 'jeton' };
  assert.throws(() => resoudreRouteTexte({ ...base, modeleNarrationCloudflare: '@cf/paid/hors-catalogue' }), /non autorisé/);
  assert.throws(() => resoudreRouteTexte({ ...base, cloudflareApiKey: '' }), /jeton Workers AI/);
  assert.throws(() => resoudreRouteTexte({ ...base, cloudflareAccountId: 'invalid' }), /Account ID/);
  assert.throws(() => resoudreRouteTexte({ ...BASE, moteurInference: 'aihorde', fournisseurNarration: 'aihorde' }), /modèle narratif/);
});

test('les modèles image et texte persistent indépendamment dans les réglages', () => {
  const v = normaliserReglagesFournisseurs({
    ...BASE, fournisseurImages: 'cloudflare', modeleNarrationCloudflare: '@cf/google/gemma-4-26b-a4b-it',
    modeleNarrationHorde: 'horde-texte', modeleImagesHorde: 'horde-images',
  });
  assert.equal(v.modeleNarrationCloudflare, '@cf/google/gemma-4-26b-a4b-it');
  assert.equal(v.modeleNarrationHorde, 'horde-texte');
  assert.equal(v.modeleImagesHorde, 'horde-images');
  assert.equal(v.fournisseurImages, 'cloudflare');
  assert.equal(v.model, 'openrouter/free');
});

test('les deux formats de réponse Cloudflare sont acceptés sans perdre le contenu', () => {
  assert.equal(convertirReponseCloudflare({ result: { response: 'Bonjour Elyndor' } }).choices[0].message.content, 'Bonjour Elyndor');
  assert.equal(convertirReponseCloudflare({ result: { choices: [{ message: { role: 'assistant', content: 'Scène' } }] } }).choices[0].message.content, 'Scène');
  assert.throws(() => convertirReponseCloudflare({ result: {} }), /aucune réponse/);
});

test('les rôles de conversation sont conservés dans le prompt AI Horde', () => {
  const messages = [
    { role: 'system' as const, content: 'Respecte le lorebook.' },
    { role: 'user' as const, content: 'Décris le marché.' },
    { role: 'assistant' as const, content: 'La foule approche.' },
  ];
  const texte = promptNarrationHorde(messages);
  assert.ok(texte.indexOf('### SYSTEM') < texte.indexOf('### USER'));
  assert.ok(texte.indexOf('### USER') < texte.indexOf('### ASSISTANT'));
  assert.ok(texte.includes('Respecte le lorebook.'));
  const demande = construireRequeteTexteHorde(messages, 'modele-rp', 0.7, 700);
  assert.deepEqual(demande.models, ['modele-rp']);
  assert.equal(demande.params.max_length, 700);
  assert.equal(demande.params.max_context_length, 4096);
  assert.throws(() => construireRequeteTexteHorde(messages, '', 0.7, 700), /Choisis un modèle/);
});

test('le catalogue Horde affiche uniquement les modèles texte servis par un worker', async () => {
  const lecteur = (async () => ({
    ok: true,
    json: async () => [{ name: 'horde-b', count: 2 }, { name: 'horde-a', count: 1 }, { name: 'hors-ligne', count: 0 }],
  })) as unknown as typeof fetch;
  const liste = await listerModelesNarrationHorde(lecteur);
  assert.deepEqual(liste.map(m=>m.id), ['horde-a', 'horde-b']);
});

test('le client Elyndor envoie les messages au modèle Cloudflare choisi, sans démarrer Runpod', async () => {
  const original = globalThis.fetch;
  const captured: Array<{url:string;init:RequestInit}> = [];
  const compte = 'f'.repeat(32);
  try {
    activerReglagesFournisseurs({
      ...BASE, fournisseurNarration: 'cloudflare', moteurInference: 'cloudflare',
      modeleNarrationCloudflare: '@cf/zai-org/glm-4.7-flash',
      cloudflareAccountId: compte, cloudflareApiKey: 'jeton-test',
    });
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      captured.push({url:String(url),init:init||{}});
      return new Response(JSON.stringify({ success: true, result: { response: 'Une épaisse brume enveloppe la cité.' } }),
        { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    const texte = await appellerModele({
      apiKey: '', model: '', messages: [
        {role:'system',content:'Narrateur Elyndor'},
        {role:'user',content:'Décris la ville'},
      ],
      temperature:0.6,maxTokens:200,
    });
    assert.equal(texte,'Une épaisse brume enveloppe la cité.');
    assert.equal(captured.length,1);
    assert.ok(captured[0].url.includes(`/accounts/${compte}/ai/run/@cf/zai-org/glm-4.7-flash`));
    assert.equal(captured[0].init.headers && (captured[0].init.headers as Record<string,string>).Authorization, 'Bearer jeton-test');
    const payload = JSON.parse(String(captured[0].init.body));
    assert.equal(payload.messages[0].role,'system');
    assert.equal(payload.max_tokens,200);
    assert.equal(payload.stream,false);
    assert.equal(payload.model,undefined, 'Workers AI /ai/run identifie le modèle dans l’URL');
  } finally {
    globalThis.fetch = original;
    activerReglagesFournisseurs(BASE);
  }
});

test('une demande AI Horde annulée libère sa tâche sans produire de narration', async () => {
  const appels: Array<{url:string;method?:string}> = [];
  const lecteur = (async (url: string | URL | Request, init?: RequestInit) => {
    appels.push({ url:String(url), method:init?.method });
    if (String(url).endsWith('/generate/text/async')) {
      return {ok:true,json:async()=>({id:'01234567-abcd-1234-abcd-abc00000ffff'})};
    }
    return {ok:true,json:async()=>({})};
  }) as unknown as typeof fetch;
  const controleur = new AbortController();
  controleur.abort();
  await assert.rejects(genererTexteHorde([{role:'user',content:'Une scène'}], 'modele-rp', '', 0.7, 200,
    controleur.signal, lecteur), /annulée/);
  assert.equal(appels.length,2);
  assert.equal(appels[1].method,'DELETE');
});
