// Elyndor — Noyau narratif natif V2.1
// M01 — Production de la réponse.
//
// M01 coordonne le tour courant : il choisit ce qui doit être traité et
// montré, rassemble les contributions utiles des autres responsabilités et
// prépare le NarrativeContract. Il ne possède ni ne recalcule leurs états.

import {
  creerNarrativeContractV21,
  type DecisionReserveeJoueur,
  type FaitContractuel,
  type IntentionPnjContractuelle,
  type LimiteContractuelle,
  type NarrativeContractV21,
  type SavoirContractuel,
} from './narrativeContract';
import type {
  BlocageNarratif,
  ContexteNarratifV21,
  ControleNarratif,
  IdMoteurNarratif,
  PropositionTransition,
  ResolutionAction,
  ResultatMoteur,
} from './types';

export const MOTEUR_M01 = 'M01' as const;

/**
 * Contribution compacte qu'un moteur spécialisé peut remettre à M01.
 *
 * Elle ne constitue pas un nouvel état persistant. Les propriétaires M02 à
 * M15 conservent l'autorité sur leurs domaines ; M01 ne fait qu'assembler ce
 * qui est pertinent pour le tour courant.
 */
export interface ContributionSceneM01 {
  faits?: FaitContractuel[];
  savoirs?: SavoirContractuel[];
  intentionsPnj?: IntentionPnjContractuelle[];
  resolutions?: ResolutionAction[];
  contraintes?: string[];
  pointsAMontrer?: string[];
  interditsNarratifs?: string[];
  choixReservesAuJoueur?: DecisionReserveeJoueur[];
  dimensionsRenduActives?: string[];
  dimensionsRenduInactives?: string[];
  directivesRendu?: string[];
  controles?: ControleNarratif[];
}

export interface EntreeM01 {
  contexte: ContexteNarratifV21;
  contributions?: ResultatMoteur<ContributionSceneM01>[];
  controlesSupplementaires?: ControleNarratif[];
}

export type ModeSortieM01 =
  | 'scene'
  | 'hors_fiction'
  | 'clarification'
  | 'suspendue';

export interface SortieM01 {
  moteur: typeof MOTEUR_M01;
  contrat: NarrativeContractV21;
  modeSortie: ModeSortieM01;
  autorisePoursuiteFiction: boolean;
  alertes: string[];
}

const PRIORITE_BLOCAGE: Record<BlocageNarratif['type'], number> = {
  limite: 0,
  agentivite: 1,
  impossibilite: 2,
  contradiction: 3,
  information_manquante: 4,
  autre: 5,
};

function texteNonVide(valeur: string | undefined): valeur is string {
  return typeof valeur === 'string' && valeur.trim().length > 0;
}

function uniquesTextes(valeurs: Iterable<string>): string[] {
  const resultat: string[] = [];
  const vus = new Set<string>();

  for (const valeur of valeurs) {
    const propre = valeur.trim();
    if (!propre) continue;
    const cle = propre.toLocaleLowerCase('fr');
    if (vus.has(cle)) continue;
    vus.add(cle);
    resultat.push(propre);
  }

  return resultat;
}

function uniquesParCle<T>(valeurs: Iterable<T>, cle: (valeur: T) => string): T[] {
  const resultat: T[] = [];
  const vus = new Set<string>();

  for (const valeur of valeurs) {
    const id = cle(valeur);
    if (vus.has(id)) continue;
    vus.add(id);
    resultat.push(valeur);
  }

  return resultat;
}

function faitsCanoniquesDuContexte(contexte: ContexteNarratifV21): FaitContractuel[] {
  return contexte.evenementsPertinents
    .filter((evenement) => evenement.canonique)
    .map((evenement) => ({
      id: evenement.id,
      contenu: evenement.resume,
      sources: evenement.sources,
      prioritaire: true,
    }));
}

