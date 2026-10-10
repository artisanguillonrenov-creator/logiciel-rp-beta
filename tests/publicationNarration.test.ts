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

test('une régénération produit le seul texte admissible après le nouvel essai', async () => {
  const lectures: string[] = [];
  const controle = await controlerLongueurNarration({
    texte: 'Trop court.', plage: { min: 20, max: 40 }, temperature: 0.7,
    compter: async (texte) => { lectures.push(texte); return texte.length; },
    reformuler: async () => 'SYLVANA : « Un nouveau choix »',
  });
  assert.equal(controle.corrige, true);
  assert.equal(controle.texte, lectures.at(-1));
  assert.equal(controle.verification, 'exacte');
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

test('234 tokens mais phrase tronquée : garder la dernière phrase complète sans génération GPU', async () => {
  const phrase = Array(219).fill('mot').join(' ') + ' terminé.';
  const coupe = phrase + ' ' + Array(14).fill('interrompu').join(' ');
  const compter = async (texte: string) => texte.trim().split(/\s+/).length;
  let appelsIA = 0;
  assert.equal(await compter(coupe), 234);
  const resultat = await controlerLongueurNarration({
    texte: coupe,
    plage: { min: 215, max: 235 },
    temperature: 0.85,
    compter,
    reformuler: async () => { appelsIA++; throw Error('Pas de génération nécessaire'); },
  });
  assert.equal(resultat.conforme, true);
  assert.equal(resultat.corrige, true);
  assert.equal(resultat.tokens, 220);
  assert.equal(resultat.texte, phrase);
  assert.equal(appelsIA, 0);
});

test('une fin tronquée ne doit pas être coupée si cela descend sous 215 tokens', async () => {
  const phrase = Array(209).fill('mot').join(' ') + ' terminé.';
  const coupe = phrase + ' ' + Array(24).fill('interrompu').join(' ');
  const compter = async (texte: string) => texte.trim().split(/\s+/).length;
  let appelsIA = 0;
  await assert.rejects(controlerLongueurNarration({
    texte: coupe,
    plage: { min: 215, max: 235 },
    temperature: 0.85,
    compter,
    reformuler: async () => { appelsIA++; return coupe; },
  }), /incomplète/);
  assert.equal(appelsIA, 2);
});
