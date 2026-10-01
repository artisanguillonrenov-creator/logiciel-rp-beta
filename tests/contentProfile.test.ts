import assert from 'node:assert/strict';
import test from 'node:test';
import {
  contenuSexuelAvecMineur,
  instructionRegistreAdulte,
  validerAbsenceMineurs,
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

test('profil Adulte : registre explicite selon les curseurs, limite mineurs toujours présente', () => {
  const extreme = instructionRegistreAdulte({ violence: 'extreme', romance: 'eleve' });
  assert.match(extreme, /anatomique et sans ellipse/);
  assert.match(extreme, /de façon explicite/);
  assert.match(extreme, /LIMITE ABSOLUE/);
  assert.match(instructionRegistreAdulte({ violence: 'faible', romance: 'aucun' }), /pas de scène sexuelle/);
});

test('aucun contenu sexuel avec un mineur, quel que soit le profil ; les scènes entre adultes passent', () => {
  assert.equal(contenuSexuelAvecMineur('La courtisane jouit dans les bras du capitaine.'), false);
  assert.equal(validerAbsenceMineurs('Il éventre le garde ; un enfant hurle au loin.').ok, true);
  assert.equal(contenuSexuelAvecMineur("L'adolescente de 15 ans... orgasme"), true);
  assert.equal(validerEntreeUtilisateur('je baise la fillette', 'adulte').ok, false);
  assert.equal(validerEntreeUtilisateur('je baise la courtisane', 'adulte').ok, true);
});
