import assert from 'node:assert/strict';
import test from 'node:test';
import { CAPITALES } from '../src/engine/canonElyndor';
import { detecterCapitale, interpreterReleve } from '../src/engine/etatScene';

const ACTUEL = { ville: 'Paris', lieu: 'Marché aux Esclaves', presents: ['Greffier'], majMessageIndex: 4 };

test('les capitales du lore sont reconnues', () => {
  assert.ok(CAPITALES.includes('Paris') && CAPITALES.includes('New York'));
  assert.equal(detecterCapitale('Le Marché aux Esclaves de Paris', CAPITALES), 'Paris');
});

test('le relevé met à jour lieu et présents, borne le temps et ignore le joueur', () => {
  const releve = interpreterReleve(
    '{"ville":"Paris","lieu":"comptoir de la Guilde des Aventuriers","presents":["Xandriia","Margaux Fontaine","William"],"minutesEcoulees":5000}',
    ACTUEL, CAPITALES, 18, 'William',
  )!;
  assert.equal(releve.scene.lieu, 'comptoir de la Guilde des Aventuriers');
  assert.deepEqual(releve.scene.presents, ['Xandriia', 'Margaux Fontaine']);
  assert.equal(releve.minutesEcoulees, 720);
  assert.equal(releve.scene.majMessageIndex, 18);
});

test('une ville inconnue garde la ville précédente, un JSON invalide est ignoré', () => {
  assert.equal(interpreterReleve('{"ville":"Atlantis","lieu":"rue"}', ACTUEL, CAPITALES, 6, 'William')!.scene.ville, 'Paris');
  assert.equal(interpreterReleve('pas de json', ACTUEL, CAPITALES, 6, 'William'), null);
});
