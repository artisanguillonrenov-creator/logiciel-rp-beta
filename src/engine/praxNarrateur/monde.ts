/**
 * Le monde de Prax pour une scène d'Elyndor.
 *
 * Construit à chaque tour à partir de la description de la scène (distribution,
 * lieux, sujets) : les actions possibles, les motivations générales des PNJ,
 * la réputation dérivée des témoignages et la propagation des nouvelles.
 * Tout passe par le vocabulaire social de Prax (relations, émotions, témoins,
 * rumeurs, réputation) ; aucun texte libre n'entre dans le moteur.
 *
 * Conventions des faits :
 * - `personnage.X`, `pnj.X`, `estjoueur.joueur`, `role.X.R`
 * - `at.X!Lieu`, `lieu.L`, `sujet.S`, `sait.X.S`
 * - relations du modèle de base : `X.relationship.Y.<axe>.score!N` (échelle
 *   de l'application × 10, donc -30..30 au départ)
 * - réactions en attente : `attente.<qui doit réagir>.<envers qui>.<genre>`
 * - faits « fraîchement faits » (`insertFor 1`) : ils comptent pour les
 *   motivations pendant le tour où ils arrivent, puis s'effacent.
 */
import { State } from '../../prax/core/engine';
import { Condition, absent, cmp, matches, neq, not_ } from '../../prax/core/query';
import { SEED_BOUNDS, draw } from '../../prax/core/rng';
import { Action, Character, Desire, Outcome, Practice, action, character, del, desire, holds, insert, insertFor, practice, want } from '../../prax/core/types';
import { adjustScore, coreFns } from '../../prax/vocab/coreModel';
import { obligedClose } from '../../prax/vocab/deontic';
import { AFRAID, ANGRY, feelTowardFor, feelingToward, unfeelToward } from '../../prax/vocab/emotion';
import { standing } from '../../prax/vocab/repute';
import { gossip } from '../../prax/vocab/rumor';
import { CoPresence, observable, saw, witnessed } from '../../prax/vocab/witness';
import { SUJETS } from './sujets';
import { DescriptionScene, ID_JOUEUR, LIEU_AILLEURS } from './types';

export const AXES = ['confiance', 'respect', 'peur', 'affection', 'hostilite'] as const;
export type Axe = (typeof AXES)[number];

/** Les rôles qui accueillent spontanément un visiteur. */
const ROLES_ACCUEIL = new Set(['receptionniste', 'taverniere', 'forgeronne', 'passeuse', 'marchand']);

const together: CoPresence = [matches('at.Actor!P'), matches('at.Witness!P')];

function ici(a: string, b: string): Condition[] {
  return [matches(`at.${a}!P`), matches(`at.${b}!P`), neq(b, a), neq('P', LIEU_AILLEURS)];
}

function score(a: string, b: string, axe: Axe, op: 'lt' | 'lte' | 'gt' | 'gte', n: number, v: string): Condition[] {
  return [matches(`${a}.relationship.${b}.${axe}.score!${v}`), cmp(op, v, String(n))];
}

const joueurSeul: Condition = matches('estjoueur.Actor');

// ---- actions --------------------------------------------------------------------

