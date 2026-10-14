import assert from 'node:assert/strict';
import test from 'node:test';
import { State } from '../src/prax/core/engine';
import { comprendre } from '../src/engine/praxNarrateur/comprehension';
import { construireMonde, faitsInitiaux } from '../src/engine/praxNarrateur/monde';
import { lignesCoulisses, rendreOuverture, rendreTour } from '../src/engine/praxNarrateur/rendu';
import type { DescriptionScene, EvenementTour } from '../src/engine/praxNarrateur/types';
import { insert } from '../src/prax/core/types';
import { deserializeState, serializeState } from '../src/prax/core/persist';
import {
  ACQUIS_EXPRESSION_V1,
  exprimerParole,
  conjuguerPresentPrax,
  conjuguerImparfaitPrax,
  conjuguerPasseComposePrax,
  accorderAdjectifPrax,
  composerPropositionPrax,
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
  assert.equal(conjuguerPresentPrax('placer', 'nous'), 'plaçons');
  assert.equal(conjuguerPresentPrax('manger', 'nous'), 'mangeons');
  assert.equal(conjuguerPresentPrax('dire', 'vous'), 'dites');
  assert.equal(conjuguerPresentPrax('prendre', 'ils'), 'prennent');
  assert.equal(conjuguerPresentPrax('recevoir', 'je'), 'reçois');
  assert.equal(conjuguerPresentPrax('jeter', 'je'), null, 'verbe non pris en charge');
});


test('une rumeur reste rapportée sans prétention de témoignage oculaire', () => {
  const evenement: EvenementTour = {
    acteur: 'alix',
    acteurNom: 'Alix',
    genre: 'raconter',
    libelle: 'Alix rapporte un événement',
    cible: 'joueur',
    cibleNom: 'le joueur',
    rapporte: { genre: 'voler', auteurNom: 'Borin', victimeNom: 'Léa' },
    temoins: [],
  };
  const texte = rendreTour({ evenements: [evenement], presentsApres: [], tour: 2, variante: 0 });
  assert.match(texte, /Il se dit que Borin a volé Léa/);
  assert.doesNotMatch(texte, /Je l.ai vu/);
});

test('les répliques natives ne créent aucun geste ou mouvement non attesté', () => {
  const e: EvenementTour = {
    acteur: 'alix',
    acteurNom: 'Alix',
    genre: 'ceder',
    libelle: 'Alix cède',
    cible: 'joueur',
    cibleNom: 'le joueur',
    registreParole: 'reserve',
    temoins: [],
  };
  const texte = rendreTour({ evenements: [e], presentsApres: [], tour: 1, variante: 0 });
  assert.match(texte, /^Alix : « /);
  assert.doesNotMatch(texte, /recule|lève les mains|croise les bras/);
});

test('un ton fondé sur les relations est prioritaire sur la signature arbitraire', () => {
  const e: EvenementTour = {
    acteur: 'alix',
    acteurNom: 'Alix',
    genre: 'tenirTete',
    libelle: 'Alix tient tête',
    cible: 'joueur',
    cibleNom: 'le joueur',
    registreParole: 'tranchant',
    temoins: [],
  };
  const texte = rendreTour({ evenements: [e], presentsApres: [], tour: 3, variante: 2 });
  const attendu = exprimerParole({ intention: 'resister', locuteur: 'alix', registre: 'tranchant' }, 5);
  assert.ok(attendu);
  assert.ok(texte.includes(attendu.texte));
});

test('Prax protège la simulation des négations et citations sans réciter de listes', () => {
  const desc: DescriptionScene = {
    version: 1,
    ville: 'Paris',
    joueurNom: 'Arwen',
    lieux: [{ id: 'rues', nom: 'les rues' }],
    pnj: [{ id: 'margaux', nom: 'Margaux', role: 'habitant', lieu: 'rues', sujets: [] }],
  };
  const st = construireMonde(desc, 123);
  for (const o of faitsInitiaux(desc, 'rues', new Set(['margaux']), new Set(['rues']), new Map())) st.performOutcome(o);
  const before = serializeState(st);
  const messages = [
    'Si je frappe Margaux, que se passera-t-il ?',
    '« Je frappe Margaux. »',
    'Je ne frappe pas Margaux',
    'Je refuse de frapper Margaux',
    'Ne frappe pas Margaux',
    'Je pourrais frapper Margaux',
    'Je raconte que je frappe Margaux',
  ];
  for (const message of messages) {
    assert.notEqual(statutEnonce(message), 'direct', message);
    const compris = comprendre(message, st, desc, 'rues', { dernierInterlocuteur: 'margaux' });
    assert.notEqual(compris.genre, 'attaquer', message);
  }
  assert.equal(serializeState(st), before, 'les énoncés étudiés ne modifient pas la simulation');
});

