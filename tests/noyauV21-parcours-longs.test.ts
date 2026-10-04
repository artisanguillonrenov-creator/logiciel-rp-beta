import assert from 'node:assert/strict';
import test from 'node:test';
import { executerKernelV21 } from '../src/engine/noyauV21/kernel';
import { executerM04 } from '../src/engine/noyauV21/m04-dynamiques-sociales';
import { executerM05 } from '../src/engine/noyauV21/m05-engagements-institutions';
import { executerM06 } from '../src/engine/noyauV21/m06-lois-monde-scene';
import { executerM07 } from '../src/engine/noyauV21/m07-agentivite-joueur';
import { executerM11 } from '../src/engine/noyauV21/m11-rythme-narratif-long-terme';
import {
  executerM15,
  racinesProvenanceM15,
} from '../src/engine/noyauV21/m15-circulation-information';
import type {
  AffirmationNarrative,
  BlessureNarrative,
  ContexteNarratifV21,
  EngagementNarratif,
  FilNarratif,
  ProfilRenduNarratif,
  RelationDirigee,
  ResolutionAction,
  SourceNarrative,
} from '../src/engine/noyauV21/types';

const profilRendu: ProfilRenduNarratif = {
  mode: 'adulte',
  ton: 'sombre_realiste',
  violence: 'modere',
  romance: 'faible',
  crudite: 'modere',
  detail: 'modere',
  longueur: 'moyenne',
  rythme: 'normal',
  creativite: 'moyenne',
  humour: 'faible',
  autresPreferences: {},
};

const source = (id: string, type: SourceNarrative['type'] = 'evenement'): SourceNarrative => ({ id, type });

function contexte(overrides: Partial<ContexteNarratifV21> = {}): ContexteNarratifV21 {
  const base: ContexteNarratifV21 = {
    cadre: {
      histoireId: 'h-parcours',
      varianteId: 'principale',
      nature: 'fiction',
      initiativeJoueur: 'Je poursuis la scène.',
    },
    scene: {
      id: 'scene-parcours',
      lieu: 'Paris',
      enjeu: 'Faire progresser la situation sans perdre la continuité.',
      participants: ['joueur', 'sylvana', 'marchand'],
    },
    profilRendu: { ...profilRendu },
    limitesActives: [],
    evenementsPertinents: [],
    personnages: [
      { id: 'joueur', nom: 'William', traits: [], valeurs: [], buts: [], competences: ['survie'] },
      { id: 'sylvana', nom: 'Sylvana', traits: ['loyale'], valeurs: ['honneur'], buts: [], competences: ['observation', 'combat'] },
      { id: 'marchand', nom: 'Marchand', traits: ['prudent'], valeurs: ['fiabilite'], buts: [], competences: ['commerce'] },
    ],
    relations: [],
    reputations: [],
    engagements: [],
    institutions: [],
    situationPhysique: {
      lieu: 'Paris',
      positions: [],
      objetsPertinents: [],
      blessures: [],
      contraintesMaterielles: [],
      moyensDisponibles: [],
    },
    delegations: [],
    archetypes: [],
    ancragesSociaux: [],
    filsNarratifs: [],
    groupes: [],
    connaissances: [],
    affirmations: [],
    transmissions: [],
    resultatsDejaEtablis: [],
    incertitudes: [],
  };

  return {
    ...base,
    ...overrides,
    cadre: { ...base.cadre, ...(overrides.cadre ?? {}) },
    scene: { ...base.scene, ...(overrides.scene ?? {}) },
    profilRendu: { ...base.profilRendu, ...(overrides.profilRendu ?? {}) },
    situationPhysique: {
      ...base.situationPhysique,
      ...(overrides.situationPhysique ?? {}),
    },
  };
}

function lancerKernel(ctx: ContexteNarratifV21) {
  return executerKernelV21({
    contexte: ctx,
    moteurs: {
      m03: { personnageJoueurId: 'joueur' },
      m07: { personnageJoueurId: 'joueur' },
      m09: { personnageJoueurId: 'joueur' },
    },
  });
}