function savoirsDuContexte(contexte: ContexteNarratifV21): {
  savoirs: SavoirContractuel[];
  alertes: string[];
} {
  const affirmationParId = new Map(
    contexte.affirmations.map((affirmation) => [affirmation.id, affirmation] as const),
  );
  const savoirs: SavoirContractuel[] = [];
  const alertes: string[] = [];

  for (const connaissance of contexte.connaissances) {
    const affirmation = affirmationParId.get(connaissance.affirmationId);
    if (!affirmation) {
      alertes.push(
        `Connaissance ignorée pour ${connaissance.acteurId} : affirmation ${connaissance.affirmationId} introuvable.`,
      );
      continue;
    }

    savoirs.push({
      acteurId: connaissance.acteurId,
      contenu: affirmation.contenu,
      statut: connaissance.statut,
      sourceIds: connaissance.sourceIds,
      confiance: connaissance.confiance,
    });
  }

  return { savoirs, alertes };
}

function limitesDuContexte(contexte: ContexteNarratifV21): LimiteContractuelle[] {
  return contexte.limitesActives.map((limite) => ({
    theme: limite.theme,
    autorisee: limite.autorisee,
    portee: limite.portee,
    intensite: limite.intensite,
    signalActuel: limite.signalActuel,
  }));
}

function contraintesMateriellesDuContexte(contexte: ContexteNarratifV21): string[] {
  const contraintes = [...contexte.situationPhysique.contraintesMaterielles];

  for (const blessure of contexte.situationPhysique.blessures) {
    for (const contrainte of blessure.contraintes) {
      contraintes.push(`${blessure.cibleId} — ${contrainte}`);
    }
  }

  return contraintes;
}

function blocageArret(contexte: ContexteNarratifV21): BlocageNarratif | undefined {
  if (contexte.cadre.nature !== 'arret') return undefined;

  return {
    type: 'limite',
    raison: "Un arrêt réel a été demandé ; la fiction ne doit pas poursuivre la trajectoire en cours.",
  };
}

function selectionnerBlocage(
  contexte: ContexteNarratifV21,
  contributions: ResultatMoteur<ContributionSceneM01>[],
): BlocageNarratif | undefined {
  const candidats: BlocageNarratif[] = [];
  const arret = blocageArret(contexte);
  if (arret) candidats.push(arret);

  for (const resultat of contributions) {
    if (resultat.blocage) candidats.push(resultat.blocage);
  }

  return candidats.sort(
    (a, b) => PRIORITE_BLOCAGE[a.type] - PRIORITE_BLOCAGE[b.type],
  )[0];
}

function modeSortiePour(
  contexte: ContexteNarratifV21,
  blocage: BlocageNarratif | undefined,
): ModeSortieM01 {
  if (contexte.cadre.nature === 'arret') return 'suspendue';

  if (blocage?.questionClarification) return 'clarification';

  if (blocage && (blocage.type === 'limite' || blocage.type === 'impossibilite')) {
    return 'suspendue';
  }

  if (
    contexte.cadre.nature === 'hors_personnage' ||
    contexte.cadre.nature === 'clarification' ||
    contexte.cadre.nature === 'reglage'
  ) {
    return 'hors_fiction';
  }

  if (blocage?.type === 'information_manquante') return 'clarification';
  return 'scene';
}

function interditsM01(contexte: ContexteNarratifV21): string[] {
  const interdits = [
    "Ne pas inventer une décision, une réplique, une intention ou une émotion intime du joueur.",
    "Ne pas transformer une hypothèse, une rumeur ou une donnée manquante en fait canonique.",
    "Ne pas remplacer un fait établi ni ajouter une capacité décisive sans fondement.",
    "Ne pas créer une conséquence uniquement pour rendre la scène plus spectaculaire.",
    "Ne pas réciter les moteurs, les arbitrages internes, un HUD ou des calculs au joueur.",
  ];

  if (contexte.cadre.nature !== 'fiction') {
    interdits.push("Ne pas déguiser cet échange hors fiction en événement du monde.");
  }

  return interdits;
}

function contraintesM01(contexte: ContexteNarratifV21): string[] {
  const contraintes = contraintesMateriellesDuContexte(contexte);

  for (const incertitude of contexte.incertitudes) {
    if (!texteNonVide(incertitude)) continue;
    contraintes.push(`Incertitude ouverte — ne pas présenter comme établi : ${incertitude.trim()}`);
  }

  if (contexte.cadre.nature === 'arret') {
    contraintes.push("Suspendre immédiatement la poursuite de la fiction.");
  } else if (contexte.cadre.nature !== 'fiction') {
    contraintes.push("Traiter d'abord la demande hors personnage, le réglage ou la clarification.");
  }

  return contraintes;
}

