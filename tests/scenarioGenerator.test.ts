import assert from 'node:assert/strict';
import test from 'node:test';
import { CONSIGNE_SCENARIO, genererScenarioDepart, nettoyerScenario, personnagesFixesDuLieu } from '../src/engine/scenarioGenerator';

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

test('la création du scénario appelle le modèle OpenRouter sélectionné, jamais le pod hérité', async () => {
  const sauvegardeFetch = globalThis.fetch;
  let adresse = ''; let corps: any;
  globalThis.fetch = async (input, init) => {
    adresse = String(input);
    corps = JSON.parse(String(init?.body));
    return Response.json({ choices: [{ message: {
      content: 'Tu arrives à Paris. Un garde te fait signe. GARDE : « Suis-moi. »',
    } }] });
  };
  try {
    const scenario = await genererScenarioDepart({
      appSettings: {
        openRouterApiKey: 'cle-test',
        model: 'fiction/modele:free',
        moteurInference: 'serveur', fournisseurNarration: 'openrouter',
        serveurLocalUrl: 'elyndor-cloud', serveurLocalModele: 'cydonia-24b-elyndor',
        profilContenu: 'grand_public',
      },
      personnageNom: 'William', lieuNom: 'Guilde des Aventuriers',
      villeDepart: 'Paris',
    });
    assert.match(scenario, /Tu arrives à Paris/);
    assert.equal(adresse, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(corps.model, 'fiction/modele:free');
  } finally {
    globalThis.fetch = sauvegardeFetch;
  }
});
