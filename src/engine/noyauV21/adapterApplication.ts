// Elyndor — Noyau narratif natif V2.1
// Adaptateur de l'état réel de l'application vers ContexteNarratifV21.
//
// Ce module ne contacte aucun modèle, ne persiste rien et ne modifie aucun
// stockage existant. Il traduit seulement les données déjà présentes dans
// StoryState / NarrativeCoreState vers le langage commun du Kernel V2.1.
//
// Principe important : une donnée absente reste absente. L'adaptateur préfère
// laisser un champ vide plutôt que d'inventer un statut, une compétence, une
// institution, une délégation, un groupe ou une connaissance.

import type {
  AppSettings,
  Engagement,
  RelationPersonnage,
  StoryState,
} from '../../types';
import type { NarrativeCoreState } from '../noyauNarratif';
import type {
  AffirmationNarrative,
  AncrageSocial,
  CadrageScene,
  ConnaissanceSituee,
  ContexteNarratifV21,
  DelegationNarrative,
  EngagementNarratif,
  EvenementNarratif,
  FilNarratif,
  GroupeNarratif,
  IdentitePersonnage,
  InstitutionNarrative,
  LimiteActive,
  NatureEchange,
  NiveauRendu,
  ProfilRenduNarratif,
  RelationDirigee,
  ReputationSituee,
  ResolutionAction,
  SituationPhysique,
  SourceNarrative,
  TransmissionInformation,
} from './types';

type LegacyObj = Record<string, any>;

export interface OptionsAdaptateurApplicationV21 {
  messageJoueur: string;
  appSettings: AppSettings;

  /**
   * Nature explicitement connue par l'interface ou la couche appelante.
   * Sans indication, l'adaptateur reste en fiction : il n'essaie pas de
   * deviner qu'un « stop » prononcé dans un dialogue serait un arrêt réel.
   */
  natureEchange?: NatureEchange;

  /** Participant(s) que la couche active sait physiquement présents. */
  participantsSupplementaires?: string[];

  /**
   * Données déjà établies ailleurs mais encore non représentées dans
   * StoryState. Elles sont copiées telles quelles ; l'adaptateur ne les crée
   * jamais de lui-même.
   */
  limitesActives?: LimiteActive[];
  delegations?: DelegationNarrative[];
  institutions?: InstitutionNarrative[];
  ancragesSociaux?: AncrageSocial[];
  groupes?: GroupeNarratif[];
  transmissions?: TransmissionInformation[];
  resultatsDejaEtablis?: ResolutionAction[];
  incertitudes?: string[];

  /** Plafonds de sélection locale afin de garder le contexte compact. */
  maxEvenements?: number;
  maxFaitsMemoireFallback?: number;
}

export interface DiagnosticAdaptateurApplicationV21 {
  noyauStructureDisponible: boolean;
  personnageJoueurId: string;
  participants: number;
  evenements: number;
  personnages: number;
  relations: number;
  reputations: number;
  engagements: number;
  connaissances: number;
  affirmations: number;
  filsNarratifs: number;
  donneesAbsentesNonInventees: string[];
}

export interface SortieAdaptateurApplicationV21 {
  contexte: ContexteNarratifV21;
  diagnostic: DiagnosticAdaptateurApplicationV21;
}

const MOTS_VIDES = new Set(
  'avec dans pour mais plus comme tout elle elles leur leurs nous vous cette ceci cela sans sous alors encore entre apres avant vers dont tres bien fait faire etre avait sont sera ses son sur une des les que qui aux par pas du de la le un une au en et ou a à il ils on ce ces se sa ne ni car puis donc'.split(/\s+/),
);

function propre(valeur: unknown): string {
  return String(valeur ?? '').replace(/\s+/g, ' ').trim();
}

function normaliser(valeur: unknown): string {
  return propre(valeur)
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9'’_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function jetons(valeur: unknown): Set<string> {
  return new Set(
    normaliser(valeur)
      .split(' ')
      .filter((mot) => mot.length >= 3 && !MOTS_VIDES.has(mot)),
  );
}

function similariteLexicale(a: unknown, b: unknown): number {
  const A = jetons(a);
  const B = jetons(b);
  if (!A.size || !B.size) return 0;
  let communs = 0;
  for (const mot of A) if (B.has(mot)) communs += 1;
  return communs / Math.sqrt(A.size * B.size);
}

