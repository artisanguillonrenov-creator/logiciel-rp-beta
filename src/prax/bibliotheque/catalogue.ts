/**
 * Bibliothèque universelle d'actions — le catalogue.
 *
 * D'après la « Bibliothèque universelle Prax-Elyndor » (licence MIT, voir
 * LICENSE-BIBLIOTHEQUE.md), enrichie et dédoublonnée : chaque action porte sa
 * famille de mécanique, ses façons d'être dite en français, ses paramètres,
 * ses rôles, son risque, sa durée, son coût et ses récits.
 *
 * Le catalogue n'est pas une base de faits concurrente : quand une action est
 * employée, ses paramètres entrent dans le `State` Prax sous forme de faits
 * `acte.<slug>.*` (voir `faitsActe`), et ce sont les pratiques Prax des
 * familles (familles.ts) qui décident et appliquent les effets.
 */
import { Outcome, insert } from '../core/types';
import donnees from './catalogue.json';

export const FAMILLES = [
  'parole', 'requete', 'information', 'influence', 'transaction', 'objet', 'deplacement', 'repos', 'observation',
  'conflit', 'furtivite', 'justice', 'institution', 'fabrication', 'soin', 'magie', 'expression', 'hors_scene',
] as const;
export type Famille = (typeof FAMILLES)[number];

export type Risque = 'nul' | 'faible' | 'moyen' | 'eleve';
export type Axe = 'affection' | 'respect' | 'confiance' | 'peur' | 'hostilite';

export interface EntreeCatalogue {
  id: string;
  /** Identifiant sûr pour un segment de chemin Prax (« commerce_acheter »). */
  slug: string;
  domaine: string;
  libelle: string;
  famille: Famille;
  /** Action déjà codée dans le narrateur Prax qui exécute cet acte (pas de doublon de mécanique). */
  equivalentPrax: string | null;
  /** Identifiants des actions fusionnées dans celle-ci (doublons du catalogue d'origine). */
  fusionnees: string[];
  expressions: string[];
  slots: string[];
  cible: 'personne' | 'objet' | 'lieu' | 'aucune';
  roleCible: string[];
  autoriteActeur: string[];
  valence: number;
  axe: Axe | null;
  risque: Risque;
  duree: number;
  fatigue: number;
  prixIndicatif: number | null;
  competence: string | null;
  lieuRequis: string | null;
  produit: string | null;
  statutCible: string | null;
  statutActeur: string | null;
  observable: boolean;
  illegal: boolean;
  recitJoueur: string;
  recitReussite: string;
  recitEchec: string;
  notesLore: string;
  /**
   * Sens d'une transaction : achat (le joueur paie un bien ou un service), vente (il cède un bien qu'il possède),
   * paiement (versement direct), requete (il demande une somme ou un accord : emprunt, salaire, rançon…),
   * ou gestion des offres en cours (accepter, refuser, annuler, contre).
   */
  sens?: 'achat' | 'vente' | 'paiement' | 'requete' | 'accepter' | 'refuser' | 'annuler' | 'contre';
  /** Effet d'objet (famille objet). */
  effetObjet?: string;
}

export const CATALOGUE: readonly EntreeCatalogue[] = donnees as unknown as EntreeCatalogue[];

const PAR_ID = new Map(CATALOGUE.map((e) => [e.id, e]));
const PAR_SLUG = new Map(CATALOGUE.map((e) => [e.slug, e]));
const FUSION = new Map<string, EntreeCatalogue>();
for (const e of CATALOGUE) for (const f of e.fusionnees) FUSION.set(f, e);

export function slugActe(id: string): string {
  return id.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
}

/** L'entrée d'un identifiant (y compris un identifiant fusionné dans une autre). */
export function entreeParId(id: string): EntreeCatalogue | undefined {
  return PAR_ID.get(id) ?? FUSION.get(id);
}

export function entreeParSlug(slug: string): EntreeCatalogue | undefined {
  return PAR_SLUG.get(slug);
}

const SEG = /[^a-z0-9_]+/g;
function seg(v: string): string {
  const s = v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(SEG, '_').replace(/^_+|_+$/g, '');
  return s.length === 0 ? 'x' : /^[0-9]/.test(s) ? `n${s}` : s;
}

/** Délai d'écart de marchandage : un quart du prix, au moins 1. */
export function ecart(prix: number): number {
  return Math.max(1, Math.round(prix / 4));
}

export type Mode = 'parole' | 'requete' | 'information' | 'influence' | 'transaction' | 'objet' | 'repos' | 'tentative';

