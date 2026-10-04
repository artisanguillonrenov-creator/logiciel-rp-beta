import assert from 'node:assert/strict';
import test from 'node:test';
import { executerKernelV21 } from '../src/engine/noyauV21/kernel';
import { executerM04 } from '../src/engine/noyauV21/m04-dynamiques-sociales';
import { executerM05 } from '../src/engine/noyauV21/m05-engagements-institutions';
import { executerM14 } from '../src/engine/noyauV21/m14-resolution-actions';
import { executerM15 } from '../src/engine/noyauV21/m15-circulation-information';
import type {
  AffirmationNarrative,
  ContexteNarratifV21,
  EngagementNarratif,
  ProfilRenduNarratif,
  ResolutionAction,
  SourceNarrative,
  TentativeAction,
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
      histoireId: 'h-transversal-suite',
      nature: 'fiction',
      initiativeJoueur: 'Je poursuis la scène.',
    },
    scene: {
      id: 'scene-transversal-suite',
      lieu: 'Paris',
      enjeu: 'Résoudre la situation courante.',
      participants: ['joueur', 'sylvana', 'marchand'],
    },
    profilRendu: { ...profilRendu },
    limitesActives: [],
    evenementsPertinents: [],
    personnages: [
      { id: 'joueur', nom: 'William', traits: [], valeurs: [], buts: [], competences: [] },
      { id: 'sylvana', nom: 'Sylvana', traits: ['loyale'], valeurs: ['honneur'], buts: [], competences: ['observation'] },
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
    situationPhysique: { ...base.situationPhysique, ...(overrides.situationPhysique ?? {}) },
  };
}

function tentative(id: string, description: string): TentativeAction {
  return {
    id,
    auteurId: 'joueur',
    description,
    cibles: [],
    moyens: [],
    opposition: [],
    preparation: [],
    connaissanceAccessible: [],
  };
}

test('C02/M14 — une blessure sérieuse reste un coût physique causal et le choix volontaire suivant reste au joueur', () => {
  const action = tentative('assaut-1', 'Forcer le passage malgré la garde');
  const sortie = executerM14({
    contexte: contexte(),
    tentatives: [action],
    donnees: [{
      tentativeId: action.id,
      typeAction: 'physique',
      intentionValideeM07: true,
      faisabiliteM06: 'possible',
      competence: 'etablie_partielle',
      preparation: 'partielle',
      contexte: 'defavorable',
      opposition: 'forte',
      effetsProposes: [{
        id: 'blessure-bras',
        domaine: 'physique',
        categorie: 'materielle',
        moteurProprietaire: 'M06',
        cibleIds: ['joueur'],
        description: 'Une blessure sérieuse au bras résulte de l’affrontement.',
        valeurProposee: { gravite: 'serieuse', contrainte: 'usage du bras limité' },
        sourceIds: ['assaut-1'],
        perceptible: true,
        transmissible: true,
        causal: true,
        coutNecessaire: true,
      }],
      choixNouveauApresIssue: 'Décider si William se replie, négocie ou tente une autre action.',
    }],
  });

  assert.equal(sortie.resolutions[0].etat, 'echec');
  assert.ok(sortie.evaluations[0].coutsNecessaires.some((cout) => cout.includes('blessure sérieuse')));
  assert.ok(sortie.resultat.transitions.some((transition) => transition.id === 'm14:effet:blessure-bras' && transition.moteurProprietaire === 'M06'));
  assert.equal(sortie.evaluations[0].prochainChoixReserve, 'Décider si William se replie, négocie ou tente une autre action.');
});

