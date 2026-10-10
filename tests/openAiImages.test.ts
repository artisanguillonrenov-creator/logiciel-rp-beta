import assert from 'node:assert/strict';
import test from 'node:test';
import { genererImageSelonReglages } from '../src/engine/fournisseursImages';
import { calculerCapacites } from '../src/automation/capabilities';
import { construireCorpsImageOpenAI, estModeleImageOpenAI, listerModelesImagesOpenAI } from '../src/engine/openAiImages';
import type { RequeteImage } from '../src/engine/elyndorCloudImages';
import type { AppSettings } from '../src/types';

const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });

const base: AppSettings = {
  openRouterApiKey: '', model: 'openrouter/free',
  moteurInference: 'openrouter',
  fournisseurImages: 'openai', openAiApiKey: 'sk-test',
  modeleImagesOpenAI: 'gpt-image-1-mini', autoriserImagesPayantes: true,
};
const req: RequeteImage = { prompt: 'Une cité au crépuscule', promptCourt: 'city',
  negatif: 'flou', modules: { lora: 1 }, steps: 30, guidance: 7,
  references: [], format: '16:9', size: '1344x768', seed: 52 };

test('modèles image : catalogue authentifié, filtré, trié, sans génération', async () => {
  let calls = 0; let auth = ''; let url = '';
  globalThis.fetch = (async (input, init) => {
    calls++; url = String(input); auth = String((init?.headers as Record<string,string>)?.Authorization);
    return Response.json({ data: [
      {id: 'gpt-image-2.5-sunburst'}, {id: 'gpt-4.1-mini'}, {id:'gpt-image-1-mini'},
      {id:'dall-e-3'}, {id:'gpt-image-2'},
    ] });
  }) as typeof fetch;
  const models = await listerModelesImagesOpenAI('sk-test');
  assert.equal(calls, 1);
  assert.equal(url, 'https://api.openai.com/v1/models');
  assert.equal(auth, 'Bearer sk-test');
  assert.deepEqual(models.map(x => x.id).sort(),
    ['gpt-image-1-mini', 'gpt-image-2', 'gpt-image-2.5-sunburst'].sort());
  assert.equal(estModeleImageOpenAI('gpt-image-1.5'), true);
  assert.equal(estModeleImageOpenAI('gpt-5.1'), false);
});

test('OpenAI : tailles compatibles, pas de paramètres SDXL/LoRA ni format de réponse ancien', () => {
  const baseImage = construireCorpsImageOpenAI(req,'gpt-image-1-mini');
  assert.deepEqual(baseImage,{model:'gpt-image-1-mini',prompt:req.prompt,n:1,
    size:'1536x1024',output_format:'png',quality:'medium'});
  const moderne = construireCorpsImageOpenAI(req,'gpt-image-2.5-flare');
  assert.equal(moderne.size,'1536x864');
  assert.equal(construireCorpsImageOpenAI({...req,format:'3:4'},'gpt-image-2').size,'960x1280');
  assert.equal(construireCorpsImageOpenAI({...req,format:'3:4'},'gpt-image-1.5').size,'1024x1536');
});

test('génération image OpenAI : clé, modèle, URL, réponse PNG base64 et aucun démarrage RunPod', async () => {
  let url = ''; let body: any; let auth = '';
  globalThis.fetch = (async (input, init) => {
    url=String(input);body=JSON.parse(String(init?.body));
    auth=String((init?.headers as Record<string,string>)?.Authorization);
    return Response.json({data:[{b64_json:'aGVsbG8='}]});
  }) as typeof fetch;
  const image = await genererImageSelonReglages(base)(req);
  assert.equal(url,'https://api.openai.com/v1/images/generations');
  assert.equal(auth,'Bearer sk-test');
  assert.equal(body.model,'gpt-image-1-mini');
  assert.equal(body.prompt,req.prompt);
  assert.equal(body.negative_prompt,undefined);
  assert.equal(body.reference_images,undefined);
  assert.equal(image,'data:image/png;base64,aGVsbG8=');
});

test('génération payante interdite par défaut, y compris lorsque la clé existe', async () => {
  assert.equal(calculerCapacites({...base,autoriserImagesPayantes:false}).images,false);
  assert.equal(calculerCapacites(base).images,true);
  assert.throws(()=>genererImageSelonReglages({...base,autoriserImagesPayantes:false}),/autorise/);
  assert.throws(()=>genererImageSelonReglages({...base,openAiApiKey:''}),/Clé API OpenAI/);
  assert.throws(()=>genererImageSelonReglages({...base,modeleImagesOpenAI:'gpt-5.1'}),/modèle GPT Image/);
});

test('erreur OpenAI explicite : aucun basculement payant vers un autre modèle ou RunPod', async () => {
  let appels=0;
  globalThis.fetch=(async () => {
    appels++;
    return Response.json({error:{message:'Model is not available for this account'}},{status:403});
  }) as typeof fetch;
  await assert.rejects(genererImageSelonReglages(base)(req),/403.*not available/);
  assert.equal(appels,1);
});
