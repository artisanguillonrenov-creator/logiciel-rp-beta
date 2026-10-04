import assert from 'node:assert/strict';
import test from 'node:test';
import { executerM04 } from '../src/engine/noyauV21/m04-dynamiques-sociales';
import { executerM05 } from '../src/engine/noyauV21/m05-engagements-institutions';
import { executerM14 } from '../src/engine/noyauV21/m14-resolution-actions';
import {
  executerM15,
  racinesProvenanceM15,
} from '../src/engine/noyauV21/m15-circulation-information';
import type {
  AffirmationNarrative,
  ContexteNarratifV21,
  EngagementNarratif,
  InstitutionNarrative,
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
      histoireId: 'h-transversal',
      nature: 'fiction',
      initiativeJoueur: 'Je poursuis la scène.',
    },
    scene: {
      id: 'scene-transversal',
      lieu: 'Paris',
      enjeu: 'Résoudre la situation courante.',
      participants: ['joueur', 'sylvana', 'marchand'],
    },
    profilRendu: { ...profilRendu },
    limitesActives: [],
    evenementsPertinents: [],
    personnages: [
      {
        id: 'joueur',
        nom: 'William',
        traits: [],
        valeurs: [],
        buts: [],
        competences: [],
      },
      {
        id: 'sylvana',
        nom: 'Sylvana',
        traits: ['loyale'],
        valeurs: ['honneur'],
        buts: [],
        competences: ['observation'],
      },
      {
        id: 'marchand',
        nom: 'Marchand',
        traits: ['prudent'],
        valeurs: ['fiabilite'],
        buts: [],
        competences: ['commerce'],
      },
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

function tentative(id: string, description = 'Franchir la porte'): TentativeAction {
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

test('T13/M04 — une relation absente mais non confirmée reste inconnue et ne rétrograde pas', () => {
  const sortie = executerM04({
    contexte: contexte({
      evenementsPertinents: [{
        id: 'evt-aide',
        resume: 'William aide Sylvana.',
        acteurs: ['sylvana', 'joueur'],
        sources: [source('src-aide')],
        canonique: true,
      }],
    }),
    experiences: [{
      id: 'exp-aide',
      acteurId: 'sylvana',
      cibleId: 'joueur',
      origine: 'vecue',
      evenementId: 'evt-aide',
      variations: [{ dimension: 'confiance', direction: 'augmente' }],
      justification: 'Aide directement vécue.',
    }],
  });

  assert.equal(sortie.evaluationsRelations[0].applicable, false);
  assert.equal(sortie.transitionsRelationnelles.length, 0);
  assert.ok(sortie.evaluationsRelations[0].blocages.some((b) => b.includes('Relation absente')));
});

test('T14/C01/M04 — une rumeur reçue localement peut modifier une réputation sans devenir vérité universelle', () => {
  const affirmation: AffirmationNarrative = {
    id: 'rumeur-dette',
    contenu: 'William n’aurait pas payé sa dette.',
    statut: 'rumeur',
    origine: source('temoin-1', 'temoignage'),
  };
  const sortie = executerM04({
    contexte: contexte({ affirmations: [affirmation] }),
    diffusionsReputation: [
      {
        id: 'diff-guilde',
        cibleId: 'joueur',
        communauteId: 'guilde-marchands',
        affirmationId: 'rumeur-dette',
        recue: true,
        orientation: 'defavorable',
        jugementPropose: 'Méfiance prudente.',
        sourceIds: ['lettre-recue'],
      },
      {
        id: 'diff-ville',
        cibleId: 'joueur',
        communauteId: 'ville-entiere',
        affirmationId: 'rumeur-dette',
        recue: false,
        orientation: 'defavorable',
        jugementPropose: 'Hostilité générale.',
        sourceIds: ['aucune-reception'],
      },
    ],
  });

  assert.equal(sortie.jugementsReputation.length, 1);
  assert.equal(sortie.jugementsReputation[0].communauteId, 'guilde-marchands');
  assert.equal(sortie.jugementsReputation[0].affirmationId, 'rumeur-dette');
  assert.equal(affirmation.statut, 'rumeur');
});

test('T19/M05 — une réponse ambiguë à une proposition ne devient pas un engagement accepté', () => {
  const sortie = executerM05({
    contexte: contexte(),
    propositionsAccord: [{
      id: 'accord-1',
      nature: 'contrat',
      parties: ['joueur', 'marchand'],
      termes: ['Livrer le colis demain.'],
      acceptations: [{
        acteurId: 'joueur',
        decision: 'ambigu',
        explicite: true,
        sourceIds: ['msg-joueur'],
      }],
      sourceIds: ['proposition-marchand'],
    }],
  });

  assert.equal(sortie.engagementsCrees.length, 1);
  assert.equal(sortie.engagementsCrees[0].engagement.etat, 'propose');
  assert.equal(sortie.engagementsCrees[0].engagement.acceptePar.length, 0);
});

test('T18/M05 — une exécution réussie ne vaut pas accomplissement si une preuve contractuelle manque', () => {
  const engagement: EngagementNarratif = {
    id: 'mission-1',
    parties: ['joueur', 'marchand'],
    termes: ['Livrer le colis.'],
    etat: 'en_cours',
    acceptePar: ['joueur', 'marchand'],
    preuvesAttendues: ['sceau de réception'],
    sources: [source('contrat-1', 'document')],
  };
  const resolution: ResolutionAction = {
    tentativeId: 'livraison-1',
    etat: 'reussite',
    resume: 'Le colis a été livré.',
    facteurs: [],
    effets: [],
  };
  const sortie = executerM05({
    contexte: contexte({ engagements: [engagement], resultatsDejaEtablis: [resolution] }),
    transitionsEngagement: [{
      id: 'fin-mission',
      engagementId: 'mission-1',
      vers: 'accompli',
      justification: 'La livraison matérielle est terminée.',
      sourceIds: ['evt-livraison'],
      resolutionId: 'livraison-1',
      executionConformeAuxTermes: true,
      termesSatisfaits: ['Livrer le colis.'],
      preuvesFournies: [],
    }],
  });

  assert.equal(sortie.evaluationsTransitions[0].applicable, false);
  assert.equal(sortie.transitionsEngagements.length, 0);
  assert.ok(sortie.evaluationsTransitions[0].blocages.some((b) => b.includes('Preuves attendues manquantes')));
});

test('T20/M05 — une institution ignorante d’une rupture secrète ne peut pas sanctionner par omniscience', () => {
  const institution: InstitutionNarrative = {
    id: 'guilde',
    nom: 'Guilde',
    objectifs: ['Faire respecter les contrats'],
    regles: ['Enquêter avant sanction'],
    moyens: ['enquêteurs'],
    agenda: [],
  };
  const sortie = executerM05({
    contexte: contexte({ institutions: [institution] }),
    reactionsInstitutionnelles: [{
      id: 'sanction-secrete',
      institutionId: 'guilde',
      type: 'sanction',
      cibleIds: ['joueur'],
      description: 'Suspendre les privilèges du joueur.',
      justification: 'Rupture supposée du contrat.',
      affirmationId: 'rupture-secrete',
      mandatApplicable: true,
      procedureEtablie: true,
      preuveRequise: false,
      moyensRequis: ['enquêteurs'],
      engagerMaintenant: true,
      sourceIds: ['regle-guilde'],
    }],
  });

  assert.equal(sortie.evaluationsInstitutions[0].statut, 'impossible');
  assert.equal(sortie.reactionsInstitutionnelles.length, 0);
  assert.ok(sortie.evaluationsInstitutions[0].blocages.some((b) => b.includes('connaissance établie')));
});

test('C19/M05 — tâche accomplie et reconnaissance du commanditaire restent deux états distincts', () => {
  const engagement: EngagementNarratif = {
    id: 'mission-2',
    parties: ['joueur', 'marchand'],
    termes: ['Récupérer le registre.'],
    etat: 'en_cours',
    acceptePar: ['joueur', 'marchand'],
    reconnaissancePar: [],
    sources: [source('contrat-2', 'document')],
  };
  const resolution: ResolutionAction = {
    tentativeId: 'recup-registre',
    etat: 'reussite',
    resume: 'Le registre a été récupéré.',
    facteurs: [],
    effets: [],
  };
  const sortie = executerM05({
    contexte: contexte({ engagements: [engagement], resultatsDejaEtablis: [resolution] }),
    transitionsEngagement: [{
      id: 'mission-accomplie',
      engagementId: 'mission-2',
      vers: 'accompli',
      justification: 'Le résultat M14 satisfait le terme convenu.',
      sourceIds: ['evt-registre'],
      resolutionId: 'recup-registre',
      executionConformeAuxTermes: true,
      termesSatisfaits: ['Récupérer le registre.'],
    }],
  });

  assert.equal(sortie.transitionsEngagements.length, 1);
  assert.equal(sortie.transitionsEngagements[0].vers, 'accompli');
  assert.equal(sortie.reconnaissances.length, 0);
  assert.deepEqual(sortie.transitionsEngagements[0].valeurProposee.reconnaissancePar, []);
});

test('T53/M14 — une tâche banale possible réussit sans coût ni incident obligatoire', () => {
  const action = tentative('ouvrir-porte', 'Ouvrir la porte non verrouillée');
  const sortie = executerM14({
    contexte: contexte(),
    tentatives: [action],
    donnees: [{
      tentativeId: action.id,
      typeAction: 'ordinaire',
      intentionValideeM07: true,
      faisabiliteM06: 'possible',
      competence: 'non_requise',
      preparation: 'non_requise',
      contexte: 'neutre',
      opposition: 'aucune',
      banaleSansEnjeu: true,
    }],
  });

  assert.equal(sortie.evaluations[0].issue, 'reussite_simple');
  assert.equal(sortie.resolutions[0].etat, 'reussite');
  assert.deepEqual(sortie.evaluations[0].coutsNecessaires, []);
});

test('T55/M14 — une persuasion ne peut pas imposer une loyauté totale', () => {
  const action = tentative('persuasion-1', 'Convaincre le garde de trahir son serment');
  const sortie = executerM14({
    contexte: contexte(),
    tentatives: [action],
    donnees: [{
      tentativeId: action.id,
      typeAction: 'sociale',
      intentionValideeM07: true,
      faisabiliteM06: 'possible',
      competence: 'etablie_suffisante',
      preparation: 'suffisante',
      contexte: 'neutre',
      opposition: 'faible',
      effetsProposes: [{
        id: 'effet-loyaute',
        domaine: 'relation',
        categorie: 'sociale',
        moteurProprietaire: 'M04',
        cibleIds: ['garde'],
        description: 'Le garde devient totalement loyal au joueur.',
        valeurProposee: { loyaute: 'totale' },
        sourceIds: ['persuasion-1'],
        perceptible: true,
        transmissible: false,
        causal: true,
        natureSocialeInterdite: 'loyaute_totale',
      }],
    }],
  });

  assert.equal(sortie.evaluationsEffets[0].admissible, false);
  assert.ok(sortie.evaluationsEffets[0].blocages.some((b) => b.includes('loyaute_totale')));
  assert.equal(sortie.resultat.transitions.some((t) => t.id === 'm14:effet:effet-loyaute'), false);
});

test('C16/M14 — créativité ou compétence ne contourne pas une impossibilité matérielle M06', () => {
  const action = tentative('mur-1', 'Traverser un mur massif sans ouverture');
  const sortie = executerM14({
    contexte: contexte({ profilRendu: { ...profilRendu, creativite: 'maximale' } }),
    tentatives: [action],
    donnees: [{
      tentativeId: action.id,
      typeAction: 'physique',
      intentionValideeM07: true,
      faisabiliteM06: 'impossible',
      prerequisManquants: ['Aucune capacité permettant de traverser la matière.'],
      competence: 'etablie_suffisante',
      preparation: 'suffisante',
      contexte: 'bloquant',
      opposition: 'aucune',
    }],
  });

  assert.equal(sortie.resolutions[0].etat, 'impossible');
  assert.equal(sortie.evaluations[0].blocage?.type, 'impossibilite');
  assert.equal(sortie.evaluations[0].effetsAdmissibles.length, 0);
});

test('C17/M14 — un échec face à une opposition réelle laisse la prochaine décision au joueur', () => {
  const action = tentative('duel-1', 'Passer la garde malgré son opposition');
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
      choixNouveauApresIssue: 'Décider si William bat en retraite ou tente autre chose.',
    }],
  });

  assert.equal(sortie.resolutions[0].etat, 'echec');
  assert.equal(sortie.evaluations[0].prochainChoixReserve, 'Décider si William bat en retraite ou tente autre chose.');
  assert.ok(sortie.resultat.contribution?.choixReservesAuJoueur?.length);
});