test('Parcours A — dette et réputation : le solde contractuel et la diffusion sociale restent localisés', () => {
  const accord = executerM05({
    contexte: contexte(),
    propositionsAccord: [{
      id: 'dette-livraison',
      nature: 'transaction',
      parties: ['joueur', 'marchand'],
      termes: ['Livrer le registre.', 'Payer 100 pièces d’or.'],
      acceptations: [
        { acteurId: 'joueur', decision: 'accepte', explicite: true, sourceIds: ['accord-joueur'] },
        { acteurId: 'marchand', decision: 'accepte', explicite: true, sourceIds: ['accord-marchand'] },
      ],
      sourceIds: ['contrat-registre'],
    }],
  });
  assert.equal(accord.engagementsCrees[0].engagement.etat, 'accepte');

  const engagementEnCours: EngagementNarratif = {
    ...accord.engagementsCrees[0].engagement,
    etat: 'en_cours',
  };
  const livraison: ResolutionAction = {
    tentativeId: 'livraison-registre',
    etat: 'reussite',
    resume: 'Le registre a été livré et 40 pièces ont été versées.',
    facteurs: [],
    effets: [],
  };

  const paiementPartiel = executerM05({
    contexte: contexte({ engagements: [engagementEnCours], resultatsDejaEtablis: [livraison] }),
    transitionsEngagement: [{
      id: 'paiement-partiel',
      engagementId: engagementEnCours.id,
      vers: 'accompli',
      justification: 'La livraison est faite mais le solde n’est pas payé.',
      sourceIds: ['versement-40'],
      resolutionId: 'livraison-registre',
      executionConformeAuxTermes: true,
      termesSatisfaits: ['Livrer le registre.'],
    }],
  });
  assert.equal(paiementPartiel.evaluationsTransitions[0].applicable, false);
  assert.ok(paiementPartiel.evaluationsTransitions[0].blocages.some((b) => b.includes('Payer 100 pièces')));

  const rumeurDette: AffirmationNarrative = {
    id: 'rumeur-dette-60',
    contenu: 'William doit encore 60 pièces au marchand.',
    statut: 'rumeur',
    origine: source('temoin-paiement', 'temoignage'),
  };
  const diffusion = executerM15({
    contexte: contexte({ affirmations: [rumeurDette] }),
    transmissions: [{
      transmission: {
        id: 'message-dette',
        affirmationId: rumeurDette.id,
        destinataireIds: ['guilde-a'],
        canal: 'messager',
        portee: 'groupe',
        recue: true,
      },
      etatAcheminement: 'arrive',
      receptionEtablie: true,
      sourceIds: ['reception-guilde-a'],
    }],
  });
  assert.ok(diffusion.savoirsPourM01.some((s) => s.acteurId === 'guilde-a' && s.contenu === rumeurDette.contenu));
  assert.equal(diffusion.savoirsPourM01.some((s) => s.acteurId === 'guilde-b'), false);

  const reputation = executerM04({
    contexte: contexte({ affirmations: [rumeurDette] }),
    diffusionsReputation: [
      {
        id: 'rep-a',
        cibleId: 'joueur',
        communauteId: 'guilde-a',
        affirmationId: rumeurDette.id,
        recue: true,
        orientation: 'defavorable',
        jugementPropose: 'Paiement incomplet : prudence.',
        sourceIds: ['reception-guilde-a'],
      },
      {
        id: 'rep-b',
        cibleId: 'joueur',
        communauteId: 'guilde-b',
        affirmationId: rumeurDette.id,
        recue: false,
        orientation: 'defavorable',
        jugementPropose: 'Méfiance générale.',
        sourceIds: ['non-recu'],
      },
    ],
  });
  assert.deepEqual(reputation.jugementsReputation.map((j) => j.communauteId), ['guilde-a']);
  assert.equal(rumeurDette.statut, 'rumeur');

  const remboursement: ResolutionAction = {
    tentativeId: 'remboursement-solde',
    etat: 'reussite',
    resume: 'Le solde de 60 pièces est payé.',
    facteurs: [],
    effets: [],
  };
  const cloture = executerM05({
    contexte: contexte({ engagements: [engagementEnCours], resultatsDejaEtablis: [remboursement] }),
    transitionsEngagement: [{
      id: 'solde-regle',
      engagementId: engagementEnCours.id,
      vers: 'accompli',
      justification: 'La livraison et le paiement complet sont désormais établis.',
      sourceIds: ['recu-solde'],
      resolutionId: 'remboursement-solde',
      executionConformeAuxTermes: true,
      termesSatisfaits: ['Livrer le registre.', 'Payer 100 pièces d’or.'],
    }],
  });
  assert.equal(cloture.transitionsEngagements[0].vers, 'accompli');

  const preuvePaiement: AffirmationNarrative = {
    id: 'preuve-solde',
    contenu: 'Un reçu prouve que la dette est intégralement remboursée.',
    statut: 'rapport',
    origine: source('recu-solde', 'document'),
  };
  const correction = executerM04({
    contexte: contexte({ affirmations: [rumeurDette, preuvePaiement] }),
    diffusionsReputation: [
      {
        id: 'corr-a',
        cibleId: 'joueur',
        communauteId: 'guilde-a',
        affirmationId: preuvePaiement.id,
        recue: true,
        orientation: 'mixte',
        jugementPropose: 'La dette est réglée ; la confiance se répare progressivement.',
        rectifieAffirmationIds: [rumeurDette.id],
        sourceIds: ['recu-solde'],
      },
      {
        id: 'corr-b',
        cibleId: 'joueur',
        communauteId: 'guilde-b',
        affirmationId: preuvePaiement.id,
        recue: false,
        orientation: 'favorable',
        jugementPropose: 'Réhabilitation instantanée.',
        rectifieAffirmationIds: [rumeurDette.id],
        sourceIds: ['preuve-non-recue'],
      },
    ],
  });
  assert.deepEqual(correction.jugementsReputation.map((j) => j.communauteId), ['guilde-a']);
});

