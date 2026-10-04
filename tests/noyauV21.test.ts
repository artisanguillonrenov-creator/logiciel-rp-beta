import assert from 'node:assert/strict';
import test from 'node:test';
import { executerKernelV21 } from '../src/engine/noyauV21/kernel';
import { creerNarrativeContractV21 } from '../src/engine/noyauV21/narrativeContract';
import { validerReponseAvecContratV21 } from '../src/engine/noyauV21/validationReponseV21';
import type { ContexteNarratifV21, ProfilRenduNarratif } from '../src/engine/noyauV21/types';

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

function contexte(overrides: Partial<ContexteNarratifV21> = {}): ContexteNarratifV21 {
  const base: ContexteNarratifV21 = {
    cadre: {
      histoireId: 'h-test',
      nature: 'fiction',
      initiativeJoueur: 'Je demande ce qui se passe.',
    },
    scene: {
      id: 'scene-test',
      lieu: 'Paris',
      enjeu: 'Répondre à la situation présente.',
      participants: ['joueur', 'sylvana'],
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

function contratVide() {
  return creerNarrativeContractV21({
    histoireId: 'h-test',
    natureEchange: 'fiction',
    initiativeJoueur: 'Je reste immobile.',
    scene: { participants: ['joueur'] },
    profilRendu: { ...profilRendu },
  });
}

test('V2.1 — le Kernel exécute exactement les quinze responsabilités M01 à M15', () => {
  const sortie = lancerKernel(contexte());
  assert.equal(sortie.version, '2.1');
  assert.equal(sortie.diagnostic.moteursExecutes.length, 15);
  assert.equal(new Set(sortie.diagnostic.moteursExecutes).size, 15);
  for (let i = 1; i <= 15; i += 1) {
    const id = `M${String(i).padStart(2, '0')}`;
    assert.ok(sortie.diagnostic.moteursExecutes.includes(id as never), `${id} doit être exécuté`);
  }
});

test('V2.1 — le Kernel ne mute pas le contexte fourni', () => {
  const ctx = contexte({ incertitudes: ['La provenance du sceau reste inconnue.'] });
  const avant = structuredClone(ctx);
  lancerKernel(ctx);
  assert.deepEqual(ctx, avant);
});

test('T49/C05 — un arrêt réel suspend immédiatement la fiction', () => {
  const sortie = lancerKernel(contexte({
    cadre: {
      histoireId: 'h-test',
      nature: 'arret',
      initiativeJoueur: 'Stop.',
    },
  }));
  assert.equal(sortie.coordination.modeSortie, 'suspendue');
  assert.equal(sortie.coordination.autorisePoursuiteFiction, false);
  assert.equal(sortie.contrat.blocage?.type, 'limite');
});

test('M01/K02 — une décision pendante reste explicitement réservée au joueur', () => {
  const sortie = lancerKernel(contexte({
    cadre: {
      histoireId: 'h-test',
      nature: 'fiction',
      initiativeJoueur: 'Je demande les risques.',
      decisionPendante: 'Décider si William signe le contrat.',
    },
  }));
  assert.ok(
    sortie.contrat.miseEnScene.choixReservesAuJoueur.some((choix) =>
      choix.description.includes('signe le contrat'),
    ),
  );
});

test('T02/K06 — une incertitude reste une contrainte et ne devient pas un fait canonique', () => {
  const incertitude = 'Le commanditaire du message est inconnu.';
  const sortie = lancerKernel(contexte({ incertitudes: [incertitude] }));
  assert.ok(sortie.contrat.contraintesApplicables.some((c) => c.includes(incertitude)));
  assert.equal(sortie.contrat.faitsDecisifs.some((fait) => fait.contenu.includes(incertitude)), false);
});

test('M01/M02 — un événement canonique pertinent entre dans les faits décisifs', () => {
  const sortie = lancerKernel(contexte({
    evenementsPertinents: [{
      id: 'evt-1',
      resume: 'La porte nord a été détruite.',
      acteurs: ['sylvana'],
      sources: [{ id: 'src-1', type: 'evenement' }],
      canonique: true,
    }],
  }));
  assert.ok(sortie.contrat.faitsDecisifs.some((fait) => fait.id === 'evt-1'));
});

test('K04/M15 — une connaissance située n’existe dans le contrat que si son affirmation existe', () => {
  const sortie = lancerKernel(contexte({
    affirmations: [{ id: 'a1', contenu: 'La route est coupée.', statut: 'rapport' }],
    connaissances: [{
      acteurId: 'sylvana',
      affirmationId: 'a1',
      statut: 'rapport',
      sourceIds: ['rapport-1'],
    }],
  }));
  assert.ok(sortie.contrat.savoirsSitues.some((s) => s.acteurId === 'sylvana' && s.contenu === 'La route est coupée.'));
});

test('K04 — une connaissance pointant vers une affirmation absente est ignorée avec alerte', () => {
  const sortie = lancerKernel(contexte({
    connaissances: [{
      acteurId: 'sylvana',
      affirmationId: 'absente',
      statut: 'rapport',
      sourceIds: ['rapport-absent'],
    }],
  }));
  assert.equal(sortie.contrat.savoirsSitues.some((s) => s.acteurId === 'sylvana'), false);
  assert.ok(sortie.alertes.some((alerte) => alerte.includes('affirmation absente')));
});

test('K08 — une réponse narrative ordinaire sans fuite interne passe le validateur local', () => {
  const resultat = validerReponseAvecContratV21({
    reponse: '*La pluie frappe les pavés.*\nSYLVANA : « La route est libre. »',
    contrat: contratVide(),
    modeSortie: 'scene',
  });
  assert.equal(resultat.rapport.ok, true);
});

test('C10/K09 — les identifiants internes M01–M15 ne doivent jamais être exposés au joueur', () => {
  const resultat = validerReponseAvecContratV21({
    reponse: 'Le moteur M07 réserve cette décision au joueur.',
    contrat: contratVide(),
    modeSortie: 'scene',
  });
  assert.equal(resultat.rapport.ok, false);
  assert.ok(resultat.diagnostic.fuiteMecaniqueInterne.includes('identifiant M01–M15'));
});

test('T49 — une sortie suspendue rejette toute poursuite balisée de la fiction', () => {
  const resultat = validerReponseAvecContratV21({
    reponse: '*Sylvana reprend sa marche comme si de rien n’était.*',
    contrat: contratVide(),
    modeSortie: 'suspendue',
  });
  assert.equal(resultat.rapport.ok, false);
  assert.ok(resultat.rapport.checks.some((check) => check.nom === 'continuite'));
});

test('clarification — une question ciblée est exigée quand le Kernel demande une clarification', () => {
  const contrat = contratVide();
  contrat.clarification = {
    question: 'Autorises-tu la mort définitive de ton personnage ?',
    raison: 'La tentative serait autrement incompatible avec la protection active.',
    suspendResolution: true,
  };

  const sansQuestion = validerReponseAvecContratV21({
    reponse: 'La résolution reste suspendue.',
    contrat,
    modeSortie: 'clarification',
  });
  assert.equal(sansQuestion.rapport.ok, false);

  const avecQuestion = validerReponseAvecContratV21({
    reponse: 'Autorises-tu la mort définitive de ton personnage ?',
    contrat,
    modeSortie: 'clarification',
  });
  assert.equal(avecQuestion.rapport.ok, true);
});

test('T22/K07 — la protection contre la mort définitive bloque « tu meurs »', () => {
  const contrat = contratVide();
  contrat.limites.push({
    theme: 'mort définitive du personnage joueur',
    autorisee: false,
    portee: 'campagne',
  });

  const resultat = validerReponseAvecContratV21({
    reponse: 'Tu meurs. Ta mort est définitive.',
    contrat,
    modeSortie: 'scene',
  });
  assert.equal(resultat.rapport.ok, false);
  assert.ok(resultat.rapport.checks.some((check) => check.nom === 'contrat_joueur'));
});
