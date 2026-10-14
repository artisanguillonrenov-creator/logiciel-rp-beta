/**
 * Le narrateur Prax et la bibliothèque universelle d'actions.
 *
 * - Compréhension : rapprocher le message du joueur d'une action du catalogue
 *   (ses expressions), lire le montant et l'objet annoncés, choisir
 *   l'interlocuteur, puis trouver l'action Prax native qui l'exécute.
 * - Diagnostic : quand l'action n'est pas possible, dire pourquoi (autorité,
 *   lieu, bourse, objet, personne à qui s'adresser) au lieu de deviner.
 * - Rendu : raconter l'acte du joueur et les réactions des PNJ en français, à
 *   partir des récits du catalogue.
 *
 * Les paramètres d'une action n'entrent dans le moteur qu'une fois, la première
 * fois qu'elle est employée (`faitsActe`) ; ce que le joueur vient d'annoncer
 * passe par `saisie.montant` et `saisie.objet`, effacés à la fin du tour.
 */
import { CATALOGUE, EntreeCatalogue, Mode, entreeParId, entreeParSlug, faitsActe, modeDe, segment } from '../../prax/bibliotheque/catalogue';
import type { State } from '../../prax/core/engine';
import type { GroundedAction } from '../../prax/core/perform';
import { del, insert } from '../../prax/core/types';
import { normaliser } from './description';
import type { ActeEvenement, DescriptionScene, EvenementTour, PnjDescription } from './types';
import { ID_JOUEUR } from './types';

// ---- index des expressions ---------------------------------------------------------------

/** Texte comparable : minuscules sans accents, ponctuation et apostrophes en espaces. */
export function texteComparable(t: string): string {
  return ` ${normaliser(t).replace(/[^a-z0-9]+/g, ' ').trim()} `;
}

interface EntreeIndex {
  expr: string;
  mots: number;
  entree: EntreeCatalogue;
}

let INDEX: EntreeIndex[] | null = null;
function index(): EntreeIndex[] {
  if (INDEX) return INDEX;
  const vus = new Set<string>();
  const out: EntreeIndex[] = [];
  for (const entree of CATALOGUE) {
    for (const x of entree.expressions) {
      const expr = texteComparable(x);
      if (expr.trim().length < 3 || vus.has(expr)) continue;
      vus.add(expr);
      out.push({ expr, mots: expr.trim().split(' ').length, entree });
    }
  }
  // Les expressions les plus longues d'abord : la plus précise l'emporte.
  out.sort((a, b) => b.mots - a.mots || b.expr.length - a.expr.length);
  INDEX = out;
  return out;
}

export interface ActeReconnu {
  entree: EntreeCatalogue;
  expression: string;
  mots: number;
  /** Position de la fin de l'expression dans le texte comparable (pour lire l'objet qui suit). */
  fin: number;
}

/** Pronoms compléments entre le sujet et le verbe (« je LUI demande », « je LE console »). */
const CLITIQUES = /( (?:je|j|tu) )((?:(?:ne|n|le|la|les|l|lui|leur|te|t|vous|me|m|se|s|y|en) )+)/g;

/** Racine grossière d'un verbe français, à l'infinitif ou conjugué au présent. */
function racine(mot: string): string {
  const m = mot.replace(/(oir|er|ir|re)$/, '').replace(/(ons|ez|ent|es|is|it|e|s|x|t)$/, '');
  return m.length >= 3 ? m : mot;
}

const MOTS_VIDES = new Set(['je', 'j', 'tu', 'il', 'elle', 'le', 'la', 'les', 'l', 'un', 'une', 'des', 'du', 'de', 'd', 'a', 'au', 'aux', 'et', 'en', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'me', 'te', 'se', 'lui', 'pour', 'avec', 'sur', 'dans', 'que', 'qui', 'quelqu', 'un', 'veux', 'vais', 'voudrais', 'peux']);

let RACINES: Map<string, EntreeCatalogue[]> | null = null;
/** Racine du verbe principal de chaque action (l'infinitif ou la première personne de ses expressions). */
function racines(): Map<string, EntreeCatalogue[]> {
  if (RACINES) return RACINES;
  const out = new Map<string, EntreeCatalogue[]>();
  for (const e of CATALOGUE) {
    const vus = new Set<string>();
    for (const x of e.expressions) {
      const mots = texteComparable(x).trim().split(' ');
      const verbe = mots[0] === 'je' || mots[0] === 'j' ? mots[1] : /(er|ir|re)$/.test(mots[0]) ? mots[0] : undefined;
      if (!verbe || verbe.length < 4) continue;
      const r = racine(verbe);
      if (vus.has(r)) continue;
      vus.add(r);
      out.set(r, [...(out.get(r) ?? []), e]);
    }
  }
  RACINES = out;
  return out;
}

function chercherExact(t: string): ActeReconnu | null {
  for (const e of index()) {
    const i = t.indexOf(e.expr);
    if (i >= 0) return { entree: e.entree, expression: e.expr.trim(), mots: e.mots, fin: i + e.expr.length - 1 };
  }
  return null;
}

