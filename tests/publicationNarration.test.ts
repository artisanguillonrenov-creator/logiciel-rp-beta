import assert from 'node:assert/strict';
import test from 'node:test';
import { finDeNarrationComplete, controlerLongueurNarration } from '../src/engine/controleLongueurNarration';
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