test('les nouveaux actes natifs varient, sans engager une transaction absente', () => {
  for (const intention of [
    'remercier', 'rassurer', 'ignorerSujet', 'presser', 'perdrePatience',
    'renvoyer', 'proposer', 'maintenirPrix', 'consentirRabais', 'conclure',
  ] as const) {
    const a = exprimerParole({ intention, locuteur: 'alix', sujet: 'la Porte Astra' }, 0);
    const b = exprimerParole({ intention, locuteur: 'alix', sujet: 'la Porte Astra' }, 1);
    assert.ok(a && b, intention);
    assert.equal(a.version, ACQUIS_EXPRESSION_V1);
    assert.doesNotMatch(a.texte, /\b\d+ (?:or|argent|cuivre)\b/, 'aucun prix sans décision de Prax');
  }
});

test('rapporter ou supposer un fait préserve sa modalité, pas sa vérité', () => {
  const rapporte = exprimerParole({ intention: 'informer', locuteur: 'alix', fait: 'Borin est parti', statut: 'rapporte' });
  const hypothese = exprimerParole({ intention: 'informer', locuteur: 'alix', fait: 'Borin est parti', statut: 'hypothese' });
  const citation = exprimerParole({ intention: 'informer', locuteur: 'alix', fait: 'Borin est parti', statut: 'citation' });
  assert.match(rapporte?.texte ?? '', /Il se dit que borin est parti/i);
  assert.match(hypothese?.texte ?? '', /Hypothèse : Borin est parti/);
  assert.match(citation?.texte ?? '', /« Borin est parti »/);
});


test('le rendu conserve les paroles hypothétiques du joueur plutôt que les exécuter', () => {
  const base: EvenementTour = {
    acteur: 'joueur',
    acteurNom: 'Arwen',
    genre: 'converser',
    libelle: 'Arwen parle à Margaux',
    cible: 'margaux',
    cibleNom: 'Margaux',
    temoins: ['margaux'],
    precision: 'Si je frappais le garde, que se passerait-il ?',
  };
  const rendu = rendreTour({ evenements: [base], presentsApres: [], tour: 1, variante: 0 });
  assert.match(rendu, /Tu évoques une hypothèse à Margaux/);
  assert.match(rendu, /Si je frappais le garde/);
  assert.doesNotMatch(rendu, /Tu frappes le garde/);
});

test('les formulations de parole ne capitalisent pas au milieu d’une phrase', () => {
  const formats = ['chaleureux', 'reserve', 'tranchant'] as const;
  for (const registre of formats) for (let i = 0; i < 64; i++) {
    const phrase = exprimerParole({ locuteur: 'margaux', intention: 'ecouter', registre }, i)?.texte ?? '';
    assert.doesNotMatch(phrase, /,\s+[A-ZÀÉÈ]\p{Ll}/u, 'on ne commence pas une proposition interne avec une majuscule');
  }
});

test('les intentions inconnues ou informations manquantes ne sont jamais comblées', () => {
  assert.equal(exprimerParole({ locuteur: 'alix', intention: 'informer', fait: '' }), null);
  assert.equal(exprimerParole({ locuteur: 'alix', intention: 'demander', sujet: '' }), null);
  assert.equal(statutEnonce("J'aimerais frapper le garde"), 'eventualite');
  assert.equal(statutEnonce("Je n'attaque pas le garde"), 'negation');
  assert.equal(statutEnonce('Je lui dis que je le frappe'), 'rapporte');
});


