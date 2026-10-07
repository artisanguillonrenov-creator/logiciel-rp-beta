import assert from 'node:assert/strict';
import test from 'node:test';
import { ROLES_CANON } from '../src/engine/canonElyndor';
import { corrigerEtiquettes, trouverEchoDuJoueur, trouverGestesDuJoueur, trouverRolesUsurpes, validerRolesCanon } from '../src/engine/controlesCoherence';
import { determinerStrategie } from '../src/engine/validator';
import { rolesDeLaVille } from '../src/engine/rolesCanon';

const PARIS = rolesDeLaVille(ROLES_CANON, 'Paris');

test('« le chef de la Guilde, Maître Kael » est un rôle usurpé : régénération complète', () => {
  const reponse = "À l'intérieur, la Guilde est bruyante. Vous apercevez le chef de la Guilde, Maître Kael, debout près du feu.\n\nKAEL : « Ah, Sir William ! »";
  const usurpes = trouverRolesUsurpes(reponse, PARIS, ['William', 'Xandriia']);
  assert.deepEqual(usurpes.map((u) => [u.role.nom, u.intrus]), [['Séraphine Duvall', 'Kael']]);
  assert.equal(determinerStrategie(validerRolesCanon(reponse, PARIS, ['William'])), 'regeneration_complete');
});

test('le rôle tenu par le bon personnage passe', () => {
  const reponse = 'La maîtresse de guilde, Séraphine Duvall, lève les yeux de son registre.';
  assert.equal(trouverRolesUsurpes(reponse, PARIS, []).length, 0);
});

test('les gestes du joueur écrits par le narrateur sont repérés, pas ses perceptions ni ce qu’il a annoncé', () => {
  const reponse = "Tu sens ta queue durcir. Xandriia accélère. Tu places tes mains dans ses cheveux. Tu la retournes sur le dos.\nXANDRIIA : « Tu prends ce que tu veux. »";
  assert.deepEqual(trouverGestesDuJoueur(reponse, 'continue').sort(), ['places', 'retournes']);
  assert.deepEqual(trouverGestesDuJoueur('Tu sors ta queue devant elle.', 'Je sors ma queue pour Xandriia'), []);
});

test('les étiquettes écorchées sont ramenées au nom connu, les autres restent', () => {
  const texte = 'SÉRAPHINE DUVALLY : « Bonjour. »\nMARGAUX FONTAUTE : « Bienvenue. »\nLE GARDE : « Halte ! »';
  assert.equal(
    corrigerEtiquettes(texte, ['Séraphine Duvall', 'Margaux Fontaine', 'Xandriia']),
    'SÉRAPHINE DUVALL : « Bonjour. »\nMARGAUX FONTAINE : « Bienvenue. »\nLE GARDE : « Halte ! »',
  );
});

test('un trajet annoncé n’est permis qu’en début de réponse', () => {
  const debut = 'Vous marchez jusqu’à la Guilde. ' ;
  assert.deepEqual(trouverGestesDuJoueur(debut, 'Ok allons à la guilde'), []);
  const loin = `${debut}${'Séraphine parle longuement de la mission. '.repeat(15)}Vous quittez la Guilde, prêts.`;
  assert.deepEqual(trouverGestesDuJoueur(loin, 'Ok allons à la guilde'), ['quittez']);
});

test('l’écho du joueur en ouverture de réponse est repéré', () => {
  assert.equal(trouverEchoDuJoueur('Tu prends une gorgée appréciative de ta bière, laissant son goût se répandre.', 'Je prends une gorgée de ma bière pendant qu’elle parle.'), 'prends');
  assert.equal(trouverEchoDuJoueur('Tu te penches en avant, tes yeux brûlant d’intérêt.', 'Je me penche un peu en avant.'), 'penches');
  assert.equal(trouverEchoDuJoueur('Althea sourit et repose son verre.', 'Je prends une gorgée de ma bière.'), undefined);
  assert.equal(trouverEchoDuJoueur('Tu sens le regard du garde peser sur toi.', 'J’entre dans la taverne.'), undefined);
});
