import assert from 'node:assert/strict';
import test from 'node:test';
import { canonRace, detecterRacePnj, negatifSdxlRace, referenceRaceFiable, traitsSdxlRace } from '../src/engine/racePnj';

test('la race et le sexe d’un PNJ sont lus dans sa fiche', () => {
  const nkala = detecterRacePnj('N’Kala', 'Elfe noire de vingt-deux ans, guerrière, désormais au service de William.');
  assert.equal(nkala?.race.id, 'elfes-noirs');
  assert.equal(nkala?.sexe, 'Femme');
  assert.match(canonRace(nkala!), /cheveux argentés/);

  assert.equal(detecterRacePnj('Elfe Noire (N’Kala)', 'Capturée lors d’un raid.')?.race.id, 'elfes-noirs');
  assert.equal(detecterRacePnj('Grom', 'Un orque noble, il commande la garde.')?.race.id, 'orques-nobles');
  assert.equal(detecterRacePnj('Brak', 'Un orc couvert de scarifications, il ricane.')?.race.id, 'orcs');
  assert.equal(detecterRacePnj('Aiko', 'Haute-elfe de Tokyo, elle méprise les humains.')?.race.id, 'hauts-elfes');
  assert.equal(detecterRacePnj('Thorin', 'Un nain forgeron, il parle peu.')?.sexe, 'Homme');
});

test('sans race reconnaissable, aucun portrait de référence n’est imposé', () => {
  assert.equal(detecterRacePnj('Marcus', 'Marchand d’esclaves des couloirs souterrains de Paris.'), null);
});

test('la race du sujet est la première citée, le sexe se lit aussi dans un nom de race féminin', () => {
  assert.equal(detecterRacePnj('Mara', 'Humaine qui traque les elfes noirs.')?.race.id, 'humains');
  assert.equal(detecterRacePnj('Sigrun', 'Une Valkyrie.')?.sexe, 'Femme');
  assert.equal(detecterRacePnj('Nyx', 'Amazone sombre.')?.race.id, 'amazones-sombres');
  assert.equal(detecterRacePnj('Nyx', 'Amazone sombre.')?.sexe, 'Femme');
  assert.equal(detecterRacePnj('Maris', 'Sirène des récifs.')?.sexe, 'Femme');
});

test('Elfes Noirs : peau ébène imposée en anglais, portrait prédéfini (trop clair) écarté', () => {
  const nkala = detecterRacePnj('N’Kala', 'Elfe noire, guerrière.')!;
  assert.match(traitsSdxlRace(nkala), /ebony skin/);
  assert.match(negatifSdxlRace(nkala), /pale skin/);
  assert.equal(referenceRaceFiable(nkala), false);
  assert.match(canonRace(nkala), /Peau ébène/);
  assert.doesNotMatch(canonRace(nkala), /brun sombre/);
  assert.equal(referenceRaceFiable(detecterRacePnj('Brak', 'Un orc.')!), true);
});