function actions(): Action[] {
  const salut: Action[] = [
    action('[Actor] salue [Cible]', [...ici('Actor', 'Cible'), matches('personnage.Cible'), not_('salue.Actor.Cible')], [
      insert('salue.Actor.Cible'),
      insert('attente.Cible.Actor.salut'),
      adjustScore('Cible', 'Actor', 'affection', 2, 'salut'),
    ]),
    action('[Actor] rend son salut à [Cible]', [matches('attente.Actor.Cible.salut')], [
      del('attente.Actor.Cible.salut'),
      insert('salue.Actor.Cible'),
      insertFor(1, 'courtois.Actor.Cible'),
    ]),
    action('[Actor] accueille [Cible]', [...ici('Actor', 'Cible'), matches('role.Actor.accueil'), matches('estjoueur.Cible'), not_('accueilli.Actor.Cible')], [
      insert('accueilli.Actor.Cible'),
      insert('salue.Actor.Cible'),
    ]),
  ];

  const parole: Action[] = [
    action('[Actor] engage la conversation avec [Cible]', [joueurSeul, ...ici('Actor', 'Cible'), matches('pnj.Cible')], [
      insert('attente.Cible.Actor.parole'),
    ]),
    action('[Actor] répond aimablement à [Cible]', [matches('attente.Actor.Cible.parole')], [
      del('attente.Actor.Cible.parole'),
      insertFor(1, 'aimable.Actor.Cible'),
    ]),
    action('[Actor] rabroue [Cible]', [matches('attente.Actor.Cible.parole')], [del('attente.Actor.Cible.parole'), insertFor(1, 'rabroue.Actor.Cible')]),
    action('[Actor] interroge [Cible] sur [Sujet]', [joueurSeul, ...ici('Actor', 'Cible'), matches('pnj.Cible'), matches('sujet.Sujet')], [
      insert('attente.Cible.Actor.question.Sujet'),
    ]),
    action('[Actor] répond à [Cible] au sujet de [Sujet]', [matches('attente.Actor.Cible.question.Sujet'), matches('sait.Actor.Sujet')], [
      del('attente.Actor.Cible.question.Sujet'),
      insert('sait.Cible.Sujet'),
      insertFor(1, 'repondu.Actor.Cible.Sujet'),
    ]),
    action('[Actor] élude la question de [Cible] sur [Sujet]', [matches('attente.Actor.Cible.question.Sujet')], [
      del('attente.Actor.Cible.question.Sujet'),
      insertFor(1, 'elude.Actor.Cible.Sujet'),
    ]),
    action('[Actor] avoue tout ignorer de [Sujet] devant [Cible]', [matches('attente.Actor.Cible.question.Sujet'), not_('sait.Actor.Sujet')], [
      del('attente.Actor.Cible.question.Sujet'),
      insertFor(1, 'ignore.Actor.Cible.Sujet'),
    ]),
    action('[Actor] complimente [Cible]', [joueurSeul, ...ici('Actor', 'Cible'), matches('pnj.Cible')], [
      insert('attente.Cible.Actor.merci'),
      adjustScore('Cible', 'Actor', 'affection', 3, 'compliment'),
    ]),
    action('[Actor] remercie [Cible]', [matches('attente.Actor.Cible.merci')], [del('attente.Actor.Cible.merci'), insertFor(1, 'remercie.Actor.Cible')]),
    action('[Actor] ignore [Cible]', [matches('attente.Actor.Cible.Genre')], [del('attente.Actor.Cible'), insertFor(1, 'snobe.Actor.Cible')]),
  ];

  const hostilite: Action[] = [
    observable(
      together,
      'menace.Actor.Cible',
      action('[Actor] menace [Cible]', [...ici('Actor', 'Cible'), matches('personnage.Cible')], [
        insertFor(1, 'menace.Actor.Cible'),
        insert('attente.Cible.Actor.menace'),
        adjustScore('Cible', 'Actor', 'peur', 10, 'menace'),
        adjustScore('Cible', 'Actor', 'hostilite', 10, 'menace'),
        feelTowardFor(3, 'Cible', AFRAID, 'Actor'),
      ]),
    ),
    action('[Actor] cède devant [Cible]', [matches('attente.Actor.Cible.menace')], [
      del('attente.Actor.Cible.menace'),
      insertFor(1, 'cede.Actor.Cible'),
    ]),
    action('[Actor] tient tête à [Cible]', [matches('attente.Actor.Cible.menace')], [
      del('attente.Actor.Cible.menace'),
      insertFor(1, 'defie.Actor.Cible'),
      adjustScore('Actor', 'Cible', 'hostilite', 5, 'defi'),
    ]),
    observable(
      together,
      'insulte.Actor.Cible',
      action('[Actor] insulte [Cible]', [...ici('Actor', 'Cible'), matches('personnage.Cible'), not_('attente.Actor.Cible.insulte')], [
        insertFor(1, 'insulte.Actor.Cible'),
        insert('attente.Cible.Actor.insulte'),
        adjustScore('Cible', 'Actor', 'hostilite', 10, 'insulte'),
        adjustScore('Cible', 'Actor', 'affection', -10, 'insulte'),
        feelTowardFor(3, 'Cible', ANGRY, 'Actor'),
      ]),
    ),
    observable(
      together,
      'insulte.Actor.Cible',
      action('[Actor] rend l’insulte à [Cible]', [matches('attente.Actor.Cible.insulte'), ...ici('Actor', 'Cible')], [
        del('attente.Actor.Cible.insulte'),
        insertFor(1, 'insulte.Actor.Cible'),
        unfeelToward('Actor', ANGRY, 'Cible'),
        adjustScore('Cible', 'Actor', 'hostilite', 5, 'insulte'),
      ]),
    ),
    observable(
      together,
      'attaque.Actor.Cible',
      action('[Actor] attaque [Cible]', [...ici('Actor', 'Cible'), matches('personnage.Cible')], [
        insertFor(1, 'attaque.Actor.Cible'),
        insert('blesse.Cible'),
        insert('attente.Cible.Actor.attaque'),
        adjustScore('Cible', 'Actor', 'hostilite', 20, 'attaque'),
        adjustScore('Cible', 'Actor', 'peur', 10, 'attaque'),
        feelTowardFor(4, 'Cible', AFRAID, 'Actor'),
        feelTowardFor(4, 'Cible', ANGRY, 'Actor'),
      ]),
    ),
    observable(
      together,
      'riposte.Actor.Cible',
      action('[Actor] riposte contre [Cible]', [matches('attente.Actor.Cible.attaque'), ...ici('Actor', 'Cible')], [
        del('attente.Actor.Cible.attaque'),
        insertFor(1, 'riposte.Actor.Cible'),
        insert('blesse.Cible'),
        unfeelToward('Actor', ANGRY, 'Cible'),
      ]),
    ),
    action('[Actor] implore [Cible] d’arrêter', [matches('attente.Actor.Cible.attaque')], [del('attente.Actor.Cible.attaque'), insertFor(1, 'implore.Actor.Cible')]),
    action('[Actor] s’enfuit', [matches('pnj.Actor'), matches('at.Actor!P'), neq('P', LIEU_AILLEURS)], [insert(`at.Actor!${LIEU_AILLEURS}`), del('attente.Actor')]),
    action(
      '[Actor] s’interpose entre [Agresseur] et [Victime]',
      [saw('Actor', 'attaque.Agresseur.Victime'), ...ici('Actor', 'Agresseur'), matches('at.Victime!P'), neq('Victime', 'Actor'), not_('interpose.Actor.Agresseur')],
      [insert('interpose.Actor.Agresseur'), adjustScore('Actor', 'Agresseur', 'hostilite', 10, 'protection')],
    ),
  ];

  const larcin: Action[] = [
    action('[Actor] vole [Cible]', [joueurSeul, ...ici('Actor', 'Cible'), matches('pnj.Cible'), not_('vole.Actor.Cible')], [
      insert('vole.Actor.Cible'),
      // Un larcin n'est pas toujours remarqué : une chance sur deux.
      ...draw(1, 2, [], [witnessed(together, 'vole.Actor.Cible')]),
    ]),
    action('[Actor] accuse [Voleur] de vol', [saw('Actor', 'vole.Voleur.V'), ...ici('Actor', 'Voleur'), not_('accuse.Actor.Voleur')], [
      insert('accuse.Actor.Voleur'),
      adjustScore('Actor', 'Voleur', 'confiance', -10, 'vol'),
    ]),
    action('[Actor] se méfie de [X]', [matches('regards.Actor.X.Etiquette'), not_('mefiant.Actor.X')], [
      insert('mefiant.Actor.X'),
      adjustScore('Actor', 'X', 'confiance', -10, 'reputation'),
    ]),
  ];

  const bienfaits: Action[] = [
    action('[Actor] propose son aide à [Cible]', [joueurSeul, ...ici('Actor', 'Cible'), matches('pnj.Cible')], [
      insert('attente.Cible.Actor.merci'),
      insert('doit.Cible.Actor'),
      adjustScore('Cible', 'Actor', 'affection', 5, 'aide'),
      adjustScore('Cible', 'Actor', 'confiance', 5, 'aide'),
    ]),
    action('[Actor] rend service à [Cible]', [matches('doit.Actor.Cible'), ...ici('Actor', 'Cible'), not_('attente.Actor.Cible.merci')], [
      del('doit.Actor.Cible'),
      insertFor(1, 'service.Actor.Cible'),
    ]),
    action('[Actor] offre de l’argent à [Cible]', [joueurSeul, ...ici('Actor', 'Cible'), matches('pnj.Cible')], [
      insert('attente.Cible.Actor.merci'),
      adjustScore('Cible', 'Actor', 'confiance', 10, 'argent'),
    ]),
    action('[Actor] présente ses excuses à [Cible]', [joueurSeul, ...ici('Actor', 'Cible'), matches('pnj.Cible')], [insert('attente.Cible.Actor.excuses')]),
    action('[Actor] assure [Cible] qu’il n’y a rien à pardonner', [
      matches('attente.Actor.Cible.excuses'),
      ...score('Actor', 'Cible', 'hostilite', 'lte', 0, 'H'),
      absent([feelingToward('Actor', ANGRY, 'Cible')]),
    ], [del('attente.Actor.Cible.excuses'), insertFor(1, 'rassure.Actor.Cible')]),
    action('[Actor] accepte les excuses de [Cible]', [matches('attente.Actor.Cible.excuses'), not_('rassure.Actor.Cible')], [
      del('attente.Actor.Cible.excuses'),
      adjustScore('Actor', 'Cible', 'hostilite', -10, 'excuses'),
      unfeelToward('Actor', ANGRY, 'Cible'),
      insertFor(1, 'pardonne.Actor.Cible'),
    ]),
    action('[Actor] refuse les excuses de [Cible]', [matches('attente.Actor.Cible.excuses')], [del('attente.Actor.Cible.excuses'), insertFor(1, 'refuse.Actor.Cible')]),
  ];

  const nouvelles: Action[] = [
    gossip(together, [], 'vole.Voleur.Victime', '[Actor] raconte à [Hearer] que [Voleur] a volé [Victime]'),
    gossip(together, [], 'attaque.Agresseur.Victime', '[Actor] raconte à [Hearer] que [Agresseur] a attaqué [Victime]'),
    gossip(together, [], 'menace.Auteur.Victime', '[Actor] raconte à [Hearer] que [Auteur] a menacé [Victime]'),
  ];

  const mouvement: Action[] = [
    action('[Actor] se rend à [Lieu]', [joueurSeul, matches('at.Actor!P'), matches('lieu.Lieu'), neq('Lieu', 'P')], [insert('at.Actor!Lieu')]),
    action('[Actor] (attend)', [matches('personnage.Actor')]),
  ];

  return [...salut, ...parole, ...hostilite, ...larcin, ...bienfaits, ...nouvelles, ...mouvement];
}