test('Parcours B — alliance et autonomie : confiance, désaccord et délégation restent des dimensions distinctes', () => {
  const relation: RelationDirigee = {
    id: 'rel-sylvana-william',
    acteurId: 'sylvana',
    cibleId: 'joueur',
    confiance: 0.5,
    respect: 0.6,
    ressentiment: 0,
    attentes: [],
    evenementsJustificatifs: [],
  };
  const cooperation = {
    id: 'evt-cooperation',
    resume: 'William et Sylvana se couvrent mutuellement pendant une fuite.',
    acteurs: ['joueur', 'sylvana'],
    sources: [source('scene-cooperation')],
    canonique: true,
  };
  const premierLien = executerM04({
    contexte: contexte({ relations: [relation], evenementsPertinents: [cooperation] }),
    experiences: [{
      id: 'exp-cooperation',
      acteurId: 'sylvana',
      cibleId: 'joueur',
      origine: 'vecue',
      evenementId: cooperation.id,
      variations: [
        { dimension: 'confiance', direction: 'augmente' },
        { dimension: 'respect', direction: 'augmente' },
      ],
      justification: 'Coopération directement vécue.',
    }],
  });
  assert.deepEqual(new Set(premierLien.transitionsRelationnelles.map((t) => t.dimension)), new Set(['confiance', 'respect']));

  const desaccord = {
    id: 'evt-desaccord',
    resume: 'Sylvana refuse le plan de William et le dit clairement.',
    acteurs: ['joueur', 'sylvana'],
    sources: [source('scene-desaccord')],
    canonique: true,
  };
  const friction = executerM04({
    contexte: contexte({ relations: [relation], evenementsPertinents: [desaccord] }),
    experiences: [{
      id: 'exp-desaccord',
      acteurId: 'sylvana',
      cibleId: 'joueur',
      origine: 'vecue',
      evenementId: desaccord.id,
      variations: [
        { dimension: 'confiance', direction: 'diminue' },
        { dimension: 'ressentiment', direction: 'augmente' },
      ],
      justification: 'Désaccord sérieux directement vécu.',
    }],
  });
  assert.deepEqual(new Set(friction.transitionsRelationnelles.map((t) => t.dimension)), new Set(['confiance', 'ressentiment']));

  const delegation = executerM07({
    contexte: contexte({ relations: [relation] }),
    personnageJoueurId: 'joueur',
    delegationsDemandees: [{
      id: 'mission-eclaireur',
      auteurId: 'joueur',
      beneficiaireId: 'sylvana',
      tache: 'Reconnaître la porte nord et revenir faire rapport.',
      perimetre: 'Observation et évitement du combat si possible.',
      margeInitiative: 'Choisir l’itinéraire et battre en retraite si nécessaire.',
      sourceIds: ['ordre-joueur'],
      acceptationBeneficiaire: 'acceptee',
    }],
  });
  assert.equal(delegation.evaluationsDelegations[0].statut, 'active');
  assert.equal(delegation.delegationsProposees[0].delegation.tache, 'Reconnaître la porte nord et revenir faire rapport.');
  assert.equal(delegation.delegationsProposees[0].delegation.perimetre, 'Observation et évitement du combat si possible.');

  const fil: FilNarratif = {
    id: 'fil-alliance',
    enjeu: 'Tester l’alliance sans supprimer l’autonomie de Sylvana.',
    acteurs: ['joueur', 'sylvana'],
    etat: 'dormant',
    conditionsReprise: ['Retour de Sylvana après la reconnaissance.'],
  };
  const reprise = executerM11({
    contexte: contexte({ filsNarratifs: [fil] }),
    transitionsDemandees: [{
      id: 'reprise-alliance',
      filId: fil.id,
      vers: 'actif',
      justification: 'Sylvana est revenue et le joueur reprend volontairement ce fil.',
      sourceIds: ['retour-sylvana'],
      conditionRepriseSatisfaite: true,
    }],
  });
  assert.equal(reprise.evaluationsTransitions[0].applicable, true);
  assert.equal(reprise.transitionsFils[0].valeurProposee.etat, 'actif');
});

