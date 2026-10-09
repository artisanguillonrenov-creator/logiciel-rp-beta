import assert from 'node:assert/strict';
import test from 'node:test';
import { creerNouvelleHistoire } from '../src/engine/story';
import {
  construireContratNarratifNatif,
  debugContratNarratif,
  RESPONSABILITES_NARRATIVES,
} from '../src/engine/narrativeBehaviorKernel';

function histoire() {
  return creerNouvelleHistoire({
    personnageNom: 'Lina',
    personnageDescription: 'Exploratrice',
    pointDeDepart: 'Paris',
    contexte: { lieu: 'Paris', ambiance: '', dateChronique: '', objectifs: '' },
    settings: {
      creativite: 'moyenne', longueur: 'moyenne', ton: 'sombre_realiste',
      violence: 'modere', romance: 'faible', humour: 'faible',
      liberteJoueur: 'elevee', rythme: 'normal',
    },
  });
}

test('V2.1 : les 15 responsabilités sont connues et ordonnées sans doublon', () => {
  assert.equal(RESPONSABILITES_NARRATIVES.length, 15);
  assert.deepEqual(RESPONSABILITES_NARRATIVES.map((x) => x.id),
    Array.from({ length: 15 }, (_, i) => 'M' + String(i + 1).padStart(2, '0')));
});

test('V2.1 : scène calme = règles fondamentales actives et pas de conflits artificiels', () => {
  const c = construireContratNarratifNatif(histoire(), 'Je contemple le ciel.', 'adulte');
  assert.equal(c.contributions.length, 15);
  for (const id of ['M01', 'M02', 'M07', 'M08', 'M13']) {
    assert.equal(c.contributions.find((x) => x.id === id)?.actif, true, id);
    assert.match(c.texte, new RegExp(id));
  }
  for (const id of ['M06', 'M12', 'M14']) {
    assert.equal(c.contributions.find((x) => x.id === id)?.actif, false, id);
  }
  assert.doesNotMatch(c.texte, /M14 Résolution des actions/);
  assert.ok(debugContratNarratif(c).every((x) => /^M\d\d /.test(x)));
});

test('V2.1 : scène sociale, collective, contractuelle et physique mobilise les 15 responsabilités', () => {
  const base = histoire();
  const relations = ['Sylvana', 'Kaelen'].map((nom, i) => ({
    id: String(i), nom, faction: 'Compagnons', confiance: 0, respect: 0,
    peur: 0, affection: 0, hostilite: 0,
  }));
  const s = {
    ...base,
    directeur: { ...base.directeur, arcActuel: 'Une enquête dans la guilde' },
    social: { ...base.social, relations },
  };
  const c = construireContratNarratifNatif(s,
    'Sylvana et Kaelen, je tente une attaque à la guilde pour retrouver le secret du contrat.',
    'adulte');
  assert.equal(c.contributions.filter((x) => x.actif).length, 15);
  assert.equal(debugContratNarratif(c).length, 15);
  assert.ok(c.texte.includes('M15 Circulation de l’information') || c.texte.includes("M15 Circulation de l'information"));
  assert.ok(c.texte.includes('M08 Registre et style narratif'));
  assert.ok(c.texte.includes('Responsabilités mobilisées : M01, M02'));
});

test('V2.1 : l’intensité déclarée suit les curseurs de la session, sans forcer la scène', () => {
  const s = histoire();
  const c = construireContratNarratifNatif(
    { ...s, settings: { ...s.settings, violence: 'extreme' } },
    'Je m’assieds au bord du chemin.',
    'adulte',
  );
  const m08 = c.contributions.find((x) => x.id === 'M08');
  assert.equal(m08?.actif, true);
  assert.match(m08?.raison ?? '', /violence=extreme/);
  assert.match(m08?.directive ?? '', /ne doit pas être intensifiée artificiellement/);
});

test('V2.1 : aucune dépendance aux 15 fiches de lore textuelles', () => {
  const c = construireContratNarratifNatif(histoire(), 'Je regarde.', 'grand_public');
  assert.ok(c.texte.length < 6500);
  assert.doesNotMatch(c.texte, /\[MÉTA\]/);
  assert.match(c.texte, /CONTRAT NARRATIF NATIF V2\.1/);
});
