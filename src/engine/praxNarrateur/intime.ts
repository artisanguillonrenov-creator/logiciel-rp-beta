/**
 * Le narrateur Prax et la vie intime adulte (src/prax/vocab/intimacy*.ts).
 *
 * Le module apporte les pratiques : proposer, accepter, refuser, commencer,
 * terminer, retirer son accord, pour chaque portée (un baiser, se tenir la
 * main…). Ce fichier les raccorde au monde du narrateur, sans seconde source
 * de vérité :
 * - éligibilité tirée des faits du narrateur : même lieu, majorité établie,
 *   ni captif, ni aux arrêts, ni immobilisé, et pas de peur entre les deux
 *   (un accord sous la contrainte n'en est pas un) ;
 * - portées permises selon le profil de contenu de l'appareil et le curseur
 *   romance de l'histoire (rien en grand public) ;
 * - le PNJ accepte ou refuse selon ses jauges envers le joueur et ses
 *   préférences, et retire son accord si l'hostilité ou la peur montent ;
 * - récit sobre, sans description : le détail appartient aux personnages.
 */
import type { State } from '../../prax/core/engine';
import type { GroundedAction } from '../../prax/core/perform';
import { Condition, absent, cmp, matches, neq, not_ } from '../../prax/core/query';
import { Desire, Outcome, del, desire, insert, want } from '../../prax/core/types';
import type { PhaseAdulte } from '../../prax/vocab/intimacy';
import { ALL_ADULT_LABELS, ADULT_SCOPE_KIND, adultScopePractices } from '../../prax/vocab/intimacyComplete';
import type { NiveauQuatre, ProfilContenu } from '../../types';
import { normaliser } from './description';
import type { DescriptionScene, PnjDescription } from './types';
import { ID_JOUEUR, LIEU_AILLEURS } from './types';

export type NiveauIntime = 'aucun' | 'tendresse' | 'sensuel' | 'complet';

/** Natures de portées permises à chaque niveau. */
const NATURES: Record<NiveauIntime, readonly string[]> = {
  aucun: [],
  tendresse: ['affection', 'care', 'discussion'],
  sensuel: ['affection', 'care', 'discussion', 'sensual', 'intimacy'],
  complet: ['affection', 'care', 'discussion', 'sensual', 'intimacy', 'sexual'],
};

/** Le niveau d'intimité permis : profil adulte de l'appareil, puis curseur romance de l'histoire. */
export function niveauIntime(profil: ProfilContenu | undefined, romance: NiveauQuatre | undefined): NiveauIntime {
  if (profil !== 'adulte') return 'aucun';
  switch (romance) {
    case 'faible':
      return 'tendresse';
    case 'modere':
      return 'sensuel';
    case 'eleve':
      return 'complet';
    default:
      return 'aucun';
  }
}

/** Seuils de jauges (échelle Prax, ×10) pour qu'un PNJ accepte, selon la nature de la portée. */
const SEUILS: Record<string, { affection: number; confiance: number }> = {
  discussion: { affection: 0, confiance: 0 },
  affection: { affection: 10, confiance: 0 },
  care: { affection: 10, confiance: 0 },
  sensual: { affection: 20, confiance: 10 },
  intimacy: { affection: 20, confiance: 10 },
  sexual: { affection: 25, confiance: 15 },
};

// ---- éligibilité, faits et pratiques -----------------------------------------------------

function memeLieu(a: string, b: string): Condition[] {
  return [matches(`at.${a}!Pi`), matches(`at.${b}!Pi`), neq(b, a), neq('Pi', LIEU_AILLEURS)];
}

/** Sans peur de l'un envers l'autre (une menace fait monter la peur). */
function sansPeur(a: string, b: string): Condition {
  return absent([matches(`${a}.relationship.${b}.peur.score!Fp`), cmp('gte', 'Fp', '20')]);
}

/**
 * Éligibilité de [Actor] et [Other] pour une portée, d'après les faits du narrateur.
 * Seul le joueur propose et commence : un PNJ répond (accepte, refuse), retire son
 * accord ou met fin, mais ne prend jamais l'initiative — et le planificateur n'a
 * pas à explorer des dizaines de propositions pour chaque PNJ.
 */