test('accords adjectivaux appris : féminin, pluriels et exceptions', () => {
  assert.equal(accorderAdjectifPrax('grand', 'feminin', 'singulier'), 'grande');
  assert.equal(accorderAdjectifPrax('sombre', 'feminin', 'pluriel'), 'sombres');
  assert.equal(accorderAdjectifPrax('royal', 'masculin', 'pluriel'), 'royaux');
  assert.equal(accorderAdjectifPrax('fier', 'feminin', 'pluriel'), 'fières');
  assert.equal(accorderAdjectifPrax('bas', 'feminin', 'singulier'), 'basse');
  assert.equal(accorderAdjectifPrax('blanc', 'feminin', 'singulier'), 'blanche');
  assert.equal(accorderAdjectifPrax('futuriste', 'feminin', 'singulier'), 'futuriste');
  assert.equal(accorderAdjectifPrax('heureux', 'feminin', 'singulier'), null, 'exception non enseignée : abstention');
  assert.equal(groupeNominalPrax('homme', 'masculin', 'singulier'), 'l’homme');
  assert.equal(groupeNominalPrax('haricot', 'masculin', 'singulier', 'defini', true), 'le haricot');
});

test('l’historique de la partie évite une répétition sans seconde mémoire', () => {
  const sens = { locuteur: 'margaux', intention: 'refuser' as const, registre: 'sobre' as const };
  const base = exprimerParole(sens, 1);
  assert.ok(base);
  const autre = exprimerParole(sens, 1, ['Margaux : « ' + base.texte + ' »']);
  assert.ok(autre);
  assert.notEqual(base.texte, autre.texte);
  assert.ok(autre.acquis.includes('G6-anti-repetition-contextuelle'));
  const stable = exprimerParole(sens, 1, ['Margaux : « ' + base.texte + ' »']);
  assert.deepEqual(stable, autre);
});


test('les faits passés emploient la morphologie native avec l’aspect demandé', () => {
  assert.equal(conjuguerImparfaitPrax('être', 'je'), 'étais');
  assert.equal(conjuguerImparfaitPrax('manger', 'nous'), 'mangions');
  assert.equal(conjuguerImparfaitPrax('manger', 'il'), 'mangeait');
  assert.equal(conjuguerImparfaitPrax('placer', 'je'), 'plaçais');
  assert.equal(conjuguerImparfaitPrax('placer', 'vous'), 'placiez');
  assert.equal(conjuguerImparfaitPrax('aller', 'ils'), 'allaient');
  assert.equal(conjuguerPasseComposePrax('voler', 'il'), 'a volé');
  assert.equal(conjuguerPasseComposePrax('attaquer', 'il'), 'a attaqué');
  assert.equal(conjuguerPasseComposePrax('venir', 'elle' as never), null);
  assert.equal(conjuguerPasseComposePrax('venir', 'il'), null, 'genre inconnu : abstention');
  assert.equal(conjuguerPasseComposePrax('venir', 'il', { genre: 'feminin' }), 'est venue');
  assert.equal(conjuguerPasseComposePrax('venir', 'ils', { genre: 'feminin' }), 'sont venues');
  assert.equal(conjuguerPasseComposePrax('sortir', 'il'), null, 'auxiliaire transitif ou intransitif ambigu');
  assert.equal(conjuguerPasseComposePrax('sortir', 'il', { auxiliaire: 'avoir' }), 'a sorti');
});


test('aucune omniscience: Prax ne révèle pas au joueur une parole hors de sa perception', () => {
  const evenement: EvenementTour = {
    acteur: 'borin',
    acteurNom: 'Borin',
    genre: 'menacer',
    libelle: 'Borin menace Alix',
    cible: 'alix',
    cibleNom: 'Alix',
    temoins: ['alix', 'nerys'],
  };
  const invisible = rendreTour({evenements: [evenement], presentsApres: [], tour: 5, variante: 0});
  assert.equal(invisible, '');
  const visible = rendreTour({evenements: [{...evenement, temoins: ['joueur', 'alix']}], presentsApres: [], tour: 5, variante: 0});
  assert.match(visible, /Borin/);
});

test('une parole citée par un personnage reste une parole, pas un vol ou une attaque', () => {
  const cas = [
    'Je raconte « Je vole les pièces »',
    'Je dis que je lui vole la bourse',
    'Elle affirme « Je vais le frapper »',
    'Je refuse de voler la bourse',
    'Je ne veux pas attaquer',
    'Peut-être que je le frappe',
    'Dans le cas où je le frappe',
  ];
  for (const enonce of cas) {
    assert.notEqual(statutEnonce(enonce), 'direct', enonce);
  }
});