/**
 * L'action du catalogue que le message exprime le plus précisément, s'il y en a une :
 * une expression du catalogue telle quelle (la plus longue l'emporte), puis sans les
 * pronoms intercalés, puis — moins sûr, compté pour un seul mot — le verbe conjugué
 * après « je » rapproché par sa racine, départagé par les autres mots du message.
 */
export function reconnaitreActe(message: string): ActeReconnu | null {
  const t = texteComparable(message);
  const exact = chercherExact(t);
  if (exact) return exact;
  const sansPronoms = t.replace(CLITIQUES, '$1');
  if (sansPronoms !== t) {
    const r = chercherExact(sansPronoms);
    // La position de fin se recale sur le texte d'origine par le dernier mot de l'expression.
    if (r) return { ...r, fin: finDans(t, r.expression) };
  }
  const m = / (?:je|j) ([a-z]{4,})(?= )/.exec(sansPronoms);
  if (!m) return null;
  const candidats = racines().get(racine(m[1]));
  if (!candidats || candidats.length === 0) return null;
  const mots = new Set(sansPronoms.trim().split(' ').filter((w) => w.length > 2 && !MOTS_VIDES.has(w) && w !== m[1]));
  const note = (e: EntreeCatalogue) => {
    const siens = new Set([...e.expressions, e.libelle].flatMap((x) => texteComparable(x).trim().split(' ')));
    return [...mots].filter((w) => siens.has(w)).length;
  };
  // À égalité, l'action dont c'est le plus souvent le verbe principal (« observer les lieux » plutôt qu'« observer une créature »).
  const r = racine(m[1]);
  const frequence = (e: EntreeCatalogue) => e.expressions.filter((x) => texteComparable(x).trim().split(' ').some((w) => w.length >= 4 && racine(w) === r)).length;
  const meilleur = [...candidats].sort((a, b) => note(b) - note(a) || frequence(b) - frequence(a))[0];
  return { entree: meilleur, expression: m[1], mots: 1, fin: finDans(t, m[1]) };
}

function finDans(t: string, expression: string): number {
  const dernier = expression.split(' ').pop() ?? '';
  const i = t.indexOf(` ${dernier} `);
  return i < 0 ? 0 : i + dernier.length + 1;
}

// ---- montants -------------------------------------------------------------------------

const NOMBRES: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12,
  quinze: 15, vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, cent: 100, mille: 1000,
};
const VALEUR_METAL: Record<string, number> = { or: 100, po: 100, argent: 10, pa: 10, cuivre: 1, cuivres: 1, pc: 1 };

/**
 * Le montant annoncé, en cuivres (1 or = 10 argent = 100 cuivre) : « 3 pièces d'or et 5 d'argent » → 350.
 * Un nombre sans métal compte en cuivres.
 */
export function lireMontant(message: string): number | undefined {
  const t = texteComparable(message);
  const nb = `(\\d+|${Object.keys(NOMBRES).join('|')})`;
  const re = new RegExp(` ${nb} (?:(?:pieces?|piece|sous|ecus?) )?(?:(?:d|de) )?(or|argent|cuivres?|po|pa|pc)(?= )`, 'g');
  let total = 0;
  let trouve = false;
  for (const m of t.matchAll(re)) {
    const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NOMBRES[m[1]];
    total += n * VALEUR_METAL[m[2]];
    trouve = true;
  }
  if (trouve) return total;
  const nu = new RegExp(` (?:pour|a|contre|de|donne|paie|offre|propose|verse) ${nb} (?:pieces? )?(?= )`).exec(t);
  if (nu) return /^\d+$/.test(nu[1]) ? Number(nu[1]) : NOMBRES[nu[1]];
  return undefined;
}

/** 350 → « 3 pièces d’or et 5 pièces d’argent ». */
export function formaterMontant(cuivres: number): string {
  const or = Math.floor(cuivres / 100);
  const ar = Math.floor((cuivres % 100) / 10);
  const cu = cuivres % 10;
  const p: string[] = [];
  if (or) p.push(`${or} pièce${or > 1 ? 's' : ''} d’or`);
  if (ar) p.push(`${ar} pièce${ar > 1 ? 's' : ''} d’argent`);
  if (cu || p.length === 0) p.push(`${cu} cuivre${cu > 1 ? 's' : ''}`);
  return p.length === 1 ? p[0] : `${p.slice(0, -1).join(', ')} et ${p[p.length - 1]}`;
}

// ---- objets ---------------------------------------------------------------------------

const DETERMINANTS = new Set(['le', 'la', 'l', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'ce', 'cet', 'cette', 'ces', 'votre', 'vos', 'notre', 'nos', 'leur', 'leurs', 'quelques']);
const ARRETS = new Set(['a', 'au', 'aux', 'pour', 'contre', 'avec', 'et', 'puis', 'sur', 'dans', 'en', 'chez', 'sous', 'vers', 'si', 'mais', 'ou', 'que', 'qui', 'moi', 'toi', 'lui', 'me', 'te', 'se', 'nous', 'vous', 's', 'il', 'elle', 'je', 'tu', 'y']);

export interface ObjetLu {
  id: string;
  /** Tel que le joueur l'a écrit (« la vieille lanterne »). */
  affiche: string;
}

