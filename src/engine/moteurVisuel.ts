import type { ProfilContenu } from '../types';
import {
  modulesPourFormat,
  motsClesStyle,
  reglagesFormat,
  elementsMotsCles,
  type FormatSujet,
  type ReglagesVisuels,
} from '../concepteur/reglagesVisuels';
import { appliquerCadrageAtelier, retirerMotsPortrait } from './cadrageVisuel';
import type { ContratVisuel, PersonnageContrat } from './contratVisuel';
import type { RequeteImage } from './elyndorCloudImages';
import type { CapacitesGenerateur } from './fournisseursImages';
import { normaliserVisuel } from './visualState';

/**
 * Moteur visuel central (partie pure) : à partir d'un contrat factuel, de la
 * configuration unique de l'Atelier et des capacités RÉELLES du générateur,
 * construit UNE requête effective et explique tout ce qui a été écarté.
 * Tous les chemins d'image (scènes, portraits, aperçus, futurs modules)
 * passent par ici, via serviceVisuel.
 */

// ---------------------------------------------------------------------------
// Références
// ---------------------------------------------------------------------------

export type RoleReference = 'identite' | 'race' | 'decor' | 'continuite';
export type TypeReferenceCandidate =
  | 'joueur-portrait' | 'joueur-avatar' | 'pnj-avatar' | 'race' | 'lieu' | 'scene-precedente' | 'manuelle';

export interface ReferenceCandidate {
  /** Identifiant stable (journalisé à la place de l'image). */
  id: string;
  type: TypeReferenceCandidate;
  role: RoleReference;
  libelle: string;
  /** Image (data URL) ; null si le fichier est introuvable ou illisible. */
  uri: string | null;
  /** Clé du personnage du contrat concerné (identité, race). */
  entite?: string;
  /** Lieu représenté (scène précédente, fiche de lieu). */
  lieu?: string;
  /** Choisie explicitement par l'utilisateur (aperçu) : pas de filtrage par réglage ni par visibilité. */
  imposee?: boolean;
}

export interface ReferenceRetenue extends ReferenceCandidate {
  uri: string;
  roleGenerateur: 'personnage' | 'scene' | 'race';
}

export interface ReferenceEcartee {
  id: string;
  libelle: string;
  raison: string;
}

const ORDRE_IDENTITE: Partial<Record<TypeReferenceCandidate, number>> = {
  'joueur-portrait': 0, 'joueur-avatar': 1, 'pnj-avatar': 2, manuelle: 3,
};
const ORDRE_ROLE: Record<RoleReference, number> = { identite: 0, race: 1, decor: 2, continuite: 3 };
const ROLE_GENERATEUR: Record<RoleReference, ReferenceRetenue['roleGenerateur']> = {
  identite: 'personnage', race: 'race', decor: 'scene', continuite: 'scene',
};

function memeLieu(a: string, contrat: ContratVisuel): boolean {
  const lieu = normaliserVisuel(a);
  return !!lieu && contrat.lieu.some((l) => {
    const n = normaliserVisuel(l);
    return !!n && (n === lieu || n.includes(lieu) || lieu.includes(n));
  });
}

/**
 * Sélection des références : pertinentes pour CE contrat (personnages
 * visibles, même lieu), activées dans l'Atelier, puis ordonnées et plafonnées
 * selon les capacités du générateur. Chaque référence écartée l'est avec sa
 * raison : aucune suppression silencieuse.
 */
