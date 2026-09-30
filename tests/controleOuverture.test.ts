import assert from 'node:assert/strict';
import test from 'node:test';
import { ecartsContratOuverture, requeteLoreOuverture } from '../src/engine/controleOuverture';

const SCENE = `La pluie ruisselle sur les pavés de la Porte de Paris, où une file de charrettes attend sous l'œil des gardes.
Une capitaine aux gants de cuir s'avance vers toi et lève sa lanterne.
CAPITAINE MAREN : « Toi, là. Ton sauf-conduit, et vite : on ferme les portes avant la nuit. »`;

test('une scène en mouvement avec un PNJ qui interpelle le joueur respecte le contrat', () => {
  assert.deepEqual(ecartsContratOuverture(SCENE, 'Ael'), []);
});

test('ouverture statique, trop courte, en salutation générique : écarts listés', () => {
  const ecarts = ecartsContratOuverture('Bienvenue, aventurier. Que faites-vous ?', 'Ael');
  assert.ok(ecarts.some((e) => e.includes('Aucun personnage')));
  assert.ok(ecarts.some((e) => e.includes('trop courte')));
  assert.ok(ecarts.some((e) => e.includes('salutation générique')));
  assert.ok(ecarts.some((e) => e.includes('question générique')));
});

test('une réplique qui ne s’adresse pas au joueur est signalée', () => {
  const scene = `${'Le marché bruisse de mille voix sous les auvents colorés, les marchands vantent leurs épices. '.repeat(3)}
MARCHAND : « Les épices du sud sont arrivées ce matin ! »`;
  assert.ok(ecartsContratOuverture(scene, 'Ael').some((e) => e.includes('ne semble pas s\'adresser au joueur')));
});

test('la requête de lore met le lieu et les pouvoirs en priorité', () => {
  const requete = requeteLoreOuverture({ contexte: { lieu: 'Porte de Paris' }, pointDeDepart: 'Contrôle aux portes' });
  assert.match(requete, /Lieu exact : Porte de Paris/);
  assert.match(requete, /souverain ou autorité canonique/);
});
