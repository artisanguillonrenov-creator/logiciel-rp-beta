import type { StoryState } from '../types';
import { RACES_ELYNDOR } from '../data/races';
import { ROLES_CANON } from './canonElyndor';
import { prenomRole } from './rolesCanon';
import { detecterRacePnj, negatifVisuelRace, traitsVisuelsRace, type RacePnj } from './racePnj';
import { contientExpression, normaliserTexte } from './texteRecherche';
import {
  CADRAGE_PORTRAIT,
  cadrageParDefaut,
  estProfilCadrage,
  type CadrageContrat,
  type ProfilCadrage,
} from './cadrageVisuel';
import {
  ID_ASSET_JOUEUR,
  listerPnjVisuels,
  normaliserVisuel,
  resoudrePersonnagesVisibles,
  type ChangementVisuel,
  type EtatVisuelHistoire,
  type PersonnageVisibleResolu,
} from './visualState';

/**
 * Contrat visuel factuel : ce qu'une image doit montrer, dérivé du lore, du
 * noyau narratif, de l'état visuel et de l'extraction du narrateur. C'est une
 * VUE dérivée (jamais un second canon) et elle ne contient aucune instruction
 * de style : l'identité artistique est ajoutée ensuite, une seule fois, par le
 * moteur visuel à partir de l'Atelier.
 */

export type FormatImage = '16:9' | '3:4';
export type OrigineImage = 'scene' | 'portrait' | 'libre' | 'lore';
export type SourceFait = 'canon' | 'fiche' | 'etat-visuel' | 'extraction' | 'repli' | 'utilisateur' | 'scene';

/** Sortie brute du narrateur (extracteur de mots-clés), après lecture du JSON. */
export interface PersonnageExtrait {
  nom: string;
  identite: string[];
  apparence: string[];
  tenue: string[];
  action: string[];
  position: string[];
}

export interface ExtractionMotsCles {
  typeScene?: ProfilCadrage;
  lieu: string[];
  instant: string[];
  eclairage: string[];
  personnagesVisibles: PersonnageExtrait[];
  horsCadre: string[];
  mentionnes: string[];
  figurants: string[];
  action: string[];
  elementsObligatoires: string[];
  decor: string[];
  interdictionsFactuelles: string[];
  changementsVisuels: ChangementVisuel[];
}

export interface PersonnageContrat {
  /** Identifiant d'entité : '__joueur__', id du PNJ, 'canon:<nom>' ou 'figurant:<nom>'. */
  cle: string;
  nom: string;
  type: 'joueur' | 'pnj' | 'canon' | 'figurant';
  assetId?: string;
  principal: boolean;
  identite: string[];
  apparence: string[];
  tenue: string[];
  /** Blessures, salissures, armes et objets portés (état courant). */
  etat: string[];
  action: string[];
  position: string[];
  sources: Partial<Record<'identite' | 'apparence' | 'tenue' | 'etat' | 'action', SourceFait>>;
}

export interface ContratVisuel {
  version: 1;
  origine: OrigineImage;
  format: FormatImage;
  typeScene: ProfilCadrage;
  lieu: string[];
  instant: string[];
  eclairage: string[];
  personnages: PersonnageContrat[];
  horsCadre: string[];
  mentionnes: string[];
  /** Figurants anonymes relevés : non dessinés sauf s'ils figurent aussi dans les éléments obligatoires. */
  figurants: string[];
  action: string[];
  elementsObligatoires: string[];
  decor: string[];
  exclusions: string[];
  cadrage: CadrageContrat;
  /** Prompt écrit par l'utilisateur (aperçu libre) ou hérité d'une ancienne scène. */
  texteLibre?: string;
  /** D'où viennent les faits (diagnostic lisible). */
  provenance: string[];
  /** Éléments écartés pendant la validation, avec leur raison. */
  rejets: string[];
}

// ---------------------------------------------------------------------------
// Nettoyage des mots-clés
// ---------------------------------------------------------------------------

const MAX_MOTS_GROUPE = 8;
const MAX_ELEMENTS = 12;