function choixReserveDuContexte(contexte: ContexteNarratifV21): DecisionReserveeJoueur[] {
  if (!texteNonVide(contexte.cadre.decisionPendante)) return [];
  return [
    {
      description: contexte.cadre.decisionPendante.trim(),
      raison: 'Décision explicitement laissée au joueur dans le cadre de cet échange.',
    },
  ];
}

function pointsDeBase(contexte: ContexteNarratifV21): string[] {
  if (contexte.cadre.nature !== 'fiction') return [];

  const points: string[] = [];
  if (texteNonVide(contexte.scene.enjeu)) {
    points.push(contexte.scene.enjeu.trim());
  }

  for (const resolution of contexte.resultatsDejaEtablis) {
    if (texteNonVide(resolution.resume)) points.push(resolution.resume.trim());
  }

  if (points.length === 0 && texteNonVide(contexte.cadre.initiativeJoueur)) {
    points.push(`Répondre directement à l'initiative : ${contexte.cadre.initiativeJoueur.trim()}`);
  }

  return points;
}

function moteursContributeurs(
  contributions: ResultatMoteur<ContributionSceneM01>[],
): IdMoteurNarratif[] {
  return uniquesParCle<IdMoteurNarratif>(
    [MOTEUR_M01, ...contributions.map((resultat) => resultat.moteur)],
    (moteur) => moteur,
  );
}

function ajouterContributions(
  contrat: NarrativeContractV21,
  contributions: ResultatMoteur<ContributionSceneM01>[],
): { alertes: string[]; controles: ControleNarratif[] } {
  const faits = [...contrat.faitsDecisifs];
  const savoirs = [...contrat.savoirsSitues];
  const intentions = [...contrat.intentionsPnj];
  const resolutions = [...contrat.resolutions];
  const contraintes = [...contrat.contraintesApplicables];
  const points = [...contrat.miseEnScene.pointsAMontrer];
  const interdits = [...contrat.miseEnScene.interditsNarratifs];
  const choix = [...contrat.miseEnScene.choixReservesAuJoueur];
  const dimensionsActives = [...contrat.rendu.dimensionsActives];
  const dimensionsInactives = [...contrat.rendu.dimensionsInactives];
  const directivesRendu = [...contrat.rendu.directives];
  const transitions: PropositionTransition[] = [...contrat.transitionsProposees];
  const controles: ControleNarratif[] = [...contrat.controles];
  const alertes: string[] = [];

  for (const resultat of contributions) {
    contraintes.push(...resultat.contraintes);
    alertes.push(...resultat.alertes);
    transitions.push(...resultat.transitions);

    const contribution = resultat.contribution;
    if (!contribution) continue;

    faits.push(...(contribution.faits ?? []));
    savoirs.push(...(contribution.savoirs ?? []));
    intentions.push(...(contribution.intentionsPnj ?? []));
    resolutions.push(...(contribution.resolutions ?? []));
    contraintes.push(...(contribution.contraintes ?? []));
    points.push(...(contribution.pointsAMontrer ?? []));
    interdits.push(...(contribution.interditsNarratifs ?? []));
    choix.push(...(contribution.choixReservesAuJoueur ?? []));
    dimensionsActives.push(...(contribution.dimensionsRenduActives ?? []));
    dimensionsInactives.push(...(contribution.dimensionsRenduInactives ?? []));
    directivesRendu.push(...(contribution.directivesRendu ?? []));
    controles.push(...(contribution.controles ?? []));
  }

  contrat.faitsDecisifs = uniquesParCle(faits, (fait) => fait.id);
  contrat.savoirsSitues = uniquesParCle(
    savoirs,
    (savoir) => `${savoir.acteurId}\u0000${savoir.contenu}\u0000${savoir.statut}`,
  );
  contrat.intentionsPnj = uniquesParCle(
    intentions,
    (intention) => `${intention.acteurId}\u0000${intention.intention}`,
  );
  contrat.resolutions = uniquesParCle(resolutions, (resolution) => resolution.tentativeId);
  contrat.contraintesApplicables = uniquesTextes(contraintes);
  contrat.miseEnScene.pointsAMontrer = uniquesTextes(points);
  contrat.miseEnScene.interditsNarratifs = uniquesTextes(interdits);
  contrat.miseEnScene.choixReservesAuJoueur = uniquesParCle(
    choix,
    (decision) => decision.description.trim().toLocaleLowerCase('fr'),
  );
  contrat.rendu.dimensionsActives = uniquesTextes(dimensionsActives);
  contrat.rendu.dimensionsInactives = uniquesTextes(dimensionsInactives).filter(
    (dimension) => !contrat.rendu.dimensionsActives.includes(dimension),
  );
  contrat.rendu.directives = uniquesTextes(directivesRendu);
  contrat.transitionsProposees = uniquesParCle(transitions, (transition) => transition.id);
  contrat.controles = uniquesParCle(
    controles,
    (controle) => `${controle.id}\u0000${controle.raison ?? ''}`,
  );

  return { alertes: uniquesTextes(alertes), controles: contrat.controles };
}

