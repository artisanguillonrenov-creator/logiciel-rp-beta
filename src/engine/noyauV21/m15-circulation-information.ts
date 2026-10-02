// Elyndor — Noyau narratif natif V2.1
// M15 — Circulation de l'information.
//
// M15 détermine qui reçoit quelle affirmation, par quel canal, à quel moment
// et avec quelle fidélité. Il conserve la provenance et la connaissance située
// sans transformer une transmission en vérité du monde ni en jugement social.
// M02 reste propriétaire des faits canoniques, M03 de l'interprétation
// psychologique et M04 des effets relationnels / réputationnels.

import type { ContributionSceneM01 } from './m01-production';
import type { SavoirContractuel } from './narrativeContract';
import type {
  AffirmationNarrative,
  BlocageNarratif,
  ConnaissanceSituee,
  ContexteNarratifV21,
  ControleNarratif,
  PorteeInformation,
  PropositionTransition,
  ResultatMoteur,
  SourceNarrative,
  StatutInformation,
  TransmissionInformation,
} from './types';

export const MOTEUR_M15 = 'M15' as const;

export type TypeCanalM15 =
  | 'perception_directe'
  | 'conversation'
  | 'document'
  | 'messager'
  | 'rumeur'
  | 'reseau_institutionnel'
  | 'moyen_exceptionnel'
  | 'autre';

export type EtatAcheminementM15 =
  | 'non_parti'
  | 'en_route'
  | 'arrive'
  | 'intercepte'
  | 'perdu'
  | 'inconnu';

export type QualiteFideliteM15 =
  | 'fidele'
  | 'alteree'
  | 'incertaine'
  | 'non_evaluee';

export type TypeOperationInformationM15 =
  | 'creer_affirmation'
  | 'transmettre'
  | 'retenir'
  | 'divulguer'
  | 'corriger'
  | 'interpreter';

export interface CanalDisponibleM15 {
  id: string;
  type: TypeCanalM15;
  nom?: string;
  disponible: boolean;
  instantaneEtabli?: boolean;
  accesIds?: string[];
  contraintes?: string[];
  fideliteTypique?: QualiteFideliteM15;
  sourceIds?: string[];
}

/**
 * Version dérivée d'une affirmation. Les parents sont indispensables : deux
 * copies d'un même témoignage ne deviennent pas deux preuves indépendantes.
 */
export interface VersionAffirmationM15 {
  affirmation: AffirmationNarrative;
  parentAffirmationIds: string[];
  causeVariation?: string;
  fidelite: QualiteFideliteM15;
  canoniqueDejaEtablie?: boolean;
  sourceIds: string[];
}

export interface PropositionTransmissionM15 {
  transmission: TransmissionInformation;
  canalId?: string;
  etatAcheminement: EtatAcheminementM15;
  momentDepart?: string;
  momentArrivee?: string;

  /**
   * Vrai uniquement lorsqu'une réception est déjà établie par une source du
   * monde. Une simple intention d'envoyer un rapport ne suffit pas.
   */
  receptionEtablie?: boolean;

  /** Statut attribuable chez le destinataire après réception. */
  statutReception?: StatutInformation;

  /** Interprétation proposée par M03, conservée seulement comme interprétation. */
  interpretationParDestinataire?: Record<string, string>;

  sourceIds: string[];
}

export interface PropositionConnaissanceM15 {
  acteurId: string;
  affirmationId: string;
  statut: StatutInformation;
  sourceIds: string[];
  confiance?: number;
  interpretation?: string;

  /**
   * Source causale de l'acquisition. M15 refuse une connaissance créée sans
   * perception, transmission reçue ou inférence explicitement attribuée.
   */
  transmissionId?: string;
  perceptionSourceId?: string;
  inferenceDepuisAffirmationIds?: string[];
}

export interface SecretM15 {
  id: string;
  affirmationIds: string[];
  detenteurIds: string[];
  accesAutoriseIds: string[];
  traceIds: string[];
  transmissionIdsDejaParties?: string[];
  risqueFuite?: string;
}

export interface EvaluationSecretM15 {
  secretId: string;
  tracesExistantes: string[];
  transmissionsIrreversibles: string[];
  fuiteAutomatique: boolean;
  raisons: string[];
  alertes: string[];
}

export interface PointDeVueM15 {
  acteurId?: string;
  affirmationIdsRevelables?: string[];
  autoriseNarrateurLarge?: boolean;
}

export interface EvaluationAffirmationM15 {
  affirmationId: string;
  existante: boolean;
  admissible: boolean;
  parentAffirmationIds: string[];
  racinesProvenance: string[];
  fidelite: QualiteFideliteM15;
  raisons: string[];
  blocages: string[];
  transition?: PropositionTransition<AffirmationNarrative>;
}

export interface EvaluationTransmissionM15 {
  transmissionId: string;
  affirmationId: string;
  canalType: TypeCanalM15;
  canalDisponible: boolean;
  etatAcheminement: EtatAcheminementM15;
  receptionValide: boolean;
  destinatairesRecevant: string[];
  destinatairesEnAttente: string[];
  raisons: string[];
  blocages: string[];
  transition?: PropositionTransition<TransmissionInformation>;
}

export interface EvaluationConnaissanceM15 {
  acteurId: string;
  affirmationId: string;
  admissible: boolean;
  statut: StatutInformation;
  connaissancePreexistante?: ConnaissanceSituee;
  valeurProposee?: ConnaissanceSituee;
  raisons: string[];
  blocages: string[];
  transition?: PropositionTransition<ConnaissanceSituee>;
}

export interface EvaluationProvenanceM15 {
  affirmationId: string;
  racines: string[];
  nombreBranches: number;
  nombreSourcesIndependantes: number;
  avertissementSourceCommune?: string;
}

export interface EvaluationNarrateurM15 {
  affirmationId: string;
  montrable: boolean;
  raison: string;
}