test('Parcours C — blessure et temps : seuls des soins ou une récupération établis modifient le corps', () => {
  const blessure: BlessureNarrative = {
    id: 'blessure-bras',
    cibleId: 'joueur',
    description: 'Entaille profonde au bras droit.',
    gravite: 'serieuse',
    contraintes: ['Usage du bras droit limité'],
    soins: [],
    sourceEvenementId: 'evt-sauvetage',
  };

  const actionBlessee = executerM06({
    contexte: contexte({ situationPhysique: { blessures: [blessure] } as never }),
    personnageJoueurId: 'joueur',
    tentatives: [{
      tentative: {
        id: 'escalade-blessee',
        auteurId: 'joueur',
        description: 'Escalader avec le bras blessé.',
        cibles: [],
        moyens: [],
        opposition: [],
        preparation: [],
        connaissanceAccessible: [],
      },
      impactsBlessures: [{
        id: 'impact-bras',
        tentativeId: 'escalade-blessee',
        blessureId: blessure.id,
        effet: 'risque',
        justification: 'Le bras blessé rend l’escalade plus risquée.',
        sourceIds: ['etat-bras'],
      }],
    }],
  });
  assert.equal(actionBlessee.evaluationsFaisabilite[0].statut, 'possible_avec_risque');
  assert.deepEqual(actionBlessee.evaluationsFaisabilite[0].blessuresPertinentes, [blessure.id]);

  const soin = executerM06({
    contexte: contexte({ situationPhysique: { blessures: [blessure] } as never }),
    traitementsBlessures: [{
      id: 'soin-bras',
      blessureId: blessure.id,
      type: 'soin',
      etabli: true,
      nouvelleGravite: 'mineure',
      contraintesRetirees: ['Usage du bras droit limité'],
      soinsAjoutes: ['Suture et bandage'],
      evolution: 'Cicatrisation en cours après plusieurs jours.',
      justification: 'Les soins et le temps de récupération sont établis.',
      sourceIds: ['scene-soins', 'ellipse-consentie'],
    }],
  });
  assert.equal(soin.evaluationsTraitements[0].applicable, true);
  assert.equal(soin.transitionsBlessures[0].apres.gravite, 'mineure');
  assert.deepEqual(soin.transitionsBlessures[0].apres.contraintes, []);

  const simpleBaisseDetail = executerM06({
    contexte: contexte({
      profilRendu: { ...profilRendu, detail: 'faible' },
      situationPhysique: { blessures: [blessure] } as never,
    }),
  });
  assert.equal(simpleBaisseDetail.transitionsBlessures.length, 0);
  assert.equal(blessure.gravite, 'serieuse');

  const sauvetage = {
    id: 'evt-sauvetage',
    resume: 'Sylvana a sauvé William lors de l’affrontement où il a été blessé.',
    acteurs: ['joueur', 'sylvana'],
    sources: [source('scene-sauvetage')],
    canonique: true,
  };
  const relation: RelationDirigee = {
    id: 'rel-william-sylvana',
    acteurId: 'joueur',
    cibleId: 'sylvana',
    confiance: 0.5,
    attentes: [],
    evenementsJustificatifs: [sauvetage.id],
  };
  const souvenirRelationnel = executerM04({
    contexte: contexte({ relations: [relation], evenementsPertinents: [sauvetage] }),
    personnageJoueurId: 'joueur',
    experiences: [{
      id: 'souvenir-sauvetage',
      acteurId: 'joueur',
      cibleId: 'sylvana',
      origine: 'vecue',
      evenementId: sauvetage.id,
      variations: [{ dimension: 'confiance', direction: 'augmente' }],
      justification: 'Le sauvetage reste un événement relationnel acquis.',
    }],
  });
  assert.equal(souvenirRelationnel.transitionsRelationnelles[0].dimension, 'confiance');
});

