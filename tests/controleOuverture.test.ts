import assert from 'node:assert/strict';
import test from 'node:test';
import type { StoryState } from '../src/types';
import { estSeuleOuverture, ecartsContratOuverture, instructionInterpellation, ouvertureSansInterpellation, requeteLoreOuverture } from '../src/engine/controleOuverture';

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

test('une ouverture sans personnage qui interpelle le joueur est repérée, la suite ajoutée la complète', () => {
  const description = 'Tu franchis les grandes portes du Marché aux Esclaves de Paris. Des centaines de corps sont exposés sur les estrades, les marchands hurlent leurs prix et les chaînes claquent sur la pierre.';
  assert.equal(ouvertureSansInterpellation(description, 'William'), true);
  const suite = 'Un marchand ventru se plante devant toi.\nGASPARD : « Toi, là ! Tu cherches une guerrière ou une domestique ? »';
  assert.equal(ouvertureSansInterpellation(`${description}\n\n${suite}`, 'William'), false);
  assert.match(instructionInterpellation(description), /UNIQUEMENT la suite immédiate[\s\S]*Marché aux Esclaves de Paris/);
});

test('seule la scène d’ouverture, sans tour joué, passe par la régénération d’ouverture', () => {
  const histoire = { messages: [] } as unknown as StoryState;
  assert.equal(estSeuleOuverture({ ...histoire, messages: [] }), false);
  assert.equal(estSeuleOuverture({ ...histoire, messages: [{ id: 'o', role: 'assistant', content: 'Ouverture', createdAt: 0 } as never] }), true);
  assert.equal(estSeuleOuverture({ ...histoire, messages: [
    { id: 'o', role: 'assistant', content: 'Ouverture', createdAt: 0 } as never,
    { id: 'u', role: 'user', content: 'Je parle', createdAt: 1 } as never,
    { id: 'a', role: 'assistant', content: 'Réponse', createdAt: 2 } as never,
  ] }), false);
});