/** Les objets à portée du joueur (au sol de son lieu, ou sur lui). */
function objetsAPortee(st: State): string[] {
  const ici = st.dbChildKeys(`at.${ID_JOUEUR}`)[0];
  return [...(ici ? st.dbChildKeys(`sol.${ici}`) : []), ...st.dbChildKeys(`possede.${ID_JOUEUR}`)];
}

/** L'objet dont parle le message : d'abord un objet présent qu'il nomme, sinon le groupe nominal qui suit l'expression. */
export function lireObjet(message: string, st: State, apres: number, exclus: readonly string[] = []): ObjetLu | undefined {
  const t = texteComparable(message);
  for (const id of objetsAPortee(st)) {
    const nom = id.replace(/_/g, ' ');
    const i = t.indexOf(` ${nom} `);
    if (i >= 0) {
      const avant = t.slice(0, i).trim().split(' ').pop() ?? '';
      const mots = [...(DETERMINANTS.has(avant) ? [avant] : []), ...nom.split(' ')];
      return { id, affiche: deuxiemePersonne(enClair(message, mots).replace(/^(l|d) /, '$1’')) };
    }
  }
  const mots = t.slice(apres).trim().split(' ').filter(Boolean);
  const exclusNorm = new Set(exclus.flatMap((n) => texteComparable(n).trim().split(' ')));
  let det = '';
  const nom: string[] = [];
  for (const m of mots) {
    if (nom.length === 0 && DETERMINANTS.has(m)) {
      det = m;
      continue;
    }
    if (ARRETS.has(m) || exclusNorm.has(m) || /^\d+$/.test(m) || m in NOMBRES || m in VALEUR_METAL || /^pieces?$/.test(m)) break;
    nom.push(m);
    if (nom.length === 3) break;
  }
  if (nom.length === 0) return undefined;
  const brut = nom.join(' ');
  const affiche = enClair(message, [det, ...nom].filter(Boolean)).replace(/^(l|d) /, '$1’');
  return { id: segment(brut), affiche: deuxiemePersonne(affiche) };
}

/** Les mots tels que le joueur les a écrits (accents compris), retrouvés à partir de leur forme comparable. */
function enClair(message: string, mots: readonly string[]): string {
  const originaux = message.toLowerCase().split(/[^a-z0-9à-öø-ÿ]+/).filter(Boolean);
  const comparables = originaux.map((m) => texteComparable(m).trim());
  for (let i = 0; i + mots.length <= comparables.length; i++) {
    if (mots.every((m, k) => comparables[i + k] === m)) return originaux.slice(i, i + mots.length).join(' ');
  }
  return mots.join(' ');
}

/** « ma lanterne » dit par le joueur devient « ta lanterne » dans le récit. */
function deuxiemePersonne(t: string): string {
  return t.replace(/^(mon|ma|mes) /, (m) => ({ 'mon ': 'ton ', 'ma ': 'ta ', 'mes ': 'tes ' })[m] ?? m);
}

// ---- valeur des choses ---------------------------------------------------------------------

/**
 * Prix courants en cuivres, d'après le lore d'Elyndor (un pain ou une chope : 1 cuivre ; un repas : 3 ;
 * une chambre : 10 ; une journée de travail : 1 argent ; un mois de vie modeste : 1 or) et des ordres de
 * grandeur cohérents avec eux pour l'équipement.
 */
const VALEURS: Record<string, number> = {
  pain: 1, chope: 1, biere: 1, vin: 2, repas: 3, ragout: 3, soupe: 2, chambre: 10, chandelle: 1, bougie: 1, cierge: 1, pomme: 1,
  lanterne: 30, torche: 2, corde: 10, sac: 8, panier: 5, couverture: 15, cape: 40, manteau: 60, bottes: 50, chapeau: 20, vetement: 30,
  couteau: 40, dague: 150, poignard: 150, epee: 1500, hache: 600, arc: 800, fleches: 30, lance: 400, bouclier: 500, armure: 3000, casque: 400,
  marteau: 60, tenailles: 50, pioche: 80, outil: 50, seau: 10, caisse: 15, tonneau: 40, pichet: 8, tabouret: 10, filet: 30,
  potion: 200, remede: 80, herbes: 10, bandage: 5, onguent: 60, parchemin: 20, plume: 5, encre: 15, livre: 150, carte: 60, registre: 100,
  bijou: 500, bague: 400, collier: 600, cheval: 1000, monture: 1000, chariot: 2500, mule: 600,
};
/** Valeur d'une chose sans prix connu : 5 pièces d'argent. */
const VALEUR_PAR_DEFAUT = 50;

/** La valeur de référence d'une offre : l'objet s'il est connu, sinon le prix indicatif de l'acte. */
export function valeurDe(objet: string | undefined, e: EntreeCatalogue): number {
  const mots = (objet ?? '').split('_');
  for (const m of mots) {
    const v = VALEURS[m] ?? VALEURS[m.replace(/s$/, '')];
    if (v !== undefined) return v;
  }
  return e.prixIndicatif ?? VALEUR_PAR_DEFAUT;
}

// ---- comprendre un acte -------------------------------------------------------------------

const EST_QUESTION = /^ (est ce que|est ce qu|tu as|vous avez|t as|tu aurais|vous auriez|combien|y a t il|avez vous|as tu) /;