test('Parcours D — secret et rumeur : provenance, réception et correction restent situées', () => {
  const secret: AffirmationNarrative = {
    id: 'secret-traitre',
    contenu: 'Le conseiller est le traître.',
    statut: 'canonique',
    origine: source('fait-secret', 'fait'),
  };
  const secretHorsVue = executerM15({
    contexte: contexte({ affirmations: [secret] }),
    pointDeVue: { acteurId: 'sylvana' },
  });
  assert.equal(secretHorsVue.evaluationsNarrateur.find((e) => e.affirmationId === secret.id)?.montrable, false);

  const trace: AffirmationNarrative = {
    id: 'trace-cachee',
    contenu: 'Une trace relie le conseiller à la cache.',
    statut: 'rapport',
    origine: source('trace-materielle', 'fait'),
  };
  const receptionTrace = executerM15({
    contexte: contexte({ affirmations: [secret, trace] }),
    transmissions: [{
      transmission: {
        id: 'rapport-trace-a',
        affirmationId: trace.id,
        destinataireIds: ['guilde-a'],
        canal: 'rapport',
        portee: 'groupe',
        recue: true,
      },
      etatAcheminement: 'arrive',
      receptionEtablie: true,
      sourceIds: ['lecture-rapport-a'],
    }],
  });
  assert.ok(receptionTrace.savoirsPourM01.some((s) => s.acteurId === 'guilde-a' && s.contenu === trace.contenu));

  const versions = [
    {
      affirmation: { id: 'copie-trace-a', contenu: trace.contenu, statut: 'rapport' as const },
      parentAffirmationIds: [trace.id],
      fidelite: 'fidele' as const,
      sourceIds: ['scribe-a'],
    },
    {
      affirmation: { id: 'copie-trace-b', contenu: trace.contenu, statut: 'rapport' as const },
      parentAffirmationIds: [trace.id],
      fidelite: 'fidele' as const,
      sourceIds: ['scribe-b'],
    },
  ];
  const ctxProvenance = contexte({ affirmations: [trace] });
  assert.deepEqual(racinesProvenanceM15(ctxProvenance, versions, 'copie-trace-a'), [trace.id]);
  assert.deepEqual(racinesProvenanceM15(ctxProvenance, versions, 'copie-trace-b'), [trace.id]);

  const accusation: AffirmationNarrative = {
    id: 'rumeur-accusation',
    contenu: 'William aurait aidé le traître.',
    statut: 'rumeur',
    origine: source('relais-rumeur', 'temoignage'),
  };
  const jugement = executerM04({
    contexte: contexte({ affirmations: [accusation] }),
    diffusionsReputation: [{
      id: 'accusation-a',
      cibleId: 'joueur',
      communauteId: 'guilde-a',
      affirmationId: accusation.id,
      recue: true,
      orientation: 'defavorable',
      jugementPropose: 'Soupçon limité à cette communauté.',
      sourceIds: ['relais-rumeur'],
    }],
  });
  assert.equal(jugement.jugementsReputation[0].communauteId, 'guilde-a');
  assert.equal(accusation.statut, 'rumeur');

  const preuve: AffirmationNarrative = {
    id: 'preuve-contradictoire',
    contenu: 'Un registre prouve que William était ailleurs.',
    statut: 'rapport',
    origine: source('registre-date', 'document'),
  };
  const correction = executerM04({
    contexte: contexte({ affirmations: [accusation, preuve] }),
    diffusionsReputation: [
      {
        id: 'preuve-recue-a',
        cibleId: 'joueur',
        communauteId: 'guilde-a',
        affirmationId: preuve.id,
        recue: true,
        orientation: 'mixte',
        jugementPropose: 'Le soupçon recule après examen du registre.',
        rectifieAffirmationIds: [accusation.id],
        sourceIds: ['registre-date'],
      },
      {
        id: 'preuve-non-recue-b',
        cibleId: 'joueur',
        communauteId: 'guilde-b',
        affirmationId: preuve.id,
        recue: false,
        orientation: 'favorable',
        jugementPropose: 'Correction globale instantanée.',
        rectifieAffirmationIds: [accusation.id],
        sourceIds: ['non-recu'],
      },
    ],
  });
  assert.deepEqual(correction.jugementsReputation.map((j) => j.communauteId), ['guilde-a']);
});

