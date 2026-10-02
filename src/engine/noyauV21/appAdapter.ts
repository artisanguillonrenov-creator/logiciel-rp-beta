// Elyndor — Adaptateur application -> Narrative Kernel V2.1
//
// Ce module construit une vue TRANSITOIRE du StoryState existant pour les
// quinze responsabilités V2.1. Il ne crée aucun nouveau stockage et ne mutile
// pas les sauvegardes héritées. Les données absentes restent absentes/inconnues.

import type {
  AppSettings,
  EntreeLoreEmergent,
  Fact,
  RelationPersonnage,
  StoryState,
} from '../../types';
import {
  filtrerTextePourProfil,
  plafonnerCurseurs,
} from '../contenuAdulte';
import { classerLexical, normaliserRecherche } from '../rechercheLexicale';
import type { PermissionMortM06 } from './m06-lois-monde-scene';
import type { InitiativeJoueurM07, ProfilPnjM09 } from './m07-agentivite-joueur';
import type { ProfilPnjM09 as ProfilPnjM09Exact } from './m09-archetypes-universels';
import type { SignalJoueurM13 } from './m13-consentement-limites-signaux';
import type { DonneesResolutionM14 } from './m14-resolution-actions';
import type { OptionsMoteursKernelV21 } from './narrativeKernel';
import type {
  AffirmationNarrative,
  AncrageSocial,
  ConnaissanceSituee,
  ContexteNarratifV21,
  EngagementNarratif,
  EvenementNarratif,
  FilNarratif,
  IdentitePersonnage,
  LimiteActive,
  NatureEchange,
  NiveauRendu,
  PositionPhysique,
  ProfilRenduNarratif,
  RelationDirigee,
  ReputationSituee,
  SourceNarrative,
  StatutInformation,
} from './types';

// Alias local pour les structures historiques volontairement souples du noyau V12.
type ObjetLegacy = Record<string, unknown>;

export interface EntreeAdaptateurApplicationV21 {
  story: StoryState;
  appSettings: AppSettings;
  messageJoueur: string;

  /** Permet à l'appelant de déclarer explicitement HRP/réglage/clarification. */
  natureEchange?: NatureEchange;
}

export interface DiagnosticAdaptateurApplicationV21 {
  sourceNoyauLegacyDisponible: boolean;
  joueurId: string;
  participantsScene: number;
  evenementsPertinents: number;
  personnages: number;
  relations: number;
  reputations: number;
  engagements: number;
  filsNarratifs: number;
  connaissances: number;
  affirmations: number;
  limites: number;
  signalReelDetecte?: SignalJoueurM13['type'];
  initiativeDetectee?: InitiativeJoueurM07['type'];
  lacunesStructurelles: string[];
}

export interface SortieAdaptateurApplicationV21 {
  contexte: ContexteNarratifV21;
  moteurs: OptionsMoteursKernelV21;
  joueurId: string;
  diagnostic: DiagnosticAdaptateurApplicationV21;
}

const ROLES_ARCHETYPES = [
  'guerrier', 'combattant', 'mercenaire', 'champion',
  'marchand', 'vendeur', 'negociant', 'commercant',
  'noble', 'dirigeant', 'seigneur', 'chef', 'regent', 'gouverneur',
  'aventurier', 'explorateur', 'independant', 'eclaireur',
  'religieux', 'pretre', 'pretresse', 'moine', 'clerc', 'devot',
  'bandit', 'brigand', 'hors-la-loi', 'pillard',
  'erudit', 'mage', 'savant', 'chercheur', 'occultiste',
  'domestique', 'assistant', 'aide', 'serviteur', 'intendant',
  'garde', 'soldat', 'sentinelle', 'militaire', 'patrouilleur',
] as const;

function propre(valeur: unknown): string {
  return String(valeur ?? '').replace(/\s+/g, ' ').trim();
}