test('T17/M05 — un achat livré et payé peut être clos sans rapport supplémentaire inventé', () => {
  const engagement: EngagementNarratif = {
    id: 'achat-epee',
    parties: ['joueur', 'marchand'],
    termes: ['Remettre l’épée.', 'Payer 10 pièces d’or.'],
    etat: 'en_cours',
    acceptePar: ['joueur', 'marchand'],
    sources: [source('accord-achat', 'document')],
  };
  const resolution: ResolutionAction = {
    tentativeId: 'transaction-epee',
    etat: 'reussite',
    resume: 'L’épée et le paiement ont été échangés.',
    facteurs: [],
    effets: [],
  };

  const sortie = executerM05({
    contexte: contexte({ engagements: [engagement], resultatsDejaEtablis: [resolution] }),
    transitionsEngagement: [{
      id: 'clore-achat',
      engagementId: 'achat-epee',
      vers: 'accompli',
      justification: 'Les deux termes de la transaction sont satisfaits.',
      sourceIds: ['transaction-epee'],
      resolutionId: 'transaction-epee',
      executionConformeAuxTermes: true,
      termesSatisfaits: ['Remettre l’épée.', 'Payer 10 pièces d’or.'],
    }],
  });

  assert.equal(sortie.evaluationsTransitions[0].applicable, true);
  assert.equal(sortie.transitionsEngagements[0].vers, 'accompli');
});

test('C06/M05 — raconter à nouveau une récompense déjà accomplie ne crée pas un second accomplissement', () => {
  const engagement: EngagementNarratif = {
    id: 'recompense-1',
    parties: ['joueur', 'guilde'],
    termes: ['Verser 100 pièces d’or.'],
    etat: 'accompli',
    acceptePar: ['joueur', 'guilde'],
    contrepartie: '100 pièces d’or déjà versées',
    sources: [source('paiement-initial', 'evenement')],
  };

  const sortie = executerM05({
    contexte: contexte({ engagements: [engagement] }),
    transitionsEngagement: [{
      id: 'rejouer-paiement',
      engagementId: 'recompense-1',
      vers: 'accompli',
      justification: 'La scène rappelle le paiement déjà effectué.',
      sourceIds: ['rappel-paiement'],
    }],
  });

  assert.equal(sortie.evaluationsTransitions[0].applicable, false);
  assert.equal(sortie.transitionsEngagements.length, 0);
  assert.ok(sortie.evaluationsTransitions[0].blocages.some((blocage) => blocage.includes('accompli → accompli')));
});

test('T54/M14 — une tentative formulée comme un succès reste soumise à l’opposition réelle', () => {
  const action = tentative('attaque-chef', 'J’abats le chef d’un seul coup.');
  const sortie = executerM14({
    contexte: contexte(),
    tentatives: [action],
    donnees: [{
      tentativeId: action.id,
      typeAction: 'physique',
      intentionValideeM07: true,
      faisabiliteM06: 'possible',
      competence: 'etablie_partielle',
      preparation: 'partielle',
      contexte: 'neutre',
      opposition: 'dominante',
    }],
  });

  assert.equal(sortie.evaluations[0].issue, 'opposition_victorieuse');
  assert.equal(sortie.resolutions[0].etat, 'echec');
});

test('T60/M15→M04 — une trace peut produire un effet social seulement après découverte et réception', () => {
  const affirmation: AffirmationNarrative = {
    id: 'trace-effraction',
    contenu: 'Des traces relient William à l’effraction.',
    statut: 'rapport',
    origine: source('trace-physique', 'fait'),
  };
  const base = contexte({ affirmations: [affirmation] });
  const transmission = {
    id: 'rapport-trace',
    affirmationId: affirmation.id,
    emetteurId: 'enqueteur',
    destinataireIds: ['guilde'],
    canal: 'messager',
    fidelite: 1,
    portee: 'groupe' as const,
    recue: false,
  };

  const avant = executerM15({
    contexte: base,
    transmissions: [{
      transmission,
      etatAcheminement: 'en_route',
      receptionEtablie: false,
      sourceIds: ['depart-rapport'],
    }],
  });
  assert.equal(avant.savoirsPourM01.some((savoir) => savoir.acteurId === 'guilde'), false);

  const apres = executerM15({
    contexte: base,
    transmissions: [{
      transmission: { ...transmission, recue: true },
      etatAcheminement: 'arrive',
      receptionEtablie: true,
      sourceIds: ['reception-rapport'],
    }],
  });
  assert.ok(apres.savoirsPourM01.some((savoir) => savoir.acteurId === 'guilde' && savoir.contenu === affirmation.contenu));

  const social = executerM04({
    contexte: base,
    diffusionsReputation: [{
      id: 'jugement-apres-reception',
      cibleId: 'joueur',
      communauteId: 'guilde',
      affirmationId: affirmation.id,
      recue: true,
      orientation: 'defavorable',
      jugementPropose: 'Méfiance après réception du rapport.',
      sourceIds: ['reception-rapport'],
    }],
  });
  assert.equal(social.jugementsReputation.length, 1);
});