/** Le mode d'exécution natif d'une action : quelle pratique Prax l'exécute. */
export function modeDe(e: EntreeCatalogue): Mode {
  switch (e.famille) {
    case 'parole':
      return e.cible === 'personne' ? 'parole' : 'tentative';
    case 'requete':
      return e.cible === 'personne' || e.roleCible.length > 0 ? 'requete' : 'tentative';
    case 'justice':
    case 'institution':
      // Un acte réservé à une autorité se tente (et se refuse sans elle) ; les autres se demandent à l'autorité.
      return e.autoriteActeur.length > 0 || (e.roleCible.length === 0 && e.cible !== 'personne') ? 'tentative' : 'requete';
    case 'information':
      return e.cible === 'personne' ? 'information' : 'tentative';
    case 'influence':
      return e.cible === 'personne' ? 'influence' : 'tentative';
    case 'transaction':
      return e.sens === 'requete' ? 'requete' : 'transaction';
    case 'objet':
      return 'objet';
    case 'repos':
      return 'repos';
    default:
      // Déplacements physiques (escalader, nager…), fabrication, soin, magie, furtivité, conflit… : une tentative
      // (le changement de lieu lui-même passe par l'action « se rend à » du narrateur).
      return 'tentative';
  }
}

/**
 * Les faits Prax d'une action du catalogue, insérés quand l'action est employée
 * pour la première fois dans une partie. Les pratiques des familles ne lisent
 * le catalogue qu'à travers eux.
 */
export function faitsActe(e: EntreeCatalogue): Outcome[] {
  const s = e.slug;
  const out: string[] = [`acte.${s}.famille.${e.famille}`, `acte.${s}.risque!${e.risque}`, `acte.${s}.duree!${Math.max(1, Math.round(e.duree))}`, `acte.${s}.fatigue!${Math.max(0, Math.round(e.fatigue))}`];
  out.push(`acte.${s}.axe!${e.axe ?? 'affection'}`);
  out.push(`acte.${s}.delta!${Math.round(e.valence * 3)}`);
  out.push(`acte.${s}.signe!${e.valence > 0 ? 'positif' : e.valence < 0 ? 'negatif' : 'neutre'}`);
  for (const r of e.roleCible.length ? e.roleCible : ['tous']) out.push(`acte.${s}.role.${seg(r)}`);
  for (const r of e.autoriteActeur.length ? e.autoriteActeur : ['tous']) out.push(`acte.${s}.autorite.${seg(r)}`);
  if (e.prixIndicatif !== null && e.prixIndicatif > 0) {
    const p = Math.round(e.prixIndicatif);
    out.push(`acte.${s}.prix!${p}`, `acte.${s}.plancher!${Math.max(1, Math.round(p / 2))}`, `acte.${s}.ecart!${ecart(p)}`);
  }
  if (e.competence) out.push(`acte.${s}.competence!${seg(e.competence)}`);
  if (e.lieuRequis) out.push(`acte.${s}.lieu!${seg(e.lieuRequis)}`);
  if (e.produit) out.push(`acte.${s}.produit!${seg(e.produit)}`);
  if (e.statutCible) out.push(`acte.${s}.statutcible!${seg(e.statutCible)}`);
  if (e.statutActeur) out.push(`acte.${s}.statutacteur!${seg(e.statutActeur)}`);
  if (e.observable) out.push(`acte.${s}.observable`);
  if (e.illegal) out.push(`acte.${s}.illegal`);
  if (e.sens) out.push(`acte.${s}.sens!${e.sens}`);
  if (e.effetObjet) out.push(`acte.${s}.effet!${e.effetObjet}`);
  if (e.cible === 'personne') out.push(`acte.${s}.cible`);
  out.push(`acte.${s}.mode!${modeDe(e)}`);
  out.push(`acte.${s}.poids!${Math.max(5, Math.abs(Math.round(e.valence)) * 5)}`);
  return out.map(insert);
}

/** Segment Prax sûr pour un nom libre (objet, produit…). */
export const segment = seg;

/** Quelques mesures du catalogue, pour le rapport de couverture. */
export function couverture(): { actions: number; parFamille: Record<string, number>; expressions: number } {
  const parFamille: Record<string, number> = {};
  let expressions = 0;
  for (const e of CATALOGUE) {
    parFamille[e.famille] = (parFamille[e.famille] ?? 0) + 1;
    expressions += e.expressions.length;
  }
  return { actions: CATALOGUE.length, parFamille, expressions };
}

/**
 * Niveau de maturité d'une action, sur l'échelle de la bibliothèque d'origine (docs/MATRICE_COUVERTURE) :
 * - L1 : reconnue, classée, paramètres extraits, mais pas jouée dans la scène (acte de meneur de jeu) ;
 * - L2 : préconditions évaluées sur l'état Prax (autorité, lieu, cible, compétence) et tentative au dé,
 *   avec fatigue et témoins, sans effet propre sur le monde ;
 * - L3 : effets propres appliqués et sauvegardés (argent, objets, statuts, produit, relations) et
 *   réactions des PNJ choisies par le planificateur.
 * L4 (essais variés sur Android) n'est pas attribué par le code : il se constate sur l'appareil.
 */
export function maturite(e: EntreeCatalogue): 'L1' | 'L2' | 'L3' {
  if (e.equivalentPrax) return 'L3';
  if (e.famille === 'hors_scene' && e.autoriteActeur.length === 0) return 'L1';
  const mode = modeDe(e);
  if (mode === 'objet') return e.effetObjet === 'manipuler' ? 'L2' : 'L3';
  if (mode === 'tentative') return e.statutCible || e.statutActeur || e.produit || e.valence !== 0 ? 'L3' : 'L2';
  return 'L3';
}