test('Prax compose des propositions inédites sans scripts de dialogue préenregistrés', () => {
  const phrase = composerPropositionPrax({
    sujet: 'Borin',
    personne: 'il',
    verbe: 'montrer',
    complement: 'une ancienne carte',
    temps: 'present',
  });
  assert.equal(phrase?.texte, 'Borin montre une ancienne carte.');
  assert.deepEqual(composerPropositionPrax({
    sujet: 'Borin', personne: 'il', verbe: 'montrer', complement: 'une ancienne carte',
  }), phrase, 'même fait, même formulation stable');
  assert.equal(composerPropositionPrax({ personne: 'je', verbe: 'avoir', complement: 'une carte' })?.texte, 'J’ai une carte.');
  assert.equal(composerPropositionPrax({ sujet: 'Margaux', personne: 'il', verbe: 'voir', complement: 'la grille', mode: 'negation' })?.texte, 'Margaux ne voit pas la grille.');
  assert.equal(composerPropositionPrax({ sujet: 'Borin', personne: 'il', verbe: 'voler', complement: 'une bague', temps: 'passeCompose' })?.texte, 'Borin a volé une bague.');
  assert.equal(composerPropositionPrax({ sujet: 'Borin', personne: 'il', verbe: 'venir', temps: 'passeCompose' }), null, 'pas de genre inventé');
});

test('la proposition préserve question, hypothèse et provenance de la connaissance', () => {
  const scenario = { sujet: 'Alix', personne: 'il' as const, verbe: 'savoir', complement: 'la réponse' };
  const interrogation = composerPropositionPrax({ ...scenario, mode: 'question' });
  assert.equal(interrogation?.texte, 'Est-ce qu’Alix sait la réponse?');
  const hypothese = composerPropositionPrax({ ...scenario, mode: 'hypothese' });
  assert.match(hypothese?.texte ?? '', /Hypothèse : Alix sait la réponse/);
  assert.equal(composerPropositionPrax({ ...scenario, mode: 'rapporte' }), null);
  assert.match(composerPropositionPrax({ ...scenario, mode: 'rapporte', source: 'le veilleur' })?.texte ?? '', /Selon le veilleur, Alix sait la réponse/);
});

test('réordonner le cadre ne déplace jamais un acteur ou ne change jamais le montant', () => {
  const evenement = {
    sujet: 'La marchande', personne: 'il' as const, verbe: 'proposer', complement: '47 pièces de cuivre',
    lieu: 'sur la place', temps: 'imparfait' as const,
  };
  const a = composerPropositionPrax(evenement, 0);
  const b = composerPropositionPrax(evenement, 1);
  assert.equal(a?.texte, 'La marchande proposait 47 pièces de cuivre sur la place.');
  assert.equal(b?.texte, 'Sur la place, la marchande proposait 47 pièces de cuivre.');
  assert.match(a?.texte ?? '', /47 pièces de cuivre/);
  assert.match(b?.texte ?? '', /47 pièces de cuivre/);
});


test('la syntaxe variable ne modifie pas les noms propres', () => {
  const result = composerPropositionPrax({
    sujet:'Borin', personne:'il', verbe:'partir', temps:'present', lieu:'vers les collines',
  }, 1);
  assert.equal(result?.texte, 'Vers les collines, Borin part.');
});

test('les verbes à h aspiré ne reçoivent pas une élision non autorisée', () => {
  const phrase = composerPropositionPrax({
    sujet: 'Borin', personne: 'il', verbe:'hacher', complement:'des légumes', mode:'negation',
  });
  assert.equal(phrase?.texte, 'Borin ne hache pas des légumes.');
});


test('la rectification ne rejoue pas l’acte corrigé', () => {
  const phrase = 'Non, je voulais dire que je frappais à la porte';
  assert.equal(statutEnonce(phrase), 'rectification');
  const ev: EvenementTour = {
    acteur: 'joueur', acteurNom: 'Arwen', cible: 'margaux', cibleNom: 'Margaux',
    genre: 'converser', libelle: 'Arwen rectifie', precision: phrase, temoins: ['margaux'],
  };
  const texte = rendreTour({ evenements: [ev], presentsApres: [], variante: 1, tour: 7 });
  assert.match(texte, /Tu rectifies tes propos/);
  assert.match(texte, /frappais à la porte/);
  assert.doesNotMatch(texte, /Tu attaques/);
});


