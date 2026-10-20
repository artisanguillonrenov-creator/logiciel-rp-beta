import assert from 'node:assert/strict';
import test from 'node:test';
import {
  instructionRegistreAdulte,
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

test('profil Adulte : registre adapté aux curseurs configurés', () => {
  const extreme = instructionRegistreAdulte({ violence: 'extreme', romance: 'eleve' });
  assert.match(extreme, /Violence : plafond extrême/);
  assert.match(extreme, /Romance \(sentiments\) : plafond élevé/);
  assert.match(extreme, /Sexe : toujours explicite/);

  const faible = instructionRegistreAdulte({ violence: 'faible', romance: 'aucun' });
  assert.match(faible, /Violence : plafond faible/);
  assert.match(faible, /Romance \(sentiments\) : aucune/);
  assert.match(faible, /Sexe : toujours explicite/);
});

test('grand public : le vocabulaire interdit est cherché en mots entiers, pluriel et radical compris', () => {
  for (const anodin of ['Il habite une orbite basse.', 'La salle regorge de marchands.', 'Une sortie subite.']) {
    assert.ok(validerProfilContenuHeuristique(anodin, 'grand_public').ok, anodin);
    assert.ok(texteCompatibleAvecProfil(anodin, 'grand_public'), anodin);
  }
  for (const interdit of ['Il sort sa bite.', 'Des bites partout.', 'Une scène de masturbation.', 'Il lui tranche la gorge.']) {
    assert.equal(validerProfilContenuHeuristique(interdit, 'grand_public').ok, false, interdit);
    assert.equal(texteCompatibleAvecProfil(interdit, 'grand_public'), false, interdit);
  }
});