function tronquer(valeur: unknown, max = 520): string {
  const texte = propre(valeur);
  if (texte.length <= max) return texte;
  return `${texte.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function objet(valeur: unknown): ObjetLegacy {
  return valeur && typeof valeur === 'object' && !Array.isArray(valeur)
    ? (valeur as ObjetLegacy)
    : {};
}

function objets(valeur: unknown): ObjetLegacy[] {
  return Array.isArray(valeur)
    ? valeur.filter((item): item is ObjetLegacy => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function chaines(valeur: unknown): string[] {
  return Array.isArray(valeur) ? valeur.map(propre).filter(Boolean) : [];
}

function nombre(valeur: unknown): number | undefined {
  const n = Number(valeur);
  return Number.isFinite(n) ? n : undefined;
}

function borner(valeur: number | undefined, min: number, max: number): number | undefined {
  if (valeur === undefined || !Number.isFinite(valeur)) return undefined;
  return Math.max(min, Math.min(max, valeur));
}

function uniquesTextes(valeurs: Iterable<string>): string[] {
  const resultat: string[] = [];
  const vus = new Set<string>();
  for (const valeur of valeurs) {
    const texte = propre(valeur);
    const cle = normaliserRecherche(texte);
    if (!cle || vus.has(cle)) continue;
    vus.add(cle);
    resultat.push(texte);
  }
  return resultat;
}

function slug(valeur: string): string {
  return normaliserRecherche(valeur)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'inconnu';
}

function texteAutorise(
  valeur: unknown,
  appSettings: AppSettings,
  max = 520,
): string {
  const texte = tronquer(valeur, max);
  if (!texte) return '';
  return filtrerTextePourProfil(texte, appSettings.profilContenu).trim();
}

function source(
  id: string,
  type: SourceNarrative['type'],
  description?: string,
  tempsFictif?: string,
): SourceNarrative {
  return {
    id,
    type,
    description: description || undefined,
    tempsFictif: tempsFictif || undefined,
  };
}

interface RegistreActeurs {
  joueurId: string;
  idParNom: Map<string, string>;
  nomParId: Map<string, string>;
}

function construireRegistreActeurs(story: StoryState): RegistreActeurs {
  const joueurId = `joueur:${story.meta.id}`;
  const idParNom = new Map<string, string>();
  const nomParId = new Map<string, string>();

  const ajouter = (nomBrut: unknown, id?: string) => {
    const nom = propre(nomBrut);
    const cle = normaliserRecherche(nom);
    if (!cle) return;
    const existant = idParNom.get(cle);
    if (existant) return;
    const identifiant = id || `pnj:${slug(nom)}`;
    idParNom.set(cle, identifiant);
    nomParId.set(identifiant, nom);
  };

  ajouter(story.meta.personnageNom || 'Personnage', joueurId);
  for (const relation of story.social.relations) ajouter(relation.nom, `pnj:${relation.id || slug(relation.nom)}`);
  for (const entree of story.loreEmergent) {
    if (entree.categorie === 'pnj') ajouter(entree.titre, `pnj:${entree.id}`);
  }

  const core = objet(story.narrativeCore);
  for (const ligne of objets(core.bdi)) ajouter(ligne.name);
  for (const evenement of objets(core.ledger).slice(-30)) {
    for (const nom of [...chaines(evenement.actors), ...chaines(evenement.targets), ...chaines(evenement.witnesses)]) ajouter(nom);
  }

  return { joueurId, idParNom, nomParId };
}

function idActeur(registre: RegistreActeurs, nomBrut: unknown): string {
  const nom = propre(nomBrut);
  const cle = normaliserRecherche(nom);
  if (!cle) return '';
  const existant = registre.idParNom.get(cle);
  if (existant) return existant;
  const id = `acteur:${slug(nom)}`;
  registre.idParNom.set(cle, id);
  registre.nomParId.set(id, nom);
  return id;
}

function profilRendu(story: StoryState, appSettings: AppSettings): ProfilRenduNarratif {
  const settings = plafonnerCurseurs(story.settings, appSettings.profilContenu);
  const niveauViolence: Record<typeof settings.violence, NiveauRendu> = {
    faible: 'faible',
    modere: 'modere',
    eleve: 'eleve',
    extreme: 'maximal',
  };
  const niveauQuatre: Record<typeof settings.romance, NiveauRendu> = {
    aucun: 'desactive',
    faible: 'faible',
    modere: 'modere',
    eleve: 'eleve',
  };

  return {
    mode: appSettings.profilContenu === 'adulte' ? 'adulte' : 'grand_public',
    ton: settings.ton,
    violence: niveauViolence[settings.violence],
    romance: niveauQuatre[settings.romance],
    humour: niveauQuatre[settings.humour],
    longueur: settings.longueur,
    rythme: settings.rythme,
    creativite: settings.creativite,
    autresPreferences: {
      liberteJoueur: settings.liberteJoueur,
    },
  };
}

function limitesDepuisProfil(
  appSettings: AppSettings,
  profil: ProfilRenduNarratif,
): LimiteActive[] {
  if (appSettings.profilContenu === 'adulte') return [];
  const src = source('reglage:profil-contenu', 'reglage', 'Profil Grand public actif.');
  return [
    {
      id: 'limite:profil:violence',
      theme: 'violence',
      portee: 'profil appareil',
      intensite: profil.violence,
      autorisee: true,
      revocable: true,
      source: src,
    },
    {
      id: 'limite:profil:romance',
      theme: 'romance',
      portee: 'profil appareil',
      intensite: profil.romance,
      autorisee: true,
      revocable: true,
      source: src,
    },
    {
      id: 'limite:profil:crudite',
      theme: 'crudite',
      portee: 'profil appareil',
      intensite: 'desactive',
      autorisee: false,
      revocable: true,
      source: src,
    },
  ];
}

function detecterSignalReel(
  messageJoueur: string,
  story: StoryState,
): SignalJoueurM13 | undefined {
  const brut = propre(messageJoueur);
  const texte = normaliserRecherche(brut);
  if (!texte || brut.startsWith('"') || brut.startsWith('«') || brut.startsWith('*')) return undefined;

  const src = source(
    `message:${story.meta.id}:${story.messages.length}:signal`,
    'message_joueur',
    brut,
    story.meta.contexte.dateChronique,
  );

  const arret =
    /^(stop|arrete|on arrete|pause)(\b|\s)/.test(texte) ||
    /je ne veux pas continuer (cette )?scene/.test(texte) ||
    /je veux arreter (cette )?scene/.test(texte);
  if (arret) {
    return {
      id: `signal:arret:${story.messages.length}`,
      type: 'arret',
      reelEtExplicite: true,
      portee: 'scene actuelle',
      source: src,
    };
  }

  const reduction =
    /moins intense/.test(texte) ||
    /baisse .*intensite/.test(texte) ||
    /moins violent/.test(texte) ||
    /moins de violence/.test(texte) ||
    /moins cru/.test(texte) ||
    /moins de detail/.test(texte);
  if (reduction) {
    const dimension = /violent|violence/.test(texte)
      ? 'violence'
      : /cru|crudite/.test(texte)
        ? 'crudite'
        : /detail/.test(texte)
          ? 'detail'
          : undefined;
    return {
      id: `signal:ralentissement:${story.messages.length}`,
      type: 'ralentissement',
      reelEtExplicite: true,
      dimension,
      niveauCible: 'faible',
      portee: 'scene actuelle',
      source: src,
    };
  }

  return undefined;
}

function natureEchange(
  explicite: NatureEchange | undefined,
  messageJoueur: string,
  signal: SignalJoueurM13 | undefined,
): NatureEchange {
  if (explicite) return explicite;
  if (signal?.type === 'arret' && signal.reelEtExplicite) return 'arret';
  const t = normaliserRecherche(messageJoueur);
  if (/^(hrp|ooc|hors personnage)\b/.test(t)) return 'hors_personnage';
  return 'fiction';
}

function participantsScene(
  story: StoryState,
  registre: RegistreActeurs,
  messageJoueur: string,
): string[] {
  const texte = normaliserRecherche([
    messageJoueur,
    ...story.messages.slice(-3).map((m) => m.content),
  ].join('\n'));
  const ids = new Set<string>([registre.joueurId]);

  for (const [cle, id] of registre.idParNom.entries()) {
    if (id !== registre.joueurId && cle.length >= 2 && texte.includes(cle)) ids.add(id);
  }

  const core = objet(story.narrativeCore);
  const dernier = objets(core.ledger).at(-1);
  if (dernier) {
    for (const nom of [...chaines(dernier.actors), ...chaines(dernier.targets), ...chaines(dernier.witnesses)]) {
      const id = idActeur(registre, nom);
      if (id) ids.add(id);
    }
  }

  return [...ids].slice(0, 12);
}

function requeteContexte(story: StoryState, messageJoueur: string): string {
  return [
    messageJoueur,
    story.meta.contexte.lieu,
    story.meta.contexte.objectifs,
    ...story.messages.slice(-3).map((message) => message.content),
  ].filter(Boolean).join('\n');
}

function evenementDepuisLedger(
  ligne: ObjetLegacy,
  registre: RegistreActeurs,
  appSettings: AppSettings,
): EvenementNarratif | undefined {
  const resume = texteAutorise(ligne.summary, appSettings, 460);
  if (!resume) return undefined;
  const id = propre(ligne.id) || `legacy-event:${slug(resume.slice(0, 80))}`;
  const temps = texteAutorise(ligne.worldTime, appSettings, 80);
  return {
    id,
    resume,
    acteurs: chaines(ligne.actors).map((nom) => idActeur(registre, nom)).filter(Boolean),
    cibles: chaines(ligne.targets).map((nom) => idActeur(registre, nom)).filter(Boolean),
    lieu: texteAutorise(ligne.location, appSettings, 180) || undefined,
    tempsFictif: temps || undefined,
    causes: [],
    sources: [source(`legacy:${id}`, 'evenement', resume, temps)],
    categorie: undefined,
    canonique: true,
  };
}

function evenementDepuisFact(
  fait: Fact,
  appSettings: AppSettings,
): EvenementNarratif | undefined {
  const resume = texteAutorise(fait.texte, appSettings, 420);
  if (!resume) return undefined;
  return {
    id: `memoire:${fait.id}`,
    resume,
    acteurs: [],
    sources: [source(`memoire:${fait.id}`, 'fait', resume)],
    canonique: fait.niveau === 'canon',
  };
}

function evenementsPertinents(
  story: StoryState,
  registre: RegistreActeurs,
  appSettings: AppSettings,
  messageJoueur: string,
): EvenementNarratif[] {
  const requete = requeteContexte(story, messageJoueur);
  const resultat: EvenementNarratif[] = [];
  const vus = new Set<string>();
  const ajouter = (evenement: EvenementNarratif | undefined) => {
    if (!evenement || vus.has(evenement.id)) return;
    vus.add(evenement.id);
    resultat.push(evenement);
  };

  const core = objet(story.narrativeCore);
  const ledger = objets(core.ledger).filter((ligne) => propre(ligne.summary));
  for (const r of classerLexical({
    requete,
    items: ledger,
    texteDe: (item) => propre(item.summary),
    titreDe: (item) => `${propre(item.location)} ${chaines(item.actors).join(' ')}`,
    dateDe: (item) => nombre(item.createdAt),
    budget: { maxResultats: 6, maxCaracteres: 2500, maxCaracteresParResultat: 420 },
  })) ajouter(evenementDepuisLedger(r.item, registre, appSettings));

  // Le dernier événement validé reste utile pour la continuité immédiate,
  // même si une question très courte ne partage aucun terme avec lui.
  ajouter(evenementDepuisLedger(ledger.at(-1) ?? {}, registre, appSettings));

  const faits = story.memoire.faits.filter((fait) => fait.niveau !== 'archive');
  for (const r of classerLexical({
    requete,
    items: faits,
    texteDe: (fait) => fait.texte,
    titreDe: (fait) => fait.type,
    budget: { maxResultats: 5, maxCaracteres: 1700, maxCaracteresParResultat: 340 },
  })) ajouter(evenementDepuisFact(r.item, appSettings));

  return resultat.slice(0, 12);
}

function lorePnjParNom(story: StoryState): Map<string, EntreeLoreEmergent> {
  const map = new Map<string, EntreeLoreEmergent>();
  for (const entree of story.loreEmergent) {
    if (entree.categorie !== 'pnj') continue;
    const cle = normaliserRecherche(entree.titre);
    if (cle) map.set(cle, entree);
  }
  return map;
}

function personnages(
  story: StoryState,
  registre: RegistreActeurs,
  appSettings: AppSettings,
): IdentitePersonnage[] {
  const core = objet(story.narrativeCore);
  const bdi = objets(core.bdi);
  const lore = lorePnjParNom(story);
  const resultat: IdentitePersonnage[] = [];

  const descriptionJoueur = texteAutorise(story.meta.personnageDescription, appSettings, 720);
  resultat.push({
    id: registre.joueurId,
    nom: texteAutorise(story.meta.personnageNom, appSettings, 120) || 'Personnage',
    traits: descriptionJoueur ? [descriptionJoueur] : [],
    valeurs: [],
    buts: [],
    competences: [],
  });

  for (const [id, nomBrut] of registre.nomParId.entries()) {
    if (id === registre.joueurId) continue;
    const nom = texteAutorise(nomBrut, appSettings, 120);
    if (!nom) continue;
    const cle = normaliserRecherche(nomBrut);
    const ficheLore = lore.get(cle);
    const etat = bdi.find((ligne) => normaliserRecherche(propre(ligne.name)) === cle);
    const traitLore = ficheLore ? texteAutorise(ficheLore.contenu, appSettings, 620) : '';
    const buts = uniquesTextes([
      ...chaines(etat?.desires).map((t) => texteAutorise(t, appSettings, 220)),
      ...chaines(etat?.intentions).map((t) => texteAutorise(t, appSettings, 220)),
    ]).filter(Boolean).slice(0, 8);

    resultat.push({
      id,
      nom,
      traits: traitLore ? [traitLore] : [],
      valeurs: [],
      buts,
      competences: [],
    });
  }

  return resultat.slice(0, 60);
}

function relationLegacyPour(
  coreReputation: ObjetLegacy[],
  nomPnj: string,
  nomJoueur: string,
): ObjetLegacy | undefined {
  const a = normaliserRecherche(nomPnj);
  const b = normaliserRecherche(nomJoueur);
  return [...coreReputation].reverse().find((ligne) => {
    if (propre(ligne.scope) !== 'personal') return false;
    return normaliserRecherche(propre(ligne.subject)) === a && normaliserRecherche(propre(ligne.target)) === b;
  });
}

function relations(
  story: StoryState,
  registre: RegistreActeurs,
  participants: string[],
): RelationDirigee[] {
  const idsScene = new Set(participants);
  const coreReputation = objets(objet(story.narrativeCore).reputation);
  const nomJoueur = story.meta.personnageNom;
  const resultat: RelationDirigee[] = [];

  for (const relation of story.social.relations) {
    const pnjId = idActeur(registre, relation.nom);
    if (!pnjId || (!idsScene.has(pnjId) && participants.length > 1)) continue;
    const legacy = relationLegacyPour(coreReputation, relation.nom, nomJoueur);
    const axe = (legacyValue: unknown, fallback: number): number | undefined => {
      const legacyN = nombre(legacyValue);
      if (legacyN !== undefined) return borner(legacyN / 100, -1, 1);
      return borner(fallback / 3, -1, 1);
    };

    resultat.push({
      id: `relation:${relation.id}`,
      acteurId: pnjId,
      cibleId: registre.joueurId,
      confiance: axe(legacy?.trust, relation.confiance),
      attachement: axe(legacy?.affection, relation.affection),
      respect: axe(legacy?.respect, relation.respect),
      peur: axe(legacy?.fear, relation.peur),
      ressentiment: axe(legacy?.hostility, relation.hostilite),
      attentes: [],
      evenementsJustificatifs: propre(legacy?.sourceEvent) ? [propre(legacy?.sourceEvent)] : [],
    });
  }

  return resultat;
}

function reputations(
  story: StoryState,
  registre: RegistreActeurs,
  participants: string[],
  appSettings: AppSettings,
): ReputationSituee[] {
  const idsScene = new Set(participants);
  const resultat: ReputationSituee[] = [];
  for (const ligne of objets(objet(story.narrativeCore).reputation)) {
    if (propre(ligne.scope) !== 'faction') continue;
    const cibleId = idActeur(registre, ligne.subject);
    if (!cibleId || (!idsScene.has(cibleId) && cibleId !== registre.joueurId)) continue;
    const faction = texteAutorise(ligne.faction, appSettings, 120);
    if (!faction) continue;
    const score = nombre(ligne.score) ?? 0;
    const raison = texteAutorise(ligne.reason, appSettings, 240);
    resultat.push({
      id: propre(ligne.id) || `reputation:${slug(`${propre(ligne.subject)}-${faction}`)}`,
      cibleId,
      communauteId: `faction:${slug(faction)}`,
      jugement: raison || (score > 0 ? 'Perception globalement favorable.' : score < 0 ? 'Perception globalement défavorable.' : 'Perception non tranchée.'),
      force: Math.min(1, Math.abs(score) / 100),
      affirmationIds: [],
      effetsObservables: [],
    });
  }
  return resultat.slice(0, 20);
}

function engagementDepuisRelation(
  engagement: StoryState['social']['engagements'][number],
  registre: RegistreActeurs,
  appSettings: AppSettings,
): EngagementNarratif | undefined {
  const description = texteAutorise(engagement.description, appSettings, 420);
  const partie = texteAutorise(engagement.partie, appSettings, 120);
  if (!description || !partie) return undefined;
  const partieId = idActeur(registre, partie) || `partie:${slug(partie)}`;
  return {
    id: `engagement:${engagement.id}`,
    parties: [registre.joueurId, partieId],
    termes: [description],
    etat: engagement.honore ? 'accompli' : engagement.rompu ? 'rompu' : 'en_cours',
    acceptePar: [registre.joueurId, partieId],
    sources: [source(`social:engagement:${engagement.id}`, 'fait', description)],
  };
}

function engagements(
  story: StoryState,
  registre: RegistreActeurs,
  appSettings: AppSettings,
  messageJoueur: string,
  participants: string[],
): EngagementNarratif[] {
  const ouverts = story.social.engagements.filter((e) => !e.honore && !e.rompu);
  const requete = requeteContexte(story, messageJoueur);
  const idsScene = new Set(participants);
  const selectionnes = new Map<string, StoryState['social']['engagements'][number]>();

  for (const engagement of ouverts) {
    const partieId = idActeur(registre, engagement.partie);
    if (idsScene.has(partieId)) selectionnes.set(engagement.id, engagement);
  }
  for (const r of classerLexical({
    requete,
    items: ouverts,
    titreDe: (e) => e.partie,
    texteDe: (e) => `${e.type} ${e.description}`,
    budget: { maxResultats: 5, maxCaracteres: 1600, maxCaracteresParResultat: 320 },
  })) selectionnes.set(r.item.id, r.item);

  return [...selectionnes.values()]
    .map((engagement) => engagementDepuisRelation(engagement, registre, appSettings))
    .filter((engagement): engagement is EngagementNarratif => Boolean(engagement))
    .slice(0, 10);
}

function filsNarratifs(
  story: StoryState,
  participants: string[],
  appSettings: AppSettings,
): FilNarratif[] {
  const resultat: FilNarratif[] = [];
  const arc = texteAutorise(story.directeur.arcActuel, appSettings, 360);
  if (arc) {
    resultat.push({
      id: 'fil:arc-actuel',
      enjeu: arc,
      acteurs: [...participants],
      etat: 'actif',
      importance: 0.8,
      conditionsReprise: [],
    });
  }
  for (const beat of story.directeur.beats.filter((b) => !b.paye).slice(-6)) {
    const description = texteAutorise(beat.description, appSettings, 260);
    if (!description) continue;
    resultat.push({
      id: `fil:beat:${beat.id}`,
      enjeu: description,
      acteurs: [],
      etat: 'dormant',
      importance: 0.45,
      conditionsReprise: ['Reprendre seulement si la scène ou une cause établie le rend pertinent.'],
    });
  }
  return resultat;
}

function statutInformationDepuisLegacy(typeBrut: unknown): StatutInformation {
  const type = normaliserRecherche(propre(typeBrut));
  if (type.includes('seen') || type.includes('participated') || type.includes('observe')) return 'observation';
  if (type.includes('rumor') || type.includes('rumeur')) return 'rumeur';
  if (type.includes('told') || type.includes('report') || type.includes('document')) return 'rapport';
  return 'croyance';
}

function informations(
  story: StoryState,
  registre: RegistreActeurs,
  participants: string[],
  appSettings: AppSettings,
  messageJoueur: string,
): { affirmations: AffirmationNarrative[]; connaissances: ConnaissanceSituee[] } {
  const core = objet(story.narrativeCore);
  const idsScene = new Set(participants);
  const affirmations: AffirmationNarrative[] = [];
  const connaissances: ConnaissanceSituee[] = [];
  const affirmationIds = new Set<string>();

  const ajouterAffirmation = (affirmation: AffirmationNarrative) => {
    if (affirmationIds.has(affirmation.id)) return;
    affirmationIds.add(affirmation.id);
    affirmations.push(affirmation);
  };

  for (const belief of objets(core.beliefs).slice(-120)) {
    if (propre(belief.status) === 'superseded') continue;
    const acteurId = idActeur(registre, belief.knower);
    if (!acteurId || !idsScene.has(acteurId)) continue;
    const contenu = texteAutorise(belief.fact, appSettings, 420);
    if (!contenu) continue;
    const id = `affirmation:${propre(belief.id) || slug(`${propre(belief.knower)}-${contenu}`)}`;
    const statut = statutInformationDepuisLegacy(belief.type);
    ajouterAffirmation({
      id,
      contenu,
      statut,
      origine: source(
        propre(belief.source) || `belief:${id}`,
        statut === 'observation' ? 'perception' : statut === 'rapport' ? 'temoignage' : 'autre',
        contenu,
      ),
      credibilite: borner(nombre(belief.confidence), 0, 1),
    });
    connaissances.push({
      acteurId,
      affirmationId: id,
      statut,
      sourceIds: uniquesTextes([propre(belief.source), propre(belief.acquiredEvent)]).filter(Boolean),
      confiance: borner(nombre(belief.confidence), 0, 1),
    });
  }

  const rumors = objets(core.rumors).filter((r) => propre(r.status) !== 'dead');
  for (const r of classerLexical({
    requete: requeteContexte(story, messageJoueur),
    items: rumors,
    texteDe: (item) => propre(item.claim),
    budget: { maxResultats: 4, maxCaracteres: 1200, maxCaracteresParResultat: 300 },
  })) {
    const contenu = texteAutorise(r.item.claim, appSettings, 360);
    if (!contenu) continue;
    ajouterAffirmation({
      id: `affirmation:rumeur:${propre(r.item.id) || slug(contenu)}`,
      contenu,
      statut: 'rumeur',
      origine: source(propre(r.item.originEvent) || `rumeur:${propre(r.item.id)}`, 'temoignage', contenu),
      credibilite: borner(1 - (nombre(r.item.distortion) ?? 0), 0, 1),
    });
  }

  return {
    affirmations: affirmations.slice(0, 40),
    connaissances: connaissances.slice(0, 40),
  };
}

function positionCanonique(
  story: StoryState,
  registre: RegistreActeurs,
  appSettings: AppSettings,
): PositionPhysique[] {
  const positions = new Map<string, PositionPhysique>();
  if (story.meta.contexte.lieu) {
    positions.set(registre.joueurId, {
      entiteId: registre.joueurId,
      lieu: texteAutorise(story.meta.contexte.lieu, appSettings, 180),
    });
  }

  for (const fait of objets(objet(story.narrativeCore).canon).filter((f) => !f.validToEvent)) {
    const predicat = normaliserRecherche(propre(fait.predicate));
    if (!/(location|position|lieu|emplacement)/.test(predicat)) continue;
    const entiteId = idActeur(registre, fait.subject);
    const lieu = texteAutorise(fait.value, appSettings, 180);
    if (entiteId && lieu) positions.set(entiteId, { entiteId, lieu });
  }

  return [...positions.values()];
}

function rolesPnj(
  personnagesScene: IdentitePersonnage[],
  joueurId: string,
): ProfilPnjM09Exact[] {
  const profils: ProfilPnjM09Exact[] = [];
  for (const personnage of personnagesScene) {
    if (personnage.id === joueurId) continue;
    const texte = normaliserRecherche([personnage.nom, ...personnage.traits].join(' '));
    const roles = ROLES_ARCHETYPES.filter((role) => texte.includes(role));
    if (!roles.length) continue;
    profils.push({
      personnageId: personnage.id,
      roles: [...roles],
      contexte: [],
    });
  }
  return profils;
}

function initiativeDepuisMessage(
  story: StoryState,
  messageJoueur: string,
  joueurId: string,
  nature: NatureEchange,
): InitiativeJoueurM07 | undefined {
  if (nature !== 'fiction') return undefined;
  const brut = propre(messageJoueur);
  const t = normaliserRecherche(brut);
  if (!t) return undefined;
  const id = `initiative:${story.meta.id}:${story.messages.length}`;
  const base = {
    id,
    description: brut,
    auteurId: joueurId,
    formulationExacte: brut,
    sourceIds: [`message:${story.meta.id}:${story.messages.length}`],
  };

  if (brut.endsWith('?') || /^(qui|quoi|ou|quand|comment|pourquoi|est ce|peux tu|pouvez vous)\b/.test(t)) {
    return { ...base, type: 'question' };
  }
  if (/^(je dis|je reponds|je lui dis|je leur dis|j annonce|je crie|je murmure)\b/.test(t)) {
    return { ...base, type: 'parole' };
  }
  if (/^(je propose|je suggere|je lui propose|je leur propose)\b/.test(t)) {
    return { ...base, type: 'proposition' };
  }
  if (/^(je lui demande de|je leur demande de|demande a .* de)\b/.test(t)) {
    return { ...base, type: 'demande_pnj' };
  }
  if (/^(je lui confie|je leur confie|je charge .* de)\b/.test(t)) {
    return { ...base, type: 'delegation' };
  }
  if (/^(je suis |je me sens |j ai peur|je ressens )/.test(t)) {
    return { ...base, type: 'etat_intime', etatIntimeDeclare: brut };
  }

  const contestee = /\b(j essaie|je tente|j attaque|je frappe|je tue|j abats|je desarme|je force|je crochete|je convaincs|je persuade|j intimide|je seduis|je poursuis|je saisis|j attrape|je vole|je m echappe)\b/.test(t);
  if (contestee) {
    const resultatFormuleCommeAcquis = /\b(je tue|j abats|je desarme|je convaincs|je seduis|je reussis|j ouvre de force)\b/.test(t);
    return {
      ...base,
      type: 'tentative',
      faisabiliteMaterielle: 'inconnue',
      opposition: 'presente',
      resultatFormuleCommeAcquis,
    };
  }

  const ordinaire = /^(je regarde|j observe|j attends|je reste|je hoche|je marche|j avance|je recule|je me leve|je m assieds|je m approche|je me dirige)\b/.test(t);
  if (ordinaire) {
    return {
      ...base,
      type: 'action_ordinaire',
      faisabiliteMaterielle: 'possible',
      opposition: 'aucune',
      ordinaireSansChoixNouveau: true,
    };
  }

  return { ...base, type: 'autre' };
}

function typeActionPourInitiative(initiative: InitiativeJoueurM07): DonneesResolutionM14['typeAction'] {
  const t = normaliserRecherche(initiative.description);
  if (/\b(convain|persuad|intimid|sedui|negoci)/.test(t)) return 'sociale';
  if (/\b(inspect|examin|enquet|cherche|fouille)/.test(t)) return 'mystere';
  if (/\b(attaque|frappe|tue|abat|desarme|force|crochet|grimpe|escalad|poursui|attrap|saisi)/.test(t)) return 'physique';
  return 'autre';
}

function competenceDepuisDescription(
  story: StoryState,
  initiative: InitiativeJoueurM07,
): DonneesResolutionM14['competence'] {
  const profil = normaliserRecherche(story.meta.personnageDescription);
  const action = normaliserRecherche(initiative.description);
  if (!profil) return 'inconnue';

  const groupes: Array<{ action: RegExp; profil: RegExp }> = [
    { action: /(attaque|frappe|tue|desarme|combat|epee|arc)/, profil: /(guerrier|soldat|mercenaire|combat|combattant|epee|archer|veteran)/ },
    { action: /(crochet|serrure|vole|furtiv)/, profil: /(voleur|roublard|crochet|furtif|espion)/ },
    { action: /(convain|persuad|negoci|diplom)/, profil: /(diplom|charism|negoci|orateur|marchand)/ },
    { action: /(magie|sort|ensorcel|rituel)/, profil: /(mage|sorcier|magie|occult|rituel)/ },
    { action: /(inspect|examin|enquet|cherche)/, profil: /(enquete|erudit|savant|chercheur|observateur)/ },
  ];
  return groupes.some((g) => g.action.test(action) && g.profil.test(profil))
    ? 'etablie_suffisante'
    : 'inconnue';
}

function donneesM14(
  story: StoryState,
  initiatives: InitiativeJoueurM07[],
): DonneesResolutionM14[] {
  return initiatives
    .filter((initiative) => initiative.type === 'tentative')
    .map((initiative) => ({
      tentativeId: initiative.id,
      typeAction: typeActionPourInitiative(initiative),
      intentionValideeM07: true,
      faisabiliteM06:
        initiative.faisabiliteMaterielle === 'impossible'
          ? 'impossible'
          : initiative.faisabiliteMaterielle === 'possible'
            ? 'possible'
            : 'inconnue',
      competence: competenceDepuisDescription(story, initiative),
      preparation: initiative.preparation?.length ? 'suffisante' : 'non_requise',
      contexte: 'inconnu',
      opposition: initiative.opposition === 'aucune' ? 'aucune' : 'inconnue',
      informationsDecisivesManquantes: [],
      sourceIds: [...(initiative.sourceIds ?? [])],
    }));
}

function permissionsMortDepuisLimites(
  limites: LimiteActive[],
  joueurId: string,
  sceneId: string,
): PermissionMortM06[] {
  const autorisations = limites.filter((limite) => {
    const theme = normaliserRecherche(limite.theme).replace(/ /g, '_');
    return limite.autorisee && (
      theme === 'mort_joueur' ||
      theme === 'mort_definitive_joueur' ||
      theme === 'mort_personnage_joueur'
    );
  });
  if (!autorisations.length) return [];
  return [{
    personnageId: joueurId,
    autorisee: true,
    portee: 'scene',
    sceneId,
    sourceIds: autorisations.map((limite) => limite.source.id),
  }];
}

function ancragesSociauxVides(personnages: IdentitePersonnage[]): AncrageSocial[] {
  // Les anciennes sauvegardes ne possèdent pas de statut social structuré.
  // Ne pas transformer une faction ou un métier supposé en droits prouvés.
  return personnages.map((personnage) => ({
    personnageId: personnage.id,
    droits: [],
    acces: [],
    dependances: [],
    soutiens: [],
    expositions: [],
  }));
}

export function adapterApplicationVersKernelV21(
  entree: EntreeAdaptateurApplicationV21,
): SortieAdaptateurApplicationV21 {
  const { story, appSettings, messageJoueur } = entree;
  const registre = construireRegistreActeurs(story);
  const signal = detecterSignalReel(messageJoueur, story);
  const nature = natureEchange(entree.natureEchange, messageJoueur, signal);
  const rendu = profilRendu(story, appSettings);
  const limites = limitesDepuisProfil(appSettings, rendu);
  const participants = participantsScene(story, registre, messageJoueur);
  const evenements = evenementsPertinents(story, registre, appSettings, messageJoueur);
  const personnagesTous = personnages(story, registre, appSettings);
  const idsScene = new Set(participants);
  const personnagesScene = personnagesTous.filter((personnage) => idsScene.has(personnage.id));
  const relationsScene = relations(story, registre, participants);
  const reputationsScene = reputations(story, registre, participants, appSettings);
  const engagementsScene = engagements(story, registre, appSettings, messageJoueur, participants);
  const fils = filsNarratifs(story, participants, appSettings);
  const info = informations(story, registre, participants, appSettings, messageJoueur);
  const sceneId = `scene:${story.meta.id}:${story.messages.length}`;
  const initiative = initiativeDepuisMessage(story, messageJoueur, registre.joueurId, nature);
  const initiatives = initiative ? [initiative] : [];

  const contexte: ContexteNarratifV21 = {
    cadre: {
      histoireId: story.meta.id,
      varianteId: story.meta.brancheDeId,
      nature,
      initiativeJoueur: texteAutorise(messageJoueur, appSettings, 2000),
    },
    scene: {
      id: sceneId,
      lieu: texteAutorise(story.meta.contexte.lieu, appSettings, 180) || undefined,
      pointDeVue: registre.joueurId,
      enjeu: texteAutorise(story.meta.contexte.objectifs, appSettings, 420) || undefined,
      ambiance: texteAutorise(story.meta.contexte.ambiance, appSettings, 260) || undefined,
      participants,
      momentFictif: texteAutorise(story.meta.contexte.dateChronique, appSettings, 120) || undefined,
    },
    profilRendu: rendu,
    limitesActives: limites,
    evenementsPertinents: evenements,
    personnages: personnagesScene,
    relations: relationsScene,
    reputations: reputationsScene,
    engagements: engagementsScene,
    institutions: [],
    situationPhysique: {
      lieu: texteAutorise(story.meta.contexte.lieu, appSettings, 180) || undefined,
      positions: positionCanonique(story, registre, appSettings),
      objetsPertinents: [],
      blessures: [],
      contraintesMaterielles: [],
      moyensDisponibles: [],
    },
    delegations: [],
    archetypes: [],
    ancragesSociaux: ancragesSociauxVides(personnagesScene),
    filsNarratifs: fils,
    groupes: [],
    connaissances: info.connaissances,
    affirmations: info.affirmations,
    transmissions: [],
    resultatsDejaEtablis: [],
    incertitudes: [],
  };

  const profilsM09 = rolesPnj(personnagesScene, registre.joueurId);
  const donneesResolution = donneesM14(story, initiatives);

  const moteurs: OptionsMoteursKernelV21 = {
    m07: {
      personnageJoueurId: registre.joueurId,
      initiatives,
      conventions: { gestesOrdinairesImplicites: true, listesDeChoixSystematiques: false },
    },
    m06: {
      personnageJoueurId: registre.joueurId,
      permissionsMort: permissionsMortDepuisLimites(limites, registre.joueurId, sceneId),
    },
    m09: {
      personnageJoueurId: registre.joueurId,
      pnjIds: personnagesScene.filter((p) => p.id !== registre.joueurId).map((p) => p.id),
      profils: profilsM09,
      utiliserPaletteReference: true,
    },
    m13: signal ? { signal } : {},
    m14: { donnees: donneesResolution },
  };

  const lacunes: string[] = [];
  if (!story.narrativeCore) lacunes.push('Noyau V12 absent : les croyances, rumeurs et états canoniques hérités sont moins structurés.');
  if (!contexte.situationPhysique.blessures.length) lacunes.push('Les sauvegardes actuelles ne fournissent pas encore de blessures V2.1 structurées ; aucune blessure n’est inventée par l’adaptateur.');
  if (!contexte.situationPhysique.moyensDisponibles.length) lacunes.push('Les moyens/inventaire ne sont pas structurés dans StoryState ; M06/M14 doivent laisser inconnue toute ressource décisive non établie ailleurs.');
  if (!contexte.institutions.length) lacunes.push('Aucune institution V2.1 structurée n’est déduite d’une simple faction ou d’un nom de guilde.');
  if (!contexte.groupes.length) lacunes.push('Aucun groupe persistant n’est inventé à partir de la seule coprésence en scène.');

  return {
    contexte,
    moteurs,
    joueurId: registre.joueurId,
    diagnostic: {
      sourceNoyauLegacyDisponible: Boolean(story.narrativeCore),
      joueurId: registre.joueurId,
      participantsScene: contexte.scene.participants.length,
      evenementsPertinents: contexte.evenementsPertinents.length,
      personnages: contexte.personnages.length,
      relations: contexte.relations.length,
      reputations: contexte.reputations.length,
      engagements: contexte.engagements.length,
      filsNarratifs: contexte.filsNarratifs.length,
      connaissances: contexte.connaissances.length,
      affirmations: contexte.affirmations.length,
      limites: contexte.limitesActives.length,
      signalReelDetecte: signal?.type,
      initiativeDetectee: initiative?.type,
      lacunesStructurelles: lacunes,
    },
  };
}