/** « Louer un logement » → « un logement » : ce sur quoi porte l'acte. */
function complementDe(libelle: string): string {
  const mots = libelle.toLowerCase().split(' ');
  return mots.length > 1 ? mots.slice(1).join(' ') : libelle.toLowerCase();
}

export interface SaisieActe {
  slug: string;
  id: string;
  libelle: string;
  mode: Mode;
  montant?: number;
  objet?: ObjetLu;
}

export interface ComprehensionActe {
  action: GroundedAction | null;
  cible?: string;
  motif?: string;
  saisie: SaisieActe;
}

/** Les modes où l'on s'adresse à quelqu'un. */
const MODES_ADRESSES = new Set<Mode>(['parole', 'requete', 'information', 'influence', 'transaction']);

/** Efface ce que le joueur avait annoncé (à faire avant chaque action et à la fin du tour). */
export function effacerSaisie(st: State): void {
  st.performOutcome(del('saisie'));
}

/** Les paramètres de l'action entrent dans le moteur la première fois qu'elle sert. */
export function installerActe(st: State, e: EntreeCatalogue): void {
  if (st.dbHas(`acte.${e.slug}.famille`)) return;
  for (const o of faitsActe(e)) st.performOutcome(o);
}

function chercher(st: State, pred: (ga: GroundedAction) => boolean): GroundedAction | null {
  return st.possibleActions(ID_JOUEUR).find(pred) ?? null;
}

const lie = (ga: GroundedAction, k: string): string | undefined => {
  const v = ga.bindings.get(k);
  return v === undefined ? undefined : String(v);
};

const NOMS_ROLES: Record<string, string> = {
  marchand: 'un marchand', garde: 'la garde', juge: 'un juge', pretre: 'un prêtre', guerisseur: 'un guérisseur', mage: 'un mage',
  maitresse_guilde: 'la maîtresse de guilde', receptionniste: 'la réception de la Guilde', taverniere: 'la tavernière', forgeronne: 'la forgeronne',
  passeuse: 'une passeuse des Portes Astra', souverain: 'le souverain', fonctionnaire: 'un fonctionnaire', noble: 'un noble', ombre: 'quelqu’un des Ombres', membre_guilde: 'un membre de guilde',
};

function rolesEnClair(roles: readonly string[]): string {
  const n = roles.map((r) => NOMS_ROLES[r] ?? r);
  return n.length <= 1 ? n.join('') : `${n.slice(0, -1).join(', ')} ou ${n[n.length - 1]}`;
}

/** « un juge » → « d’un juge », « la garde » → « de la garde ». */
function deRole(r: string): string {
  if (/^(un|une) /.test(r)) return `d’${r}`;
  if (r.startsWith('le ')) return `du ${r.slice(3)}`;
  return `de ${r}`;
}

/** Pourquoi l'action n'a pas pu se faire. */
function diagnostiquer(st: State, e: EntreeCatalogue, mode: Mode, cible: string | undefined, s: SaisieActe): string {
  if (e.autoriteActeur.length > 0 && !e.autoriteActeur.some((r) => st.dbHas(`role.${ID_JOUEUR}.${r}`))) {
    return `${e.libelle} : c’est le rôle ${deRole(rolesEnClair(e.autoriteActeur))}, pas le tien. Tu peux le lui demander.`;
  }
  if (st.dbHas(`statut.${ID_JOUEUR}.arrete`) && mode === 'tentative') return 'Tu es aux arrêts : règle d’abord ton amende auprès de la garde.';
  const besoinCible = MODES_ADRESSES.has(mode) || (mode === 'tentative' && e.cible === 'personne') || (mode === 'objet' && e.effetObjet === 'donner');
  if (besoinCible && !cible) return 'Il n’y a personne ici à qui t’adresser pour cela.';
  if (e.lieuRequis) {
    const ici = st.dbChildKeys(`at.${ID_JOUEUR}`)[0];
    if (!ici || !st.dbHas(`typelieu.${ici}.${segment(e.lieuRequis)}`)) return `${e.libelle} : il faut être dans un lieu adapté (${e.lieuRequis.replace(/_/g, ' ')}).`;
  }
  const bourse = Number(st.dbChildKeys(`bourse.${ID_JOUEUR}`)[0] ?? 0);
  if (s.montant !== undefined && (e.sens === 'paiement' || e.sens === 'achat') && bourse < s.montant) {
    return `Ta bourse ne suffit pas : tu as ${formaterMontant(bourse)}, il en faudrait ${formaterMontant(s.montant)}.`;
  }
  if (mode === 'objet' || e.sens === 'vente') {
    if (!s.objet) return `${e.libelle} : de quel objet parles-tu ?`;
    const o = s.objet.id;
    if (e.effetObjet === 'prendre') return `Il n’y a pas de ${s.objet.affiche.replace(/^(le|la|les|un|une|des|l’) ?/, '')} à portée de main.`;
    if (['poser', 'donner', 'equiper'].includes(e.effetObjet ?? '') || e.sens === 'vente') {
      if (!st.dbHas(`possede.${ID_JOUEUR}.${o}`)) return `Tu n’as pas ${s.objet.affiche} sur toi.`;
    }
    if (e.effetObjet === 'desequiper' && !st.dbHas(`equipe.${ID_JOUEUR}.${o}`)) return `Tu ne portes pas ${s.objet.affiche}.`;
    if (!st.dbHas(`objet.${o}`)) return `Il n’y a pas ${s.objet.affiche} ici.`;
  }
  return `${e.libelle} : ce n’est pas possible pour l’instant.`;
}