// ---- motivations ------------------------------------------------------------------

/** Les motivations communes à tous les PNJ (Owner = le PNJ). Une par désir. */
function motivations(): Desire[] {
  const d = (nom: string, conds: Condition[], u: number): Desire => desire(nom, want(conds, u));
  return [
    // Politesse et conversation.
    d('courtoisie', [matches('attente.Owner.X.salut')], -2),
    d('courtoisie-faite', [matches('courtois.Owner.X'), ...score('Owner', 'X', 'hostilite', 'lt', 20, 'H')], 1),
    d('accueil', [matches('accueilli.Owner.X')], 2),
    d('parole-en-suspens', [matches('attente.Owner.X.parole')], -2),
    d('amabilite', [matches('aimable.Owner.X'), ...score('Owner', 'X', 'hostilite', 'lt', 20, 'H')], 1),
    d('rudesse', [matches('rabroue.Owner.X'), ...score('Owner', 'X', 'hostilite', 'gte', 20, 'H')], 2),
    // Questions : on partage avec qui on ne se méfie pas.
    d('question-en-suspens', [matches('attente.Owner.X.question.S')], -2),
    d('partage', [matches('repondu.Owner.X.S'), ...score('Owner', 'X', 'confiance', 'gte', 0, 'C'), ...score('Owner', 'X', 'hostilite', 'lt', 20, 'H')], 3),
    d('mefiance', [matches('repondu.Owner.X.S'), ...score('Owner', 'X', 'confiance', 'lt', 0, 'C')], -4),
    d('franchise', [matches('ignore.Owner.X.S')], 1),
    // Gratitude.
    d('merci-en-suspens', [matches('attente.Owner.X.merci')], -1),
    d('reconnaissance', [matches('remercie.Owner.X'), ...score('Owner', 'X', 'hostilite', 'lt', 20, 'H')], 1),
    d('dette-morale', [matches('doit.Owner.X')], -1),
    d('mepris', [matches('snobe.Owner.X'), ...score('Owner', 'X', 'hostilite', 'gte', 20, 'H')], 2),
    d('impolitesse', [matches('snobe.Owner.X'), ...score('Owner', 'X', 'hostilite', 'lt', 20, 'H')], -1),
    // Menaces.
    d('menace-en-suspens', [matches('attente.Owner.X.menace')], -5),
    d('prudence', [matches('defie.Owner.X'), ...score('Owner', 'X', 'peur', 'gte', 20, 'F')], -6),
    d('fierte', [matches('cede.Owner.X'), ...score('Owner', 'X', 'peur', 'lt', 20, 'F')], -3),
    d('audace', [matches('defie.Owner.X')], 1),
    // Insultes et colère.
    d('colere', [feelingToward('Owner', ANGRY, 'X')], -3),
    d('insulte-en-suspens', [matches('attente.Owner.X.insulte')], -1),
    d('retenue', [matches('insulte.Owner.X'), ...score('Owner', 'X', 'hostilite', 'lt', 10, 'H')], -2),
    d('crainte-de-provoquer', [matches('insulte.Owner.X'), ...score('Owner', 'X', 'peur', 'gte', 20, 'F')], -5),
    d('rancune', [matches('insulte.Owner.X'), matches('estjoueur.X'), ...score('Owner', 'X', 'hostilite', 'gte', 20, 'H')], 1),
    // Violence.
    // La fuite n'attire qu'une peur forte (menaces répétées, violence).
    d('peur', [feelingToward('Owner', AFRAID, 'X'), matches('at.Owner!P'), matches('at.X!P'), ...score('Owner', 'X', 'peur', 'gte', 30, 'F')], -4),
    d('attaque-en-suspens', [matches('attente.Owner.X.attaque')], -4),
    // Quitter les lieux a un coût : on ne fuit que si la peur l'emporte.
    d('rester-sur-place', [matches(`at.Owner!${LIEU_AILLEURS}`)], -1),
    d('non-violence', [matches('attaque.Owner.X'), ...score('Owner', 'X', 'hostilite', 'lt', 30, 'H')], -6),
    d('non-violence-riposte', [matches('riposte.Owner.X'), ...score('Owner', 'X', 'hostilite', 'lt', 30, 'H')], -6),
    d('combativite', [matches('riposte.Owner.X'), ...score('Owner', 'X', 'peur', 'lt', 30, 'F')], 3),
    d('protection', [matches('interpose.Owner.A'), saw('Owner', 'attaque.A.V'), ...score('Owner', 'V', 'affection', 'gte', 10, 'Af')], 4),
    // Larcins et réputation.
    d('justice', [matches('accuse.Owner.T'), saw('Owner', 'vole.T.V')], 4),
    d('vigilance', [matches('mefiant.Owner.X'), matches('regards.Owner.X.L')], 2),
    // Excuses.
    d('excuses-en-suspens', [matches('attente.Owner.X.excuses')], -1),
    d('clemence', [matches('pardonne.Owner.X'), ...score('Owner', 'X', 'hostilite', 'lt', 30, 'H'), ...score('Owner', 'X', 'hostilite', 'gt', 0, 'H0')], 2),
    d('bienveillance', [matches('rassure.Owner.X')], 3),
    d('rancune-tenace', [matches('refuse.Owner.X'), ...score('Owner', 'X', 'hostilite', 'gte', 30, 'H')], 2),
    // Nouvelles : faire savoir ce qu'on a vu ou entendu.
    d('commerage-vol', [matches('Owner.believes.vole.T.V'), matches('H.believes.vole.T.V.heard.Owner')], 2),
    d('commerage-attaque', [matches('Owner.believes.attaque.T.V'), matches('H.believes.attaque.T.V.heard.Owner')], 2),
    d('commerage-menace', [matches('Owner.believes.menace.T.V'), matches('H.believes.menace.T.V.heard.Owner')], 1),
  ];
}

