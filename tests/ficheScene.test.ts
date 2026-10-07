import assert from 'node:assert/strict';
import test from 'node:test';
import { preparerTour } from '../src/engine/ficheScene';
import { construireMessages } from '../src/engine/promptBuilder';
import { creerNouvelleHistoire } from '../src/engine/story';

function histoire() {
  const story = creerNouvelleHistoire({
    personnageNom: 'William',
    personnageDescription: 'Aventurier légendaire.',
    pointDeDepart: 'Le Marché aux Esclaves de Paris, au bord de la Seine.',
    contexte: { lieu: 'Marchés aux esclaves', ambiance: '', dateChronique: '', objectifs: '' },
    settings: {
      creativite: 'moyenne', longueur: 'moyenne', ton: 'sombre_realiste', violence: 'extreme',
      romance: 'aucun', humour: 'faible', liberteJoueur: 'elevee', rythme: 'normal',
    },
  } as any);
  return { ...story, scene: { ville: 'Paris', lieu: 'Marché aux Esclaves', presents: ['Xandriia'], majMessageIndex: 0 } };
}

test('« Ok allons à la guilde » : la fiche donne Paris, la destination et les rôles fixés', () => {
  const { fiche, roles } = preparerTour(histoire(), 'Ok allons à la guilde');
  assert.match(fiche, /Ville : Paris\. Lieu actuel : Marché aux Esclaves → destination : comptoir de la Guilde des Aventuriers de Paris\./);
  assert.match(fiche, /Présents : Xandriia\./);
  assert.deepEqual(roles.map((r) => r.nom), ['Séraphine Duvall', 'Margaux Fontaine']);
  assert.match(fiche, /ne les remplace jamais par un inventé/);
});

test('la fiche et le protocole du tour ferment le prompt système, avant le rappel de format', () => {
  const story = histoire();
  const [systeme] = construireMessages({
    meta: story.meta, settings: story.settings, resume: '', faits: [], loreElyndor: [], messagesRecents: [], messageJoueur: 'Ok allons à la guilde',
    metamoteursSelectionnes: [{ id: 'm', titre: '[MÉTA] Test', contenu: 'Règle.' }],
    ficheScene: preparerTour(story, 'Ok allons à la guilde').fiche,
  });
  const i = systeme.content.indexOf('[FICHE DE SCÈNE');
  const j = systeme.content.indexOf('[PROTOCOLE DU TOUR]');
  const k = systeme.content.indexOf('[RAPPEL DE FORMAT]');
  assert.ok(i > systeme.content.indexOf('[MÉTAMOTEURS ACTIFS]') && i < j && j < k);
});