/** Interlocuteur pour un acte : celui que le message nomme, sinon un présent qui a le rôle voulu, sinon la cible par défaut. */
function choisirCible(e: EntreeCatalogue, presents: readonly PnjDescription[], nommee: string | undefined, parDefaut: string | undefined): string | undefined {
  if (nommee) return nommee;
  if (e.roleCible.length > 0) {
    const competent = presents.find((p) => (e.roleCible as readonly string[]).includes(p.role));
    if (competent) return competent.id;
  }
  return parDefaut;
}

/**
 * Comprend un acte du catalogue. Renvoie `null` quand le narrateur doit garder
 * sa propre mécanique (par exemple un achat sans prix annoncé, que la demande
 * et le marchandage du narrateur traitent déjà).
 */
export function comprendreActe(
  r: ActeReconnu,
  message: string,
  st: State,
  desc: DescriptionScene,
  presents: readonly PnjDescription[],
  cibleNommee: string | undefined,
  cibleParDefaut: string | undefined,
): ComprehensionActe | null {
  if (r.entree.famille === 'hors_scene' && r.entree.autoriteActeur.length === 0) {
    const saisie: SaisieActe = { slug: r.entree.slug, id: r.entree.id, libelle: r.entree.libelle, mode: modeDe(r.entree) };
    return { action: null, saisie, motif: `« ${r.entree.libelle} » relève du meneur de jeu, pas d’une action de ton personnage dans la scène : Prax la reconnaît mais ne la joue pas.` };
  }
  let montant = lireMontant(message);
  // « Je donne 5 pièces d'argent » : c'est un versement, pas un objet tendu.
  const e = montant !== undefined && r.entree.effetObjet === 'donner' ? entreeParId('commerce.donner_argent') ?? r.entree : r.entree;
  const mode = modeDe(e);
  const cible = choisirCible(e, presents, cibleNommee, cibleParDefaut);
  const nomsPresents = presents.map((p) => p.nom);
  const objet = lireObjet(message, st, r.fin, nomsPresents);

  // Gestion des offres en cours.
  if (e.sens === 'accepter' || e.sens === 'refuser' || e.sens === 'annuler' || e.sens === 'contre') {
    const gabarit = { accepter: '[Actor] accepte la contre-offre de [Cible] pour [O]', refuser: '[Actor] décline la contre-offre de [Cible]', annuler: '[Actor] retire son offre à [Cible]', contre: '' }[e.sens];
    if (!gabarit) return null; // contre-proposer : c'est marchander, le narrateur s'en charge
    installerActe(st, e);
    const action = chercher(st, (ga) => ga.actionId === gabarit && (!cible || lie(ga, 'Cible') === cible)) ?? chercher(st, (ga) => ga.actionId === gabarit);
    const saisie: SaisieActe = { slug: e.slug, id: e.id, libelle: e.libelle, mode };
    if (!action) return e.sens === 'accepter' ? null : { action: null, cible, saisie, motif: 'Il n’y a pas d’offre en cours à laquelle répondre.' };
    return { action, cible: lie(action, 'Cible'), saisie };
  }

  if (mode === 'transaction' && montant === undefined) {
    // Sans prix annoncé, l'achat et le paiement passent par la demande et le marchandage du narrateur ;
    // seul un acte au prix fixé par le lore (une chambre, un repas), affirmé et non demandé, se propose à ce prix.
    if (e.prixIndicatif === null || EST_QUESTION.test(texteComparable(message)) || message.includes('?')) return null;
    montant = e.prixIndicatif;
  }
  const objetEffectif: ObjetLu | undefined =
    objet ?? (mode === 'transaction' && e.sens === 'achat' ? (e.produit ? { id: segment(e.produit), affiche: e.produit } : { id: 'service', affiche: complementDe(e.libelle) }) : undefined);

  installerActe(st, e);
  effacerSaisie(st);
  if (montant !== undefined) st.performOutcome(insert(`saisie.montant!${montant}`));
  if (objetEffectif) st.performOutcome(insert(`saisie.objet!${objetEffectif.id}`));
  if (mode === 'transaction') {
    const v = valeurDe(objetEffectif?.id, e);
    st.performOutcome(insert(`saisie.valeur!${v}`));
    st.performOutcome(insert(`saisie.plancher!${Math.max(1, Math.round(v / 2))}`));
  }
  const saisie: SaisieActe = { slug: e.slug, id: e.id, libelle: e.libelle, mode, montant, objet: objetEffectif };

  const avecCible = (ga: GroundedAction) => lie(ga, 'Acte') === e.slug && (lie(ga, 'Cible') === undefined || lie(ga, 'Cible') === cible);
  const action = chercher(st, avecCible) ?? chercher(st, (ga) => lie(ga, 'Acte') === e.slug && lie(ga, 'Cible') === undefined);
  if (!action) return { action: null, cible, saisie, motif: diagnostiquer(st, e, mode, cible, saisie) };
  return { action, cible: lie(action, 'Cible'), saisie };
}