test('C15/M04+M15 — un démenti reçu seulement par une communauté ne corrige pas toutes les réputations', () => {
  const rumeur: AffirmationNarrative = {
    id: 'rumeur-vol',
    contenu: 'William aurait volé le registre.',
    statut: 'rumeur',
    origine: source('temoin-rumeur', 'temoignage'),
  };
  const dementi: AffirmationNarrative = {
    id: 'dementi-vol',
    contenu: 'Une preuve disculpe William.',
    statut: 'rapport',
    origine: source('preuve-dementi', 'document'),
  };
  const base = contexte({ affirmations: [rumeur, dementi] });

  const info = executerM15({
    contexte: base,
    transmissions: [{
      transmission: {
        id: 'lettre-dementi',
        affirmationId: 'dementi-vol',
        destinataireIds: ['guilde-a'],
        canal: 'lettre',
        portee: 'groupe',
        recue: true,
      },
      etatAcheminement: 'arrive',
      receptionEtablie: true,
      sourceIds: ['preuve-dementi'],
    }],
  });
  assert.ok(info.savoirsPourM01.some((savoir) => savoir.acteurId === 'guilde-a' && savoir.affirmationId === undefined) || info.savoirsPourM01.some((savoir) => savoir.acteurId === 'guilde-a'));

  const social = executerM04({
    contexte: base,
    diffusionsReputation: [
      {
        id: 'correction-guilde-a',
        cibleId: 'joueur',
        communauteId: 'guilde-a',
        affirmationId: 'dementi-vol',
        recue: true,
        orientation: 'mixte',
        jugementPropose: 'Le jugement est révisé sans effacement instantané de toute défiance.',
        rectifieAffirmationIds: ['rumeur-vol'],
        sourceIds: ['lettre-dementi'],
      },
      {
        id: 'correction-guilde-b',
        cibleId: 'joueur',
        communauteId: 'guilde-b',
        affirmationId: 'dementi-vol',
        recue: false,
        orientation: 'favorable',
        jugementPropose: 'Correction non reçue.',
        rectifieAffirmationIds: ['rumeur-vol'],
        sourceIds: ['aucune-reception'],
      },
    ],
  });

  assert.equal(social.jugementsReputation.length, 1);
  assert.equal(social.jugementsReputation[0].communauteId, 'guilde-a');
});

test('C18/M08+M13 — un niveau maximal est conservé avant un arrêt réel, puis la fiction est suspendue', () => {
  const profilMaximal: ProfilRenduNarratif = {
    ...profilRendu,
    violence: 'maximal',
    detail: 'maximal',
  };
  const avant = executerKernelV21({
    contexte: contexte({ profilRendu: profilMaximal }),
    moteurs: {
      m03: { personnageJoueurId: 'joueur' },
      m07: { personnageJoueurId: 'joueur' },
      m09: { personnageJoueurId: 'joueur' },
    },
  });

  assert.equal(avant.contrat.rendu.profil.violence, 'maximal');
  assert.equal(avant.coordination.modeSortie, 'scene');

  const apres = executerKernelV21({
    contexte: contexte({
      profilRendu: profilMaximal,
      cadre: {
        histoireId: 'h-transversal-suite',
        nature: 'arret',
        initiativeJoueur: 'Stop.',
      },
    }),
    moteurs: {
      m03: { personnageJoueurId: 'joueur' },
      m07: { personnageJoueurId: 'joueur' },
      m09: { personnageJoueurId: 'joueur' },
    },
  });

  assert.equal(apres.coordination.modeSortie, 'suspendue');
  assert.equal(apres.coordination.autorisePoursuiteFiction, false);
});