export function eligibiliteNarrateur(scope: string, phase: PhaseAdulte): Condition[] {
  const libre = (x: string): Condition[] => [not_(`statut.${x}.captif`), not_(`statut.${x}.arrete`), not_(`statut.${x}.immobilise`)];
  return [
    ...(phase === 'accepter' ? [] : [matches('estjoueur.Actor')]),
    matches(`praxAdult.permis.${scope}`),
    ...memeLieu('Actor', 'Other'),
    matches('majeur.Actor'),
    matches('majeur.Other'),
    ...libre('Actor'),
    ...libre('Other'),
    sansPeur('Actor', 'Other'),
    sansPeur('Other', 'Actor'),
  ];
}

export function pratiquesIntimes() {
  return adultScopePractices(eligibiliteNarrateur);
}

/** Instances des pratiques (à poser une fois par partie). */
export const INSTANCES_INTIMES = ['practice.praxAdultInteractions.world', 'practice.praxAdultExpanded.world'];

/** Faits posés à chaque tour : portées permises par les réglages, nature et seuils. */
export function faitsIntimes(niveau: NiveauIntime): Outcome[] {
  const out: Outcome[] = [del('praxAdult.permis')];
  const natures = NATURES[niveau];
  for (const [scope, nature] of Object.entries(ADULT_SCOPE_KIND)) {
    out.push(insert(`praxAdult.nature.${scope}!${nature}`));
    if (natures.includes(nature)) out.push(insert(`praxAdult.permis.${scope}`));
  }
  for (const [nature, s] of Object.entries(SEUILS)) {
    out.push(insert(`praxAdult.seuil.${nature}.affection!${s.affection}`), insert(`praxAdult.seuil.${nature}.confiance!${s.confiance}`));
  }
  return out;
}

const ENFANCE = /\b(enfant|enfants|gamin|gamine|fillette|garcon|garconnet|petit|petite|bebe|nourrisson|ado|adolescent|adolescente|jeune fille|jeune garcon|eleve|ecolier|ecoliere|pupille|mineur|mineure)\b/;
const ADULTE = /\b(homme|femme|dame|monsieur|madame|veuve|veuf|vieil|vieille|vieux|ivrogne|aubergiste|marin|soldat|soldate|mere|pere|epouse|epoux|mari|guerriere|guerrier|chevalier|mercenaire|voyageur|voyageuse|marchande|noble|courtisan|courtisane|pretresse|pretre)\b/;

/**
 * La majorité est-elle établie ? Oui pour les rôles officiels et les métiers
 * d'adulte ; pour un simple habitant, seulement si son nom le dit (« une femme »,
 * « un marin ») ; jamais si quoi que ce soit évoque l'enfance.
 */
export function majeurEtabli(p: PnjDescription): boolean {
  const n = normaliser(`${p.nom} ${p.libelleRole ?? ''}`);
  if (ENFANCE.test(n)) return false;
  if (p.role === 'captif') return false;
  if (p.role !== 'habitant') return true;
  return ADULTE.test(n);
}

// ---- motivations des PNJ ---------------------------------------------------------------------

export function motivationsIntimes(): Desire[] {
  const d = (nom: string, conds: Condition[], u: number): Desire => desire(`intime-${nom}`, want(conds, u));
  const score = (axe: string, op: 'lt' | 'gte', n: string, v: string): Condition[] => [matches(`Owner.relationship.X.${axe}.score!${v}`), cmp(op, v, n)];
  return [
    // Une proposition appelle une réponse.
    d('proposition-en-suspens', [matches('praxAdult.offer.X.Owner.S')], -2),
    // Accepter quand les jauges le permettent, et seulement alors.
    d('accord-voulu', [
      matches('praxAdult.agree.Owner.X.S'),
      matches('praxAdult.nature.S!K'),
      matches('praxAdult.seuil.K.affection!Na'),
      matches('praxAdult.seuil.K.confiance!Nc'),
      ...score('affection', 'gte', 'Na', 'Af'),
      ...score('confiance', 'gte', 'Nc', 'Co'),
      ...score('hostilite', 'lt', '10', 'Ho'),
      ...score('peur', 'lt', '20', 'Pe'),
      // Une préférence « dislike » (setAdultPreference) empêche d'accepter, quelles que soient les jauges.
      not_('praxAdult.mind.Owner.preference.S!dislike'),
    ], 6),
    // Refuser est toujours légitime ; c'est la réponse quand les jauges ne suffisent pas.
    d('refus', [matches('praxAdult.refusal.Owner.X.S')], 3),
    // Retirer son accord si l'hostilité ou la peur montent.
    d('retrait-hostile', [matches('praxAdult.withdrawal.Owner.X.S'), ...score('hostilite', 'gte', '10', 'Ho')], 8),
    d('retrait-peur', [matches('praxAdult.withdrawal.Owner.X.S'), ...score('peur', 'gte', '20', 'Pe')], 8),
  ];
}