test('l’ouverture emprunte son ambiance aux faits de la partie sans ajouter des éléments fictifs', () => {
  const scene = rendreOuverture('la taverne', 'Paris', [], '', 'Une fumée bleue flotte devant la cheminée.');
  assert.match(scene, /Une fumée bleue flotte devant la cheminée/);
  assert.doesNotMatch(scene, /orage|pluie|éclairs|sang|foule/i);
  const neutre = rendreOuverture('la taverne', 'Paris', [], '');
  assert.doesNotMatch(neutre, /fumée|pluie|orage/i);
});


test('la négation compose correctement les temps composés sans déplacer les faits', () => {
  const agir = composerPropositionPrax({
    sujet: 'Borin', personne: 'il', verbe: 'voler', temps: 'passeCompose',
    complement: 'la bourse', mode: 'negation',
  });
  assert.equal(agir?.texte, 'Borin n’a pas volé la bourse.');
  const partir = composerPropositionPrax({
    sujet: 'Alix', personne: 'il', genre: 'feminin', verbe: 'venir',
    temps: 'passeCompose', mode: 'negation',
  });
  assert.equal(partir?.texte, 'Alix n’est pas venue.');
  const auxiliaireNonVocalique = composerPropositionPrax({
    sujet: 'Alix', personne: 'il', genre: 'feminin', verbe: 'venir',
    temps: 'passeCompose', mode: 'negation', auxiliaire: 'être',
  });
  assert.equal(auxiliaireNonVocalique?.texte, 'Alix n’est pas venue.');
  const sujetJe = composerPropositionPrax({
    personne: 'je', verbe: 'avoir', temps: 'passeCompose', mode: 'negation',
    complement: 'les clés',
  });
  assert.equal(sujetJe?.texte, 'Je n’ai pas eu les clés.');
});


test('l’oralité ne matérialise pas de postures inventées', () => {
  const e: EvenementTour = {
    acteur:'nerys', acteurNom:'Nerys', genre:'accuser',
    libelle:'Nerys accuse Borin', cible:'joueur', cibleNom:'Arwen',
    temoins:['joueur'],
  };
  const sortie = rendreTour({ evenements:[e], presentsApres:[], variante:0, tour:10 });
  assert.match(sortie, /Nerys : « /);
  assert.doesNotMatch(sortie, /pointe un doigt|se gratte le menton|hoche la tête/);
});


test('une pensée privée de PNJ ne devient pas une observation du joueur', () => {
  const mefiance: EvenementTour = {
    acteur:'margaux', acteurNom:'Margaux', genre:'se_mefier',
    libelle:'Margaux se méfie du joueur', cible:'joueur',
    cibleNom:'Arwen', temoins:['joueur'],
  };
  const rendu = rendreTour({ evenements:[mefiance], presentsApres:[], tour:8, variante:0 });
  assert.equal(rendu, '', 'le statut intérieur appartient à la simulation, pas au récit subjectif');
});


test('le diagnostic expose uniquement les compétences narratives effectivement utilisées', () => {
  const trace: string[] = [];
  const e: EvenementTour = {
    acteur:'margaux', acteurNom:'Margaux', genre:'refuserDemande',
    libelle:'Margaux refuse', cible:'joueur', cibleNom:'Arwen',
    temoins:['joueur'],
  };
  rendreTour({ evenements:[e], presentsApres:[], tour:3, variante:0, acquisNarratifs:trace });
  assert.ok(trace.length > 0);
  assert.ok(trace.some(x=>x.includes('G4-voix-stable')));
  const rapport = {
    version:1 as const, tour:3, ville:'Paris', lieu:'taverne', presents:['Margaux'],
    joueur:{message:'Demande',compris:true},
    evenements:[e], relations:[], coulisses:[], acquisNarratifs:trace,
  };
  assert.ok(lignesCoulisses(rapport).some(line=>line.includes('Savoir narratif utilisé')));
});
