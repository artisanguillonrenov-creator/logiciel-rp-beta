// Elyndor — Noyau narratif natif V2.1
// Adaptateur de l'état réel de l'application vers ContexteNarratifV21.
//
// Aucun appel modèle, aucune persistance et aucune mutation de StoryState.
// Une donnée absente reste absente : l'adaptateur ne fabrique ni compétence,
// ni statut, ni groupe, ni institution, ni délégation, ni connaissance.

import type { AppSettings, Engagement, RelationPersonnage, StoryState } from '../../types';
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
  TransmissionInformation,
} from './types';

type Obj = Record<string, any>;

export interface OptionsAdaptateurApplicationV21 {
  messageJoueur: string;
  appSettings: AppSettings;
  natureEchange?: NatureEchange;
  participantsSupplementaires?: string[];
  limitesActives?: LimiteActive[];
  delegations?: DelegationNarrative[];
  institutions?: InstitutionNarrative[];
  ancragesSociaux?: AncrageSocial[];
  groupes?: GroupeNarratif[];
  transmissions?: TransmissionInformation[];
  resultatsDejaEtablis?: ResolutionAction[];
  incertitudes?: string[];
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

const propre = (v: unknown): string => String(v ?? '').replace(/\s+/g, ' ').trim();

function normaliser(v: unknown): string {
  return propre(v)
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9'’_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function id(prefixe: string, valeur: unknown): string {
  const cle = normaliser(valeur)
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${prefixe}:${cle || 'inconnu'}`;
}

function objets(v: unknown): Obj[] {
  return Array.isArray(v)
    ? v.filter((x): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x))
    : [];
}

function uniques(valeurs: Iterable<string>): string[] {
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

function textes(v: unknown): string[] {
  return Array.isArray(v) ? uniques(v.map(propre)) : [];
}

function borne(v: unknown, min: number, max: number): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : undefined;
}

function jetons(v: unknown): Set<string> {
  return new Set(
    normaliser(v).split(' ').filter((mot) => mot.length >= 3 && !MOTS_VIDES.has(mot)),
  );
}

function similarite(a: unknown, b: unknown): number {
  const A = jetons(a);
  const B = jetons(b);
  if (!A.size || !B.size) return 0;
  let communs = 0;
  for (const mot of A) if (B.has(mot)) communs += 1;
  return communs / Math.sqrt(A.size * B.size);
}

function joueurId(story: StoryState): string {
  return id('joueur', propre(story.meta.personnageNom) || 'Joueur');
}

function entiteId(story: StoryState, nom: unknown): string {
  const n = propre(nom);
  const nomJoueur = propre(story.meta.personnageNom) || 'Joueur';
  if (normaliser(n) === normaliser(nomJoueur)) return joueurId(story);
  if (/^faction\s*:/i.test(n)) return id('groupe', n.replace(/^faction\s*:/i, ''));
  return id('pnj', n || 'inconnu');
}

function tempsFictif(core: NarrativeCoreState | undefined): string | undefined {
  if (!core?.clock) return undefined;
  const jour = Math.max(0, Number(core.clock.day) || 0);
  const minute = Math.max(0, Number(core.clock.minute) || 0) % 1440;
  return `J${Math.trunc(jour)} ${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(Math.trunc(minute % 60)).padStart(2, '0')}`;
}

function niveauViolence(v: StoryState['settings']['violence']): NiveauRendu {
  if (v === 'faible') return 'faible';
  if (v === 'modere') return 'modere';
  if (v === 'eleve') return 'eleve';
  if (v === 'extreme') return 'maximal';
  return 'modere';
}

function niveauQuatre(v: StoryState['settings']['romance']): NiveauRendu {
  if (v === 'aucun') return 'desactive';
  if (v === 'faible') return 'faible';
  if (v === 'modere') return 'modere';
  if (v === 'eleve') return 'eleve';
  return 'modere';
}

function profilRendu(story: StoryState, app: AppSettings): ProfilRenduNarratif {
  return {
    mode: app.profilContenu === 'adulte' ? 'adulte' : 'grand_public',
    ton: story.settings.ton,
    violence: niveauViolence(story.settings.violence),
    romance: niveauQuatre(story.settings.romance),
    humour: niveauQuatre(story.settings.humour),
    longueur: story.settings.longueur,
    rythme: story.settings.rythme,
    creativite: story.settings.creativite,
    autresPreferences: { liberteJoueur: story.settings.liberteJoueur },
  };
}

function construirePersonnages(story: StoryState): IdentitePersonnage[] {
  const resultat = new Map<string, IdentitePersonnage>();
  const jId = joueurId(story);
  const nomJoueur = propre(story.meta.personnageNom) || 'Joueur';
  resultat.set(jId, {
    id: jId,
    nom: nomJoueur,
    traits: propre(story.meta.personnageDescription) ? [propre(story.meta.personnageDescription)] : [],
    valeurs: [],
    buts: propre(story.meta.contexte.objectifs) ? [propre(story.meta.contexte.objectifs)] : [],
    competences: [],
  });

  for (const bdi of objets(story.narrativeCore?.bdi)) {
    const nom = propre(bdi.name);
    if (!nom || normaliser(nom) === normaliser(nomJoueur)) continue;
    const pId = entiteId(story, nom);
    resultat.set(pId, {
      id: pId,
      nom,
      traits: [],
      valeurs: [],
      buts: uniques([...textes(bdi.desires), ...textes(bdi.intentions)]),
      competences: [],
    });
  }

  for (const relation of story.social.relations) {
    const nom = propre(relation.nom);
    if (!nom || normaliser(nom) === normaliser(nomJoueur)) continue;
    const pId = entiteId(story, nom);
    if (!resultat.has(pId)) {
      resultat.set(pId, { id: pId, nom, traits: [], valeurs: [], buts: [], competences: [] });
    }
  }

  for (const lore of story.loreEmergent) {
    if (lore.categorie !== 'pnj' || lore.statut !== 'permanent') continue;
    const nom = propre(lore.titre);
    if (!nom || normaliser(nom) === normaliser(nomJoueur)) continue;
    const pId = entiteId(story, nom);
    const existant = resultat.get(pId);
    const description = propre(lore.contenu);
    if (existant) {
      if (description && !existant.traits.length) existant.traits = [description];
    } else {
      resultat.set(pId, {
        id: pId,
        nom,
        traits: description ? [description] : [],
        valeurs: [],
        buts: [],
        competences: [],
      });
    }
  }
  return [...resultat.values()];
}

function participants(story: StoryState, supplements: string[]): string[] {
  const jId = joueurId(story);
  const lieu = normaliser(story.meta.contexte.lieu);
  let issusEvenement: string[] = [];
  const ledger = objets(story.narrativeCore?.ledger);
  for (let i = ledger.length - 1; i >= 0; i -= 1) {
    const ev = ledger[i];
    const lieuEv = normaliser(ev.location);
    if (lieu && lieuEv && lieu !== lieuEv) continue;
    issusEvenement = uniques([
      ...textes(ev.actors),
      ...textes(ev.targets),
      ...textes(ev.witnesses),
    ]).map((nom) => entiteId(story, nom));
    if (issusEvenement.length) break;
  }
  return uniques([
    jId,
    ...issusEvenement,
    ...supplements.map((nom) => nom.includes(':') ? nom : entiteId(story, nom)),
  ]);
}

function scene(story: StoryState, supplements: string[]): CadrageScene {
  const jId = joueurId(story);
  return {
    id: `scene:${story.meta.id}:${story.messages.length}`,
    lieu: propre(story.meta.contexte.lieu) || undefined,
    pointDeVue: jId,
    enjeu: propre(story.meta.contexte.objectifs) || propre(story.meta.pointDeDepart) || undefined,
    ambiance: propre(story.meta.contexte.ambiance) || undefined,
    participants: participants(story, supplements),
    momentFictif: tempsFictif(story.narrativeCore) || propre(story.meta.contexte.dateChronique) || undefined,
  };
}

function evenements(story: StoryState, message: string, max: number, fallback: number): EvenementNarratif[] {
  const ledger = objets(story.narrativeCore?.ledger);
  const requete = uniques([
    message,
    story.meta.contexte.lieu,
    story.meta.contexte.objectifs,
    ...story.messages.slice(-2).map((m) => m.content),
  ]).join('\n');
  const lieu = normaliser(story.meta.contexte.lieu);

  const selection = ledger
    .map((ev, index) => {
      let score = similarite(
        `${propre(ev.summary)} ${propre(ev.location)} ${textes(ev.actors).join(' ')} ${textes(ev.targets).join(' ')}`,
        requete,
      ) * 60;
      if (lieu && normaliser(ev.location) === lieu) score += 14;
      score += (borne(ev.importance, 0, 1) ?? 0) * 16;
      score += Math.max(0, 10 - (ledger.length - 1 - index) / 5);
      return { ev, index, score };
    })
    .filter((x) => x.score >= 8 || x.index >= Math.max(0, ledger.length - 2))
    .sort((a, b) => b.score - a.score || b.index - a.index)
    .slice(0, Math.max(1, max))
    .map(({ ev }): EvenementNarratif | undefined => {
      const resume = propre(ev.summary);
      if (!resume) return undefined;
      return {
        id: propre(ev.id) || id('evt', resume),
        resume,
        acteurs: textes(ev.actors).map((nom) => entiteId(story, nom)),
        cibles: textes(ev.targets).map((nom) => entiteId(story, nom)),
        lieu: propre(ev.location) || undefined,
        tempsFictif: propre(ev.worldTime) || undefined,
        sources: [{
          id: propre(ev.id) || id('evt-source', resume),
          type: 'evenement',
          description: resume,
          tempsFictif: propre(ev.worldTime) || undefined,
        }],
        canonique: true,
      };
    })
    .filter((x): x is EvenementNarratif => !!x);

  if (selection.length) return selection;

  return story.memoire.faits
    .filter((fait) => fait.niveau === 'canon' || fait.niveau === 'consolide')
    .slice(-Math.max(0, fallback))
    .map((fait) => ({
      id: `memoire-fait:${fait.id}`,
      resume: propre(fait.texte),
      acteurs: [],
      sources: [{
        id: `memoire:${story.meta.id}:${fait.id}`,
        type: 'fait' as const,
        description: 'Fait conservé par la mémoire applicative',
        messageIndex: fait.dernierAcces,
      }],
      canonique: fait.niveau === 'canon',
    }))
    .filter((x) => !!x.resume);
}

function relationLegacy(story: StoryState, relation: RelationPersonnage): RelationDirigee | undefined {
  const nom = propre(relation.nom);
  if (!nom) return undefined;
  const acteurId = entiteId(story, nom);
  const cibleId = joueurId(story);
  return {
    id: `relation:${acteurId}->${cibleId}`,
    acteurId,
    cibleId,
    confiance: borne(relation.confiance, -3, 3),
    attachement: borne(relation.affection, -3, 3),
    respect: borne(relation.respect, -3, 3),
    peur: borne(relation.peur, -3, 3),
    ressentiment: borne(relation.hostilite, -3, 3),
    attentes: [],
    evenementsJustificatifs: [],
  };
}

function relations(story: StoryState): RelationDirigee[] {
  const resultat = new Map<string, RelationDirigee>();
  const echelle = (v: unknown): number | undefined => {
    const n = borne(v, -100, 100);
    return n === undefined ? undefined : Math.round((n / 100) * 300) / 100;
  };

  for (const ligne of objets(story.narrativeCore?.reputation)) {
    if (ligne.scope !== 'personal' || !propre(ligne.subject) || !propre(ligne.target)) continue;
    const acteurId = entiteId(story, ligne.subject);
    const cibleId = entiteId(story, ligne.target);
    const relation: RelationDirigee = {
      id: propre(ligne.id) || `relation:${acteurId}->${cibleId}`,
      acteurId,
      cibleId,
      confiance: echelle(ligne.trust),
      attachement: echelle(ligne.affection),
      respect: echelle(ligne.respect),
      peur: echelle(ligne.fear),
      ressentiment: echelle(ligne.hostility),
      attentes: [],
      evenementsJustificatifs: propre(ligne.sourceEvent) ? [propre(ligne.sourceEvent)] : [],
    };
    resultat.set(`${acteurId}->${cibleId}`, relation);
  }

  for (const r of story.social.relations) {
    const relation = relationLegacy(story, r);
    if (!relation) continue;
    const cle = `${relation.acteurId}->${relation.cibleId}`;
    if (!resultat.has(cle)) resultat.set(cle, relation);
  }
  return [...resultat.values()];
}

function reputations(story: StoryState): ReputationSituee[] {
  return objets(story.narrativeCore?.reputation)
    .filter((r) => r.scope === 'faction' && propre(r.subject) && propre(r.faction))
    .map((r) => ({
      id: propre(r.id) || id('reputation', `${r.subject}:${r.faction}`),
      cibleId: entiteId(story, r.subject),
      communauteId: id('communaute', r.faction),
      jugement: propre(r.reason) || `Réputation ${Number(r.score) >= 0 ? 'favorable' : 'défavorable'}`,
      force: borne(Math.abs(Number(r.score) || 0) / 100, 0, 1),
      affirmationIds: [],
      effetsObservables: [],
    }));
}

function etatEngagement(e: Engagement): EngagementNarratif['etat'] {
  if (e.honore) return 'accompli';
  if (e.rompu) return 'rompu';
  return 'en_cours';
}

function engagements(story: StoryState): EngagementNarratif[] {
  const resultat = new Map<string, EngagementNarratif>();
  const jId = joueurId(story);

  for (const e of story.social.engagements) {
    const partie = propre(e.partie) ? entiteId(story, e.partie) : id('partie', 'inconnue');
    const description = propre(e.description);
    const ligne: EngagementNarratif = {
      id: propre(e.id) || id('engagement', description),
      parties: uniques([jId, partie]),
      termes: description ? [description] : [],
      etat: etatEngagement(e),
      acceptePar: uniques([jId, partie]),
      sources: [],
    };
    resultat.set(normaliser(description), ligne);
  }

  for (const d of objets(story.narrativeCore?.debts).filter((x) => x.kind === 'commitment')) {
    const description = propre(d.summary);
    if (!description || resultat.has(normaliser(description))) continue;
    const partie = propre(d.source) ? entiteId(story, d.source) : id('partie', 'inconnue');
    resultat.set(normaliser(description), {
      id: propre(d.id) || id('engagement', description),
      parties: uniques([jId, partie]),
      termes: [description],
      etat: d.status === 'resolved' ? 'accompli' : 'en_cours',
      acceptePar: uniques([jId, partie]),
      sources: propre(d.createdEvent) ? [{ id: propre(d.createdEvent), type: 'evenement' }] : [],
    });
  }
  return [...resultat.values()];
}

function fils(story: StoryState): FilNarratif[] {
  const arc = propre(story.directeur.arcActuel);
  if (!arc) return [];
  return [{
    id: `fil:arc:${story.meta.id}`,
    enjeu: arc,
    acteurs: [],
    etat: 'actif',
    importance: 1,
    conditionsReprise: [],
    engagementIds: story.social.engagements
      .filter((e) => !e.honore && !e.rompu)
      .map((e) => e.id),
  }];
}

function statutCroyance(type: unknown): AffirmationNarrative['statut'] {
  const t = normaliser(type);
  if (t.includes('rumor') || t.includes('rumeur')) return 'rumeur';
  if (t.includes('seen') || t.includes('observe') || t.includes('perception')) return 'observation';
  if (t.includes('told') || t.includes('report') || t.includes('temoign')) return 'rapport';
  return 'croyance';
}

function information(story: StoryState): {
  affirmations: AffirmationNarrative[];
  connaissances: ConnaissanceSituee[];
} {
  const affirmations: AffirmationNarrative[] = [];
  const connaissances: ConnaissanceSituee[] = [];
  const vus = new Set<string>();

  for (const c of objets(story.narrativeCore?.beliefs)) {
    if (c.status === 'superseded' || !propre(c.fact) || !propre(c.knower)) continue;
    const aId = `affirmation:${propre(c.id) || id('croyance', `${c.knower}:${c.fact}`)}`;
    const statut = statutCroyance(c.type);
    if (!vus.has(aId)) {
      vus.add(aId);
      affirmations.push({
        id: aId,
        contenu: propre(c.fact),
        statut,
        origine: propre(c.acquiredEvent) ? { id: propre(c.acquiredEvent), type: 'evenement' } : undefined,
        credibilite: borne(c.confidence, 0, 1),
      });
    }
    connaissances.push({
      acteurId: entiteId(story, c.knower),
      affirmationId: aId,
      statut,
      sourceIds: uniques([propre(c.source), propre(c.acquiredEvent)]),
      confiance: borne(c.confidence, 0, 1),
    });
  }

  for (const r of objets(story.narrativeCore?.rumors)) {
    if (r.status === 'dead' || !propre(r.claim)) continue;
    const aId = `affirmation:rumeur:${propre(r.id) || id('rumeur', r.claim)}`;
    const confiance = borne(1 - (Number(r.distortion) || 0), 0, 1);
    if (!vus.has(aId)) {
      vus.add(aId);
      affirmations.push({
        id: aId,
        contenu: propre(r.claim),
        statut: 'rumeur',
        origine: propre(r.originEvent) ? { id: propre(r.originEvent), type: 'evenement' } : undefined,
        credibilite: confiance,
      });
    }
    for (const porteur of textes(r.carriers)) {
      connaissances.push({
        acteurId: entiteId(story, porteur),
        affirmationId: aId,
        statut: 'rumeur',
        sourceIds: uniques([propre(r.id), propre(r.originEvent)]),
        confiance,
      });
    }
    for (const faction of textes(r.factions)) {
      connaissances.push({
        acteurId: id('groupe', faction),
        affirmationId: aId,
        statut: 'rumeur',
        sourceIds: uniques([propre(r.id), propre(r.originEvent)]),
        confiance,
      });
    }
  }
  return { affirmations, connaissances };
}

function situationPhysique(s: CadrageScene): SituationPhysique {
  const lieu = propre(s.lieu);
  return {
    lieu: lieu || undefined,
    positions: lieu ? s.participants.map((entiteId) => ({ entiteId, lieu })) : [],
    objetsPertinents: [],
    blessures: [],
    contraintesMaterielles: [],
    moyensDisponibles: [],
  };
}

function absences(options: OptionsAdaptateurApplicationV21): string[] {
  const r: string[] = [];
  if (!options.institutions?.length) r.push('institutions');
  if (!options.ancragesSociaux?.length) r.push('ancrages_sociaux');
  if (!options.groupes?.length) r.push('groupes');
  if (!options.delegations?.length) r.push('delegations');
  if (!options.limitesActives?.length) r.push('limites_actives_specifiques');
  if (!options.transmissions?.length) r.push('transmissions_en_cours');
  if (!options.resultatsDejaEtablis?.length) r.push('resolutions_structurees');
  return r;
}

/** Traduit l'état courant de l'application en contexte V2.1, sans mutation. */
export function adapterApplicationVersContexteV21(
  story: StoryState,
  options: OptionsAdaptateurApplicationV21,
): SortieAdaptateurApplicationV21 {
  const s = scene(story, options.participantsSupplementaires ?? []);
  const info = information(story);
  const contexte: ContexteNarratifV21 = {
    cadre: {
      histoireId: propre(story.meta.brancheDeId) || story.meta.id,
      varianteId: propre(story.meta.brancheDeId) ? story.meta.id : undefined,
      nature: options.natureEchange ?? 'fiction',
      initiativeJoueur: propre(options.messageJoueur),
    },
    scene: s,
    profilRendu: profilRendu(story, options.appSettings),
    limitesActives: [...(options.limitesActives ?? [])],
    evenementsPertinents: evenements(
      story,
      options.messageJoueur,
      Math.max(1, options.maxEvenements ?? 8),
      Math.max(0, options.maxFaitsMemoireFallback ?? 8),
    ),
    personnages: construirePersonnages(story),
    relations: relations(story),
    reputations: reputations(story),
    engagements: engagements(story),
    institutions: [...(options.institutions ?? [])],
    situationPhysique: situationPhysique(s),
    delegations: [...(options.delegations ?? [])],
    archetypes: [],
    ancragesSociaux: [...(options.ancragesSociaux ?? [])],
    filsNarratifs: fils(story),
    groupes: [...(options.groupes ?? [])],
    connaissances: info.connaissances,
    affirmations: info.affirmations,
    transmissions: [...(options.transmissions ?? [])],
    resultatsDejaEtablis: [...(options.resultatsDejaEtablis ?? [])],
    incertitudes: uniques(options.incertitudes ?? []),
  };

  return {
    contexte,
    diagnostic: {
      noyauStructureDisponible: !!story.narrativeCore,
      personnageJoueurId: joueurId(story),
      participants: contexte.scene.participants.length,
      evenements: contexte.evenementsPertinents.length,
      personnages: contexte.personnages.length,
      relations: contexte.relations.length,
      reputations: contexte.reputations.length,
      engagements: contexte.engagements.length,
      connaissances: contexte.connaissances.length,
      affirmations: contexte.affirmations.length,
      filsNarratifs: contexte.filsNarratifs.length,
      donneesAbsentesNonInventees: absences(options),
    },
  };
}

export function idPersonnageJoueurV21(story: StoryState): string {
  return joueurId(story);
}