// ---- compréhension ------------------------------------------------------------------------------

/** Tournures françaises → portée. L'ordre compte : la plus précise d'abord. */
const PORTEES: Array<[RegExp, string]> = [
  [/\b(baiser sur le front|embrasse\w* (sur )?le front)\b/, 'forehead_kiss'],
  [/\b(bise|baiser sur la joue|embrasse\w* (sur )?la joue)\b/, 'cheek_kiss'],
  [/\b(long baiser|baiser langoureux)\b/, 'long_kiss'],
  [/\b(baisers sensuels)\b/, 'sensual_kissing'],
  [/\b(un baiser|embrass\w*)\b/, 'kiss'],
  [/\b(prend\w* (sa|ta|la) main|ten\w* (sa|ta|la) main|main dans la main|se tenir la main)\b/, 'holding_hands'],
  [/\b(dans (mes|tes|ses) bras|enlac\w*|etrein\w*|etreinte|calin\w*)\b/, 'embrace'],
  [/\b(blotti\w*)\b/, 'cuddle'],
  [/\b(caress\w*)\b/, 'caress'],
  [/\b(massage|mass(e|er|es)\b)/, 'massage'],
  [/\b(danse\w* avec (toi|vous|elle|lui)|une danse)\b/, 'slow_dance'],
  [/\b(partag\w* (un|mon|ton|le) lit|dormir avec (toi|vous|moi))\b/, 'shared_bed'],
  [/\b(nous reposer ensemble|se reposer ensemble)\b/, 'rest_together'],
  [/\b(endroit (plus )?(tranquille|intime|discret)|a l ecart|en prive|plus d intimite)\b/, 'private_retreat'],
  [/\b(parl\w* de (protection|contraception)|discut\w* (de )?(protection|contraception))\b/, 'discuss_protection'],
  [/\b(parl\w*|discut\w*|clarifi\w*) (de |des )?(nos |tes |mes )?limites\b/, 'discuss_boundaries'],
  [/\b(parl\w*|discut\w*|partag\w*) (de |des )?(nos |tes |mes )?preferences\b/, 'discuss_preferences'],
  [/\b(fidelite|exclusivite)\b/, 'discuss_exclusivity'],
  [/\b(faire l amour|coucher avec|nuit ensemble)\b/, 'mutual_intimacy'],
  [/\b(rapport oral)\b/, 'oral'],
  [/\b(rapport vaginal)\b/, 'vaginal'],
  [/\b(rapport anal)\b/, 'anal'],
];

const RETRAIT = /\b(stop|arrete|arretons|arretez|je ne veux plus|je ne veux pas|je change d avis|je retire mon accord|non finalement)\b/;
const FIN = /\b(on termine|terminons|c etait bien|on en reste la|restons en la)\b/;
const DEBUT = /\b(on commence|commencons|allons y|viens|d accord on y va)\b/;

export function porteeDe(texte: string): string | undefined {
  return PORTEES.find(([re]) => re.test(texte))?.[1];
}

export interface ComprehensionIntime {
  action: GroundedAction | null;
  cible: string;
  motif?: string;
}

/** L'identifiant exact de l'action du module pour une phase et une portée. */
function gabarit(prefixe: string, scope: string): string {
  const label = ALL_ADULT_LABELS[scope];
  const suite = prefixe === 'proposer' ? 'à [Other]' : prefixe === 'accepter' || prefixe === 'refuser' ? 'proposé par [Other]' : 'avec [Other]';
  return `[Actor]: ${prefixe} ${label} ${suite}`;
}

