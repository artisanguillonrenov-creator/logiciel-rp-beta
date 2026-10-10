import assert from 'node:assert/strict';
import test from 'node:test';
import { finDeNarrationComplete, controlerLongueurNarration, compterTokensNarration } from '../src/engine/controleLongueurNarration';
import {
  deltaAssocieAuTexte, exigerNarrationValide, preparerNarrationPourPublication,
} from '../src/engine/controlePublicationNarration';
import { rapportOk } from '../src/engine/validator';

test('une réplique close par » est une vraie fin, même sans point final', () => {
  assert.equal(finDeNarrationComplete('SYLVANA : « Approche »'), true);
  assert.equal(finDeNarrationComplete('SYLVANA : « Approche'), false);
  assert.equal(finDeNarrationComplete('SYLVANA : « Approche.'), false);
  assert.equal(finDeNarrationComplete('Elle tend la'), false);
  assert.equal(finDeNarrationComplete('Elle tend la main.'), true);
});

test('normalisation AVANT comptage : le joueur ne parle plus et la variante change', () => {
  const initial = 'WILLIAM : « Je signe le contrat. »\n\nSYLVANA : « Non, attends. »';
  const propre = preparerNarrationPourPublication(initial, '', 'WILLIAM', ['SYLVANA', 'WILLIAM']);
  assert.equal(propre.modifie, true);
  assert.equal(propre.texte, 'SYLVANA : « Non, attends. »');
  assert.equal(propre.texte.includes('Je signe'), false);
});

test('delta machine invalidé dès que le texte associé est modifié', () => {
  const ancienDelta = { events: [{ summary: 'Le personnage signe un contrat.' }] };
  assert.equal(deltaAssocieAuTexte('Même scène.', 'Même scène.', ancienDelta), ancienDelta);
  assert.equal(deltaAssocieAuTexte('Il signe.', 'Il refuse.', ancienDelta), null);
});

test('aucun texte technique, vide ou rejeté ne peut être publié', () => {
  assert.doesNotThrow(() => exigerNarrationValide('Le cheval arrive.', rapportOk()));
  assert.throws(() => exigerNarrationValide(' ', rapportOk()), /vide/);
  assert.throws(() => exigerNarrationValide('Bonjour <<<ELYNDOR_STATE_V12>>>', rapportOk()), /Marqueur technique/);
  assert.throws(() => exigerNarrationValide('Il signe.', {
    ok: false,
    checks: [{ nom: 'contrat_joueur', ok: false, gravite: 'grave', raison: 'Action forcée.' }],
  }), /Action forcée/);
});

test('le compteur reçoit exactement la version préparée qui sera publiée', async () => {
  const brut = 'WILLIAM : « Je paie. »\n\nSYLVANA : « Reste ici »';
  const prepare = preparerNarrationPourPublication(brut, '', 'WILLIAM', ['SYLVANA']);
  const lectures: string[] = [];
  const controle = await controlerLongueurNarration({
    texte: prepare.texte, plage: { min: 20, max: 30 }, temperature: 0.7,
    compter: async (texte) => { lectures.push(texte); return texte.length; },
    reformuler: async () => { throw new Error('Ne devrait pas régénérer'); },
  });
  exigerNarrationValide(controle.texte, rapportOk());
  assert.equal(controle.texte, prepare.texte);
  assert.deepEqual(lectures, [controle.texte]);
  assert.equal(controle.conforme, true);
});

test('une longueur trop courte conserve le texte sans appel au modèle', async () => {
  let reformulations = 0;
  const controle = await controlerLongueurNarration({
    texte: 'Trop court.', plage: { min: 20, max: 40 }, temperature: 0.7,
    compter: async (texte) => texte.length,
    reformuler: async () => { reformulations++; return 'Autre texte'; },
  });
  assert.equal(controle.texte, 'Trop court.');
  assert.equal(controle.conforme, false);
  assert.equal(controle.corrige, false);
  assert.equal(controle.verification, 'exacte');
  assert.equal(reformulations, 0);
});

test('tokenizer exact : URL /tokenize racine, Unicode conservé et réponse mesurée', async () => {
  let vu = '';
  const fetchMock = (async (url: RequestInfo | URL, init?: RequestInit) => {
    assert.match(String(url), /\/tokenize$/);
    const json = JSON.parse(String(init?.body));
    vu = json.content;
    assert.equal(json.add_special, false);
    assert.equal(json.parse_special, false);
    return { ok: true, json: async () => ({ tokens: [19, 20, 21, 22] }) } as Response;
  }) as typeof fetch;
  const t = await compterTokensNarration('Élysée, Sylvana et 🐉.', fetchMock, async () => undefined);
  assert.equal(vu, 'Élysée, Sylvana et 🐉.');
  assert.equal(t, 4);
});

test('tokenizer : 404, faux résultat, erreur réseau et ids de tokens invalides restent non vérifiés', async () => {
  for (const valeur of [
    { ok: false },
    { ok: true, json: async () => ({ tokens: '4' }) },
    { ok: true, json: async () => ({ tokens: [-1] }) },
    { ok: true, json: async () => ({ tokens: [] }) },
  ]) {
    const fetchMock = (async () => valeur as Response) as typeof fetch;
    assert.equal(await compterTokensNarration('Élyndor', fetchMock, async () => undefined), null);
  }
  const erreur = (async () => { throw new Error('Connexion perdue'); }) as typeof fetch;
  assert.equal(await compterTokensNarration('Test.', erreur, async () => undefined), null);
});

test('une fin tronquée reste inchangée sans tentative de réécriture', async () => {
  const phrase = Array(219).fill('mot').join(' ') + ' terminé.';
  const coupe = phrase + ' ' + Array(14).fill('interrompu').join(' ');
  const compter = async (texte: string) => texte.trim().split(/\\s+/).length;
  let appelsIA = 0;
  const resultat = await controlerLongueurNarration({
    texte: coupe,
    plage: { min: 215, max: 235 },
    temperature: 0.85,
    compter,
    reformuler: async () => { appelsIA++; throw Error('Pas de génération nécessaire'); },
  });
  assert.equal(resultat.conforme, true);
  assert.equal(resultat.corrige, false);
  assert.equal(resultat.tokens, 234);
  assert.equal(resultat.texte, coupe);
  assert.equal(appelsIA, 0);
});

test('un nombre de tokens hors cible ne bloque jamais le récit', async () => {
  const texte = 'Corvin tend la clef sanglante vers William.';
  let appelsIA = 0;
  const resultat = await controlerLongueurNarration({
    texte,
    plage: { min: 280, max: 320 },
    temperature: 0.85,
    compter: async () => 413,
    reformuler: async () => { appelsIA++; return 'Texte modifié'; },
  });
  assert.equal(resultat.conforme, false);
  assert.equal(resultat.texte, texte);
  assert.equal(resultat.tokens, 413);
  assert.equal(resultat.corrige, false);
  assert.equal(appelsIA, 0);
});

test('une panne de comptage ne bloque jamais le récit', async () => {
  const texte = 'Sylvana répond.';
  const resultat = await controlerLongueurNarration({
    texte,
    plage: { min: 280, max: 320 },
    temperature: 0.7,
    compter: async () => { throw new Error('Compteur indisponible'); },
  });
  assert.equal(resultat.texte, texte);
  assert.equal(resultat.tokens, null);
  assert.equal(resultat.conforme, false);
  assert.equal(resultat.verification, 'indisponible');
});
