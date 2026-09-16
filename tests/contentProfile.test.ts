import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filtrerTextePourProfil,
  plafonnerCurseurs,
  texteCompatibleAvecProfil,
  validerEntreeUtilisateur,
  validerProfilContenuHeuristique,
  valeursAutoriseesRomance,
  valeursAutoriseesViolence,
} from '../src/engine/contenuAdulte';

const storySettings = {
  creativite: 'moyenne',
  longueur: 'moyenne',
  ton: 'sombre_realiste',
  rythme: 'normal',
  liberteJoueur: 'elevee',
  violence: 'extreme',
  romance: 'eleve',
  humour: 'modere',
} as any;

test('un profil indéterminé reste fail-closed comme Grand public', () => {
  assert.deepEqual(valeursAutoriseesViolence(undefined), valeursAutoriseesViolence('grand_public'));
  assert.deepEqual(valeursAutoriseesRomance(undefined), valeursAutoriseesRomance('grand_public'));

  const borne = plafonnerCurseurs(storySettings, undefined);
  assert.equal(borne.violence, 'faible');
  assert.equal(borne.romance, 'faible');
});

test('un texte explicite est refusé sans profil déclaré et autorisé uniquement en Adulte', () => {
  const texte = 'Il l’éventre et ses entrailles tombent au sol.';
  assert.equal(validerEntreeUtilisateur(texte, undefined).ok, false);
  assert.equal(validerEntreeUtilisateur(texte, 'grand_public').ok, false);
  assert.equal(validerEntreeUtilisateur(texte, 'adulte').ok, true);

  assert.equal(validerProfilContenuHeuristique(texte, undefined).ok, false);
  assert.equal(validerProfilContenuHeuristique(texte, 'adulte').ok, true);
});

test('les anciens blocs incompatibles peuvent être retirés avant prompt ou embeddings', () => {
  const explicite = 'Une mare de sang recouvre le sol.';
  const neutre = 'La pluie frappe les pavés de Paris.';

  assert.equal(texteCompatibleAvecProfil(explicite, 'grand_public'), false);
  assert.equal(texteCompatibleAvecProfil(explicite, undefined), false);
  assert.equal(texteCompatibleAvecProfil(explicite, 'adulte'), true);
  assert.equal(filtrerTextePourProfil(explicite, 'grand_public'), '');
  assert.equal(filtrerTextePourProfil(neutre, 'grand_public'), neutre);
});