test('Parcours E — histoire alternative et arrêt : intensité, suspension et variantes ne contaminent pas les histoires', () => {
  const evenementA = {
    id: 'evt-variante-a-dette',
    resume: 'Dans la variante A, William contracte une dette de 50 pièces.',
    acteurs: ['joueur'],
    sources: [source('variante-a')],
    canonique: true,
  };
  const blessureA: BlessureNarrative = {
    id: 'blessure-variante-a',
    cibleId: 'joueur',
    description: 'Blessure propre à la variante A.',
    gravite: 'serieuse',
    contraintes: ['Déplacement ralenti'],
    soins: [],
    sourceEvenementId: evenementA.id,
  };

  const intense = lancerKernel(contexte({
    cadre: { histoireId: 'h-alt', varianteId: 'A', nature: 'fiction', initiativeJoueur: 'Je poursuis.' },
    profilRendu: { ...profilRendu, violence: 'maximal', detail: 'maximal' },
    evenementsPertinents: [evenementA],
    situationPhysique: { blessures: [blessureA] } as never,
  }));
  assert.equal(intense.contrat.rendu.profil.violence, 'maximal');
  assert.ok(intense.contrat.faitsDecisifs.some((f) => f.id === evenementA.id));

  const reduite = lancerKernel(contexte({
    cadre: { histoireId: 'h-alt', varianteId: 'A', nature: 'fiction', initiativeJoueur: 'Réduis l’intensité.' },
    profilRendu: { ...profilRendu, violence: 'faible', detail: 'faible' },
    evenementsPertinents: [evenementA],
    situationPhysique: { blessures: [blessureA] } as never,
  }));
  assert.equal(reduite.contrat.rendu.profil.violence, 'faible');

  const arret = lancerKernel(contexte({
    cadre: { histoireId: 'h-alt', varianteId: 'A', nature: 'arret', initiativeJoueur: 'Stop.' },
    profilRendu: { ...profilRendu, violence: 'faible' },
    evenementsPertinents: [evenementA],
    situationPhysique: { blessures: [blessureA] } as never,
  }));
  assert.equal(arret.coordination.modeSortie, 'suspendue');
  assert.equal(arret.coordination.autorisePoursuiteFiction, false);

  const varianteB = lancerKernel(contexte({
    cadre: { histoireId: 'h-alt', varianteId: 'B', nature: 'fiction', initiativeJoueur: 'Je reprends autrement.' },
    evenementsPertinents: [{
      id: 'evt-variante-b',
      resume: 'Dans la variante B, William refuse le marché.',
      acteurs: ['joueur'],
      sources: [source('variante-b')],
      canonique: true,
    }],
    situationPhysique: { blessures: [] } as never,
  }));
  assert.equal(varianteB.contrat.varianteId, 'B');
  assert.equal(varianteB.contrat.faitsDecisifs.some((f) => f.id === evenementA.id), false);
  assert.equal(varianteB.contrat.contraintesApplicables.some((c) => c.includes('blessure-variante-a')), false);
});

