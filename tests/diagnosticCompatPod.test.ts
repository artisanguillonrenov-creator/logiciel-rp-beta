import assert from 'node:assert/strict';
import test from 'node:test';
import { CLES_SAMPLERS, reglagesNarrateurDefaut } from '../src/concepteur/reglagesNarrateur';
import { lancerDiagnosticCompatibilitePod } from '../src/concepteur/diagnosticCompatPod';

const RACINE = 'https://exemple-8000.proxy.runpod.net';

function simulateur(reponseChat?: (requete: Record<string, unknown>) => Response) {
  const corpsEnvoyes: Record<string, unknown>[] = [];
  const requete = (async (url: string | URL | Request, options?: RequestInit) => {
    const chemin = String(url);
    if (chemin.endsWith('/health')) return Response.json({ status: 'ok' });
    if (chemin.endsWith('/v1/models')) return Response.json({ data: [{ id: 'cydonia-24b-v4.3' }] });
    if (chemin.endsWith('/props')) return Response.json({ model_path: '/models/Cydonia-Q4_K_M.gguf' });
    if (chemin.endsWith('/tokenize')) return Response.json({ tokens: [1, 2, 3, 4, 5] });
    if (chemin.endsWith('/v1/chat/completions')) {
      const corps = JSON.parse(String(options?.body)) as Record<string, unknown>;
      corpsEnvoyes.push(corps);
      return reponseChat?.(corps) ?? Response.json({ choices: [{ message: { role: 'assistant', content: 'Bonjour' } }] });
    }
    return Response.json({ error: 'Inconnu' }, { status: 404 });
  }) as typeof fetch;
  return { requete, corpsEnvoyes };
}

test('diagnostic explicite: 19 sondes et aucun changement de configuration', async () => {
  const { requete, corpsEnvoyes } = simulateur();
  const defauts = reglagesNarrateurDefaut();
  const etapes: string[] = [];
  const resultat = await lancerDiagnosticCompatibilitePod({
    requete, preparer: async () => {},
    adresse: () => RACINE + '/v1', identifiant: () => 'u0nb7hefflw2rg',
    progression: (_rapport, etape) => etapes.push(etape),
  });
  assert.equal(resultat.pod, 'u0nb7hefflw2rg');
  assert.equal(resultat.modeleAnnonce, 'cydonia-24b-v4.3');
  assert.equal(resultat.identiteBinaire, 'Cydonia-Q4_K_M.gguf');
  assert.equal(resultat.tokensTemoin, 5);
  assert.equal(resultat.generationTemoin.disponible, true);
  assert.equal(resultat.sondes.length, 19);
  assert.equal(corpsEnvoyes.length, 20);
  assert.equal(resultat.sondes.filter(s => s.etat === 'accepte').length, 19);
  assert.deepEqual(resultat.sondes.map(s => s.cle), CLES_SAMPLERS);
  assert.equal(corpsEnvoyes[0].max_tokens, 3);
  assert.equal(corpsEnvoyes[0].stream, false);
  for (let i = 0; i < CLES_SAMPLERS.length; i++) {
    const cle = CLES_SAMPLERS[i];
    assert.equal(typeof corpsEnvoyes[i + 1][cle], 'number');
    assert.equal(Object.keys(corpsEnvoyes[i + 1]).filter(k => CLES_SAMPLERS.includes(k as typeof cle)).length, 1);
  }
  assert.equal(defauts.samplersActifs, false, 'le diagnostic n’active pas les paramètres Production');
  assert.equal(resultat.interrompu, false);
  assert.ok(resultat.termineA >= resultat.commenceA);
  assert.equal(etapes.at(-1), 'Diagnostic terminé');
});

test('HTTP 422 = refus explicite ; HTTP 200 sans choix = indéterminé', async () => {
  const { requete } = simulateur(corps => {
    if ('top_k' in corps) return Response.json({ error: { message: 'top_k refusé' } }, { status: 422 });
    if ('min_p' in corps) return new Response('OK', { status: 200 });
    return Response.json({ choices: [{ message: { content: 'Oui' } }] });
  });
  const r = await lancerDiagnosticCompatibilitePod({
    requete, preparer: async () => {}, adresse: () => RACINE + '/v1',
  });
  assert.equal(r.sondes.find(s => s.cle === 'top_k')?.etat, 'rejete');
  assert.match(r.sondes.find(s => s.cle === 'top_k')?.detail ?? '', /refusé/);
  assert.equal(r.sondes.find(s => s.cle === 'min_p')?.etat, 'indetermine');
  assert.equal(r.sondes.find(s => s.cle === 'top_p')?.etat, 'accepte');
});

test('ne réalise aucune sonde si la génération témoin échoue', async () => {
  const { requete, corpsEnvoyes } = simulateur(() => Response.json({ error: 'indisponible' }, { status: 503 }));
  const r = await lancerDiagnosticCompatibilitePod({
    requete, preparer: async () => {}, adresse: () => RACINE + '/v1',
  });
  assert.equal(corpsEnvoyes.length, 1);
  assert.equal(r.generationTemoin.disponible, false);
  assert.equal(r.sondes.every(s => s.etat === 'non_teste'), true);
  assert.match(r.motifArret ?? '', /référence indisponible/);
});

test('annulation: les sondes restantes restent explicitement non testées', async () => {
  const { requete, corpsEnvoyes } = simulateur();
  const annuler = new AbortController();
  const r = await lancerDiagnosticCompatibilitePod({
    requete, preparer: async () => {}, adresse: () => RACINE + '/v1', signal: annuler.signal,
    progression: (_rapport, etape) => { if (etape === 'Résultat top_p') annuler.abort(); },
  });
  assert.equal(r.interrompu, true);
  assert.equal(r.sondes[0].etat, 'accepte');
  assert.equal(r.sondes.slice(1).every(s => s.etat === 'non_teste'), true);
  assert.equal(corpsEnvoyes.length, 2);
});