export function selectionnerReferences(
  candidats: readonly ReferenceCandidate[],
  contrat: ContratVisuel,
  reglages: Pick<ReglagesVisuels, 'references'>,
  capacites: CapacitesGenerateur,
): { retenues: ReferenceRetenue[]; ecartees: ReferenceEcartee[] } {
  const ecartees: ReferenceEcartee[] = [];
  const ecarter = (ref: ReferenceCandidate, raison: string) => ecartees.push({ id: ref.id, libelle: ref.libelle, raison });
  const portrait = contrat.format === '3:4';
  const visibles = new Map<string, number>(contrat.personnages.map((p: PersonnageContrat, i) => [p.cle, i]));
  const eligibles: ReferenceRetenue[] = [];
  const uris = new Set<string>();

  for (const ref of candidats) {
    if (!ref.uri) { ecarter(ref, 'fichier introuvable ou illisible'); continue; }
    if (!ref.imposee) {
      if (ref.role === 'identite' && !portrait && !reglages.references.personnages) { ecarter(ref, 'références de personnages désactivées dans l’Atelier'); continue; }
      if (ref.role === 'race' && !reglages.references.races) { ecarter(ref, 'références de races désactivées dans l’Atelier'); continue; }
      if (ref.role === 'decor' && !reglages.references.lieux) { ecarter(ref, 'références de lieux désactivées dans l’Atelier'); continue; }
      if (ref.role === 'continuite' && !reglages.references.scenePrecedente) { ecarter(ref, 'référence de scène précédente désactivée dans l’Atelier'); continue; }
      if ((ref.role === 'identite' || ref.role === 'race') && ref.entite && !visibles.has(ref.entite)) { ecarter(ref, 'personnage non visible dans cette image'); continue; }
      if (ref.role === 'continuite' || ref.role === 'decor') {
        if (!ref.lieu || !contrat.lieu.length) { ecarter(ref, 'lieu inconnu : continuité non garantie'); continue; }
        if (!memeLieu(ref.lieu, contrat)) { ecarter(ref, `autre lieu (« ${ref.lieu} »)`); continue; }
      }
    }
    if (uris.has(ref.uri)) { ecarter(ref, 'doublon d’une autre référence'); continue; }
    uris.add(ref.uri);
    eligibles.push({ ...ref, uri: ref.uri, roleGenerateur: ROLE_GENERATEUR[ref.role] });
  }

  // Une seule identité par personnage (portrait de création d'abord), puis
  // les rôles par importance : une scène ne peut jamais évincer un visage.
  const tries = eligibles
    .map((ref, ordre) => ({ ref, ordre }))
    .sort((a, b) => ORDRE_ROLE[a.ref.role] - ORDRE_ROLE[b.ref.role]
      || (visibles.get(a.ref.entite ?? '') ?? 99) - (visibles.get(b.ref.entite ?? '') ?? 99)
      || (ORDRE_IDENTITE[a.ref.type] ?? 9) - (ORDRE_IDENTITE[b.ref.type] ?? 9)
      || a.ordre - b.ordre)
    .map(({ ref }) => ref);
  // Générateur à référence générale unique : on garde celle qui sert le
  // format (décor ou continuité pour une scène, race pour un portrait).
  if (capacites.references.referenceGeneraleUnique) {
    const prioritaires: RoleReference[] = portrait ? ['race', 'decor', 'continuite'] : ['decor', 'continuite', 'race'];
    const generale = prioritaires.map((role) => tries.find((r) => r.role === role)).find(Boolean);
    for (let i = tries.length - 1; i >= 0; i--) {
      const ref = tries[i];
      if (ref.role !== 'identite' && ref !== generale) {
        ecarter(ref, `${capacites.nom} n’accepte qu’une référence générale (décor ou race) en plus des visages`);
        tries.splice(i, 1);
      }
    }
  }
  const entitesVues = new Set<string>();
  const retenues: ReferenceRetenue[] = [];
  let visages = 0;
  for (const ref of tries) {
    if (!capacites.references.supportees) { ecarter(ref, `images de référence non prises en charge par ${capacites.nom} : description textuelle seule`); continue; }
    if (ref.role === 'identite') {
      if (ref.entite && entitesVues.has(ref.entite)) { ecarter(ref, 'une seule référence d’identité par personnage'); continue; }
      if (visages >= capacites.references.maxVisages) { ecarter(ref, `plafond de ${capacites.references.maxVisages} visages du générateur atteint`); continue; }
      if (ref.entite) entitesVues.add(ref.entite);
      visages++;
    }
    if (retenues.length >= capacites.references.max) { ecarter(ref, `plafond de ${capacites.references.max} images du générateur atteint`); continue; }
    retenues.push(ref);
  }
  return { retenues, ecartees };
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export type NiveauGroupe = 'obligatoire' | 'secondaire' | 'cadrage' | 'style' | 'reglage' | 'securite';

export interface GroupePrompt {
  cle: string;
  niveau: NiveauGroupe;
  texte: string;
}

export interface ParametreEcarte {
  parametre: string;
  raison: string;
}

export interface PreparationImage {
  requete: RequeteImage;
  groupes: GroupePrompt[];
  styleApplique: string[];
  references: { retenues: ReferenceRetenue[]; ecartees: ReferenceEcartee[] };
  ecartes: ParametreEcarte[];
  avertissements: string[];
  capacites: CapacitesGenerateur;
  contrat: ContratVisuel;
}

/** Exclusions de sécurité du profil Grand public : distinctes, toujours visibles dans le diagnostic. */
export const NEGATIF_GRAND_PUBLIC = 'nsfw, nudity, nude, naked, explicit, sexual content, gore';
const POSITIF_GRAND_PUBLIC = 'safe for work, fully clothed';

function liste(...valeurs: Array<readonly string[] | string | undefined>): string[] {
  const vus = new Set<string>();
  const sortie: string[] = [];
  for (const v of valeurs) {
    for (const element of typeof v === 'string' ? elementsMotsCles(v) : v ?? []) {
      const t = element.trim();
      const cle = t.toLowerCase();
      if (!t || vus.has(cle)) continue;
      vus.add(cle);
      sortie.push(t);
    }
  }
  return sortie;
}

function groupePersonnage(p: PersonnageContrat): string {
  return liste(p.identite, p.apparence, p.tenue, p.etat, p.action, p.position).join(', ');
}

/**
 * Groupes du prompt, du plus critique au moins critique : lieu, action,
 * personnages et apparences, éléments obligatoires, puis contexte
 * secondaire, cadrage, identité artistique globale et ajouts de l'Atelier.
 */
export function groupesPrompt(
  contrat: ContratVisuel,
  reglages: ReglagesVisuels,
  options: { profilContenu?: ProfilContenu; negatifPrisEnCharge: boolean },
): { groupes: GroupePrompt[]; negatifCadrage: string; styleApplique: string[] } {
  const scene = contrat.origine === 'scene';
  const nettoyer = (mots: readonly string[]) => (scene && reglages.eviterPortraitScene ? retirerMotsPortrait(mots) : [...mots]);
  const groupes: GroupePrompt[] = [];
  const ajouter = (cle: string, niveau: NiveauGroupe, mots: readonly string[]) => {
    const elementsSimples = mots.flatMap((m) => m.split(',').map((x) => x.trim())).filter(Boolean);
    const texte = liste(nettoyer(elementsSimples)).join(', ');
    if (texte) groupes.push({ cle, niveau, texte });
  };
  if (contrat.texteLibre) ajouter('texte', 'obligatoire', [contrat.texteLibre]);
  ajouter('lieu', 'obligatoire', contrat.lieu);
  ajouter('action', 'obligatoire', contrat.action);
  if (contrat.personnages.length > 1) ajouter('nombre', 'obligatoire', [`${contrat.personnages.length} characters`]);
  contrat.personnages.forEach((p, i) => ajouter(`personnage:${i + 1}:${p.nom}`, 'obligatoire', [groupePersonnage(p)]));
  ajouter('elements-obligatoires', 'obligatoire', contrat.elementsObligatoires);
  ajouter('decor', 'secondaire', contrat.decor);
  ajouter('instant', 'secondaire', contrat.instant);
  ajouter('eclairage', 'secondaire', contrat.eclairage);

  let negatifCadrage = '';
  let cadrage = contrat.cadrage;
  if (scene && contrat.format === '16:9') {
    const regle = appliquerCadrageAtelier(contrat.cadrage, reglages, contrat.personnages.length > 0);
    cadrage = regle.cadrage;
    negatifCadrage = regle.negatif;
  }
  ajouter('cadrage', 'cadrage', [cadrage.plan, cadrage.angle, cadrage.composition].filter(Boolean));

  const styleApplique = motsClesStyle(reglages);
  ajouter('style', 'style', styleApplique);
  const format: FormatSujet = contrat.format === '3:4' ? 'portrait' : 'scene';
  ajouter('positif', 'reglage', liste(reglages.positif, reglagesFormat(reglages, format).positif));
  if (options.profilContenu !== 'adulte' && !options.negatifPrisEnCharge) ajouter('securite', 'securite', [POSITIF_GRAND_PUBLIC]);
  return { groupes, negatifCadrage, styleApplique };
}

/**
 * Prépare la requête EFFECTIVE pour un générateur donné. Pure : aucune
 * lecture de stockage, aucun réseau. Les paramètres non pris en charge ne
 * sont jamais transmis ; chacun est listé avec sa raison.
 */
export function preparerRequeteImage(params: {
  contrat: ContratVisuel;
  reglages: ReglagesVisuels;
  capacites: CapacitesGenerateur;
  candidats?: readonly ReferenceCandidate[];
  profilContenu?: ProfilContenu;
  /** Exclusions tirées du canon (traits de race contraires…). */
  negatifCanon?: readonly string[];
}): PreparationImage {
  const { contrat, reglages, capacites } = params;
  const format: FormatSujet = contrat.format === '3:4' ? 'portrait' : 'scene';
  const technique = reglagesFormat(reglages, format);
  const ecartes: ParametreEcarte[] = [];
  const avertissements: string[] = [];
  const nonPrisEnCharge = `non pris en charge par ${capacites.nom}`;

  const { groupes, negatifCadrage, styleApplique } = groupesPrompt(contrat, reglages, {
    profilContenu: params.profilContenu,
    negatifPrisEnCharge: capacites.negatif,
  });

  // Longueur annoncée par le fournisseur : on retire d'abord le contexte
  // secondaire (du moins important au plus important), jamais une obligation.
  let retenus = [...groupes];
  const longueur = () => retenus.map((g) => g.texte).join(', ').length;
  if (capacites.longueurMaxPrompt) {
    for (let i = retenus.length - 1; i >= 0 && longueur() > capacites.longueurMaxPrompt; i--) {
      if (retenus[i].niveau === 'secondaire') {
        avertissements.push(`« ${retenus[i].cle} » retiré : longueur maximale du générateur (${capacites.longueurMaxPrompt} caractères)`);
        retenus.splice(i, 1);
      }
    }
    if (longueur() > capacites.longueurMaxPrompt) {
      avertissements.push(`La scène dépasse la longueur annoncée par le générateur (${longueur()} > ${capacites.longueurMaxPrompt} caractères) : aucune obligation n’a été retirée, la fin peut être ignorée par le modèle.`);
    }
  }
  const prompt = retenus.map((g) => g.texte).join(', ');

  const negatif = liste(
    reglages.negatif,
    technique.negatif,
    ...(params.negatifCanon ?? []),
    negatifCadrage,
    contrat.exclusions,
    params.profilContenu === 'adulte' ? '' : NEGATIF_GRAND_PUBLIC,
  ).join(', ');
  if (negatif && !capacites.negatif) {
    ecartes.push({ parametre: 'prompt négatif', raison: `${nonPrisEnCharge} (exclusions non transmises${params.profilContenu === 'adulte' ? '' : ' ; protection Grand public traduite en mots-clés positifs'})` });
  }

  const requete: RequeteImage = {
    prompt,
    references: [],
    format: contrat.format,
    ...(negatif && capacites.negatif ? { negatif } : {}),
  };

  if (capacites.tailles === null) ecartes.push({ parametre: 'taille', raison: 'dimensions imposées par le générateur' });
  else if (capacites.tailles[contrat.format].includes(technique.taille)) requete.size = technique.taille;
  else ecartes.push({ parametre: 'taille', raison: `${technique.taille} non acceptée par ${capacites.nom}` });

  const optionnel = (nom: string, valeur: number | null, supporte: boolean, appliquer: (v: number) => void) => {
    if (valeur === null) return;
    if (supporte) appliquer(valeur);
    else ecartes.push({ parametre: nom, raison: nonPrisEnCharge });
  };
  optionnel('étapes', technique.pas, capacites.pas, (v) => { requete.steps = v; });
  optionnel('guidance', technique.guidance, capacites.guidance, (v) => { requete.guidance = v; });
  optionnel('graine', technique.graine, capacites.graine, (v) => { requete.seed = v; });
  if (format === 'portrait') {
    optionnel('poids de référence de race', reglages.portrait.poidsReferenceRace, capacites.poidsReference, (v) => { requete.poidsRace = v; });
  }
  const modules = modulesPourFormat(reglages, format);
  if (capacites.modules) requete.modules = modules;
  else if (Object.keys(modules).length) ecartes.push({ parametre: `modules (${Object.keys(modules).join(', ')})`, raison: nonPrisEnCharge });

  const references = selectionnerReferences(params.candidats ?? [], contrat, reglages, capacites);
  requete.references = references.retenues.map((r) => ({ role: r.roleGenerateur, image: r.uri }));
  if (references.retenues.length && !capacites.references.roles.length) {
    avertissements.push(`${capacites.nom} reçoit les références sans distinguer leur rôle (visage, race, décor).`);
  }
  const identitesSansImage = contrat.personnages.filter((p) => p.type !== 'figurant'
    && !references.retenues.some((r) => r.role === 'identite' && r.entite === p.cle));
  if (identitesSansImage.length && contrat.origine !== 'libre') {
    avertissements.push(`Identité décrite par le texte seul pour : ${identitesSansImage.map((p) => p.nom).join(', ')}.`);
  }

  return { requete, groupes: retenus, styleApplique, references, ecartes, avertissements, capacites, contrat };
}

// ---------------------------------------------------------------------------
// Trace de diagnostic
// ---------------------------------------------------------------------------

export interface TraceIllustration {
  operation: string;
  origine: ContratVisuel['origine'];
  storyId?: string;
  revision?: string;
  config: { schema: number; majLe: number; style: string };
  extraction?: { parModele: boolean; brute?: string; erreur?: string; rejets: string[] };
  contrat: {
    lieu: string[]; action: string[]; personnages: string[]; horsCadre: string[]; mentionnes: string[];
    elementsObligatoires: string[]; exclusions: string[]; provenance: string[]; rejets: string[];
  };
  style: string[];
  capacites: { fournisseur: string; nom: string; source: string; remarques: string[] };
  references: {
    retenues: Array<{ id: string; libelle: string; role: string; taille: number }>;
    ecartees: ReferenceEcartee[];
  };
  requete: Omit<RequeteImage, 'references'> & { references: number };
  ecartes: ParametreEcarte[];
  avertissements: string[];
  statut: 'simulation' | 'ok' | 'erreur';
  dureeMs?: number;
  erreur?: string;
  destination?: string;
}

/** Trace sans image (aucun base64) ni secret : seulement identifiants, rôles et tailles. */
export function construireTrace(
  preparation: PreparationImage,
  contexte: Pick<TraceIllustration, 'operation' | 'storyId' | 'revision' | 'extraction' | 'statut' | 'dureeMs' | 'erreur' | 'destination'>,
  reglages: Pick<ReglagesVisuels, 'schema' | 'majLe' | 'style'>,
): TraceIllustration {
  const { requete, contrat } = preparation;
  const { references: _refs, ...reste } = requete;
  return {
    ...contexte,
    origine: contrat.origine,
    config: { schema: reglages.schema, majLe: reglages.majLe, style: reglages.style.nom },
    contrat: {
      lieu: contrat.lieu, action: contrat.action,
      personnages: contrat.personnages.map((p) => `${p.nom} (${p.type})`),
      horsCadre: contrat.horsCadre, mentionnes: contrat.mentionnes,
      elementsObligatoires: contrat.elementsObligatoires, exclusions: contrat.exclusions,
      provenance: contrat.provenance, rejets: contrat.rejets,
    },
    style: preparation.styleApplique,
    capacites: {
      fournisseur: preparation.capacites.fournisseur, nom: preparation.capacites.nom,
      source: preparation.capacites.source, remarques: preparation.capacites.remarques,
    },
    references: {
      retenues: preparation.references.retenues.map((r) => ({ id: r.id, libelle: r.libelle, role: r.roleGenerateur, taille: r.uri.length })),
      ecartees: preparation.references.ecartees,
    },
    requete: { ...reste, references: requete.references.length },
    ecartes: preparation.ecartes,
    avertissements: preparation.avertissements,
  };
}