/**
 * Exécute M01 sans appeler de modèle et sans muter l'état de la partie.
 *
 * La fonction produit le contrat compact du tour à partir du contexte déjà
 * sélectionné et des contributions des moteurs propriétaires. Toute mutation
 * reste une proposition jusqu'à validation par le Kernel.
 */
export function executerM01(entree: EntreeM01): SortieM01 {
  const { contexte } = entree;
  const contributions = entree.contributions ?? [];
  const contrat = creerNarrativeContractV21({
    histoireId: contexte.cadre.histoireId,
    varianteId: contexte.cadre.varianteId,
    natureEchange: contexte.cadre.nature,
    initiativeJoueur: contexte.cadre.initiativeJoueur,
    scene: contexte.scene,
    profilRendu: contexte.profilRendu,
  });

  const faitsContexte = faitsCanoniquesDuContexte(contexte);
  const savoirsContexte = savoirsDuContexte(contexte);

  contrat.faitsDecisifs = faitsContexte;
  contrat.savoirsSitues = savoirsContexte.savoirs;
  contrat.resolutions = [...contexte.resultatsDejaEtablis];
  contrat.limites = limitesDuContexte(contexte);
  contrat.contraintesApplicables = contraintesM01(contexte);
  contrat.miseEnScene.pointsAMontrer = pointsDeBase(contexte);
  contrat.miseEnScene.interditsNarratifs = interditsM01(contexte);
  contrat.miseEnScene.choixReservesAuJoueur = choixReserveDuContexte(contexte);
  contrat.controles = [...(entree.controlesSupplementaires ?? [])];
  contrat.moteursContributeurs = moteursContributeurs(contributions);

  const fusion = ajouterContributions(contrat, contributions);
  const blocage = selectionnerBlocage(contexte, contributions);
  const modeSortie = modeSortiePour(contexte, blocage);

  if (blocage) {
    contrat.blocage = blocage;
    if (blocage.questionClarification) {
      contrat.clarification = {
        question: blocage.questionClarification,
        raison: blocage.raison,
        suspendResolution: true,
      };
    }
  }

  // Une dimension ne peut pas être simultanément active et inactive après la
  // fusion des contributions. La comparaison est normalisée pour éviter les
  // doublons dus à la casse.
  const dimensionsActives = new Set(
    contrat.rendu.dimensionsActives.map((dimension) => dimension.toLocaleLowerCase('fr')),
  );
  contrat.rendu.dimensionsInactives = contrat.rendu.dimensionsInactives.filter(
    (dimension) => !dimensionsActives.has(dimension.toLocaleLowerCase('fr')),
  );

  const alertes = uniquesTextes([
    ...savoirsContexte.alertes,
    ...fusion.alertes,
    ...contributions.flatMap((resultat) => resultat.alertes),
  ]);

  return {
    moteur: MOTEUR_M01,
    contrat,
    modeSortie,
    autorisePoursuiteFiction: modeSortie === 'scene',
    alertes,
  };
}