function trouver(st: State, prefixe: string, scope: string, autre: string): GroundedAction | null {
  const id = gabarit(prefixe, scope);
  return st.possibleActions(ID_JOUEUR).find((ga) => ga.actionId === id && String(ga.bindings.get('Other')) === autre) ?? null;
}

/** Portées en cours entre le joueur et la cible (proposée, acceptée, commencée). */
function enCours(st: State, cible: string, quoi: 'offer' | 'agree' | 'active'): string[] {
  const a = quoi === 'agree' ? st.dbChildKeys(`praxAdult.agree.${cible}.${ID_JOUEUR}`) : st.dbChildKeys(`praxAdult.${quoi}.${ID_JOUEUR}.${cible}`);
  return a;
}

function libre(st: State, id: string): boolean {
  return !['captif', 'arrete', 'immobilise'].some((s) => st.dbHas(`statut.${id}.${s}`));
}

function peur(st: State, a: string, b: string): number {
  return Number(st.dbChildKeys(`${a}.relationship.${b}.peur.score`)[0] ?? 0);
}

/**
 * Le message relève-t-il de l'intimité, et quelle action du module joue-t-il ?
 * `null` : rien d'intime dans le message (le narrateur continue normalement).
 */
export function comprendreIntime(texte: string, st: State, desc: DescriptionScene, cible: string | undefined, niveau: NiveauIntime): ComprehensionIntime | null {
  const scopeDit = porteeDe(texte);
  const enCoursAvec = cible ? [...enCours(st, cible, 'active'), ...enCours(st, cible, 'agree'), ...enCours(st, cible, 'offer')] : [];
  // Retrait ou fin : sur ce qui est en cours avec l'interlocuteur.
  if (cible && enCoursAvec.length > 0 && (RETRAIT.test(texte) || FIN.test(texte))) {
    const scope = scopeDit && enCoursAvec.includes(scopeDit) ? scopeDit : enCoursAvec[0];
    const actif = st.dbHas(`praxAdult.active.${ID_JOUEUR}.${cible}.${scope}`);
    const action = FIN.test(texte) && actif ? trouver(st, 'terminer', scope, cible) : trouver(st, 'retirer son accord pour', scope, cible);
    if (action) return { action, cible };
  }
  if (!scopeDit) {
    // « On commence » après un accord.
    if (cible && DEBUT.test(texte)) {
      const accordee = enCours(st, cible, 'agree').find((s) => st.dbHas(`praxAdult.agree.${ID_JOUEUR}.${cible}.${s}`) && !st.dbHas(`praxAdult.active.${ID_JOUEUR}.${cible}.${s}`));
      if (accordee) {
        const action = trouver(st, 'commencer', accordee, cible);
        if (action) return { action, cible };
      }
    }
    return null;
  }
  if (niveau === 'aucun') return { action: null, cible: cible ?? '', motif: 'Les scènes intimes sont désactivées pour ce profil de contenu ou cette histoire (curseur romance).' };
  if (!st.dbHas(`praxAdult.permis.${scopeDit}`)) return { action: null, cible: cible ?? '', motif: 'Cela dépasse le niveau de romance choisi pour cette histoire.' };
  if (!cible) return { action: null, cible: '', motif: 'Il n’y a personne ici avec qui partager cela.' };
  const nom = desc.pnj.find((p) => p.id === cible)?.nom ?? cible;
  // Déjà accepté des deux côtés : c'est le moment de commencer.
  if (st.dbHas(`praxAdult.agree.${cible}.${ID_JOUEUR}.${scopeDit}`) && st.dbHas(`praxAdult.agree.${ID_JOUEUR}.${cible}.${scopeDit}`)) {
    const action = trouver(st, 'commencer', scopeDit, cible);
    if (action) return { action, cible };
    if (st.dbHas(`praxAdult.active.${ID_JOUEUR}.${cible}.${scopeDit}`)) return { action: null, cible, motif: 'C’est déjà en cours.' };
  }
  const action = trouver(st, 'proposer', scopeDit, cible);
  if (action) return { action, cible };
  // Pourquoi pas : on le dit, sans jamais deviner l'accord de l'autre.
  let motif: string;
  if (!st.dbHas(`majeur.${cible}`)) motif = `Prax ne connaît pas l’âge de ${nom} : rien d’intime sans majorité établie.`;
  else if (!libre(st, cible) || !libre(st, ID_JOUEUR)) motif = `${nom} n’est pas libre de consentir : c’est impossible.`;
  else if (peur(st, cible, ID_JOUEUR) >= 20 || peur(st, ID_JOUEUR, cible) >= 20) motif = `${nom} a peur : un accord sous la contrainte n’en est pas un.`;
  else if (st.dbHas(`praxAdult.refusal.${cible}.${ID_JOUEUR}.${scopeDit}`)) motif = `${nom} a déjà refusé ; sa décision est respectée.`;
  else if (st.dbHas(`praxAdult.offer.${ID_JOUEUR}.${cible}.${scopeDit}`)) motif = 'Ta proposition attend encore sa réponse.';
  else if (st.dbHas(`praxAdult.person.${cible}.forbid.${scopeDit}`)) motif = `${nom} a posé cette limite.`;
  else motif = 'Ce n’est pas possible pour l’instant.';
  return { action: null, cible, motif };
}

