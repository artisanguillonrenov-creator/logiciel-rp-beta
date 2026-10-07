import assert from 'node:assert/strict';
import test from 'node:test';
import { CONSIGNE_SCENARIO, nettoyerScenario, personnagesFixesDuLieu } from '../src/engine/scenarioGenerator';

test('la Guilde des Aventuriers fournit ses maîtresses et réceptionnistes officielles au scénario', () => {
  const liste = personnagesFixesDuLieu('Guilde des Aventuriers');
  assert.match(liste, /Paris — Maîtresse de la Guilde des Aventuriers : Séraphine Duvall/);
  assert.match(liste, /Paris — Réceptionniste de la Guilde des Aventuriers : Margaux Fontaine/);
});

test('le Marché aux esclaves n’a pas de personnage fixé : le scénario crée un personnage local', () => {
  assert.equal(personnagesFixesDuLieu('Marchés aux esclaves'), '');
});

test('la consigne type nomme le premier interlocuteur et autorise une seule réplique', () => {
  assert.match(CONSIGNE_SCENARIO, /premier interlocuteur/);
  assert.match(CONSIGNE_SCENARIO, /une seule courte réplique/);
});

test('le scénario finit sans question générique et avec une étiquette en majuscules', () => {
  const brut = 'Tu arrives au marché de Paris.\n\nVendeur : « Ah, monsieur ! Venez voir. »\n\nQu’est-ce que tu vas faire ?'.replace('’', "'");
  assert.equal(nettoyerScenario(brut), 'Tu arrives au marché de Paris.\n\nVENDEUR : « Ah, monsieur ! Venez voir. »');
});