/** Le joueur paie : une prestation convenue (requête), ou son amende s'il est aux arrêts. */
export function reglementEnAttente(st: State, message: string, cible: string | undefined): GroundedAction | null {
  const due = chercher(st, (ga) => ga.actionId === '[Actor] règle [Acte] à [Cible]' && (!cible || lie(ga, 'Cible') === cible));
  if (due) return due;
  if (!st.dbHas(`statut.${ID_JOUEUR}.arrete`)) return null;
  // L'amende se règle à la garde : payer quelqu'un d'autre reste un paiement ordinaire.
  if (cible && !st.dbHas(`role.${cible}.garde`)) return null;
  effacerSaisie(st);
  st.performOutcome(insert(`saisie.montant!${lireMontant(message) ?? AMENDE_PAR_DEFAUT}`));
  return chercher(st, (ga) => ga.actionId === '[Actor] règle son amende auprès de [Cible]');
}

/** Amende ordinaire quand le joueur ne dit pas combien il paie (5 pièces d'argent). */
export const AMENDE_PAR_DEFAUT = 50;

// ---- issues : ce que chaque action native raconte ----------------------------------------

export type Issue =
  | 'parole' | 'requete' | 'regle' | 'information' | 'influence' | 'offre' | 'accepteContre' | 'declineContre' | 'retire' | 'offreVente' | 'verse' | 'objet' | 'repos' | 'tentative' | 'amende'
  | 'favorable' | 'froid' | 'replique' | 'encaisse' | 'accorde' | 'condition' | 'refuse' | 'renvoie' | 'renseigne' | 'derobe' | 'cede' | 'resiste'
  | 'vend' | 'contreOffre' | 'insolvable' | 'refuseOffre' | 'achete' | 'refuseAchat' | 'remercieDon' | 'accepteCadeau' | 'refuseCadeau' | 'arrete';

