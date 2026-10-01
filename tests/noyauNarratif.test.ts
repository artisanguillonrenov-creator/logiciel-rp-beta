import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FIN_ETAT,
  MARQUEUR_ETAT,
  annulerTour,
  assurerNoyau,
  construireContexteNoyau,
  extraireEnveloppeEtat,
  validerTour,
} from '../src/engine/noyauNarratif';
import { creerNouvelleHistoire } from '../src/engine/story';
import type { StoryState } from '../src/types';

function histoire(): StoryState {
  const s = creerNouvelleHistoire({
    personnageNom: 'William',
    personnageDescription: 'Voyageur',
    pointDeDepart: 'Paris',
    contexte: { lieu: 'Paris', ambiance: '', dateChronique: '', objectifs: '' },
    settings: {
      creativite: 'moyenne', longueur: 'moyenne', ton: 'sombre_realiste', violence: 'modere',
      romance: 'aucun', humour: 'faible', liberteJoueur: 'elevee', rythme: 'normal',
    },
  });
  return { ...s, social: { engagements: [], relations: [{ id: 'r', nom: 'Sylvana', faction: 'Compagnons', confiance: 0, respect: 0, peur: 0, affection: 0, hostilite: 0 }] } };
}

const u = { id: 'u1', content: 'Je donne mon épée à Sylvana.' };
const a = { id: 'a1', content: 'Sylvana reçoit l’épée et la garde.', timestamp: 2 };
const delta = {
  events: [{ type: 'transfer', summary: 'William donne son épée à Sylvana.', actors: ['William'], targets: ['Sylvana'], location: 'Paris', witnesses: ['Sylvana'], importance: 0.7, public: false }],
  stateChanges: [{ subject: 'Épée de William', predicate: 'owner', from: null, to: 'Sylvana', confidence: 1 }],
  npcStates: [{ name: 'Sylvana', beliefs: ['William lui a donné son épée'], desires: [], intentions: [] }],
};

test('auto-test V13 : le transfert de l’épée entre au canon et ressort dans le contexte', () => {
  const s = validerTour(histoire(), { messageJoueur: u, messageNarrateur: a, delta });
  const c = s.narrativeCore;
  assert.equal(c.canon.find((f) => f.subject === 'Épée de William' && !f.validToEvent)?.value, 'Sylvana');
  assert.equal(c.ledger.length, 1);
  assert.ok(c.beliefs.some((b) => b.knower === 'Sylvana' && b.type === 'SEEN'));
  assert.equal(c.rumors.length, 1);
  const ctx = construireContexteNoyau(s, 'Où est mon épée ? Sylvana ?');
  assert.match(ctx.texte, /Épée de William\.owner = Sylvana/);
  assert.match(ctx.texteSocial, /Sylvana/);
});

test('un changement d’état qui contredit le canon part en quarantaine', () => {
  const s1 = validerTour(histoire(), { messageJoueur: u, messageNarrateur: a, delta });
  const s2 = validerTour(s1, {
    messageJoueur: { id: 'u2', content: 'Je regarde Sylvana.' },
    messageNarrateur: { id: 'a2', content: 'Borek brandit l’épée.' },
    delta: { stateChanges: [{ subject: 'Épée de William', predicate: 'owner', from: 'Borek', to: 'Borek', confidence: 1 }] },
  });
  assert.equal(s2.narrativeCore.canon.find((f) => f.subject === 'Épée de William' && !f.validToEvent)?.value, 'Sylvana');
  assert.ok(s2.narrativeCore.quarantine.some((q) => q.reason === 'from_mismatch'));
});

test('la réputation d’une faction ne bouge pas pour un acte que personne ne connaît', () => {
  const s = validerTour(histoire(), {
    messageJoueur: u, messageNarrateur: a,
    delta: { ...delta, reputationSignals: [{ subject: 'William', faction: 'Garde', delta: -10, reason: 'vol discret' }] },
  });
  assert.ok(!s.narrativeCore.reputation.some((r) => r.scope === 'faction'));
  assert.ok(s.narrativeCore.quarantine.some((q) => q.reason === 'knowledge_gate_blocked'));
});

test('sans delta, le tour est tout de même journalisé et l’heure avance', () => {
  const s = validerTour(histoire(), {
    messageJoueur: { id: 'u', content: 'Deux heures plus tard, je rejoins le marché.' },
    messageNarrateur: { id: 'n', content: 'MARCHAND : « Vous voilà ! »' },
  });
  assert.equal(s.narrativeCore.ledger.length, 1);
  assert.equal(s.narrativeCore.clock.minute, 720 + 120);
});

test('régénération : le tour annulé disparaît du noyau et le fait remplacé redevient courant', () => {
  const s1 = validerTour(histoire(), { messageJoueur: u, messageNarrateur: a, delta });
  const s2 = validerTour(s1, {
    messageJoueur: { id: 'u2', content: 'Je reprends mon épée.' },
    messageNarrateur: { id: 'a2', content: 'Tu reprends ton épée.' },
    delta: { events: [{ summary: 'William reprend son épée.' }], stateChanges: [{ subject: 'Épée de William', predicate: 'owner', from: 'Sylvana', to: 'William', confidence: 1 }] },
  });
  const annule = assurerNoyau(annulerTour(s2, 'a2'));
  assert.equal(annule.narrativeCore.ledger.length, 1);
  assert.equal(annule.narrativeCore.canon.find((f) => f.subject === 'Épée de William' && !f.validToEvent)?.value, 'Sylvana');
});

test('le bloc d’état n’apparaît jamais dans le récit, même coupé', () => {
  const complet = extraireEnveloppeEtat(`La porte s’ouvre.\n${MARQUEUR_ETAT}\n{"events":[{"summary":"La porte s'ouvre."}]}\n${FIN_ETAT}`);
  assert.equal(complet.texte, 'La porte s’ouvre.');
  assert.equal(complet.trouve, true);
  const coupe = extraireEnveloppeEtat(`La porte s’ouvre.\n${MARQUEUR_ETAT}\n{"events":[{"summ`);
  assert.equal(coupe.texte, 'La porte s’ouvre.');
  assert.equal(coupe.delta, null);
  assert.equal(extraireEnveloppeEtat('La porte s’ouvre.\n<<<ELYNDOR_ST').texte, 'La porte s’ouvre.');
  assert.equal(extraireEnveloppeEtat('Rien de spécial.').texte, 'Rien de spécial.');
});