function praxis(): Practice {
  return practice('elyndor', { name: 'Une scène d’Elyndor', roles: ['Monde'], actions: actions() });
}

// ---- construction -------------------------------------------------------------------

/** Graine du dé dramatique, stable pour une partie donnée. */
export function graineDe(texte: string): number {
  let h = 2166136261;
  for (let i = 0; i < texte.length; i++) h = Math.imul(h ^ texte.charCodeAt(i), 16777619) >>> 0;
  const [lo, hi] = SEED_BOUNDS;
  return lo + (h % (hi - lo));
}

/** Le monde Prax (règles et distribution) pour une description de scène, sans faits. */
export function construireMonde(desc: DescriptionScene, graine: number): State {
  const st = new State();
  st.definePractices([praxis()]);
  st.defineFunctions(coreFns());
  const desirs = motivations();
  const noms = desirs.map((x) => x.name);
  const pnj: Character[] = desc.pnj.map((p) => noms.reduce((c, n) => holds(c, n), character(p.id)));
  st.setCharacters([character(ID_JOUEUR), ...pnj]);
  st.setAxioms(obligedClose([standing('vole.T.V', 'voleur'), standing('attaque.T.V', 'dangereux'), standing('menace.T.V', 'menacant')]));
  st.setDesires(desirs);
  st.seedDie(graine);
  // On ne prédit que les personnages présents dans le même lieu.
  st.setPredictionScope([matches('at.Actor!P'), matches('at.Witness!P')]);
  return st;
}