test('Parcours F — repos et fils : un calme choisi ne crée pas de climax et un fil dormant revient seulement sur signal réel', () => {
  const filActif: FilNarratif = {
    id: 'fil-ruines',
    enjeu: 'Explorer les ruines lorsque le joueur le souhaite.',
    acteurs: ['joueur', 'sylvana'],
    etat: 'actif',
    importance: 2,
    conditionsReprise: ['Le joueur décide de retourner aux ruines.', 'Une nouvelle réellement reçue concerne les ruines.'],
  };
  const miseEnRepos = executerM11({
    contexte: contexte({ filsNarratifs: [filActif] }),
    transitionsDemandees: [{
      id: 'repos-ruines',
      filId: filActif.id,
      vers: 'dormant',
      justification: 'Après le succès de l’arc, le joueur choisit une période de quotidien.',
      sourceIds: ['fin-arc-ruines'],
      miseEnSommeilJustifiee: true,
    }],
  });
  assert.equal(miseEnRepos.evaluationsTransitions[0].applicable, true);
  const filDormant = miseEnRepos.transitionsFils[0].valeurProposee;
  assert.equal(filDormant.etat, 'dormant');

  const contratIndependant: EngagementNarratif = {
    id: 'contrat-mensuel',
    parties: ['joueur', 'marchand'],
    termes: ['Remettre un rapport à la fin du mois.'],
    etat: 'en_cours',
    acceptePar: ['joueur', 'marchand'],
    echeance: 'fin du mois',
    sources: [source('contrat-mensuel', 'document')],
  };
  const calme = executerM11({
    contexte: contexte({ filsNarratifs: [filDormant], engagements: [contratIndependant] }),
    stagnation: { attenteChoisie: true },
  });
  assert.equal(calme.diagnosticStagnation.recommandation, 'laisser_calme');
  assert.equal(calme.diagnosticStagnation.inventerPerturbation, false);
  assert.equal(calme.prioritesReprise.find((p) => p.filId === filDormant.id)?.priorite, 'aucune');

  const reprise = executerM11({
    contexte: contexte({
      filsNarratifs: [filDormant],
      engagements: [contratIndependant],
      cadre: { histoireId: 'h-parcours', nature: 'fiction', initiativeJoueur: 'Je retourne volontairement aux ruines.' },
    }),
    signauxFils: [{ filId: filDormant.id, initiativeJoueurLiee: true, conditionRepriseSatisfaite: true }],
    transitionsDemandees: [{
      id: 'retour-ruines',
      filId: filDormant.id,
      vers: 'actif',
      justification: 'Le joueur reprend explicitement le fil.',
      sourceIds: ['initiative-joueur-retour'],
      conditionRepriseSatisfaite: true,
    }],
  });
  assert.equal(reprise.evaluationsTransitions[0].applicable, true);
  assert.equal(reprise.transitionsFils[0].valeurProposee.etat, 'actif');

  const nouvelle: AffirmationNarrative = {
    id: 'nouvelle-ruines',
    contenu: 'Un messager rapporte qu’une porte des ruines vient de s’ouvrir.',
    statut: 'rapport',
    origine: source('messager-ruines', 'temoignage'),
  };
  const informationRecue = executerM15({
    contexte: contexte({ affirmations: [nouvelle] }),
    transmissions: [{
      transmission: {
        id: 'lettre-ruines',
        affirmationId: nouvelle.id,
        destinataireIds: ['joueur'],
        canal: 'messager',
        portee: 'privee',
        recue: true,
      },
      etatAcheminement: 'arrive',
      receptionEtablie: true,
      sourceIds: ['reception-joueur'],
    }],
  });
  assert.ok(informationRecue.savoirsPourM01.some((s) => s.acteurId === 'joueur' && s.contenu === nouvelle.contenu));
});
