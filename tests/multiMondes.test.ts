import assert from 'node:assert/strict';
import test from 'node:test';
import { histoiresDuMonde, MONDE_PAR_DEFAUT, monde, mondeIdDe, paquetMonde, titreLoreDe } from '../src/mondes';
import { donneesMonde } from '../src/mondes/donnees';
import { routeDeDepart } from '../src/navigation/routeDepart';
import { preparerTour } from '../src/engine/ficheScene';
import { creerNouvelleHistoire } from '../src/engine/story';
import { migrerHistoire } from '../src/storage/storyMigration';
import { reconstituerHistoire, serialiserHistoire } from '../src/storage/storySerialization';
import type { StoryMeta } from '../src/types';

const REGLAGES = {
  creativite: 'moyenne', longueur: 'moyenne', ton: 'sombre_realiste', violence: 'modere',
  romance: 'aucun', humour: 'faible', liberteJoueur: 'elevee', rythme: 'normal',
} as const;

function histoire(mondeId?: string) {
  return creerNouvelleHistoire({
    personnageNom: 'Ael', personnageDescription: 'Voyageuse', pointDeDepart: 'Paris, à l’aube.',
    contexte: { lieu: 'Paris', ambiance: '', dateChronique: '', objectifs: '' },
    settings: { ...REGLAGES },
    mondeId,
  });
}

test('une histoire sans mondeId (ancienne sauvegarde) se charge avec le paquet d’Elyndor', () => {
  const ancienne: any = JSON.parse(JSON.stringify(histoire()));
  assert.equal('mondeId' in ancienne.meta, false);
  const relue = reconstituerHistoire(serialiserHistoire(migrerHistoire(ancienne)));
  assert.equal(relue.meta.mondeId, undefined);
  assert.equal(mondeIdDe(relue.meta), 'elyndor');
  const paquet = paquetMonde(mondeIdDe(relue.meta));
  assert.equal(paquet.id, 'elyndor');
  assert.equal(titreLoreDe(paquet), 'LORE ELYNDOR PERTINENT');
  // Lore et rôles canon d'Elyndor : identifiants elyndor-<n> inchangés.
  assert.ok(donneesMonde(mondeIdDe(relue.meta)).lore.every((e) => /^elyndor-\d+$/.test(e.id)));
  const { roles } = preparerTour(relue, 'Je me rends à la Guilde des Aventuriers de Paris.');
  assert.ok(roles.some((r) => r.nom === 'Séraphine Duvall'));
});

test('le mondeId d’une nouvelle histoire est enregistré et survit à la sauvegarde', () => {
  const h = histoire('elyndor');
  assert.equal(reconstituerHistoire(serialiserHistoire(h)).meta.mondeId, 'elyndor');
});

test('route de départ : activation, monde mémorisé, aucun monde mémorisé', () => {
  assert.equal(routeDeDepart({}), 'Activation');
  assert.equal(routeDeDepart({ betaAcceptee: false, mondeActif: 'elyndor' }), 'Activation');
  assert.equal(routeDeDepart({ betaAcceptee: true, mondeActif: 'elyndor' }), 'Demarrage');
  assert.equal(routeDeDepart({ betaAcceptee: true }), 'ChoixMonde');
  // Un monde mémorisé qui n'existe plus ramène au choix du monde.
  assert.equal(routeDeDepart({ betaAcceptee: true, mondeActif: 'monde-disparu' }), 'ChoixMonde');
});

test('liste « Histoires » : seules les histoires du monde actif apparaissent', () => {
  const metas = [
    { id: 'a' }, { id: 'b', mondeId: 'elyndor' }, { id: 'c', mondeId: 'autre-monde' },
  ] as StoryMeta[];
  assert.deepEqual(histoiresDuMonde(metas, 'elyndor').map((m) => m.id), ['a', 'b']);
  assert.deepEqual(histoiresDuMonde(metas, 'autre-monde').map((m) => m.id), ['c']);
});

test('le monde actif vaut Elyndor par défaut et prévient ses abonnés quand il change', () => {
  assert.equal(monde.actifId(), MONDE_PAR_DEFAUT);
  const vus: string[] = [];
  const desabonner = monde.abonner((id) => vus.push(id));
  // Un identifiant inconnu retombe sur Elyndor : aucun changement.
  monde.definirActif('monde-inconnu');
  assert.deepEqual(vus, []);
  desabonner();
  assert.equal(monde.actif().id, 'elyndor');
});