test('T57/M15 — un rapport en route ne crée aucune connaissance chez le destinataire', () => {
  const affirmation: AffirmationNarrative = {
    id: 'rapport-attaque',
    contenu: 'La porte est attaquée.',
    statut: 'rapport',
    origine: source('temoin-attaque', 'temoignage'),
  };
  const sortie = executerM15({
    contexte: contexte({ affirmations: [affirmation] }),
    transmissions: [{
      transmission: {
        id: 'lettre-attaque',
        affirmationId: 'rapport-attaque',
        emetteurId: 'marchand',
        destinataireIds: ['sylvana'],
        canal: 'messager',
        fidelite: 1,
        portee: 'privee',
        recue: false,
      },
      etatAcheminement: 'en_route',
      receptionEtablie: false,
      sourceIds: ['depart-messager'],
    }],
  });

  assert.equal(sortie.evaluationsTransmissions[0].receptionValide, false);
  assert.deepEqual(sortie.evaluationsTransmissions[0].destinatairesRecevant, []);
  assert.equal(sortie.savoirsPourM01.some((s) => s.acteurId === 'sylvana' && s.contenu === affirmation.contenu), false);
});

test('T58/M15 — deux copies héritées du même témoin conservent une racine commune', () => {
  const racine: AffirmationNarrative = {
    id: 'temoignage-racine',
    contenu: 'Le convoi est passé au nord.',
    statut: 'rapport',
    origine: source('temoin-unique', 'temoignage'),
  };
  const ctx = contexte({ affirmations: [racine] });
  const versions = [
    {
      affirmation: { id: 'copie-a', contenu: racine.contenu, statut: 'rapport' as const },
      parentAffirmationIds: ['temoignage-racine'],
      fidelite: 'fidele' as const,
      sourceIds: ['scribe-a'],
    },
    {
      affirmation: { id: 'copie-b', contenu: racine.contenu, statut: 'rapport' as const },
      parentAffirmationIds: ['temoignage-racine'],
      fidelite: 'fidele' as const,
      sourceIds: ['scribe-b'],
    },
  ];

  assert.deepEqual(racinesProvenanceM15(ctx, versions, 'copie-a'), ['temoignage-racine']);
  assert.deepEqual(racinesProvenanceM15(ctx, versions, 'copie-b'), ['temoignage-racine']);
});