export type ValeursRelation = Partial<Record<Axe, number>>;

/**
 * Les faits de départ des entités NOUVELLES de la description (toutes, pour une
 * partie qui commence). `relationsJoueur` : attitude de chaque PNJ envers le
 * joueur, sur l'échelle de l'application (-3..3).
 */
export function faitsInitiaux(
  desc: DescriptionScene,
  lieuJoueur: string | null,
  nouveauxPnj: ReadonlySet<string>,
  nouveauxLieux: ReadonlySet<string>,
  relationsJoueur: ReadonlyMap<string, ValeursRelation>,
): Outcome[] {
  const out: Outcome[] = [];
  if (lieuJoueur !== null) {
    out.push(insert('practice.elyndor.monde'), insert(`personnage.${ID_JOUEUR}`), insert(`estjoueur.${ID_JOUEUR}`), insert(`at.${ID_JOUEUR}!${lieuJoueur}`));
    for (const s of SUJETS) out.push(insert(`sujet.${s.id}`));
  }
  for (const l of desc.lieux) if (nouveauxLieux.has(l.id) && l.id !== LIEU_AILLEURS) out.push(insert(`lieu.${l.id}`));
  for (const p of desc.pnj) {
    if (!nouveauxPnj.has(p.id)) continue;
    out.push(insert(`personnage.${p.id}`), insert(`pnj.${p.id}`), insert(`at.${p.id}!${p.lieu}`), insert(`role.${p.id}.${p.role}`));
    if (ROLES_ACCUEIL.has(p.role)) out.push(insert(`role.${p.id}.accueil`));
    for (const s of p.sujets) out.push(insert(`sait.${p.id}.${s}`));
    const versJoueur = relationsJoueur.get(p.id) ?? {};
    for (const axe of AXES) out.push(insert(`${p.id}.relationship.${ID_JOUEUR}.${axe}.score!${Math.round((versJoueur[axe] ?? 0) * 10)}`));
    // Entre PNJ : neutre, sauf collègues (même lieu de travail ou même faction).
    for (const q of desc.pnj) {
      if (q.id === p.id) continue;
      const collegues = (p.faction && p.faction === q.faction) || (p.libelleRole && q.libelleRole && p.lieu === q.lieu);
      for (const [a, b] of [[p.id, q.id], [q.id, p.id]]) {
        if (!nouveauxPnj.has(a) && !nouveauxPnj.has(b)) continue;
        for (const axe of AXES) out.push(insert(`${a}.relationship.${b}.${axe}.score!${axe === 'affection' && collegues ? 10 : 0}`));
      }
    }
  }
  return out;
}

/** Lieu actuel d'un personnage dans l'état Prax. */
export function lieuDe(st: State, id: string): string | undefined {
  return st.dbChildKeys(`at.${id}`)[0];
}

/** Lit l'attitude d'un PNJ envers le joueur (échelle Prax, ×10). */
export function lireRelation(st: State, pnj: string, axe: Axe): number {
  const v = st.dbChildKeys(`${pnj}.relationship.${ID_JOUEUR}.${axe}.score`)[0];
  const n = v === undefined ? 0 : Number(v);
  return Number.isFinite(n) ? n : 0;
}