function identifiant(prefixe: string, valeur: unknown): string {
  const cle = normaliser(valeur)
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${prefixe}:${cle || 'inconnu'}`;
}

function listeObjets(valeur: unknown): LegacyObj[] {
  return Array.isArray(valeur)
    ? valeur.filter((element): element is LegacyObj => !!element && typeof element === 'object')
    : [];
}

function listeTextes(valeur: unknown): string[] {
  if (!Array.isArray(valeur)) return [];
  return uniquesTextes(valeur.map(propre));
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

function borner(valeur: unknown, min: number, max: number): number | undefined {
  const n = Number(valeur);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(min, Math.min(max, n));
}

function entier(valeur: unknown, defaut = 0): number {
  const n = Number(valeur);
  return Number.isFinite(n) ? Math.trunc(n) : defaut;
}

function sourceMessageJoueur(story: StoryState): SourceNarrative {
  const index = Math.max(0, story.messages.length);
  return {
    id: `message-joueur:${story.meta.id}:${index}`,
    type: 'message_joueur',
    description: 'Initiative du joueur pour le tour courant',
    messageIndex: index,
    tempsFictif: tempsFictif(story.narrativeCore),
  };
}

function sourceEvenementCore(evenement: LegacyObj): SourceNarrative {
  const source = evenement.source && typeof evenement.source === 'object'
    ? evenement.source as LegacyObj
    : {};
  return {
    id: propre(evenement.id) || identifiant('evt-source', evenement.summary),
    type: 'evenement',
    description: propre(evenement.summary) || undefined,
    messageIndex:
      Number.isFinite(Number(source.messageIndex))
        ? Number(source.messageIndex)
        : undefined,
    tempsFictif: propre(evenement.worldTime) || undefined,
  };
}

function sourceFaitMemoire(story: StoryState, id: string, index?: number): SourceNarrative {
  return {
    id: `memoire:${story.meta.id}:${id}`,
    type: 'fait',
    description: 'Fait conservé par la mémoire applicative',
    messageIndex: index,
  };
}

function niveauViolence(valeur: StoryState['settings']['violence']): NiveauRendu {
  switch (valeur) {
    case 'faible': return 'faible';
    case 'modere': return 'modere';
    case 'eleve': return 'eleve';
    case 'extreme': return 'maximal';
    default: return 'modere';
  }
}

function niveauQuatre(valeur: StoryState['settings']['romance']): NiveauRendu {
  switch (valeur) {
    case 'aucun': return 'desactive';
    case 'faible': return 'faible';
    case 'modere': return 'modere';
    case 'eleve': return 'eleve';
    default: return 'modere';
  }
}

function construireProfilRendu(story: StoryState, appSettings: AppSettings): ProfilRenduNarratif {
  return {
    mode: appSettings.profilContenu === 'adulte' ? 'adulte' : 'grand_public',
    ton: story.settings.ton,
    violence: niveauViolence(story.settings.violence),
    romance: niveauQuatre(story.settings.romance),
    humour: niveauQuatre(story.settings.humour),
    longueur: story.settings.longueur,
    rythme: story.settings.rythme,
    creativite: story.settings.creativite,
    autresPreferences: {
      liberteJoueur: story.settings.liberteJoueur,
    },
  };
}

function tempsFictif(core: NarrativeCoreState | undefined): string | undefined {
  if (!core?.clock) return undefined;
  const jour = Math.max(0, entier(core.clock.day));
  const minute = Math.max(0, entier(core.clock.minute)) % 1440;
  const hh = String(Math.floor(minute / 60)).padStart(2, '0');
  const mm = String(minute % 60).padStart(2, '0');
  return `J${jour} ${hh}:${mm}`;
}

function resolverEntite(nom: unknown, joueurNom: string, joueurId: string): string {
  const propreNom = propre(nom);
  if (!propreNom) return identifiant('entite', 'inconnu');
  if (normaliser(propreNom) === normaliser(joueurNom)) return joueurId;
  if (/^faction\s*:/i.test(propreNom)) {
    return identifiant('groupe', propreNom.replace(/^faction\s*:/i, ''));
  }
  return identifiant('pnj', propreNom);
}

function construirePersonnages(
  story: StoryState,
  joueurId: string,
): IdentitePersonnage[] {
  const parId = new Map<string, IdentitePersonnage>();
  const joueurNom = propre(story.meta.personnageNom) || 'Joueur';

  parId.set(joueurId, {
    id: joueurId,
    nom: joueurNom,
    traits: propre(story.meta.personnageDescription)
      ? [propre(story.meta.personnageDescription)]
      : [],
    valeurs: [],
    buts: propre(story.meta.contexte.objectifs)
      ? [propre(story.meta.contexte.objectifs)]
      : [],
    competences: [],
  });

  const core = story.narrativeCore;
  for (const bdi of listeObjets(core?.bdi)) {
    const nom = propre(bdi.name);
    if (!nom || normaliser(nom) === normaliser(joueurNom)) continue;
    const id = resolverEntite(nom, joueurNom, joueurId);
    parId.set(id, {
      id,
      nom,
      traits: [],
      valeurs: [],
      buts: uniquesTextes([
        ...listeTextes(bdi.desires),
        ...listeTextes(bdi.intentions),
      ]),
      competences: [],
    });
  }

  for (const relation of story.social.relations) {
    const nom = propre(relation.nom);
    if (!nom || normaliser(nom) === normaliser(joueurNom)) continue;
    const id = resolverEntite(nom, joueurNom, joueurId);
    if (!parId.has(id)) {
      parId.set(id, {
        id,
        nom,
        traits: [],
        valeurs: [],
        buts: [],
        competences: [],
      });
    }
  }

  for (const entree of story.loreEmergent) {
    if (entree.categorie !== 'pnj' || entree.statut !== 'permanent') continue;
    const nom = propre(entree.titre);
    if (!nom || normaliser(nom) === normaliser(joueurNom)) continue;
    const id = resolverEntite(nom, joueurNom, joueurId);
    const existant = parId.get(id);
    const description = propre(entree.contenu);
    if (existant) {
      if (description && existant.traits.length === 0) existant.traits = [description];
    } else {
      parId.set(id, {
        id,
        nom,
        traits: description ? [description] : [],
        valeurs: [],
        buts: [],
        competences: [],
      });
    }
  }

  return [...parId.values()];
}

function participantsDepuisDernierEvenement(
  story: StoryState,
  joueurId: string,
): string[] {
  const core = story.narrativeCore;
  const joueurNom = propre(story.meta.personnageNom) || 'Joueur';
  const lieuActuel = normaliser(story.meta.contexte.lieu);
  const evenements = listeObjets(core?.ledger);

  for (let i = evenements.length - 1; i >= 0; i -= 1) {
    const evenement = evenements[i];
    const lieuEvenement = normaliser(evenement.location);
    if (lieuActuel && lieuEvenement && lieuActuel !== lieuEvenement) continue;
    const noms = uniquesTextes([
      ...listeTextes(evenement.actors),
      ...listeTextes(evenement.targets),
      ...listeTextes(evenement.witnesses),
    ]);
    if (!noms.length) continue;
    return uniquesTextes([
      joueurId,
      ...noms.map((nom) => resolverEntite(nom, joueurNom, joueurId)),
    ]);
  }

  return [joueurId];
}

function construireScene(
  story: StoryState,
  joueurId: string,
  participantsSupplementaires: string[],
): CadrageScene {
  const joueurNom = propre(story.meta.personnageNom) || 'Joueur';
  const participants = uniquesTextes([
    ...participantsDepuisDernierEvenement(story, joueurId),
    ...participantsSupplementaires.map((nom) =>
      nom.includes(':') ? nom : resolverEntite(nom, joueurNom, joueurId)),
  ]);

  return {
    id: `scene:${story.meta.id}:${story.messages.length}`,
    lieu: propre(story.meta.contexte.lieu) || undefined,
    pointDeVue: joueurId,
    enjeu:
      propre(story.meta.contexte.objectifs) ||
      propre(story.meta.pointDeDepart) ||
      undefined,
    ambiance: propre(story.meta.contexte.ambiance) || undefined,
    participants,
    momentFictif: tempsFictif(story.narrativeCore) || propre(story.meta.contexte.dateChronique) || undefined,
  };
}

function scoreEvenement(
  evenement: LegacyObj,
  requete: string,
  lieu: string,
  index: number,
  total: number,
): number {
  let score = similariteLexicale(
    `${propre(evenement.summary)} ${propre(evenement.location)} ${listeTextes(evenement.actors).join(' ')} ${listeTextes(evenement.targets).join(' ')}`,
    requete,
  ) * 60;

  if (lieu && normaliser(evenement.location) === normaliser(lieu)) score += 14;
  const importance = borner(evenement.importance, 0, 1) ?? 0;
  score += importance * 16;
  score += Math.max(0, 10 - (total - 1 - index) / 5);
  return score;
}

function mapperEvenementCore(
  story: StoryState,
  evenement: LegacyObj,
  joueurId: string,
): EvenementNarratif | undefined {
  const resume = propre(evenement.summary);
  if (!resume) return undefined;
  const joueurNom = propre(story.meta.personnageNom) || 'Joueur';
  return {
    id: propre(evenement.id) || identifiant('evt', resume),
    resume,
    acteurs: listeTextes(evenement.actors).map((nom) => resolverEntite(nom, joueurNom, joueurId)),
    cibles: listeTextes(evenement.targets).map((nom) => resolverEntite(nom, joueurNom, joueurId)),
    lieu: propre(evenement.location) || undefined,
    tempsFictif: propre(evenement.worldTime) || undefined,
    causes: [],
    sources: [sourceEvenementCore(evenement)],
    canonique: true,
  };
}

function construireEvenementsPertinents(
  story: StoryState,
  messageJoueur: string,
  joueurId: string,
  maxEvenements: number,
  maxFaitsMemoireFallback: number,
): EvenementNarratif[] {
  const core = story.narrativeCore;
  const ledger = listeObjets(core?.ledger);
  const lieu = propre(story.meta.contexte.lieu);
  const requete = uniquesTextes([
    messageJoueur,
    lieu,
    story.meta.contexte.objectifs,
    ...story.messages.slice(-2).map((message) => message.content),
  ]).join('\n');

  const selection = ledger
    .map((evenement, index) => ({
      evenement,
      score: scoreEvenement(evenement, requete, lieu, index, ledger.length),
      index,
    }))
    .filter(({ score, index }) => score >= 8 || index >= Math.max(0, ledger.length - 2))
    .sort((a, b) => b.score - a.score || b.index - a.index)
    .slice(0, Math.max(1, maxEvenements))
    .map(({ evenement }) => mapperEvenementCore(story, evenement, joueurId))
    .filter((evenement): evenement is EvenementNarratif => !!evenement);

  if (selection.length) return selection;

  return story.memoire.faits
    .filter((fait) => fait.niveau === 'canon' || fait.niveau === 'consolide')
    .slice(-Math.max(0, maxFaitsMemoireFallback))
    .map((fait) => ({
      id: `memoire-fait:${fait.id}`,
      resume: propre(fait.texte),
      acteurs: [],
      sources: [sourceFaitMemoire(story, fait.id, fait.dernierAcces)],
      canonique: fait.niveau === 'canon',
    }))
    .filter((evenement) => !!evenement.resume);
}

function mapperRelationLegacy(
  story: StoryState,
  relation: RelationPersonnage,
  joueurId: string,
): RelationDirigee | undefined {
  const nom = propre(relation.nom);
  if (!nom) return undefined;
  const joueurNom = propre(story.meta.personnageNom) || 'Joueur';
  const acteurId = resolverEntite(nom, joueurNom, joueurId);
  return {
    id: `relation:${act  eurId}->${joueurId}`.replace('act  eur', 'acteur'),
    acteurId,
    cibleId: joueurId,
    confiance: borner(relation.confiance, -3, 3),
    attachement: borner(relation.affection, -3, 3),
    respect: borner(relation.respect, -3, 3),
    peur: borner(relation.peur, -3, 3),
    ressentiment: borner(relation.hostilite, -3, 3),
    attentes: [],
    evenementsJustificatifs: [],
  };
}

function mapperRelationCore(
  story: StoryState,
  ligne: LegacyObj,
  joueurId: string,
): RelationDirigee | undefined {
  if (ligne.scope !== 'personal') return undefined;
  const from = propre(ligne.subject);
  const to = propre(ligne.target);
  if (!from || !to) return undefined;
  const joueurNom = propre(story.meta.personnageNom) || 'Joueur';
  const acteurId = resolverEntite(from, joueurNom, joueurId);
  const cibleId = resolverEntite(to, joueurNom, joueurId);
  const versEchelleCourte = (valeur: unknown): number | undefined => {
    const n = borner(valeur, -100, 100);
    return n === undefined ? undefined : Math.round((n / 100) * 3 * 100) / 100;
  };
  return {
    id: propre(ligne.id) || `relation:${acteurId}->${cibleId}`,
    acteurId,
    cibleId,
    confiance: versEchelleCourte(ligne.trust),
    attachement: versEchelleCourte(ligne.affection),
    respect: versEchelleCourte(ligne.respect),
    peur: versEchelleCourte(ligne.fear),
    ressentiment: versEchelleCourte(ligne.hostility),
    attentes: [],
    evenementsJustificatifs: propre(ligne.sourceEvent) ? [propre(ligne.sourceEvent)] : [],
  };
}

function construireRelations(story: StoryState, joueurId: string): RelationDirigee[] {
  const resultat = new Map<string, RelationDirigee>();

  for (const ligne of listeObjets(story.narrativeCore?.reputation)) {
    const relation = mapperRelationCore(story, ligne, joueurId);
    if (!relation) continue;
    resultat.set(`${relation.acteurId}->${relation.cibleId}`, relation);
  }

  for (const legacy of story.social.relations) {
    const relation = mapperRelationLegacy(story, legacy, joueurId);
    if (!relation) continue;
    const cle = `${relation.acteurId}->${relation.cibleId}`;
    if (!resultat.has(cle)) resultat.set(cle, relation);
  }

  return [...resultat.values()];
}

function construireReputations(story: StoryState, joueurId: string): ReputationSituee[] {
  const joueurNom = propre(story.meta.personnageNom) || 'Joueur';
  return listeObjets(story.narrativeCore?.reputation)
    .filter((ligne) => ligne.scope === 'faction' && propre(ligne.subject) && propre(ligne.faction))
    .map((ligne) => ({
      id: propre(ligne.id) || identifiant('reputation', `${ligne.subject}:${ligne.faction}`),
      cibleId: resolverEntite(ligne.subject, joueurNom, joueurId),
      communauteId: identifiant('communaute', ligne.faction),
      jugement: propre(ligne.reason) || `Réputation ${Number(ligne.score) >= 0 ? 'favorable' : 'défavorable'}`,
      force: borner(Math.abs(Number(ligne.score) || 0) / 100, 0, 1),
      affirmationIds: [],
      effetsObservables: [],
    }));
}

function etatEngagementLegacy(engagement: Engagement): EngagementNarratif['etat'] {
  if (engagement.honore) return 'accompli';
  if (engagement.rompu) return 'rompu';
  return 'en_cours';
}

function construireEngagements(story: StoryState, joueurId: string): EngagementNarratif[] {
  const joueurNom = propre(story.meta.personnageNom) || 'Joueur';
  const resultat = new Map<string, EngagementNarratif>();

  for (const engagement of story.social.engagements) {
    const partie = propre(engagement.partie);
    const partieId = partie ? resolverEntite(partie, joueurNom, joueurId) : identifiant('partie', 'inconnue');
    const ligne: EngagementNarratif = {
      id: propre(engagement.id) || identifiant('engagement', engagement.description),
      parties: uniquesTextes([joueurId, partieId]),
      termes: propre(engagement.description) ? [propre(engagement.description)] : [],
      etat: etatEngagementLegacy(engagement),
      acceptePar: uniquesTextes([joueurId, partieId]),
      sources: [],
    };
    resultat.set(normaliser(engagement.description), ligne);
  }

  for (const dette of listeObjets(story.narrativeCore?.debts).filter((ligne) => ligne.kind === 'commitment')) {
    const description = propre(dette.summary);
    if (!description || resultat.has(normaliser(description))) continue;
    const partie = propre(dette.source);
    const partieId = partie ? resolverEntite(partie, joueurNom, joueurId) : identifiant('partie', 'inconnue');
    resultat.set(normaliser(description), {
      id: propre(dette.id) || identifiant('engagement', description),
      parties: uniquesTextes([joueurId, partieId]),
      termes: [description],
      etat: dette.status === 'resolved' ? 'accompli' : 'en_cours',
      acceptePar: uniquesTextes([joueurId, partieId]),
      sources: propre(dette.createdEvent)
        ? [{ id: propre(dette.createdEvent), type: 'evenement' }]
        : [],
    });
  }

  return [...resultat.values()];
}

function construireFilsNarratifs(story: StoryState): FilNarratif[] {
  const arc = propre(story.directeur.arcActuel);
  if (!arc) return [];
  const engagementIds = story.social.engagements
    .filter((engagement) => !engagement.honore && !engagement.rompu)
    .map((engagement) => engagement.id);
  return [{
    id: `fil:arc:${story.meta.id}`,
    enjeu: arc,
    acteurs: [],
    etat: 'actif',
    importance: 1,
    conditionsReprise: [],
    engagementIds,
  }];
}

function construireSituationPhysique(
  story: StoryState,
  scene: CadrageScene,
): SituationPhysique {
  const lieu = propre(scene.lieu);
  return {
    lieu: lieu || undefined,
    positions: lieu
      ? scene.participants.map((entiteId) => ({ entiteId, lieu }))
      : [],
    objetsPertinents: [],
    blessures: [],
    contraintesMaterielles: [],
    moyensDisponibles: [],
  };
}

function statutDepuisTypeCroyance(type: unknown): AffirmationNarrative['statut'] {
  const t = normaliser(type);
  if (t.includes('rumor') || t.includes('rumeur')) return 'rumeur';
  if (t.includes('seen') || t.includes('observe') || t.includes('perception')) return 'observation';
  if (t.includes('told') || t.includes('report') || t.includes('temoign')) return 'rapport';
  if (t.includes('infer') || t.includes('deduc')) return 'croyance';
  return 'croyance';
}

function construireInformation(
  story: StoryState,
  joueurId: string,
): {
  affirmations: AffirmationNarrative[];
  connaissances: ConnaissanceSituee[];
} {
  const joueurNom = propre(story.meta.personnageNom) || 'Joueur';
  const affirmations: AffirmationNarrative[] = [];
  const connaissances: ConnaissanceSituee[] = [];
  const idsAffirmation = new Set<string>();

  for (const croyance of listeObjets(story.narrativeCore?.beliefs)) {
    if (croyance.status === 'superseded') continue;
    const fait = propre(croyance.fact);
    const porteur = propre(croyance.knower);
    if (!fait || !porteur) continue;
    const idAffirmation = `affirmation:${propre(croyance.id) || identifiant('croyance', `${porteur}:${fait}`)}`;
    const statut = statutDepuisTypeCroyance(croyance.type);
    if (!idsAffirmation.has(idAffirmation)) {
      idsAffirmation.add(idAffirmation);
      affirmations.push({
        id: idAffirmation,
        contenu: fait,
        statut,
        origine: propre(croyance.acquiredEvent)
          ? { id: propre(croyance.acquiredEvent), type: 'evenement' }
          : undefined,
        credibilite: borner(croyance.confidence, 0, 1),
      });
    }
    connaissances.push({
      acteurId: resolverEntite(porteur, joueurNom, joueurId),
      affirmationId: idAffirmation,
      statut,
      sourceIds: uniquesTextes([
        propre(croyance.source),
        propre(croyance.acquiredEvent),
      ]),
      confiance: borner(croyance.confidence, 0, 1),
    });
  }

  for (const rumeur of listeObjets(story.narrativeCore?.rumors)) {
    if (rumeur.status === 'dead') continue;
    const contenu = propre(rumeur.claim);
    if (!contenu) continue;
    const idAffirmation = `affirmation:rumeur:${propre(rumeur.id) || identifiant('rumeur', contenu)}`;
    if (!idsAffirmation.has(idAffirmation)) {
      idsAffirmation.add(idAffirmation);
      affirmations.push({
        id: idAffirmation,
        contenu,
        statut: 'rumeur',
        origine: propre(rumeur.originEvent)
          ? { id: propre(rumeur.originEvent), type: 'evenement' }
          : undefined,
        credibilite: borner(1 - (Number(rumeur.distortion) || 0), 0, 1),
      });
    }

    for (const porteur of listeTextes(rumeur.carriers)) {
      connaissances.push({
        acteurId: resolverEntite(porteur, joueurNom, joueurId),
        affirmationId: idAffirmation,
        statut: 'rumeur',
        sourceIds: uniquesTextes([propre(rumeur.originEvent), propre(rumeur.id)]),
        confiance: borner(1 - (Number(rumeur.distortion) || 0), 0, 1),
      });
    }
    for (const faction of listeTextes(rumeur.factions)) {
      connaissances.push({
        acteurId: identifiant('groupe', faction),
        affirmationId: idAffirmation,
        statut: 'rumeur',
        sourceIds: uniquesTextes([propre(rumeur.originEvent), propre(rumeur.id)]),
        confiance: borner(1 - (Number(rumeur.distortion) || 0), 0, 1),
      });
    }
  }

  return { affirmations, connaissances };
}

function construireCadre(story: StoryState, messageJoueur: string, nature: NatureEchange) {
  const branche = propre(story.meta.brancheDeId);
  return {
    histoireId: branche || story.meta.id,
    varianteId: branche ? story.meta.id : undefined,
    nature,
    initiativeJoueur: propre(messageJoueur),
  };
}

function absencesNonInventees(
  options: OptionsAdaptateurApplicationV21,
): string[] {
  const absences: string[] = [];
  if (!options.institutions?.length) absences.push('institutions');
  if (!options.ancragesSociaux?.length) absences.push('ancrages_sociaux');
  if (!options.groupes?.length) absences.push('groupes');
  if (!options.delegations?.length) absences.push('delegations');
  if (!options.limitesActives?.length) absences.push('limites_actives_specifiques');
  if (!options.transmissions?.length) absences.push('transmissions_en_cours');
  if (!options.resultatsDejaEtablis?.length) absences.push('resolutions_structurees');
  return absences;
}

/**
 * Transforme l'état courant de l'application en contexte V2.1 sans mutation.
 *
 * Cette étape ne lance pas le Kernel et ne remplace pas encore le pipeline
 * actif. Elle rend simplement les données existantes exploitables par M01–M15.
 */
export function adapterApplicationVersContexteV21(
  story: StoryState,
  options: OptionsAdaptateurApplicationV21,
): SortieAdaptateurApplicationV21 {
  const joueurNom = propre(story.meta.personnageNom) || 'Joueur';
  const joueurId = identifiant('joueur', joueurNom);
  const scene = construireScene(
    story,
    joueurId,
    options.participantsSupplementaires ?? [],
  );
  const personnages = construirePersonnages(story, joueurId);
  const relations = construireRelations(story, joueurId);
  const reputations = construireReputations(story, joueurId);
  const engagements = construireEngagements(story, joueurId);
  const filsNarratifs = construireFilsNarratifs(story);
  const information = construireInformation(story, joueurId);
  const evenementsPertinents = construireEvenementsPertinents(
    story,
    options.messageJoueur,
    joueurId,
    Math.max(1, options.maxEvenements ?? 8),
    Math.max(0, options.maxFaitsMemoireFallback ?? 8),
  );

  const contexte: ContexteNarratifV21 = {
    cadre: construireCadre(
      story,
      options.messageJoueur,
      options.natureEchange ?? 'fiction',
    ),
    scene,
    profilRendu: construireProfilRendu(story, options.appSettings),
    limitesActives: [...(options.limitesActives ?? [])],
    evenementsPertinents,
    personnages,
    relations,
    reputations,
    engagements,
    institutions: [...(options.institutions ?? [])],
    situationPhysique: construireSituationPhysique(story, scene),
    delegations: [...(options.delegations ?? [])],
    archetypes: [],
    ancragesSociaux: [...(options.ancragesSociaux ?? [])],
    filsNarratifs,
    groupes: [...(options.groupes ?? [])],
    connaissances: information.connaissances,
    affirmations: information.affirmations,
    transmissions: [...(options.transmissions ?? [])],
    resultatsDejaEtablis: [...(options.resultatsDejaEtablis ?? [])],
    incertitudes: uniquesTextes(options.incertitudes ?? []),
  };

  return {
    contexte,
    diagnostic: {
      noyauStructureDisponible: !!story.narrativeCore,
      personnageJoueurId: joueurId,
      participants: scene.participants.length,
      evenements: contexte.evenementsPertinents.length,
      personnages: contexte.personnages.length,
      relations: contexte.relations.length,
      reputations: contexte.reputations.length,
      engagements: contexte.engagements.length,
      connaissances: contexte.connaissances.length,
      affirmations: contexte.affirmations.length,
      filsNarratifs: contexte.filsNarratifs.length,
      donneesAbsentesNonInventees: absencesNonInventees(options),
    },
  };
}

export function idPersonnageJoueurV21(story: StoryState): string {
  return identifiant('joueur', propre(story.meta.personnageNom) || 'Joueur');
}