const ISSUES: Array<[RegExp, Issue]> = [
  [/^\[Actor\] adresse \[Acte\] à/, 'parole'],
  [/^\[Actor\] accueille favorablement/, 'favorable'],
  [/^\[Actor\] reste froid/, 'froid'],
  [/^\[Actor\] réplique à \[Acte\]/, 'replique'],
  [/^\[Actor\] encaisse/, 'encaisse'],
  [/^\[Actor\] sollicite/, 'requete'],
  [/^\[Actor\] accorde/, 'accorde'],
  [/contre paiement$/, 'condition'],
  [/^\[Actor\] refuse \[Acte\] à/, 'refuse'],
  [/^\[Actor\] renvoie \[Cible\] vers qui/, 'renvoie'],
  [/^\[Actor\] règle \[Acte\]/, 'regle'],
  [/^\[Actor\] demande \[Acte\]/, 'information'],
  [/^\[Actor\] renseigne/, 'renseigne'],
  [/^\[Actor\] se dérobe/, 'derobe'],
  [/^\[Actor\] tente \[Acte\] sur \[Cible\]$/, 'influence'],
  [/^\[Actor\] cède à/, 'cede'],
  [/^\[Actor\] résiste/, 'resiste'],
  [/^\[Actor\] propose \[Acte\] de \[O\]/, 'offre'],
  [/^\[Actor\] accepte \[Acte\] de \[O\]/, 'vend'],
  [/^\[Actor\] fait une contre-offre/, 'contreOffre'],
  [/^\[Actor\] constate/, 'insolvable'],
  [/^\[Actor\] refuse \[Acte\] de \[O\]/, 'refuseOffre'],
  [/^\[Actor\] accepte la contre-offre/, 'accepteContre'],
  [/^\[Actor\] décline la contre-offre/, 'declineContre'],
  [/^\[Actor\] retire son offre/, 'retire'],
  [/^\[Actor\] propose de céder/, 'offreVente'],
  [/^\[Actor\] achète/, 'achete'],
  [/^\[Actor\] refuse d’acheter/, 'refuseAchat'],
  [/^\[Actor\] verse/, 'verse'],
  [/^\[Actor\] remercie \[Cible\] de son argent/, 'remercieDon'],
  [/^\[Actor\] accepte \[O\] de/, 'accepteCadeau'],
  [/^\[Actor\] refuse \[O\] de/, 'refuseCadeau'],
  [/^\[Actor\] tente \[Acte\]( sur \[Cible\])? \(/, 'tentative'],
  [/^\[Actor\] prend du repos/, 'repos'],
  [/^\[Actor\] arrête \[X\]/, 'arrete'],
  [/^\[Actor\] règle son amende/, 'amende'],
  [/\(\[Acte\]\)$/, 'objet'],
];

export type InfoActe = ActeEvenement & { issue: Issue };

/** Ce qu'une action native de la bibliothèque raconte, lu juste APRÈS qu'elle a été jouée. */
export function infoActe(ga: GroundedAction, st: State): InfoActe | undefined {
  const issue = ISSUES.find(([re]) => re.test(ga.actionId))?.[1];
  if (!issue) return undefined;
  const slug = lie(ga, 'Acte') ?? lie(ga, 'A');
  const e = slug ? entreeParSlug(slug) : undefined;
  const info: InfoActe = { issue, id: e?.id, libelle: e?.libelle };
  const m = lie(ga, 'M') ?? lie(ga, 'P');
  if (m !== undefined) info.montant = Number(m);
  const o = lie(ga, 'O');
  if (o !== undefined) info.objet = o.replace(/_/g, ' ');
  const acteur = lie(ga, 'Actor');
  const cible = lie(ga, 'Cible');
  if (issue === 'contreOffre' && acteur && cible && slug && o) info.montant = Number(st.dbChildKeys(`contre.${acteur}.${cible}.${slug}.${o}`)[0]);
  if (issue === 'condition' && acteur && cible && slug) info.montant = Number(st.dbChildKeys(`du.${cible}.${acteur}.${slug}`)[0]);
  if (issue === 'tentative' && acteur && slug) info.reussi = st.dbHas(`reussi.${acteur}.${slug}`);
  return info;
}

// ---- rendu --------------------------------------------------------------------------------

function remplir(modele: string, ev: EvenementTour): string {
  const a = ev.acte;
  const objetAffiche = a?.objetAffiche;
  return modele
    .replace(/\{cible\}/g, ev.cibleNom ?? 'ton interlocuteur')
    .replace(/\{objet\}/g, objetAffiche ?? a?.objet ?? 'cela')
    .replace(/\{montant\}/g, a?.montant !== undefined ? formaterMontant(a.montant) : 'la somme')
    .replace(/\{destination\}/g, ev.lieuNom ?? 'ta destination')
    .replace(/\{(sujet|offre)\}/g, 'cela')
    .replace(/\{[a-z]+\}/g, '')
    .replace(/(^|\s)de le /g, '$1du ')
    .replace(/(^|\s)de les /g, '$1des ')
    .replace(/(^|\s)à le /g, '$1au ')
    .replace(/(^|\s)à les /g, '$1aux ')
    .replace(/(^|\s)de (un|une) /g, '$1d’$2 ')
    .replace(/(^|\s)de ([aeiouhéè])/gi, '$1d’$2')
    .replace(/\s+([.,])/g, '$1')
    .trim();
}

/** Phrase(s) de l'acte du joueur (deuxième personne). */
export function renduActeJoueur(ev: EvenementTour): string[] {
  const a = ev.acte;
  const e = a?.id ? CATALOGUE.find((x) => x.id === a.id) : undefined;
  if (!a) return [ev.libelle];
  const m = a.montant !== undefined ? formaterMontant(a.montant) : '';
  const base = e?.recitJoueur ? remplir(e.recitJoueur, ev) : `Tu entreprends : ${(a.libelle ?? '').toLowerCase()}.`;
  switch (a.issue) {
    case 'offre':
      return [base, `Ton offre : ${m}.`];
    case 'offreVente':
      return [base, `Ton prix : ${m}.`];
    case 'verse':
      return [base, `Tu lui remets ${m}.`];
    case 'regle':
      return [`Tu règles ce qui était convenu : ${m}.`];
    case 'amende':
      return [`Tu règles ton amende : ${m}.`];
    case 'accepteContre':
      return [`Tu acceptes le prix ${deNomEv(ev)} et tu paies.`];
    case 'declineContre':
      return ['Tu déclines la contre-offre.'];
    case 'retire':
      return ['Tu retires ton offre.'];
    case 'tentative':
      return [base, a.reussi ? (e?.recitReussite ? remplir(e.recitReussite, ev) : 'Tu y parviens.') : e?.recitEchec ? remplir(e.recitEchec, ev) : 'Cela ne marche pas cette fois.'];
    case 'objet':
    case 'repos':
      return [base, ...(e?.recitReussite ? [remplir(e.recitReussite, ev)] : [])];
    default:
      return [base];
  }
}

function deNomEv(ev: EvenementTour): string {
  const n = ev.cibleNom ?? '';
  return /^(le |les )/i.test(n) ? n.replace(/^le /i, 'du ').replace(/^les /i, 'des ') : `de ${n}`;
}

type Choix = (options: readonly string[], cle: string) => string;

/** Réaction d'un PNJ à un acte : une narration, puis une réplique. */
export function renduActePnj(ev: EvenementTour, cle: string, choisir: Choix): { narration: string; replique?: string } {
  const a = ev.acte;
  const n = ev.acteurNom;
  const m = a?.montant !== undefined && Number.isFinite(a.montant) ? formaterMontant(a.montant) : 'ce prix';
  const e = a?.id ? CATALOGUE.find((x) => x.id === a.id) : undefined;
  // Les récits du catalogue parlent de la cible de l'acte du joueur : ici, le PNJ qui réagit.
  const pourPnj: EvenementTour = { ...ev, cibleNom: ev.acteurNom };
  const reussite = e?.recitReussite ? remplir(e.recitReussite, pourPnj) : '';
  const echec = e?.recitEchec ? remplir(e.recitEchec, pourPnj) : '';
  const vers = ev.cible === ID_JOUEUR;
  switch (a?.issue) {
    case 'favorable':
      return { narration: choisir([`${n} accueille cela avec un sourire.`, `Le visage ${deNomEv({ ...ev, cibleNom: n })} s’adoucit.`], cle), replique: choisir(['C’est gentil de ta part.', 'Merci, ça me touche.'], cle + 'l') };
    case 'froid':
      return { narration: choisir([`${n} reste de marbre.`, `${n} ne laisse rien paraître.`], cle), replique: choisir(['Si tu le dis.', 'Hm.'], cle + 'l') };
    case 'replique':
      return { narration: choisir([`${n} ne se laisse pas faire.`, `${n} se redresse.`], cle), replique: choisir(['Fais attention à ce que tu dis.', 'Tu veux vraiment jouer à ça ?'], cle + 'l') };
    case 'encaisse':
      return { narration: choisir([`${n} baisse les yeux sans répondre.`, `${n} encaisse en silence.`], cle) };
    case 'accorde':
      return { narration: reussite || choisir([`${n} acquiesce.`, `${n} hoche la tête.`], cle), replique: choisir(['C’est d’accord.', 'Entendu, je m’en occupe.'], cle + 'l') };
    case 'condition':
      return { narration: choisir([`${n} réfléchit un instant.`, `${n} te jauge.`], cle), replique: `D’accord, mais ce sera ${m}.` };
    case 'refuse':
      return { narration: echec || choisir([`${n} secoue la tête.`, `${n} croise les bras.`], cle), replique: choisir(['Non.', 'N’y compte pas.'], cle + 'l') };
    case 'renvoie': {
      const roles = e?.roleCible ?? [];
      return { narration: choisir([`${n} hausse les épaules.`, `${n} fait un geste vague.`], cle), replique: roles.length ? `Ce n’est pas à moi qu’il faut demander ça. Vois plutôt ${rolesEnClair(roles)}.` : 'Ce n’est pas à moi qu’il faut demander ça.' };
    }
    case 'renseigne':
      return { narration: reussite || choisir([`${n} baisse un peu la voix.`, `${n} réfléchit avant de répondre.`], cle), replique: choisir(['Je vais te dire ce que je sais.', 'Écoute bien.'], cle + 'l') };
    case 'derobe':
      return { narration: echec || choisir([`${n} détourne le regard.`, `${n} hausse les épaules.`], cle), replique: 'Je n’ai rien à te dire là-dessus.' };
    case 'cede':
      return { narration: reussite || choisir([`${n} finit par céder.`, `${n} soupire et baisse la garde.`], cle), replique: 'Très bien… comme tu voudras.' };
    case 'resiste':
      return { narration: echec || choisir([`${n} ne cède pas.`, `${n} soutient ton regard.`], cle), replique: 'N’y compte pas.' };
    case 'vend':
      return { narration: choisir([`${n} accepte l’affaire.`, `${n} empoche les pièces.`], cle), replique: `Marché conclu, pour ${m}.` };
    case 'contreOffre':
      return { narration: choisir([`${n} fait la moue.`, `${n} secoue la tête en souriant.`], cle), replique: `Pas à ce prix. Pour ${m}, c’est d’accord.` };
    case 'insolvable':
      return { narration: `${n} jette un œil à ta bourse.`, replique: 'Tu n’as pas de quoi payer. Reviens avec l’argent.' };
    case 'refuseOffre':
      return { narration: choisir([`${n} secoue la tête.`, `${n} repousse ton offre d’un geste.`], cle), replique: 'Non, pas à ce prix.' };
    case 'achete':
      return { narration: `${n} examine ce que tu proposes.`, replique: `Je te le prends pour ${m}.` };
    case 'refuseAchat':
      return { narration: `${n} examine ce que tu proposes, puis le repousse.`, replique: 'Je n’en veux pas à ce prix.' };
    case 'remercieDon':
      return { narration: choisir([`${n} accepte avec un signe de tête.`, `${n} range les pièces.`], cle), replique: choisir(['Merci, c’est généreux.', 'Je te remercie.'], cle + 'l') };
    case 'accepteCadeau':
      return { narration: `${n} prend ${a?.objet ?? 'ce que tu tends'}.`, replique: choisir(['Pour moi ? Merci.', 'C’est très aimable.'], cle) };
    case 'refuseCadeau':
      return { narration: `${n} repousse ta main.`, replique: 'Garde ça.' };
    case 'arrete':
      return vers
        ? { narration: `${n} t’arrête au nom de la loi !`, replique: 'Tu vas devoir répondre de tes actes. L’amende, ou la cellule.' }
        : { narration: `${n} arrête ${ev.cibleNom ?? 'quelqu’un'}.` };
    default:
      return { narration: ev.libelle };
  }
}

/** Les actes de la bibliothèque à citer dans l'aide quand Prax ne comprend pas. */
export function exemplesBibliotheque(): string {
  return 'acheter ou vendre à un prix (« j’achète la lanterne pour 2 pièces d’argent »), louer, payer, demander un service ou une autorisation, prendre, poser, donner, ouvrir ou examiner un objet, forger, cuisiner, soigner, se cacher, crocheter, prier, se reposer…';
}