test('T59/M15 — une copie fidèle n’est pas déformée mécaniquement', () => {
  const racine: AffirmationNarrative = {
    id: 'doc-original',
    contenu: 'Livraison validée au troisième jour.',
    statut: 'rapport',
    origine: source('registre-original', 'document'),
  };
  const sortie = executerM15({
    contexte: contexte({ affirmations: [racine] }),
    nouvellesAffirmations: [{
      affirmation: {
        id: 'doc-copie',
        contenu: racine.contenu,
        statut: 'rapport',
        origine: source('copie-registre', 'document'),
      },
      parentAffirmationIds: ['doc-original'],
      fidelite: 'fidele',
      sourceIds: ['copie-registre'],
    }],
  });

  assert.equal(sortie.evaluationsAffirmations[0].admissible, true);
  assert.equal(sortie.evaluationsAffirmations[0].fidelite, 'fidele');
  assert.deepEqual(sortie.evaluationsAffirmations[0].racinesProvenance, ['doc-original']);
});

test('C09/M15 — un secret hors du point de vue actif n’est pas exposé au narrateur de scène', () => {
  const secret: AffirmationNarrative = {
    id: 'secret-1',
    contenu: 'Le conseiller est le traître.',
    statut: 'canonique',
    origine: source('fait-secret', 'fait'),
  };
  const sortie = executerM15({
    contexte: contexte({ affirmations: [secret] }),
    pointDeVue: { acteurId: 'sylvana' },
  });

  const evaluation = sortie.evaluationsNarrateur.find((e) => e.affirmationId === 'secret-1');
  assert.equal(evaluation?.montrable, false);
  assert.ok(sortie.resultat.contraintes.some((c) => c.includes('secret-1')));
});