/** Le joueur change de lieu : propositions, accords et refus en cours avec lui sont levés. */
export function leverAccordsDuJoueur(st: State): void {
  for (const quoi of ['offer', 'agree', 'active', 'refusal']) {
    for (const autre of st.dbChildKeys(`praxAdult.${quoi}.${ID_JOUEUR}`)) st.performOutcome(del(`praxAdult.${quoi}.${ID_JOUEUR}.${autre}`));
    for (const autre of st.dbChildKeys(`praxAdult.${quoi}`)) if (autre !== ID_JOUEUR) st.performOutcome(del(`praxAdult.${quoi}.${autre}.${ID_JOUEUR}`));
  }
}

// ---- récit ------------------------------------------------------------------------------------

export type PhaseIntime = 'proposer' | 'accepter' | 'refuser' | 'commencer' | 'terminer' | 'retirer';

export interface InfoIntime {
  phase: PhaseIntime;
  label: string;
}

const PHASES: Array<[RegExp, PhaseIntime]> = [
  [/^\[Actor\]: proposer (.+) à \[Other\]$/, 'proposer'],
  [/^\[Actor\]: accepter (.+) proposé par \[Other\]$/, 'accepter'],
  [/^\[Actor\]: refuser (.+) proposé par \[Other\]$/, 'refuser'],
  [/^\[Actor\]: commencer (.+) avec \[Other\]$/, 'commencer'],
  [/^\[Actor\]: terminer (.+) avec \[Other\]$/, 'terminer'],
  [/^\[Actor\]: retirer son accord pour (.+) avec \[Other\]$/, 'retirer'],
];

export function infoIntime(actionId: string): InfoIntime | undefined {
  for (const [re, phase] of PHASES) {
    const m = re.exec(actionId);
    if (m) return { phase, label: m[1] };
  }
  return undefined;
}

/** « se tenir la main » se propose tel quel ; « un baiser » aussi. */
export function renduIntimeJoueur(i: InfoIntime, cibleNom: string): string {
  switch (i.phase) {
    case 'proposer':
      return `Tu proposes à ${cibleNom} : ${i.label}.`;
    case 'commencer':
      return `${cibleNom} et toi, vous y venez : ${i.label}. Le détail vous appartient.`;
    case 'terminer':
      return `Vous en restez là : ${i.label} prend fin.`;
    case 'retirer':
      return 'Tu retires ton accord : tout s’arrête.';
    default:
      return `Tu réponds à ${cibleNom}.`;
  }
}

export function renduIntimePnj(i: InfoIntime, acteurNom: string): string[] {
  switch (i.phase) {
    case 'accepter':
      return [`${acteurNom} accepte.`];
    case 'refuser':
      return [`${acteurNom} refuse. Sa décision est respectée.`];
    case 'retirer':
      return [`${acteurNom} retire son accord : tout s’arrête, et sa décision est respectée.`];
    case 'terminer':
      return [`${acteurNom} y met fin : ${i.label} s’arrête là.`];
    case 'commencer':
      return [`${acteurNom} et toi, vous y venez : ${i.label}. Le détail vous appartient.`];
    default:
      return [`${acteurNom} propose : ${i.label}.`];
  }
}