/** Le narrateur ne choisit ni style, ni rendu, ni modèle : ces mots sont écartés. */
const MOTS_DE_STYLE = /\b(masterpiece|best quality|high quality|ultra detailed|highly detailed|hyper ?realistic|photo ?realistic|8k|4k|uhd|hdr|cinematic|film still|film grain|35 ?mm|tarantino|director|artstation|octane|unreal engine|sdxl|lora|style)\b/i;

/** Retire les syntaxes de pondération propres à certains générateurs : « (mot)1.2 », « (mot:1.3) », « [mot] ». */
export function retirerPonderations(texte: string): string {
  return texte
    .replace(/\(([^()]*?)(?::\s*\d+(?:\.\d+)?)?\)\s*\d+(?:\.\d+)?/g, '$1')
    .replace(/\(([^()]*?):\s*\d+(?:\.\d+)?\)/g, '$1')
    .replace(/[()[\]{}<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Âge écrit « N years old », jamais sous 20 ans. */
function normaliserAge(texte: string): string {
  return texte.replace(/\b(\d{1,3})\s*(?:-\s*)?years?[\s-]*old\b/gi, (_, n: string) => `${Math.max(20, Number(n))} years old`);
}

/**
 * Valide une liste de mots-clés : groupes courts, sans phrase ni ponctuation
 * de phrase, sans mots de style ni pondérations. Les écarts sont tracés.
 */
export function nettoyerMotsCles(valeur: unknown, champ: string, rejets: string[], max = MAX_ELEMENTS): string[] {
  const brut = Array.isArray(valeur) ? valeur : typeof valeur === 'string' && valeur.trim() ? valeur.split(',') : [];
  const sortie: string[] = [];
  const vus = new Set<string>();
  for (const element of brut) {
    if (typeof element !== 'string') continue;
    const texte = normaliserAge(retirerPonderations(element)).replace(/[.;!?]+$/g, '').trim();
    if (!texte) continue;
    if (texte.split(/\s+/).length > MAX_MOTS_GROUPE || /[.!?;]\s/.test(texte)) {
      rejets.push(`${champ} : « ${texte.slice(0, 80)} » écarté (phrase au lieu de mots-clés)`);
      continue;
    }
    if (MOTS_DE_STYLE.test(texte)) {
      rejets.push(`${champ} : « ${texte} » écarté (le style vient de l'Atelier, pas du narrateur)`);
      continue;
    }
    const cle = texte.toLowerCase();
    if (vus.has(cle)) continue;
    vus.add(cle);
    sortie.push(texte);
    if (sortie.length >= max) break;
  }
  return sortie;
}

// ---------------------------------------------------------------------------
// Lecture de la sortie du narrateur
// ---------------------------------------------------------------------------

const estObjet = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const texteCourt = (x: unknown, max: number) => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim().slice(0, max) : '');

function extraireJson(sortie: string): Record<string, unknown> | null {
  const match = sortie.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const objet = JSON.parse(match[0]);
    return estObjet(objet) ? objet : null;
  } catch {
    return null;
  }
}

/** Lit et valide la sortie JSON de l'extracteur. null si illisible. */
export function analyserExtraction(sortie: string): { extraction: ExtractionMotsCles; rejets: string[] } | null {
  const brut = extraireJson(sortie);
  if (!brut) return null;
  const rejets: string[] = [];
  const personnages = (Array.isArray(brut.personnagesVisibles) ? brut.personnagesVisibles : [])
    .filter(estObjet)
    .map((p): PersonnageExtrait => ({
      nom: texteCourt(p.nom, 80),
      identite: nettoyerMotsCles(p.identite, 'identité', rejets, 8),
      apparence: nettoyerMotsCles(p.apparence, 'apparence', rejets, 8),
      tenue: nettoyerMotsCles(p.tenue, 'tenue', rejets, 8),
      action: nettoyerMotsCles(p.action, 'action', rejets, 4),
      position: nettoyerMotsCles(p.position, 'position', rejets, 3),
    }))
    .filter((p) => p.nom)
    .slice(0, 6);
  const changements: ChangementVisuel[] = (Array.isArray(brut.changementsVisuels) ? brut.changementsVisuels : [])
    .filter(estObjet)
    .map((c) => ({
      cible: (c.cible === 'decor' ? 'decor' : 'personnage') as ChangementVisuel['cible'],
      nom: texteCourt(c.nom, 80) || undefined,
      champ: texteCourt(c.champ, 40),
      operation: (['definir', 'ajouter', 'retirer'].includes(String(c.operation)) ? c.operation : 'definir') as ChangementVisuel['operation'],
      valeur: texteCourt(c.valeur, 160),
      evenement: texteCourt(c.evenement, 400),
    }))
    .filter((c) => c.champ)
    .slice(0, 24);
  return {
    extraction: {
      typeScene: estProfilCadrage(brut.typeScene) ? brut.typeScene : undefined,
      lieu: nettoyerMotsCles(brut.lieu, 'lieu', rejets, 6),
      instant: nettoyerMotsCles(brut.instant, 'instant', rejets, 4),
      eclairage: nettoyerMotsCles(brut.eclairage, 'éclairage', rejets, 4),
      personnagesVisibles: personnages,
      horsCadre: nettoyerMotsCles(brut.horsCadre, 'hors cadre', rejets, 8),
      mentionnes: nettoyerMotsCles(brut.mentionnes, 'mentionnés', rejets, 8),
      figurants: nettoyerMotsCles(brut.figurants, 'figurants', rejets, 4),
      action: nettoyerMotsCles(brut.action, 'action', rejets, 6),
      elementsObligatoires: nettoyerMotsCles(brut.elementsObligatoires, 'éléments obligatoires', rejets, 10),
      decor: nettoyerMotsCles(brut.decor, 'décor', rejets, 10),
      interdictionsFactuelles: nettoyerMotsCles(brut.interdictionsFactuelles, 'interdictions', rejets, 6),
      changementsVisuels: changements,
    },
    rejets,
  };
}

export function extractionVide(): ExtractionMotsCles {
  return {
    lieu: [], instant: [], eclairage: [], personnagesVisibles: [], horsCadre: [], mentionnes: [], figurants: [],
    action: [], elementsObligatoires: [], decor: [], interdictionsFactuelles: [], changementsVisuels: [],
  };
}

// ---------------------------------------------------------------------------
// Canon des personnages
// ---------------------------------------------------------------------------

const TITRES = /^(ma[iî]tre|ma[iî]tresse|chef|dame|sir|seigneur|messire|capitaine|p[èe]re|m[èe]re|fr[èe]re|s[œo]eur)$/i;

/** Le nom (complet, ou premier mot s'il n'est pas un simple titre) figure dans le texte. */
export function nomCiteDans(nom: string, texte: string): boolean {
  if (!nom.trim() || !texte.trim()) return false;
  if (contientExpression(texte, nom)) return true;
  const mots = nom.trim().split(/\s+/);
  return mots.length > 1 && mots[0].length > 2 && !TITRES.test(mots[0]) && contientExpression(texte, mots[0]);
}

function roleCanonPour(nom: string) {
  const cle = normaliserTexte(nom);
  return ROLES_CANON.find((r) => normaliserTexte(r.nom) === cle || normaliserTexte(prenomRole(r)) === cle.split(' ')[0]);
}

/** Race connue d'un personnage, depuis la création (joueur), sa fiche ou le canon du lore. */
export function raceDuPersonnage(story: StoryState, personnage: Pick<PersonnageContrat, 'type' | 'assetId' | 'nom'>): RacePnj | null {
  if (personnage.type === 'joueur') {
    const race = RACES_ELYNDOR.find((r) => r.id === story.meta.raceOrigineId);
    if (!race) return detecterRacePnj(story.meta.personnageNom, story.meta.personnageDescription ?? '');
    const sexe = story.meta.sexe === 'Homme' || story.meta.sexe === 'Femme' ? story.meta.sexe : 'Autre';
    return { race, sexe };
  }
  if (personnage.type === 'pnj') {
    const fiche = listerPnjVisuels(story).find((p) => p.id === personnage.assetId);
    return fiche ? detecterRacePnj(fiche.titre, fiche.contenu) : null;
  }
  if (personnage.type === 'canon') {
    const role = roleCanonPour(personnage.nom);
    return role ? detecterRacePnj(role.nom, role.description) : null;
  }
  return null;
}

/** Fiche textuelle canonique d'un personnage (création, lore émergent ou lore officiel). */
export function ficheDuPersonnage(story: StoryState, personnage: Pick<PersonnageContrat, 'type' | 'assetId' | 'nom'>): string {
  if (personnage.type === 'joueur') return story.meta.personnageDescription ?? '';
  if (personnage.type === 'pnj') return listerPnjVisuels(story).find((p) => p.id === personnage.assetId)?.contenu ?? '';
  if (personnage.type === 'canon') return roleCanonPour(personnage.nom)?.description ?? '';
  return '';
}

/** Mots-clés de repli tirés d'une fiche : segments courts, sans invention. */
export function motsClesDeFiche(fiche: string, max = 6): string[] {
  return fiche
    .split(/[.,;:\n]/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s && s.split(' ').length <= 6)
    .slice(0, max);
}

const EST_CARNATION = /\b(skin|skinned|complexion)\b/i;
const EST_CHEVELURE = /\bhair\b/i;

function decouper(texte: string): string[] {
  return texte.split(',').map((x) => x.trim()).filter(Boolean);
}

function sansDoublons(liste: string[]): string[] {
  const vus = new Set<string>();
  return liste.filter((x) => {
    const cle = x.toLowerCase();
    if (vus.has(cle)) return false;
    vus.add(cle);
    return true;
  });
}

/**
 * Le canon reprend autorité sur l'extraction : traits de race (carnation,
 * cheveux, oreilles…) et état visuel établi (tenue, coiffure, blessures,
 * objets) remplacent ce que le narrateur aurait proposé d'autre.
 */
export function appliquerCanonPersonnage(
  p: PersonnageContrat,
  story: StoryState,
  etat: EtatVisuelHistoire,
  provenance: string[],
  rejets: string[],
): { personnage: PersonnageContrat; negatif: string } {
  const sortie: PersonnageContrat = { ...p, sources: { ...p.sources } };
  const race = raceDuPersonnage(story, p);
  let negatif = '';
  if (race) {
    const traits = decouper(traitsVisuelsRace(race));
    if (traits.length) {
      const remplaceCarnation = traits.some((t) => EST_CARNATION.test(t));
      const remplaceCheveux = traits.some((t) => EST_CHEVELURE.test(t));
      const ecartes = sortie.apparence.filter((a) => (remplaceCarnation && EST_CARNATION.test(a)) || (remplaceCheveux && EST_CHEVELURE.test(a)));
      for (const e of ecartes) rejets.push(`${p.nom} : « ${e} » remplacé par le canon de la race ${race.race.nom}`);
      sortie.apparence = sansDoublons([...traits, ...sortie.apparence.filter((a) => !ecartes.includes(a))]);
      sortie.sources.apparence = 'canon';
      provenance.push(`${p.nom} : traits de race ${race.race.nom} (canon)`);
    }
    negatif = negatifVisuelRace(race);
  }
  const persistant = etat.personnages.find((x) => x.cle === normaliserVisuel(p.nom) || (!!p.assetId && x.assetId === p.assetId));
  if (persistant) {
    const tenue = [persistant.tenue, persistant.armure].filter(Boolean);
    if (tenue.length) {
      if (sortie.tenue.length && sortie.tenue.join(', ') !== tenue.join(', ')) {
        rejets.push(`${p.nom} : tenue proposée « ${sortie.tenue.join(', ')} » remplacée par l'état visuel établi`);
      }
      sortie.tenue = tenue;
      sortie.sources.tenue = 'etat-visuel';
    }
    if (persistant.coiffure) {
      sortie.apparence = [...sortie.apparence.filter((a) => !EST_CHEVELURE.test(a) || sortie.sources.apparence === 'canon'), persistant.coiffure];
    }
    sortie.apparence = sansDoublons([...sortie.apparence, ...persistant.transformations]);
    const etatCourant = [
      ...persistant.blessures, ...persistant.cicatrices, ...persistant.salissures,
      persistant.proprete, ...persistant.armesVisibles, ...persistant.accessoires, ...persistant.objetsPortes,
    ].filter(Boolean);
    if (etatCourant.length) {
      sortie.etat = sansDoublons([...etatCourant, ...sortie.etat]);
      sortie.sources.etat = 'etat-visuel';
    }
    provenance.push(`${p.nom} : état visuel établi au message ${persistant.majAuMessage}`);
  }
  if (!sortie.identite.length && !sortie.apparence.length) {
    const fiche = ficheDuPersonnage(story, p);
    if (fiche) {
      sortie.apparence = motsClesDeFiche(fiche);
      sortie.sources.apparence = 'fiche';
      provenance.push(`${p.nom} : apparence reprise de sa fiche (aucun mot-clé fourni)`);
    }
  }
  return { personnage: sortie, negatif };
}

function versContrat(resolu: PersonnageVisibleResolu, extrait?: PersonnageExtrait, source: SourceFait = 'extraction'): PersonnageContrat {
  const canon = resolu.type === 'figurant' ? roleCanonPour(resolu.nom) : undefined;
  const type: PersonnageContrat['type'] = canon ? 'canon' : resolu.type;
  return {
    cle: resolu.assetId ?? (canon ? `canon:${normaliserVisuel(canon.nom)}` : `figurant:${normaliserVisuel(resolu.nom)}`),
    nom: canon?.nom ?? resolu.nom,
    type,
    assetId: resolu.assetId,
    principal: resolu.principal || !!canon,
    identite: extrait?.identite ?? [],
    apparence: extrait?.apparence ?? [],
    tenue: extrait?.tenue ?? [],
    etat: [],
    action: extrait?.action ?? [],
    position: extrait?.position ?? [],
    sources: extrait ? { identite: source, apparence: source, tenue: source, action: source } : {},
  };
}

// ---------------------------------------------------------------------------
// Consolidation d'une scène
// ---------------------------------------------------------------------------

export interface EntreesConsolidation {
  story: StoryState;
  extraction: ExtractionMotsCles;
  /** État visuel projeté sur la chronologie courante (voir projeterEtatVisuel). */
  etat: EtatVisuelHistoire;
  /** Dernier passage du narrateur : la scène illustrée. */
  texteScene: string;
  parModele: boolean;
  rejetsExtraction?: string[];
}

/**
 * Contrat d'une scène : extraction validée puis corrigée par le canon, l'état
 * visuel et la réalité de la scène (présence, lieu). C'est sur ce contrat, et
 * lui seul, que le prompt final est construit.
 */
export function consoliderContratScene(e: EntreesConsolidation): { contrat: ContratVisuel; negatifCanon: string[] } {
  const { story, extraction, etat } = e;
  const provenance: string[] = [e.parModele ? 'mots-clés extraits par le narrateur' : 'repli local : mots-clés reconstruits sans appel au narrateur'];
  const rejets: string[] = [...(e.rejetsExtraction ?? [])];
  const negatifCanon: string[] = [];

  const horsCadre = new Set(extraction.horsCadre.map(normaliserVisuel));
  const presents = (story.scene?.presents ?? []).join('\n');
  const personnages: PersonnageContrat[] = [];
  const mentionnes = [...extraction.mentionnes];
  for (const extrait of extraction.personnagesVisibles) {
    const resolu = resoudrePersonnagesVisibles(story, [extrait.nom])[0];
    if (!resolu) continue;
    if (horsCadre.has(normaliserVisuel(extrait.nom)) || horsCadre.has(normaliserVisuel(resolu.nom))) {
      rejets.push(`${resolu.nom} : déclaré à la fois visible et hors cadre, gardé hors cadre`);
      continue;
    }
    // Un personnage non cité dans le passage illustré (ni présent dans la
    // scène) n'est que mentionné : il n'est pas dessiné.
    if (resolu.type !== 'joueur' && !nomCiteDans(resolu.nom, e.texteScene) && !nomCiteDans(extrait.nom, e.texteScene)
      && !nomCiteDans(resolu.nom, presents)) {
      rejets.push(`${resolu.nom} : absent du passage illustré, traité comme simplement mentionné`);
      mentionnes.push(resolu.nom);
      continue;
    }
    const contrat = versContrat(resolu, extrait, e.parModele ? 'extraction' : 'repli');
    if (personnages.some((p) => p.cle === contrat.cle)) continue;
    const { personnage, negatif } = appliquerCanonPersonnage(contrat, story, etat, provenance, rejets);
    if (negatif) negatifCanon.push(negatif);
    personnages.push(personnage);
  }

  // Lieu : l'état visuel projeté (et donc l'état de scène) prime ; les
  // descripteurs de l'extraction complètent le même lieu.
  const decorEtat = etat.decor;
  const lieu = sansDoublons([
    ...(decorEtat ? [decorEtat.lieu, decorEtat.typeLieu].filter(Boolean) : []),
    ...extraction.lieu,
  ]);
  if (!lieu.length && story.meta.contexte?.lieu) lieu.push(story.meta.contexte.lieu);
  if (decorEtat?.lieu) provenance.push(`lieu : état visuel (« ${decorEtat.lieu} », message ${decorEtat.majAuMessage})`);
  else if (extraction.lieu.length) provenance.push('lieu : extraction');

  const decor = sansDoublons([
    ...(decorEtat ? [decorEtat.architecture, decorEtat.disposition, ...decorEtat.objetsImportants, ...decorEtat.mobilier,
      ...decorEtat.degats, ...decorEtat.incendies, ...decorEtat.ouvertures, ...decorEtat.traces].filter(Boolean) : []),
    ...extraction.decor,
  ]);
  const instant = sansDoublons([...(decorEtat ? [decorEtat.heure, decorEtat.meteo].filter(Boolean) : []), ...extraction.instant]);
  const eclairage = sansDoublons([
    ...(decorEtat ? [decorEtat.lumiere, ...decorEtat.sourcesLumineuses].filter(Boolean) : []),
    ...extraction.eclairage,
  ]);

  const typeScene = extraction.typeScene ?? (!personnages.length ? 'paysage' : personnages.length >= 3 ? 'groupe' : 'dialogue');
  return {
    contrat: {
      version: 1,
      origine: 'scene',
      format: '16:9',
      typeScene,
      lieu,
      instant,
      eclairage,
      personnages,
      horsCadre: [...extraction.horsCadre],
      mentionnes: sansDoublons(mentionnes),
      figurants: [...extraction.figurants],
      action: [...extraction.action],
      elementsObligatoires: [...extraction.elementsObligatoires],
      decor,
      exclusions: [...extraction.interdictionsFactuelles],
      cadrage: cadrageParDefaut(typeScene),
      provenance,
      rejets,
    },
    negatifCanon,
  };
}

/** Portrait (avatar) d'un personnage : même contrat, format 3:4, sujet unique. */
export function contratPortrait(params: {
  story: StoryState;
  sujet: PersonnageVisibleResolu;
  extraction: ExtractionMotsCles | null;
  parModele: boolean;
  etat: EtatVisuelHistoire;
  rejetsExtraction?: string[];
}): { contrat: ContratVisuel; negatifCanon: string[] } {
  const provenance: string[] = [params.parModele ? 'mots-clés extraits par le narrateur depuis la fiche' : 'repli local : mots-clés de la fiche'];
  const rejets: string[] = [...(params.rejetsExtraction ?? [])];
  const extrait = params.extraction?.personnagesVisibles[0];
  const base = versContrat(params.sujet, extrait ? { ...extrait, action: [], position: [] } : undefined, params.parModele ? 'extraction' : 'repli');
  const { personnage, negatif } = appliquerCanonPersonnage(base, params.story, params.etat, provenance, rejets);
  return {
    contrat: {
      version: 1,
      origine: 'portrait',
      format: '3:4',
      typeScene: 'dialogue',
      lieu: [], instant: [], eclairage: [],
      personnages: [personnage],
      horsCadre: [], mentionnes: [], figurants: [], action: [],
      elementsObligatoires: [], decor: [],
      exclusions: params.extraction?.interdictionsFactuelles ?? [],
      cadrage: { ...CADRAGE_PORTRAIT },
      provenance,
      rejets,
    },
    negatifCanon: negatif ? [negatif] : [],
  };
}

/** Aperçu libre : le prompt de l'utilisateur, sans canon ajouté. */
export function contratLibre(texte: string, format: FormatImage, negatifUtilisateur = ''): ContratVisuel {
  return {
    version: 1,
    origine: 'libre',
    format,
    typeScene: format === '3:4' ? 'dialogue' : 'paysage',
    lieu: [], instant: [], eclairage: [],
    personnages: [],
    horsCadre: [], mentionnes: [], figurants: [], action: [],
    elementsObligatoires: [], decor: [],
    exclusions: negatifUtilisateur.split(',').map((x) => x.trim()).filter(Boolean),
    cadrage: format === '3:4' ? { ...CADRAGE_PORTRAIT } : { plan: '', angle: '', composition: '' },
    texteLibre: texte.replace(/\s+/g, ' ').trim(),
    provenance: ['prompt saisi dans l’aperçu libre'],
    rejets: [],
  };
}

// ---------------------------------------------------------------------------
// Anciennes scènes (format V2) : lues pour les régénérations
// ---------------------------------------------------------------------------

/** Structure des scènes enregistrées avant la V3 ; conservée pour les relire. */
export interface StructureIllustrationHeritee {
  profil: string;
  personnages: Array<{ nom: string; apparence?: string; tenue?: string; blessures?: string; armesAccessoires?: string; posture?: string; action?: string }>;
  horsCadre?: string[];
  action?: string;
  decor?: { lieu?: string; architecture?: string; objetsImportants?: string; premierPlan?: string; arrierePlan?: string };
  lumiere?: { source?: string; heure?: string; meteo?: string };
  promptSdxl?: string;
}

/**
 * Convertit une ancienne scène pour la régénérer : mêmes personnages, même
 * lieu, même action. Les mots-clés anglais qu'elle portait sont repris, nettoyés
 * des pondérations et des mots de style propres à l'ancien générateur.
 */
export function contratDepuisStructureHeritee(structure: StructureIllustrationHeritee): ContratVisuel {
  const rejets: string[] = [];
  const typeScene = estProfilCadrage(structure.profil) ? structure.profil : 'dialogue';
  const motsHerites = structure.promptSdxl ? nettoyerMotsCles(structure.promptSdxl.split(','), 'ancienne scène', rejets, 40) : [];
  const texte = (x?: string) => (x?.trim() ? [x.trim()] : []);
  return {
    version: 1,
    origine: 'scene',
    format: '16:9',
    typeScene,
    lieu: texte(structure.decor?.lieu),
    instant: [structure.lumiere?.heure, structure.lumiere?.meteo].filter((x): x is string => !!x?.trim()),
    eclairage: texte(structure.lumiere?.source),
    personnages: structure.personnages.map((p) => ({
      cle: `figurant:${normaliserVisuel(p.nom)}`,
      nom: p.nom,
      type: 'figurant' as const,
      principal: false,
      identite: [],
      apparence: motsHerites.length ? [] : texte(p.apparence),
      tenue: motsHerites.length ? [] : texte(p.tenue),
      etat: motsHerites.length ? [] : [...texte(p.blessures), ...texte(p.armesAccessoires)],
      action: motsHerites.length ? [] : texte(p.action),
      position: [],
      sources: {},
    })),
    horsCadre: structure.horsCadre ?? [],
    mentionnes: [], figurants: [],
    action: motsHerites.length ? [] : texte(structure.action),
    elementsObligatoires: [],
    decor: [structure.decor?.architecture, structure.decor?.objetsImportants].filter((x): x is string => !!x?.trim()),
    exclusions: [],
    cadrage: cadrageParDefaut(typeScene),
    texteLibre: motsHerites.length ? motsHerites.join(', ') : undefined,
    provenance: ['scène enregistrée avant la V3 (contenu repris tel quel)'],
    rejets,
  };
}

export { ID_ASSET_JOUEUR };