export interface EntreeM15 {
  contexte: ContexteNarratifV21;
  canaux?: CanalDisponibleM15[];
  nouvellesAffirmations?: VersionAffirmationM15[];
  transmissions?: PropositionTransmissionM15[];
  connaissancesProposees?: PropositionConnaissanceM15[];
  secrets?: SecretM15[];
  pointDeVue?: PointDeVueM15;
}

export interface SortieM15 {
  moteur: typeof MOTEUR_M15;
  resultat: ResultatMoteur<ContributionSceneM01>;
  evaluationsAffirmations: EvaluationAffirmationM15[];
  evaluationsTransmissions: EvaluationTransmissionM15[];
  evaluationsConnaissances: EvaluationConnaissanceM15[];
  evaluationsProvenance: EvaluationProvenanceM15[];
  evaluationsSecrets: EvaluationSecretM15[];
  evaluationsNarrateur: EvaluationNarrateurM15[];
  transitionsInformation: PropositionTransition[];
  savoirsPourM01: SavoirContractuel[];
  alertes: string[];
}

function propre(valeur: unknown): string {
  return String(valeur ?? '').trim();
}

function normaliser(valeur: unknown): string {
  return propre(valeur)
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniquesTextes(valeurs: Iterable<string>): string[] {
  const resultat: string[] = [];
  const vus = new Set<string>();

  for (const valeur of valeurs) {
    const texte = propre(valeur);
    const cle = normaliser(texte);
    if (!cle || vus.has(cle)) continue;
    vus.add(cle);
    resultat.push(texte);
  }

  return resultat;
}

function uniquesParCle<T>(valeurs: Iterable<T>, cle: (valeur: T) => string): T[] {
  const resultat: T[] = [];
  const vus = new Set<string>();

  for (const valeur of valeurs) {
    const id = propre(cle(valeur));
    if (!id || vus.has(id)) continue;
    vus.add(id);
    resultat.push(valeur);
  }

  return resultat;
}

function bornerConfiance(valeur: number | undefined): number | undefined {
  if (valeur === undefined || !Number.isFinite(valeur)) return undefined;
  return Math.max(0, Math.min(1, valeur));
}

function bornerFidelite(valeur: number | undefined): number | undefined {
  if (valeur === undefined || !Number.isFinite(valeur)) return undefined;
  return Math.max(0, Math.min(1, valeur));
}

function affirmationParId(
  affirmations: AffirmationNarrative[],
  id: string,
): AffirmationNarrative | undefined {
  return affirmations.find((affirmation) => affirmation.id === id);
}

function transmissionParId(
  transmissions: TransmissionInformation[],
  id: string,
): TransmissionInformation | undefined {
  return transmissions.find((transmission) => transmission.id === id);
}

function connaissanceParCle(
  connaissances: ConnaissanceSituee[],
  acteurId: string,
  affirmationId: string,
): ConnaissanceSituee | undefined {
  return connaissances.find(
    (connaissance) =>
      connaissance.acteurId === acteurId &&
      connaissance.affirmationId === affirmationId,
  );
}

function canalParId(entree: EntreeM15, id: string | undefined): CanalDisponibleM15 | undefined {
  if (!id) return undefined;
  return entree.canaux?.find((canal) => canal.id === id);
}

function classifierCanal(canal: string, definition?: CanalDisponibleM15): TypeCanalM15 {
  if (definition) return definition.type;

  const cle = normaliser(canal).replace(/ /g, '_');
  if (cle.includes('perception') || cle.includes('vue') || cle.includes('audition')) {
    return 'perception_directe';
  }
  if (cle.includes('lettre') || cle.includes('document') || cle.includes('registre')) {
    return 'document';
  }
  if (cle.includes('messager') || cle.includes('courrier')) return 'messager';
  if (cle.includes('rumeur')) return 'rumeur';
  if (cle.includes('institution') || cle.includes('reseau')) return 'reseau_institutionnel';
  if (cle.includes('conversation') || cle.includes('parole') || cle.includes('dialogue')) {
    return 'conversation';
  }
  if (cle.includes('magie') || cle.includes('telepath') || cle.includes('exception')) {
    return 'moyen_exceptionnel';
  }
  return 'autre';
}

function statutParDefautPourCanal(type: TypeCanalM15): StatutInformation {
  switch (type) {
    case 'perception_directe':
      return 'observation';
    case 'rumeur':
      return 'rumeur';
    case 'conversation':
    case 'document':
    case 'messager':
    case 'reseau_institutionnel':
    case 'moyen_exceptionnel':
    case 'autre':
      return 'rapport';
  }
}

function porteeParDefaut(type: TypeCanalM15): PorteeInformation {
  switch (type) {
    case 'rumeur':
      return 'locale';
    case 'reseau_institutionnel':
      return 'groupe';
    default:
      return 'privee';
  }
}

function transitionAffirmation(
  version: VersionAffirmationM15,
): PropositionTransition<AffirmationNarrative> {
  return {
    id: `m15:affirmation:${version.affirmation.id}`,
    moteurProprietaire: MOTEUR_M15,
    domaine: 'information',
    categorie: 'informationnelle',
    cibleIds: [version.affirmation.id],
    justification: version.parentAffirmationIds.length
      ? `Version informationnelle dérivée de ${version.parentAffirmationIds.join(', ')}.`
      : 'Nouvelle affirmation avec provenance explicite.',
    sourceIds: uniquesTextes([
      ...version.sourceIds,
      ...version.parentAffirmationIds,
      ...(version.affirmation.origine?.id ? [version.affirmation.origine.id] : []),
    ]),
    valeurProposee: version.affirmation,
    perceptible: false,
    transmissible: true,
  };
}

function transitionTransmission(
  proposition: PropositionTransmissionM15,
): PropositionTransition<TransmissionInformation> {
  const transmission: TransmissionInformation = {
    ...proposition.transmission,
    fidelite: bornerFidelite(proposition.transmission.fidelite),
    recue: proposition.etatAcheminement === 'arrive' && proposition.receptionEtablie === true,
  };

  return {
    id: `m15:transmission:${transmission.id}`,
    moteurProprietaire: MOTEUR_M15,
    domaine: 'information',
    categorie: 'informationnelle',
    cibleIds: uniquesTextes([
      transmission.affirmationId,
      ...transmission.destinataireIds,
    ]),
    justification: transmission.recue
      ? `Réception établie par le canal ${transmission.canal}.`
      : `Transmission enregistrée sans réception anticipée par le canal ${transmission.canal}.`,
    sourceIds: uniquesTextes(proposition.sourceIds),
    valeurProposee: transmission,
    perceptible: transmission.recue,
    transmissible: true,
  };
}

function transitionConnaissance(
  connaissance: ConnaissanceSituee,
): PropositionTransition<ConnaissanceSituee> {
  return {
    id: `m15:savoir:${connaissance.acteurId}:${connaissance.affirmationId}`,
    moteurProprietaire: MOTEUR_M15,
    domaine: 'information',
    categorie: 'informationnelle',
    cibleIds: [connaissance.acteurId, connaissance.affirmationId],
    justification: 'Mise à jour d’un savoir situé depuis une réception, perception ou inférence traçable.',
    sourceIds: connaissance.sourceIds,
    valeurProposee: connaissance,
    perceptible: false,
    transmissible: false,
  };
}

function construireGrapheParents(
  contexte: ContexteNarratifV21,
  versions: VersionAffirmationM15[],
): Map<string, string[]> {
  const graphe = new Map<string, string[]>();

  for (const affirmation of contexte.affirmations) {
    graphe.set(affirmation.id, []);
  }

  for (const version of versions) {
    graphe.set(version.affirmation.id, uniquesTextes(version.parentAffirmationIds));
  }

  return graphe;
}

function racinesAffirmation(
  affirmationId: string,
  graphe: Map<string, string[]>,
  pile = new Set<string>(),
): string[] {
  if (pile.has(affirmationId)) return [affirmationId];
  const parents = graphe.get(affirmationId) ?? [];
  if (!parents.length) return [affirmationId];

  const suivante = new Set(pile);
  suivante.add(affirmationId);

  return uniquesTextes(
    parents.flatMap((parentId) => racinesAffirmation(parentId, graphe, suivante)),
  );
}

function evaluerAffirmation(
  entree: EntreeM15,
  version: VersionAffirmationM15,
  affirmationsConnues: AffirmationNarrative[],
  graphe: Map<string, string[]>,
): EvaluationAffirmationM15 {
  const raisons: string[] = [];
  const blocages: string[] = [];
  const existante = Boolean(affirmationParId(affirmationsConnues, version.affirmation.id));

  if (!propre(version.affirmation.id)) blocages.push('Identifiant d’affirmation absent.');
  if (!propre(version.affirmation.contenu)) blocages.push('Contenu d’affirmation absent.');
  if (!version.sourceIds.length && !version.affirmation.origine?.id) {
    blocages.push('Une affirmation nouvelle doit conserver une provenance.');
  }

  for (const parentId of version.parentAffirmationIds) {
    if (!affirmationParId(affirmationsConnues, parentId) && !entree.nouvellesAffirmations?.some((v) => v.affirmation.id === parentId)) {
      blocages.push(`Parent informationnel introuvable : ${parentId}.`);
    }
    if (parentId === version.affirmation.id) {
      blocages.push('Une affirmation ne peut pas être sa propre version parente.');
    }
  }

  if (
    version.affirmation.statut === 'canonique' &&
    !existante &&
    version.canoniqueDejaEtablie !== true
  ) {
    blocages.push(
      'M15 ne peut pas canoniser une affirmation nouvelle : le fait du monde doit déjà être établi par son propriétaire.',
    );
  }

  if (version.fidelite === 'alteree' && !version.parentAffirmationIds.length) {
    blocages.push('Une version altérée doit référencer au moins une affirmation parente.');
  }

  if (version.fidelite === 'alteree' && !propre(version.causeVariation)) {
    blocages.push('Une déformation doit avoir une cause intelligible ; elle n’est pas automatique.');
  }

  if (
    version.fidelite === 'fidele' &&
    version.parentAffirmationIds.length === 1
  ) {
    const parent = affirmationParId(affirmationsConnues, version.parentAffirmationIds[0]);
    if (parent && normaliser(parent.contenu) !== normaliser(version.affirmation.contenu)) {
      raisons.push('La version est déclarée fidèle mais son texte diffère ; la provenance est conservée sans conclure à une fraude.');
    }
  }

  if (!blocages.length) {
    raisons.push('Provenance conservée et statut informationnel distinct de la vérité du monde.');
    if (version.parentAffirmationIds.length) {
      raisons.push('Les liens parents empêchent de compter des copies comme preuves indépendantes.');
    }
  }

  return {
    affirmationId: version.affirmation.id,
    existante,
    admissible: blocages.length === 0,
    parentAffirmationIds: uniquesTextes(version.parentAffirmationIds),
    racinesProvenance: racinesAffirmation(version.affirmation.id, graphe),
    fidelite: version.fidelite,
    raisons,
    blocages,
    transition: blocages.length ? undefined : transitionAffirmation(version),
  };
}

function evaluerTransmission(
  entree: EntreeM15,
  proposition: PropositionTransmissionM15,
  affirmationsDisponibles: AffirmationNarrative[],
): EvaluationTransmissionM15 {
  const transmission = proposition.transmission;
  const definitionCanal = canalParId(entree, proposition.canalId);
  const canalType = classifierCanal(transmission.canal, definitionCanal);
  const raisons: string[] = [];
  const blocages: string[] = [];

  if (!propre(transmission.id)) blocages.push('Identifiant de transmission absent.');
  if (!affirmationParId(affirmationsDisponibles, transmission.affirmationId)) {
    blocages.push(`Affirmation transmise introuvable : ${transmission.affirmationId}.`);
  }
  if (!transmission.destinataireIds.length) {
    blocages.push('Une transmission doit viser au moins un destinataire.');
  }

  const canalDisponible = definitionCanal?.disponible !== false;
  if (!canalDisponible) {
    blocages.push(`Le canal ${definitionCanal?.id ?? transmission.canal} est indisponible.`);
  }

  if (
    canalType === 'moyen_exceptionnel' &&
    !definitionCanal
  ) {
    blocages.push('Un moyen exceptionnel doit être établi par le monde avant son utilisation.');
  }

  if (
    canalType === 'moyen_exceptionnel' &&
    definitionCanal &&
    !definitionCanal.instantaneEtabli &&
    proposition.etatAcheminement === 'arrive' &&
    proposition.momentDepart &&
    proposition.momentArrivee &&
    proposition.momentDepart === proposition.momentArrivee
  ) {
    raisons.push('Le canal exceptionnel n’est pas déclaré instantané ; aucune instantanéité supplémentaire n’est inférée.');
  }

  const acces = definitionCanal?.accesIds;
  if (acces?.length) {
    for (const destinataireId of transmission.destinataireIds) {
      if (!acces.includes(destinataireId)) {
        blocages.push(`Le destinataire ${destinataireId} n’a pas accès au canal ${definitionCanal?.id}.`);
      }
    }
  }

  const arrivee = proposition.etatAcheminement === 'arrive';
  const receptionValide = arrivee && proposition.receptionEtablie === true && blocages.length === 0;

  if (transmission.recue && !receptionValide) {
    blocages.push(
      'Le drapeau de réception ne peut pas anticiper l’arrivée : une réception doit être établie dans le temps fictif.',
    );
  }

  if (!arrivee) {
    raisons.push(`Transmission ${proposition.etatAcheminement} : aucun savoir destinataire n’est créé maintenant.`);
  } else if (!proposition.receptionEtablie) {
    raisons.push('L’arrivée seule ne prouve pas que le destinataire a effectivement reçu ou consulté le message.');
  } else if (!blocages.length) {
    raisons.push('Réception établie : les destinataires peuvent acquérir une connaissance située.');
  }

  if (proposition.etatAcheminement === 'intercepte') {
    raisons.push('Le message intercepté n’atteint pas automatiquement les destinataires initiaux.');
  }
  if (proposition.etatAcheminement === 'perdu') {
    raisons.push('La perte du support empêche la réception prévue sans effacer les autres traces déjà existantes.');
  }

  return {
    transmissionId: transmission.id,
    affirmationId: transmission.affirmationId,
    canalType,
    canalDisponible,
    etatAcheminement: proposition.etatAcheminement,
    receptionValide,
    destinatairesRecevant: receptionValide
      ? uniquesTextes(transmission.destinataireIds)
      : [],
    destinatairesEnAttente: receptionValide
      ? []
      : uniquesTextes(transmission.destinataireIds),
    raisons,
    blocages,
    transition: blocages.length ? undefined : transitionTransmission(proposition),
  };
}

function transmissionRecueParActeur(
  acteurId: string,
  affirmationId: string,
  propositions: PropositionTransmissionM15[],
  evaluations: EvaluationTransmissionM15[],
): PropositionTransmissionM15 | undefined {
  for (const proposition of propositions) {
    if (proposition.transmission.affirmationId !== affirmationId) continue;
    if (!proposition.transmission.destinataireIds.includes(acteurId)) continue;
    const evaluation = evaluations.find(
      (candidate) => candidate.transmissionId === proposition.transmission.id,
    );
    if (evaluation?.receptionValide) return proposition;
  }
  return undefined;
}

function connaissanceDepuisTransmission(
  acteurId: string,
  proposition: PropositionTransmissionM15,
  entree: EntreeM15,
): ConnaissanceSituee {
  const definitionCanal = canalParId(entree, proposition.canalId);
  const typeCanal = classifierCanal(proposition.transmission.canal, definitionCanal);
  const interpretation = proposition.interpretationParDestinataire?.[acteurId];

  return {
    acteurId,
    affirmationId: proposition.transmission.affirmationId,
    statut: proposition.statutReception ?? statutParDefautPourCanal(typeCanal),
    sourceIds: uniquesTextes([
      proposition.transmission.id,
      ...proposition.sourceIds,
    ]),
    confiance: bornerConfiance(proposition.transmission.fidelite),
    interpretation: propre(interpretation) || undefined,
  };
}

function evaluerConnaissance(
  entree: EntreeM15,
  proposition: PropositionConnaissanceM15,
  affirmationsDisponibles: AffirmationNarrative[],
  evaluationsTransmissions: EvaluationTransmissionM15[],
): EvaluationConnaissanceM15 {
  const raisons: string[] = [];
  const blocages: string[] = [];
  const existante = connaissanceParCle(
    entree.contexte.connaissances,
    proposition.acteurId,
    proposition.affirmationId,
  );

  if (!propre(proposition.acteurId)) blocages.push('Acteur de connaissance absent.');
  if (!affirmationParId(affirmationsDisponibles, proposition.affirmationId)) {
    blocages.push(`Affirmation inconnue : ${proposition.affirmationId}.`);
  }

  const aTransmission = proposition.transmissionId
    ? evaluationsTransmissions.some(
        (evaluation) =>
          evaluation.transmissionId === proposition.transmissionId &&
          evaluation.receptionValide &&
          evaluation.destinatairesRecevant.includes(proposition.acteurId),
      )
    : false;

  const aPerception = Boolean(propre(proposition.perceptionSourceId));
  const aInference = Boolean(proposition.inferenceDepuisAffirmationIds?.length);

  if (!aTransmission && !aPerception && !aInference) {
    blocages.push(
      'La connaissance n’a ni réception, ni perception, ni inférence attribuée comme cause.',
    );
  }

  if (aInference) {
    for (const parentId of proposition.inferenceDepuisAffirmationIds ?? []) {
      const parentConnu = connaissanceParCle(
        entree.contexte.connaissances,
        proposition.acteurId,
        parentId,
      );
      if (!parentConnu) {
        blocages.push(`L’acteur ${proposition.acteurId} ne possède pas l’information nécessaire à l’inférence : ${parentId}.`);
      }
    }
    if (proposition.statut === 'canonique') {
      blocages.push('Une inférence d’acteur ne devient pas canonique par simple déduction.');
    }
  }

  if (proposition.statut === 'canonique') {
    raisons.push('Le statut canonique décrit ici un savoir sur un fait déjà établi ; M15 ne crée pas ce fait.');
  }

  if (existante) {
    raisons.push('Une connaissance préexistante est mise à jour sans effacer automatiquement son historique antérieur.');
  }

  const valeurProposee: ConnaissanceSituee | undefined = blocages.length
    ? undefined
    : {
        acteurId: proposition.acteurId,
        affirmationId: proposition.affirmationId,
        statut: proposition.statut,
        sourceIds: uniquesTextes([
          ...(existante?.sourceIds ?? []),
          ...proposition.sourceIds,
          ...(proposition.transmissionId ? [proposition.transmissionId] : []),
          ...(proposition.perceptionSourceId ? [proposition.perceptionSourceId] : []),
          ...(proposition.inferenceDepuisAffirmationIds ?? []),
        ]),
        confiance: bornerConfiance(proposition.confiance ?? existante?.confiance),
        interpretation: propre(proposition.interpretation) || existante?.interpretation,
      };

  if (!blocages.length) {
    raisons.push('Acquisition ou révision du savoir attribuée à une cause accessible à cet acteur.');
  }

  return {
    acteurId: proposition.acteurId,
    affirmationId: proposition.affirmationId,
    admissible: blocages.length === 0,
    statut: proposition.statut,
    connaissancePreexistante: existante,
    valeurProposee,
    raisons,
    blocages,
    transition: valeurProposee ? transitionConnaissance(valeurProposee) : undefined,
  };
}

function evaluationsConnaissancesDepuisReceptions(
  entree: EntreeM15,
  propositions: PropositionTransmissionM15[],
  evaluations: EvaluationTransmissionM15[],
): EvaluationConnaissanceM15[] {
  const resultat: EvaluationConnaissanceM15[] = [];

  for (const proposition of propositions) {
    const evaluationTransmission = evaluations.find(
      (candidate) => candidate.transmissionId === proposition.transmission.id,
    );
    if (!evaluationTransmission?.receptionValide) continue;

    for (const acteurId of evaluationTransmission.destinatairesRecevant) {
      const valeurRecue = connaissanceDepuisTransmission(acteurId, proposition, entree);
      const existante = connaissanceParCle(
        entree.contexte.connaissances,
        acteurId,
        valeurRecue.affirmationId,
      );

      const valeurProposee: ConnaissanceSituee = {
        ...valeurRecue,
        sourceIds: uniquesTextes([
          ...(existante?.sourceIds ?? []),
          ...valeurRecue.sourceIds,
        ]),
        confiance: valeurRecue.confiance ?? existante?.confiance,
        interpretation: valeurRecue.interpretation ?? existante?.interpretation,
      };

      resultat.push({
        acteurId,
        affirmationId: valeurRecue.affirmationId,
        admissible: true,
        statut: valeurRecue.statut,
        connaissancePreexistante: existante,
        valeurProposee,
        raisons: [
          `La transmission ${proposition.transmission.id} est effectivement reçue par ${acteurId}.`,
          'La réception crée un savoir situé sans transformer l’affirmation en vérité supplémentaire.',
        ],
        blocages: [],
        transition: transitionConnaissance(valeurProposee),
      });
    }
  }

  return resultat;
}

function evaluerProvenance(
  affirmationId: string,
  graphe: Map<string, string[]>,
): EvaluationProvenanceM15 {
  const racines = racinesAffirmation(affirmationId, graphe);
  const parents = graphe.get(affirmationId) ?? [];
  const nombreBranches = parents.length || 1;
  const nombreSourcesIndependantes = racines.length;

  return {
    affirmationId,
    racines,
    nombreBranches,
    nombreSourcesIndependantes,
    avertissementSourceCommune:
      nombreBranches > 1 && nombreSourcesIndependantes === 1
        ? 'Plusieurs versions ou relais remontent à une même racine ; ils ne constituent pas des preuves indépendantes.'
        : undefined,
  };
}

function evaluerSecret(secret: SecretM15): EvaluationSecretM15 {
  const raisons: string[] = [];
  const alertes: string[] = [];
  const tracesExistantes = uniquesTextes(secret.traceIds);
  const transmissionsIrreversibles = uniquesTextes(secret.transmissionIdsDejaParties ?? []);

  raisons.push('Un secret est évalué par ses détenteurs, ses traces et ses transmissions déjà engagées.');
  if (tracesExistantes.length) {
    raisons.push('L’absence de témoin direct n’efface pas les traces existantes.');
  }
  if (transmissionsIrreversibles.length) {
    raisons.push('Une transmission déjà partie subsiste même si un témoin disparaît ensuite.');
  }
  if (propre(secret.risqueFuite)) {
    raisons.push(`Risque de fuite établi : ${secret.risqueFuite}.`);
  }

  // M15 ne déclenche jamais une fuite uniquement pour relancer le rythme.
  const fuiteAutomatique = false;

  if (!secret.detenteurIds.length && !tracesExistantes.length && !transmissionsIrreversibles.length) {
    alertes.push('Aucun détenteur, trace ou relais n’est fourni ; M15 ne fabrique pas une fuite pour compenser.');
  }

  return {
    secretId: secret.id,
    tracesExistantes,
    transmissionsIrreversibles,
    fuiteAutomatique,
    raisons,
    alertes,
  };
}

function connaissanceEffective(
  contexte: ContexteNarratifV21,
  evaluations: EvaluationConnaissanceM15[],
): ConnaissanceSituee[] {
  const carte = new Map<string, ConnaissanceSituee>();

  for (const connaissance of contexte.connaissances) {
    carte.set(`${connaissance.acteurId}::${connaissance.affirmationId}`, connaissance);
  }

  for (const evaluation of evaluations) {
    if (!evaluation.admissible || !evaluation.valeurProposee) continue;
    const connaissance = evaluation.valeurProposee;
    carte.set(`${connaissance.acteurId}::${connaissance.affirmationId}`, connaissance);
  }

  return [...carte.values()];
}

function evaluerNarrateur(
  affirmation: AffirmationNarrative,
  pointDeVue: PointDeVueM15 | undefined,
  connaissances: ConnaissanceSituee[],
): EvaluationNarrateurM15 {
  if (pointDeVue?.affirmationIdsRevelables?.includes(affirmation.id)) {
    return {
      affirmationId: affirmation.id,
      montrable: true,
      raison: 'Affirmation explicitement autorisée à la révélation dans ce cadrage.',
    };
  }

  if (pointDeVue?.acteurId) {
    const connue = connaissances.some(
      (connaissance) =>
        connaissance.acteurId === pointDeVue.acteurId &&
        connaissance.affirmationId === affirmation.id,
    );
    return {
      affirmationId: affirmation.id,
      montrable: connue,
      raison: connue
        ? `Le point de vue ${pointDeVue.acteurId} possède cette information.`
        : `Le point de vue ${pointDeVue.acteurId} ne possède pas cette information.`,
    };
  }

  if (pointDeVue?.autoriseNarrateurLarge) {
    return {
      affirmationId: affirmation.id,
      montrable: true,
      raison: 'Le cadrage autorise un narrateur plus large ; cela ne transmet pas ce savoir aux personnages.',
    };
  }

  return {
    affirmationId: affirmation.id,
    montrable: false,
    raison: 'Aucune condition de révélation ne permet d’exposer ce fait caché dans le cadrage fourni.',
  };
}

function creerControles(
  evaluationsTransmissions: EvaluationTransmissionM15[],
  evaluationsConnaissances: EvaluationConnaissanceM15[],
  evaluationsNarrateur: EvaluationNarrateurM15[],
): ControleNarratif[] {
  const fuiteSavoir = evaluationsConnaissances.some(
    (evaluation) => !evaluation.admissible && evaluation.blocages.length > 0,
  );
  const receptionAnticipee = evaluationsTransmissions.some(
    (evaluation) =>
      evaluation.etatAcheminement !== 'arrive' &&
      evaluation.destinatairesRecevant.length > 0,
  );

  return [
    {
      id: 'savoir',
      ok: !fuiteSavoir && !receptionAnticipee,
      raison: !fuiteSavoir && !receptionAnticipee
        ? 'Les savoirs retenus possèdent une provenance accessible et aucune réception future n’est anticipée.'
        : 'Au moins une connaissance ou réception proposée dépasse les informations accessibles.',
    },
    {
      id: 'fidelite_recit',
      ok: evaluationsNarrateur.every(
        (evaluation) => evaluation.montrable || Boolean(evaluation.raison),
      ),
      raison: 'La visibilité narrative est séparée de la connaissance des personnages.',
    },
  ];
}

function blocagePrincipal(
  evaluationsAffirmations: EvaluationAffirmationM15[],
  evaluationsTransmissions: EvaluationTransmissionM15[],
  evaluationsConnaissances: EvaluationConnaissanceM15[],
): BlocageNarratif | undefined {
  const affirmationBloquee = evaluationsAffirmations.find(
    (evaluation) => !evaluation.admissible && evaluation.blocages.length,
  );
  if (affirmationBloquee) {
    return {
      type: 'information_manquante',
      raison: affirmationBloquee.blocages[0],
    };
  }

  const transmissionBloquee = evaluationsTransmissions.find(
    (evaluation) => evaluation.blocages.length,
  );
  if (transmissionBloquee) {
    return {
      type: 'information_manquante',
      raison: transmissionBloquee.blocages[0],
    };
  }

  const connaissanceBloquee = evaluationsConnaissances.find(
    (evaluation) => !evaluation.admissible && evaluation.blocages.length,
  );
  if (connaissanceBloquee) {
    return {
      type: 'information_manquante',
      raison: connaissanceBloquee.blocages[0],
    };
  }

  return undefined;
}

function savoirsPourM01(
  affirmations: AffirmationNarrative[],
  connaissances: ConnaissanceSituee[],
): SavoirContractuel[] {
  const resultat: SavoirContractuel[] = [];

  for (const connaissance of connaissances) {
    const affirmation = affirmationParId(affirmations, connaissance.affirmationId);
    if (!affirmation) continue;

    resultat.push({
      acteurId: connaissance.acteurId,
      contenu: affirmation.contenu,
      statut: connaissance.statut,
      sourceIds: connaissance.sourceIds,
      confiance: connaissance.confiance,
    });
  }

  return uniquesParCle(
    resultat,
    (savoir) => `${savoir.acteurId}::${normaliser(savoir.contenu)}::${savoir.statut}`,
  );
}

function contraintesPourM01(
  evaluationsTransmissions: EvaluationTransmissionM15[],
  evaluationsNarrateur: EvaluationNarrateurM15[],
): string[] {
  const contraintes: string[] = [
    'Ne pas attribuer à un personnage une affirmation qu’il n’a ni perçue, ni reçue, ni inférée depuis des informations accessibles.',
    'Ne pas traiter plusieurs copies issues d’une même source comme des preuves indépendantes.',
    'Ne pas accélérer un rapport, une lettre ou un messager pour faciliter la scène.',
    'Une déformation d’information exige une cause ; elle n’est jamais automatique.',
  ];

  for (const evaluation of evaluationsTransmissions) {
    if (!evaluation.receptionValide && evaluation.destinatairesEnAttente.length) {
      contraintes.push(
        `La transmission ${evaluation.transmissionId} n’est pas reçue par ${evaluation.destinatairesEnAttente.join(', ')} dans l’état courant.`,
      );
    }
  }

  for (const evaluation of evaluationsNarrateur) {
    if (!evaluation.montrable) {
      contraintes.push(`Ne pas révéler l’affirmation ${evaluation.affirmationId} depuis le point de vue actuel.`);
    }
  }

  return uniquesTextes(contraintes);
}

/**
 * Exécute M15 sur un contexte V2.1.
 *
 * M15 ne simule pas un réseau omniscient. Les propositions sont évaluées à
 * partir de leurs sources, canaux et états d'acheminement. Les transitions
 * restent des propositions : le Kernel devra les valider avant persistance.
 */
export function executerM15(entree: EntreeM15): SortieM15 {
  const nouvellesAffirmations = entree.nouvellesAffirmations ?? [];
  const propositionsTransmissions = entree.transmissions ?? [];
  const connaissancesExplicites = entree.connaissancesProposees ?? [];

  const graphe = construireGrapheParents(entree.contexte, nouvellesAffirmations);

  const affirmationsAvant = [...entree.contexte.affirmations];
  const evaluationsAffirmations = nouvellesAffirmations.map((version) =>
    evaluerAffirmation(entree, version, affirmationsAvant, graphe),
  );

  const affirmationsAdmissibles = evaluationsAffirmations
    .filter((evaluation) => evaluation.admissible)
    .map((evaluation) =>
      nouvellesAffirmations.find(
        (version) => version.affirmation.id === evaluation.affirmationId,
      )?.affirmation,
    )
    .filter((affirmation): affirmation is AffirmationNarrative => Boolean(affirmation));

  const affirmationsEffectives = uniquesParCle(
    [...affirmationsAvant, ...affirmationsAdmissibles],
    (affirmation) => affirmation.id,
  );

  const evaluationsTransmissions = propositionsTransmissions.map((proposition) =>
    evaluerTransmission(entree, proposition, affirmationsEffectives),
  );

  const evaluationsDepuisReceptions = evaluationsConnaissancesDepuisReceptions(
    entree,
    propositionsTransmissions,
    evaluationsTransmissions,
  );

  const evaluationsConnaissancesExplicites = connaissancesExplicites.map((proposition) =>
    evaluerConnaissance(
      entree,
      proposition,
      affirmationsEffectives,
      evaluationsTransmissions,
    ),
  );

  const evaluationsConnaissances = uniquesParCle(
    [...evaluationsDepuisReceptions, ...evaluationsConnaissancesExplicites],
    (evaluation) => `${evaluation.acteurId}::${evaluation.affirmationId}::${evaluation.transition?.id ?? 'sans-transition'}`,
  );

  const connaissancesEffectives = connaissanceEffective(
    entree.contexte,
    evaluationsConnaissances,
  );

  const evaluationsProvenance = uniquesParCle(
    affirmationsEffectives.map((affirmation) => evaluerProvenance(affirmation.id, graphe)),
    (evaluation) => evaluation.affirmationId,
  );

  const evaluationsSecrets = (entree.secrets ?? []).map(evaluerSecret);

  const evaluationsNarrateur = affirmationsEffectives.map((affirmation) =>
    evaluerNarrateur(affirmation, entree.pointDeVue, connaissancesEffectives),
  );

  const transitionsInformation = uniquesParCle(
    [
      ...evaluationsAffirmations.flatMap((evaluation) =>
        evaluation.transition ? [evaluation.transition] : [],
      ),
      ...evaluationsTransmissions.flatMap((evaluation) =>
        evaluation.transition ? [evaluation.transition] : [],
      ),
      ...evaluationsConnaissances.flatMap((evaluation) =>
        evaluation.transition ? [evaluation.transition] : [],
      ),
    ],
    (transition) => transition.id,
  );

  const savoirs = savoirsPourM01(affirmationsEffectives, connaissancesEffectives);
  const controles = creerControles(
    evaluationsTransmissions,
    evaluationsConnaissances,
    evaluationsNarrateur,
  );

  const alertes = uniquesTextes([
    ...evaluationsAffirmations.flatMap((evaluation) => evaluation.blocages),
    ...evaluationsTransmissions.flatMap((evaluation) => evaluation.blocages),
    ...evaluationsConnaissances.flatMap((evaluation) => evaluation.blocages),
    ...evaluationsProvenance.flatMap((evaluation) =>
      evaluation.avertissementSourceCommune
        ? [evaluation.avertissementSourceCommune]
        : [],
    ),
    ...evaluationsSecrets.flatMap((evaluation) => evaluation.alertes),
  ]);

  const contraintes = contraintesPourM01(
    evaluationsTransmissions,
    evaluationsNarrateur,
  );

  const pointsAMontrer = uniquesTextes(
    evaluationsTransmissions.flatMap((evaluation) =>
      evaluation.receptionValide
        ? [`La réception ${evaluation.transmissionId} peut être mise en scène si elle est perceptible dans le cadrage actuel.`]
        : [],
    ),
  );

  const contribution: ContributionSceneM01 = {
    savoirs,
    contraintes,
    pointsAMontrer,
    interditsNarratifs: uniquesTextes([
      'Ne pas donner un savoir d’auteur à un personnage qui ne le possède pas.',
      'Ne pas transformer une rumeur en fait canonique par répétition.',
      'Ne pas déclencher une fuite de secret uniquement pour relancer le rythme.',
      'Ne pas réécrire rétroactivement le moment où une information a été reçue.',
    ]),
    controles,
  };

  const resultat: ResultatMoteur<ContributionSceneM01> = {
    moteur: MOTEUR_M15,
    contribution,
    transitions: transitionsInformation,
    contraintes,
    alertes,
    blocage: blocagePrincipal(
      evaluationsAffirmations,
      evaluationsTransmissions,
      evaluationsConnaissances,
    ),
  };

  return {
    moteur: MOTEUR_M15,
    resultat,
    evaluationsAffirmations,
    evaluationsTransmissions,
    evaluationsConnaissances,
    evaluationsProvenance,
    evaluationsSecrets,
    evaluationsNarrateur,
    transitionsInformation,
    savoirsPourM01: savoirs,
    alertes,
  };
}

/**
 * Utilitaire de construction d'une transmission planifiée sans réception.
 * Utile pour une lettre ou un rapport qui vient seulement de partir : la
 * fonction fixe volontairement `recue` à false afin de prévenir toute
 * connaissance prématurée du destinataire.
 */
export function creerTransmissionPlanifieeM15(params: {
  id: string;
  affirmationId: string;
  emetteurId?: string;
  destinataireIds: string[];
  canal: string;
  moment?: string;
  fidelite?: number;
  portee?: PorteeInformation;
}): TransmissionInformation {
  return {
    id: params.id,
    affirmationId: params.affirmationId,
    emetteurId: params.emetteurId,
    destinataireIds: uniquesTextes(params.destinataireIds),
    canal: params.canal,
    moment: params.moment,
    fidelite: bornerFidelite(params.fidelite),
    portee: params.portee ?? porteeParDefaut(classifierCanal(params.canal)),
    recue: false,
  };
}

/**
 * Construit une proposition de réception seulement lorsqu'une arrivée et une
 * réception ont déjà été établies par les sources de la scène.
 */
export function marquerReceptionEtablieM15(
  transmission: TransmissionInformation,
  sourceIds: string[],
  options?: {
    canalId?: string;
    statutReception?: StatutInformation;
    interpretationParDestinataire?: Record<string, string>;
  },
): PropositionTransmissionM15 {
  return {
    transmission: {
      ...transmission,
      recue: true,
    },
    canalId: options?.canalId,
    etatAcheminement: 'arrive',
    receptionEtablie: true,
    statutReception: options?.statutReception,
    interpretationParDestinataire: options?.interpretationParDestinataire,
    sourceIds: uniquesTextes(sourceIds),
  };
}

/**
 * Donne les racines de provenance d'une affirmation parmi les versions
 * proposées. Cette fonction ne mesure pas la vérité ; elle sert uniquement à
 * repérer les copies qui remontent au même témoin, document ou récit.
 */
export function racinesProvenanceM15(
  contexte: ContexteNarratifV21,
  versions: VersionAffirmationM15[],
  affirmationId: string,
): string[] {
  return racinesAffirmation(
    affirmationId,
    construireGrapheParents(contexte, versions),
  );
}

/**
 * Vérifie sans mutation si un acteur dispose actuellement d'une affirmation.
 * L'absence renvoie false : elle ne signifie ni oubli fictif, ni preuve que
 * l'affirmation est fausse.
 */
export function acteurConnaitAffirmationM15(
  contexte: ContexteNarratifV21,
  acteurId: string,
  affirmationId: string,
): boolean {
  return Boolean(
    connaissanceParCle(contexte.connaissances, acteurId, affirmationId),
  );
}

/**
 * Retourne les transmissions déjà reçues par un acteur dans l'état fourni.
 * Les transmissions planifiées ou en route sont volontairement exclues.
 */
export function transmissionsRecuesParActeurM15(
  contexte: ContexteNarratifV21,
  acteurId: string,
): TransmissionInformation[] {
  return contexte.transmissions.filter(
    (transmission) =>
      transmission.recue && transmission.destinataireIds.includes(acteurId),
  );
}

/**
 * Diagnostic de cohérence pour le cas E15 : un acteur ne doit pas connaître
 * une affirmation uniquement parce qu'un rapport est en route vers lui.
 */
export function verifierAbsenceInformationAvantReceptionM15(params: {
  contexte: ContexteNarratifV21;
  acteurId: string;
  affirmationId: string;
  transmissionId: string;
}): {
  conforme: boolean;
  raison: string;
} {
  const transmission = transmissionParId(
    params.contexte.transmissions,
    params.transmissionId,
  );
  const connaissance = connaissanceParCle(
    params.contexte.connaissances,
    params.acteurId,
    params.affirmationId,
  );

  if (!transmission) {
    return {
      conforme: !connaissance,
      raison: connaissance
        ? 'Une connaissance est présente sans transmission référencée dans ce diagnostic.'
        : 'Aucune transmission ni connaissance anticipée n’est constatée.',
    };
  }

  if (!transmission.recue && connaissance?.sourceIds.includes(transmission.id)) {
    return {
      conforme: false,
      raison: 'La connaissance cite une transmission qui n’est pas encore reçue.',
    };
  }

  return {
    conforme: true,
    raison: transmission.recue
      ? 'La transmission est reçue ; une connaissance correspondante peut être légitime.'
      : 'La transmission est encore non reçue et n’accorde pas de savoir au destinataire.',
  };
}

/**
 * Produit une version fidèle explicitement reliée à sa source. Une copie
 * fidèle ne subit aucune déformation mécanique du seul fait d'avoir circulé.
 */
export function creerCopieFideleM15(params: {
  id: string;
  parent: AffirmationNarrative;
  contenu?: string;
  origine?: SourceNarrative;
  sourceIds: string[];
}): VersionAffirmationM15 {
  return {
    affirmation: {
      id: params.id,
      contenu: params.contenu ?? params.parent.contenu,
      statut: params.parent.statut,
      origine: params.origine,
      credibilite: params.parent.credibilite,
    },
    parentAffirmationIds: [params.parent.id],
    fidelite: 'fidele',
    sourceIds: uniquesTextes(params.sourceIds),
  };
}

/**
 * Produit une version altérée uniquement avec une cause explicite. Cela évite
 * la règle erronée « chaque relais déforme forcément l'information ».
 */
export function creerVersionAltereeM15(params: {
  affirmation: AffirmationNarrative;
  parentAffirmationIds: string[];
  causeVariation: string;
  sourceIds: string[];
}): VersionAffirmationM15 {
  return {
    affirmation: params.affirmation,
    parentAffirmationIds: uniquesTextes(params.parentAffirmationIds),
    causeVariation: params.causeVariation,
    fidelite: 'alteree',
    sourceIds: uniquesTextes(params.sourceIds),
  };
}
