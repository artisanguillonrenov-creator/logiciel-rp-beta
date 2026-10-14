import assert from 'node:assert/strict';
import test from 'node:test';
import { State } from '../src/prax/core/engine';
import { insert } from '../src/prax/core/types';
import { deserializeState, serializeState } from '../src/prax/core/persist';
import {
  ACQUIS_EXPRESSION_V1,
  exprimerParole,
  conjuguerPresentPrax,
  groupeNominalPrax,
  registreStable,
  statutEnonce,
} from '../src/prax/vocab/conversation';

test('le savoir conversationnel est bien une compétence du vocabulaire Prax', () => {
  assert.equal(ACQUIS_EXPRESSION_V1, 'prax-expression-fr-v1');
  assert.equal(registreStable('nerys'), registreStable('nerys'));
  const phrase = exprimerParole({ locuteur: 'nerys', intention: 'resister' }, 3);
  assert.ok(phrase?.texte.endsWith('.'));
  assert.ok(phrase?.acquis.includes('G6-variation-sans-faits-nouveaux'));
});

test('des sujets nouveaux sont composés et non cherchés dans une banque de répliques', () => {
  for (const sujet of ['les lanternes de corail', 'le traité de Nérival', 'la porte des pluies']) {
    const phrase = exprimerParole({ locuteur: 'pierre', intention: 'eluder', sujet, registre: 'sobre' }, 1);
    assert.ok(phrase?.texte.includes(sujet.replace(/^les /, 'des ').replace(/^le /, 'du ').replace(/^la /, 'de la ')), phrase?.texte ?? 'phrase absente');
  }
});

test('une information absente n’est pas inventée par une compétence narrative', () => {
  assert.equal(exprimerParole({ locuteur: 'zara', intention: 'informer' }), null);
  assert.equal(exprimerParole({ locuteur: 'zara', intention: 'contreOffre' }), null);
  assert.equal(exprimerParole({ locuteur: 'zara', intention: 'contreOffre', proposition: { montant: NaN, monnaie: 'argent' } }), null);
});

test('un montant proposé en amont reste strictement intact, même après variation', () => {
  for (let i = 0; i < 28; i++) {
    const result = exprimerParole({ locuteur: 'lys', intention: 'contreOffre', proposition: { montant: 47, monnaie: 'pièces de cuivre' } }, i);
    assert.ok(result?.texte.includes('47 pièces de cuivre'), result?.texte ?? 'montant absent');
    assert.equal(result?.texte.includes('48 pièces'), false);
    assert.ok(result?.acquis.includes('G2-montant-invariant'));
  }
});

test('la variation d’expression est déterministe et ne change jamais les faits de Prax', () => {
  const monde = new State();
  monde.performOutcome(insert('at.borin!pont'));
  const sauvegarde = serializeState(monde);
  const phrases = new Set<string>();
  for (let i = 0; i < 24; i++) {
    const a = exprimerParole({ locuteur: 'borin', intention: 'refuser', registre: 'reserve' }, i);
    const b = exprimerParole({ locuteur: 'borin', intention: 'refuser', registre: 'reserve' }, i);
    assert.deepEqual(a, b);
    if (a) phrases.add(a.texte);
  }
  assert.ok(phrases.size >= 2, 'les constructions possèdent au moins deux variantes');
  assert.equal(serializeState(monde), sauvegarde, 'aucun effet dans la base de faits');
  const relu = deserializeState(sauvegarde, new State());
  assert.equal(relu.dbHas('at.borin!pont'), true, 'l’état se restaure sans la moindre règle narrative temporaire');
  assert.ok(exprimerParole({ locuteur: 'borin', intention: 'refuser' }), 'les règles natives survivent au redémarrage du monde');
});

test('le langage rapporté ou hypothétique ne réalise pas une action', () => {
  assert.equal(statutEnonce('Je te menace.'), 'direct');
  assert.equal(statutEnonce('Si je te menace, comment réagirais-tu ?'), 'hypothese');
  assert.equal(statutEnonce('Supposons que je lui vole la bourse.'), 'hypothese');
  assert.equal(statutEnonce('« Je le frappe. »'), 'citation');
  assert.equal(statutEnonce('On m’a dit que l’homme avait volé une clef.'), 'rapporte');
});


test('grammaire native : accords et déterminants généralisent à des lexèmes inédits', () => {
  assert.equal(groupeNominalPrax('portail', 'masculin', 'pluriel'), 'les portails');
  assert.equal(groupeNominalPrax('voyageuse', 'feminin', 'pluriel'), 'les voyageuses');
  assert.equal(groupeNominalPrax('château', 'masculin', 'singulier'), 'le château');
  assert.equal(groupeNominalPrax('château', 'masculin', 'pluriel'), 'les châteaux');
  assert.equal(groupeNominalPrax('auberge', 'feminin', 'singulier'), 'l’auberge');
  assert.equal(groupeNominalPrax('hall', 'masculin', 'singulier', 'defini', true), 'le hall');
  assert.equal(groupeNominalPrax('cheval', 'masculin', 'pluriel'), 'les chevaux');
  assert.equal(groupeNominalPrax('œil', 'masculin', 'pluriel'), 'les yeux');
  assert.equal(groupeNominalPrax('7', 'masculin', 'singulier'), null);
});

test('grammaire native : présent conjugué et formes hors couverture refusées', () => {
  assert.equal(conjuguerPresentPrax('parler', 'tu'), 'parles');
  assert.equal(conjuguerPresentPrax('proposer', 'nous'), 'proposons');
  assert.equal(conjuguerPresentPrax('finir', 'ils'), 'finissent');
  assert.equal(conjuguerPresentPrax('être', 'vous'), 'êtes');
  assert.equal(conjuguerPresentPrax('aller', 'je'), 'vais');
  assert.equal(conjuguerPresentPrax('avoir', 'ils'), 'ont');
  assert.equal(conjuguerPresentPrax('venir', 'il'), 'vient');
  assert.equal(conjuguerPresentPrax('placer', 'nous'), null, 'conjugaison exigeant une modification orthographique non prise en charge');
});
