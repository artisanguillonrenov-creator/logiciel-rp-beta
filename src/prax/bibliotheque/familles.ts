/**
 * Bibliothèque universelle — les mécaniques natives de Prax, une par mode.
 *
 * Chaque action du catalogue s'exécute par l'un de ces modes, paramétré par
 * ses faits `acte.<slug>.*` (catalogue.ts). Il n'y a ni second moteur ni
 * seconde base de faits : ce sont des pratiques Prax ordinaires, avec leurs
 * conditions, leurs effets, le dé du moteur, les témoins, et des réactions de
 * PNJ choisies par le planificateur selon leurs motivations.
 *
 * Conventions de faits (en plus de celles du monde) :
 * - `role.X.tous` pour tout personnage ; `role.X.<rôle>` ;
 * - `bourse.X!N` (en cuivres ; 1 or = 10 argent = 100 cuivre) ;
 * - `objet.O`, `sol.<lieu>.O`, `possede.X.O`, `equipe.X.O`, `etat.O!E` ;
 * - `statut.X.<statut>` (blesse, fatigue, cache, arrete, membre…) ;
 * - `competence.X.<compétence>`, `typelieu.<lieu>.<type>` ;
 * - `saisie.montant!M`, `saisie.objet!O` : ce que le joueur vient d'annoncer
 *   (posés par le narrateur juste avant l'action, effacés après le tour) ;
 * - réactions en attente : `attente.<PNJ>.<joueur>.f<mode>.<acte>`.
 */
import { Condition, absent, calc, cmp, exists, matches, neq, not_ } from '../core/query';
import { draw } from '../core/rng';
import { Action, Desire, Outcome, PraxFunction, action, call, del, desire, fn, forEach, insert, insertFor, want } from '../core/types';
import { adjustScore } from '../vocab/coreModel';
import { ANGRY, feelTowardFor } from '../vocab/emotion';
import { CoPresence, witnessed } from '../vocab/witness';

export interface OptionsFamilles {
  /** Gabarit de co-présence du monde (Witness et Actor au même endroit). */
  copresence: CoPresence;
  /** Conditions « a et b sont au même endroit » (b ≠ a, lieu réel). */
  ici: (a: string, b: string) => Condition[];
}

type Op = 'lt' | 'lte' | 'gt' | 'gte';
function score(a: string, b: string, axe: string, op: Op, n: number, v: string): Condition[] {
  return [matches(`${a}.relationship.${b}.${axe}.score!${v}`), cmp(op, v, String(n))];
}

/** L'acteur a l'autorité requise par l'acte (« tous » pour un acte ordinaire). */
const autorite: Condition[] = [matches('acte.Acte.autorite.Rau'), matches('role.Actor.Rau')];
/** Le PNJ a un rôle qui peut répondre à l'acte. */
const roleOk = (qui: string): Condition => exists([matches('acte.Acte.role.Rr'), matches(`role.${qui}.Rr`)]);
const roleKo = (qui: string): Condition => absent([matches('acte.Acte.role.Rr'), matches(`role.${qui}.Rr`)]);
const base = (mode: string): Condition[] => [matches('estjoueur.Actor'), matches(`acte.Acte.mode!${mode}`), ...autorite];

const statutActeur = (qui: string): Outcome => forEach([matches('acte.Acte.statutacteur!Sa')], [insert(`statut.${qui}.Sa`)]);
const produitPour = (qui: string): Outcome => forEach([matches('acte.Acte.produit!Pr')], [insert(`objet.Pr`), insert(`possede.${qui}.Pr`)]);

// ---- fonctions -----------------------------------------------------------------------

export function fonctionsFamilles(): PraxFunction[] {
  return [
    // Transfert d'argent atomique : rien ne bouge si la bourse ne suffit pas.
    fn('prax_transfert', ['De', 'A', 'M'], [
      [
        [matches('bourse.De!B1'), matches('bourse.A!B2'), cmp('gte', 'B1', 'M'), calc('N1', 'sub', 'B1', 'M'), calc('N2', 'add', 'B2', 'M')],
        [insert('bourse.De!N1'), insert('bourse.A!N2'), insertFor(1, 'transfert.De.A!M')],
      ],
      [[], [insertFor(1, 'fondsinsuffisants.De')]],
    ]),
  ];
}

// ---- parole ----------------------------------------------------------------------------

function parole(o: OptionsFamilles): Action[] {
  return [
    action('[Actor] adresse [Acte] à [Cible]', [...base('parole'), ...o.ici('Actor', 'Cible'), matches('personnage.Cible'), matches('acte.Acte.axe!Ax'), matches('acte.Acte.delta!D')], [
      insert('attente.Cible.Actor.fparole.Acte'),
      call('prax_adjustScore', ['Cible', 'Actor', 'Ax', 'D', 'Acte']),
      forEach([matches('acte.Acte.signe!negatif')], [feelTowardFor(3, 'Cible', ANGRY, 'Actor'), witnessed(o.copresence, 'offense.Actor.Cible')]),
    ]),
    action('[Actor] accueille favorablement [Acte] de [Cible]', [matches('attente.Actor.Cible.fparole.Acte'), not_('acte.Acte.signe!negatif')], [
      del('attente.Actor.Cible.fparole.Acte'),
      insertFor(1, 'favorable.Actor.Cible.Acte'),
    ]),
    action('[Actor] reste froid devant [Acte] de [Cible]', [matches('attente.Actor.Cible.fparole.Acte')], [del('attente.Actor.Cible.fparole.Acte'), insertFor(1, 'froid.Actor.Cible.Acte')]),
    action('[Actor] réplique à [Acte] de [Cible]', [matches('attente.Actor.Cible.fparole.Acte'), matches('acte.Acte.signe!negatif')], [
      del('attente.Actor.Cible.fparole.Acte'),
      insertFor(1, 'replique.Actor.Cible.Acte'),
    ]),
    action('[Actor] encaisse [Acte] de [Cible]', [matches('attente.Actor.Cible.fparole.Acte'), matches('acte.Acte.signe!negatif')], [
      del('attente.Actor.Cible.fparole.Acte'),
      insertFor(1, 'encaisse.Actor.Cible.Acte'),
    ]),
  ];
}

// ---- requête (et justice / institution adressées à une autorité) -------------------------

function requete(o: OptionsFamilles): Action[] {
  const attente = 'attente.Actor.Cible.frequete.Acte';
  return [
    action('[Actor] sollicite [Acte] auprès de [Cible]', [...base('requete'), ...o.ici('Actor', 'Cible'), matches('pnj.Cible')], [insert('attente.Cible.Actor.frequete.Acte')]),
    action('[Actor] accorde [Acte] à [Cible]', [matches(attente), roleOk('Actor'), not_('acte.Acte.prix')], [
      del(attente),
      insert('accorde.Actor.Cible.Acte'),
      statutActeur('Cible'),
      insertFor(1, 'accordeq.Actor.Cible.Acte'),
    ]),
    action('[Actor] accepte [Acte] pour [Cible] contre paiement', [matches(attente), roleOk('Actor'), matches('acte.Acte.prix!P')], [
      del(attente),
      insert('du.Cible.Actor.Acte!P'),
      insertFor(1, 'conditionq.Actor.Cible.Acte'),
    ]),
    action('[Actor] refuse [Acte] à [Cible]', [matches(attente)], [del(attente), insertFor(1, 'refusq.Actor.Cible.Acte')]),
    action('[Actor] renvoie [Cible] vers qui peut [Acte]', [matches(attente), roleKo('Actor')], [del(attente), insertFor(1, 'renvoieq.Actor.Cible.Acte')]),
    // Régler ce qui a été convenu : la prestation est alors due.
    action('[Actor] règle [Acte] à [Cible]', [matches('estjoueur.Actor'), ...o.ici('Actor', 'Cible'), matches('du.Actor.Cible.Acte!P'), matches('bourse.Actor!B'), cmp('gte', 'B', 'P')], [
      call('prax_transfert', ['Actor', 'Cible', 'P']),
      del('du.Actor.Cible.Acte'),
      insert('accorde.Cible.Actor.Acte'),
      statutActeur('Actor'),
      insert('attente.Cible.Actor.paiement'),
    ]),
  ];
}

// ---- information --------------------------------------------------------------------------

function information(o: OptionsFamilles): Action[] {
  const attente = 'attente.Actor.Cible.finfo.Acte';
  return [
    action('[Actor] demande [Acte] à [Cible]', [...base('information'), ...o.ici('Actor', 'Cible'), matches('pnj.Cible')], [insert('attente.Cible.Actor.finfo.Acte')]),
    action('[Actor] renseigne [Cible] sur [Acte]', [matches(attente)], [del(attente), insert('informe.Actor.Cible.Acte'), insertFor(1, 'renseigne.Actor.Cible.Acte')]),
    action('[Actor] se dérobe à [Acte] de [Cible]', [matches(attente)], [del(attente), insertFor(1, 'derobe.Actor.Cible.Acte')]),
  ];
}

// ---- influence ------------------------------------------------------------------------------

function influence(o: OptionsFamilles): Action[] {
  const attente = 'attente.Actor.Cible.finfluence.Acte';
  return [
    action('[Actor] tente [Acte] sur [Cible]', [...base('influence'), ...o.ici('Actor', 'Cible'), matches('pnj.Cible'), matches('acte.Acte.axe!Ax'), matches('acte.Acte.poids!W')], [
      call('prax_adjustScore', ['Cible', 'Actor', 'Ax', 'W', 'Acte']),
      insert('attente.Cible.Actor.finfluence.Acte'),
      forEach([matches('acte.Acte.observable')], [witnessed(o.copresence, 'pression.Actor.Cible')]),
    ]),
    action('[Actor] cède à [Acte] de [Cible]', [matches(attente)], [
      del(attente),
      insert('cede.Actor.Cible.Acte'),
      forEach([matches('acte.Acte.statutcible!Sc')], [insert('statut.Actor.Sc')]),
      insertFor(1, 'cedei.Actor.Cible.Acte'),
    ]),
    action('[Actor] résiste à [Acte] de [Cible]', [matches(attente)], [
      del(attente),
      insertFor(1, 'resiste.Actor.Cible.Acte'),
      adjustScore('Actor', 'Cible', 'hostilite', 5, 'pression'),
    ]),
  ];
}

// ---- transaction ------------------------------------------------------------------------------

/**
 * Chaque offre porte sa valeur de référence (`saisie.valeur`, `saisie.plancher`, posées par le narrateur :
 * prix courant de l'objet d'après le lore, sinon prix indicatif de l'acte) ; le PNJ la compare au montant.
 */
function transaction(o: OptionsFamilles): Action[] {
  const att = 'attente.Actor.Cible.fachat.Acte.O';
  const offre = 'offre.Cible.Actor.Acte.O!M';
  const ref = 'ref.Cible.Actor.Acte.O';
  const finOffre = [del(att), del('offre.Cible.Actor.Acte.O'), del(ref)];
  return [
    // Achat (ou location, réservation, emprunt…) : une offre en attente, rien ne change de mains.
    action('[Actor] propose [Acte] de [O] à [Cible] pour [M]', [
      ...base('transaction'), matches('acte.Acte.sens!achat'), ...o.ici('Actor', 'Cible'), matches('pnj.Cible'),
      matches('saisie.montant!M'), matches('saisie.objet!O'), matches('saisie.valeur!V'), matches('saisie.plancher!F'),
    ], [
      insert('offre.Actor.Cible.Acte.O!M'),
      insert('ref.Actor.Cible.Acte.O.valeur!V'),
      insert('ref.Actor.Cible.Acte.O.plancher!F'),
      insert('attente.Cible.Actor.fachat.Acte.O'),
    ]),
    action('[Actor] accepte [Acte] de [O] avec [Cible]', [matches(att), roleOk('Actor'), matches(offre), matches(`${ref}.valeur!V`), matches('bourse.Cible!B'), cmp('gte', 'B', 'M')], [
      ...finOffre,
      call('prax_transfert', ['Cible', 'Actor', 'M']),
      insert('objet.O'),
      insert('possede.Cible.O'),
      insert('obtenu.Cible.Acte'),
      statutActeur('Cible'),
      insertFor(1, 'vente.Actor.Cible.Acte.offert!M'),
      insertFor(1, 'vente.Actor.Cible.Acte.valeur!V'),
    ]),
    // Contre-offre : le PNJ propose sa valeur de référence.
    action('[Actor] fait une contre-offre à [Cible] pour [O]', [matches(att), roleOk('Actor'), matches(offre), matches(`${ref}.valeur!V`), matches(`${ref}.plancher!F`), cmp('lt', 'M', 'V')], [
      ...finOffre,
      insert('contre.Actor.Cible.Acte.O!V'),
      insertFor(1, 'contreoffre.Actor.Cible.Acte.offert!M'),
      insertFor(1, 'contreoffre.Actor.Cible.Acte.plancher!F'),
    ]),
    action('[Actor] constate que [Cible] n’a pas de quoi payer [O]', [matches(att), matches(offre), matches('bourse.Cible!B'), cmp('lt', 'B', 'M')], [...finOffre, insertFor(1, 'insolvable.Actor.Cible')]),
    action('[Actor] refuse [Acte] de [O] à [Cible]', [matches(att), matches(offre), matches(`${ref}.plancher!F`)], [
      ...finOffre,
      insertFor(1, 'refusvente.Actor.Cible.Acte.offert!M'),
      insertFor(1, 'refusvente.Actor.Cible.Acte.plancher!F'),
    ]),
    action('[Actor] renvoie [Cible] vers qui fait [Acte]', [matches(att), roleKo('Actor')], [...finOffre, insertFor(1, 'renvoieq.Actor.Cible.Acte')]),
    // Gestion des offres.
    action('[Actor] accepte la contre-offre de [Cible] pour [O]', [matches('estjoueur.Actor'), ...o.ici('Actor', 'Cible'), matches('contre.Cible.Actor.A.O!M'), matches('bourse.Actor!B'), cmp('gte', 'B', 'M')], [
      call('prax_transfert', ['Actor', 'Cible', 'M']),
      del('contre.Cible.Actor.A.O'),
      insert('objet.O'),
      insert('possede.Actor.O'),
      insert('obtenu.Actor.A'),
      forEach([matches('acte.A.statutacteur!Sa')], [insert('statut.Actor.Sa')]),
      insert('attente.Cible.Actor.paiement'),
    ]),
    action('[Actor] décline la contre-offre de [Cible]', [matches('estjoueur.Actor'), matches('contre.Cible.Actor.A.O!M')], [del('contre.Cible.Actor.A.O')]),
    action('[Actor] retire son offre à [Cible]', [matches('estjoueur.Actor'), matches('offre.Actor.Cible.A.O!M')], [del('offre.Actor.Cible.A.O'), del('ref.Actor.Cible.A.O'), del('attente.Cible.Actor.fachat.A.O')]),
    // Vente par le joueur d'un objet qu'il possède.
    action('[Actor] propose de céder [O] à [Cible] pour [M]', [
      ...base('transaction'), matches('acte.Acte.sens!vente'), ...o.ici('Actor', 'Cible'), matches('pnj.Cible'),
      matches('saisie.montant!M'), matches('saisie.objet!O'), matches('saisie.valeur!V'), matches('possede.Actor.O'),
    ], [
      insert('offrev.Actor.Cible.Acte.O!M'),
      insert('refv.Actor.Cible.Acte.O!V'),
      insert('attente.Cible.Actor.fvente.Acte.O'),
    ]),
    action('[Actor] achète [O] à [Cible]', [matches('attente.Actor.Cible.fvente.Acte.O'), matches('offrev.Cible.Actor.Acte.O!M'), matches('refv.Cible.Actor.Acte.O!V'), matches('possede.Cible.O'), matches('bourse.Actor!B'), cmp('gte', 'B', 'M')], [
      del('attente.Actor.Cible.fvente.Acte.O'),
      del('offrev.Cible.Actor.Acte.O'),
      del('refv.Cible.Actor.Acte.O'),
      call('prax_transfert', ['Actor', 'Cible', 'M']),
      del('possede.Cible.O'),
      del('equipe.Cible.O'),
      insert('possede.Actor.O'),
      insertFor(1, 'achat.Actor.Cible.Acte.offert!M'),
      insertFor(1, 'achat.Actor.Cible.Acte.valeur!V'),
    ]),
    action('[Actor] refuse d’acheter [O] à [Cible]', [matches('attente.Actor.Cible.fvente.Acte.O'), matches('offrev.Cible.Actor.Acte.O!M'), matches('refv.Cible.Actor.Acte.O!V')], [
      del('attente.Actor.Cible.fvente.Acte.O'),
      del('offrev.Cible.Actor.Acte.O'),
      del('refv.Cible.Actor.Acte.O'),
      insertFor(1, 'refusachat.Actor.Cible.Acte.offert!M'),
      insertFor(1, 'refusachat.Actor.Cible.Acte.valeur!V'),
    ]),
    // Paiement direct (payer, rembourser, faire un don, verser un acompte…).
    action('[Actor] verse [M] à [Cible] pour [Acte]', [...base('transaction'), matches('acte.Acte.sens!paiement'), ...o.ici('Actor', 'Cible'), matches('pnj.Cible'), matches('saisie.montant!M'), matches('bourse.Actor!B'), cmp('gte', 'B', 'M')], [
      call('prax_transfert', ['Actor', 'Cible', 'M']),
      insert('attente.Cible.Actor.fdon'),
      adjustScore('Cible', 'Actor', 'confiance', 3, 'argent'),
    ]),
    action('[Actor] remercie [Cible] de son argent', [matches('attente.Actor.Cible.fdon')], [del('attente.Actor.Cible.fdon'), insertFor(1, 'gratitude.Actor.Cible'), adjustScore('Actor', 'Cible', 'affection', 3, 'don')]),
  ];
}

// ---- objets -------------------------------------------------------------------------------------

function objets(o: OptionsFamilles): Action[] {
  const b = (effet: string): Condition[] => [...base('objet'), matches(`acte.Acte.effet!${effet}`), matches('saisie.objet!O')];
  const aPortee: Condition = exists([matches('at.Actor!Pa'), matches('sol.Pa.O')]);
  const accessible: Condition[] = [matches('objet.O'), absent([absent([matches('possede.Actor.O')]), absent([matches('at.Actor!Pb'), matches('sol.Pb.O')])])];
  return [
    action('[Actor] ramasse [O] ([Acte])', [...b('prendre'), aPortee, matches('at.Actor!P'), matches('sol.P.O')], [del('sol.P.O'), insert('possede.Actor.O'), forEach([matches('proprio.O.Pr'), neq('Pr', 'Actor')], [witnessed(o.copresence, 'delit.Actor.Acte')])]),
    action('[Actor] dépose [O] ([Acte])', [...b('poser'), matches('possede.Actor.O'), matches('at.Actor!P')], [del('possede.Actor.O'), del('equipe.Actor.O'), insert('sol.P.O')]),
    action('[Actor] tend [O] à [Cible] ([Acte])', [...b('donner'), matches('possede.Actor.O'), ...o.ici('Actor', 'Cible'), matches('pnj.Cible')], [insert('attente.Cible.Actor.fcadeau.O')]),
    action('[Actor] accepte [O] de [Cible]', [matches('attente.Actor.Cible.fcadeau.O'), matches('possede.Cible.O')], [
      del('attente.Actor.Cible.fcadeau.O'),
      del('possede.Cible.O'),
      del('equipe.Cible.O'),
      insert('possede.Actor.O'),
      adjustScore('Actor', 'Cible', 'affection', 3, 'cadeau'),
      insertFor(1, 'cadeau.Actor.Cible'),
    ]),
    action('[Actor] refuse [O] de [Cible]', [matches('attente.Actor.Cible.fcadeau.O')], [del('attente.Actor.Cible.fcadeau.O'), insertFor(1, 'refuscadeau.Actor.Cible')]),
    action('[Actor] s’équipe de [O] ([Acte])', [...b('equiper'), matches('possede.Actor.O'), not_('equipe.Actor.O')], [insert('equipe.Actor.O')]),
    action('[Actor] retire [O] ([Acte])', [...b('desequiper'), matches('equipe.Actor.O')], [del('equipe.Actor.O')]),
    action('[Actor] ouvre [O] ([Acte])', [...b('ouvrir'), ...accessible, not_('etat.O!verrouille')], [insert('etat.O!ouvert')]),
    action('[Actor] ferme [O] ([Acte])', [...b('fermer'), ...accessible], [insert('etat.O!ferme')]),
    action('[Actor] verrouille [O] ([Acte])', [...b('verrouiller'), ...accessible], [insert('etat.O!verrouille')]),
    action('[Actor] déverrouille [O] ([Acte])', [...b('deverrouiller'), ...accessible, matches('etat.O!verrouille')], [insert('etat.O!ferme')]),
    action('[Actor] allume [O] ([Acte])', [...b('allumer'), ...accessible], [insert('etat.O!allume')]),
    action('[Actor] éteint [O] ([Acte])', [...b('eteindre'), ...accessible], [insert('etat.O!eteint')]),
    action('[Actor] examine [O] ([Acte])', [...b('examiner'), ...accessible], [insert('sait.Actor.objet.O'), insertFor(1, 'examine.Actor.O')]),
    action('[Actor] brise [O] ([Acte])', [...b('briser'), ...accessible, matches('at.Actor!P')], [
      del('possede.Actor.O'),
      del('sol.P.O'),
      del('equipe.Actor.O'),
      insert('brise.O'),
      forEach([matches('proprio.O.Pr'), neq('Pr', 'Actor')], [witnessed(o.copresence, 'delit.Actor.Acte')]),
    ]),
    action('[Actor] manipule [O] ([Acte])', [...b('manipuler'), ...accessible], [insertFor(1, 'manipule.Actor.O.Acte')]),
  ];
}

// ---- repos -----------------------------------------------------------------------------------------

function repos(): Action[] {
  return [
    action('[Actor] prend du repos ([Acte])', [...base('repos')], [del('statut.Actor.fatigue'), statutActeur('Actor'), insertFor(1, 'repose.Actor.Acte')]),
  ];
}

// ---- tentatives (le dé, le risque, la compétence) -------------------------------------------------------

const COTES: Record<string, { sans: [number, number] | null; avec: [number, number] | null }> = {
  nul: { sans: null, avec: null },
  faible: { sans: [3, 4], avec: [7, 8] },
  moyen: { sans: [1, 2], avec: [3, 4] },
  eleve: { sans: [1, 4], avec: [1, 2] },
};

function tentatives(o: OptionsFamilles): Action[] {
  const out: Action[] = [];
  // Le lieu exigé par l'acte, s'il y en a un, doit être celui où l'on se trouve.
  const lieuOk: Condition = absent([matches('acte.Acte.lieu!Lr'), absent([matches('at.Actor!Pl'), matches('typelieu.Pl.Lr')])]);
  const aComp: Condition = exists([matches('acte.Acte.competence!Cp'), matches('competence.Actor.Cp')]);
  const sansComp: Condition = absent([matches('acte.Acte.competence!Cp'), matches('competence.Actor.Cp')]);
  for (const cible of [false, true]) {
    for (const [risque, cotes] of Object.entries(COTES)) {
      for (const competent of [true, false]) {
        const cote = competent ? cotes.avec : cotes.sans;
        if (risque === 'nul' && !competent) continue; // sans dé : une seule variante
        const conds: Condition[] = [...base('tentative'), matches(`acte.Acte.risque!${risque}`), lieuOk, not_('statut.Actor.arrete')];
        if (risque !== 'nul') conds.push(competent ? aComp : sansComp);
        if (cible) conds.push(matches('acte.Acte.cible'), ...o.ici('Actor', 'Cible'), matches('personnage.Cible'));
        else conds.push(not_('acte.Acte.cible'));
        const succes: Outcome[] = [
          del('rate.Actor.Acte'),
          insertFor(1, 'reussi.Actor.Acte'),
          statutActeur('Actor'),
          produitPour('Actor'),
        ];
        if (cible) {
          succes.push(
            forEach([matches('acte.Acte.statutcible!Sc')], [insert('statut.Cible.Sc')]),
            // Un soin réussi efface la blessure.
            forEach([matches('acte.Acte.statutcible!soigne')], [del('statut.Cible.blesse')]),
            forEach([matches('acte.Acte.signe!positif')], [insert('attente.Cible.Actor.fdon')]),
          );
        }
        const effets: Outcome[] = [
          insertFor(1, 'tente.Actor.Acte'),
          insertFor(1, 'rate.Actor.Acte'),
          ...(cote === null ? succes : draw(cote[0], cote[1], [], succes)),
          forEach([matches('acte.Acte.fatigue!F'), cmp('gte', 'F', '2')], [insert('statut.Actor.fatigue')]),
          forEach([matches('acte.Acte.illegal')], [witnessed(o.copresence, 'delit.Actor.Acte')]),
        ];
        if (cible) {
          effets.push(
            forEach([matches('acte.Acte.signe!negatif')], [
              insert('attente.Cible.Actor.attaque'),
              adjustScore('Cible', 'Actor', 'hostilite', 10, 'agression'),
              feelTowardFor(3, 'Cible', ANGRY, 'Actor'),
            ]),
          );
        }
        const etiquette = `${cible ? '[Actor] tente [Acte] sur [Cible]' : '[Actor] tente [Acte]'} (${risque}${risque === 'nul' ? '' : competent ? ', avec compétence' : ''})`;
        out.push(action(etiquette, conds, effets));
      }
    }
  }
  return out;
}

// ---- ordre public -------------------------------------------------------------------------------------------

function ordrePublic(o: OptionsFamilles): Action[] {
  return [
    action('[Actor] arrête [X]', [matches('role.Actor.garde'), matches('regards.Actor.X.hors_la_loi'), ...o.ici('Actor', 'X'), not_('statut.X.arrete')], [
      insert('statut.X.arrete'),
      del('statut.X.cache'),
      insertFor(1, 'arrestation.Actor.X'),
    ]),
    action('[Actor] règle son amende auprès de [Cible]', [matches('estjoueur.Actor'), matches('role.Cible.garde'), ...o.ici('Actor', 'Cible'), matches('statut.Actor.arrete'), matches('saisie.montant!M'), matches('bourse.Actor!B'), cmp('gte', 'B', 'M')], [
      call('prax_transfert', ['Actor', 'Cible', 'M']),
      del('statut.Actor.arrete'),
      // L'amende éteint les poursuites : ceux qui avaient vu les délits n'en tiennent plus compte.
      forEach([matches('W.believes.delit.Actor.A')], [del('W.believes.delit.Actor.A')]),
      insert('attente.Cible.Actor.fdon'),
    ]),
  ];
}

export function actionsFamilles(o: OptionsFamilles): Action[] {
  return [...parole(o), ...requete(o), ...information(o), ...influence(o), ...transaction(o), ...objets(o), ...repos(), ...tentatives(o), ...ordrePublic(o)];
}

// ---- motivations des PNJ ---------------------------------------------------------------------------------------

export function motivationsFamilles(): Desire[] {
  const d = (nom: string, conds: Condition[], u: number): Desire => desire(`bib-${nom}`, want(conds, u));
  const H = (op: Op, n: number) => score('Owner', 'X', 'hostilite', op, n, 'Hb');
  const C = (op: Op, n: number) => score('Owner', 'X', 'confiance', op, n, 'Cb');
  const F = (op: Op, n: number) => score('Owner', 'X', 'peur', op, n, 'Fb');
  return [
    // parole
    d('parole-en-suspens', [matches('attente.Owner.X.fparole.A')], -2),
    d('bon-accueil', [matches('favorable.Owner.X.A'), ...H('lt', 20)], 2),
    d('froideur', [matches('froid.Owner.X.A'), ...H('gte', 20)], 2),
    d('repartie', [matches('replique.Owner.X.A'), ...F('lt', 20)], 2),
    d('encaisser', [matches('encaisse.Owner.X.A'), ...F('gte', 20)], 2),
    // requêtes
    d('requete-en-suspens', [matches('attente.Owner.X.frequete.A')], -2),
    d('obliger', [matches('accordeq.Owner.X.A'), ...H('lt', 20), ...C('gte', -5)], 3),
    d('monnayer', [matches('conditionq.Owner.X.A'), ...H('lt', 20), ...C('gte', -5)], 3),
    d('refus-hostile', [matches('refusq.Owner.X.A'), ...H('gte', 20)], 4),
    d('refus-mefiant', [matches('refusq.Owner.X.A'), ...C('lt', -5)], 4),
    d('pas-de-mon-ressort', [matches('renvoieq.Owner.X.A')], 1),
    // information
    d('info-en-suspens', [matches('attente.Owner.X.finfo.A')], -2),
    d('renseigner', [matches('renseigne.Owner.X.A'), ...C('gte', 0), ...H('lt', 20)], 3),
    d('se-taire', [matches('derobe.Owner.X.A'), ...C('lt', 0)], 3),
    d('se-taire-hostile', [matches('derobe.Owner.X.A'), ...H('gte', 20)], 3),
    // influence : on cède quand l'axe visé est assez fort
    d('influence-en-suspens', [matches('attente.Owner.X.finfluence.A')], -2),
    d('ceder', [matches('cedei.Owner.X.A'), matches('acte.A.axe!Ax'), matches('Owner.relationship.X.Ax.score!Si'), cmp('gte', 'Si', '15')], 4),
    d('fierte', [matches('resiste.Owner.X.A')], 2),
    // transactions
    d('achat-en-suspens', [matches('attente.Owner.X.fachat.A.O')], -2),
    // Vendre : au moins la valeur, c'est une bonne affaire ; en dessous, on perd ; sous le plancher, on refuse.
    d('vente-juste', [matches('vente.Owner.X.A.offert!M'), matches('vente.Owner.X.A.valeur!V'), cmp('gte', 'M', 'V')], 4),
    d('vente-bradee', [matches('vente.Owner.X.A.offert!M'), matches('vente.Owner.X.A.valeur!V'), cmp('lt', 'M', 'V')], -3),
    d('contre-offre', [matches('contreoffre.Owner.X.A.offert!M'), matches('contreoffre.Owner.X.A.plancher!Fl'), cmp('gte', 'M', 'Fl')], 3),
    d('refus-offre-basse', [matches('refusvente.Owner.X.A.offert!M'), matches('refusvente.Owner.X.A.plancher!Fl'), cmp('lt', 'M', 'Fl')], 4),
    d('refus-vente-hostile', [matches('refusvente.Owner.X.A.offert!M'), ...H('gte', 20)], 5),
    d('constat-insolvable', [matches('insolvable.Owner.X')], 5),
    d('vente-en-suspens', [matches('attente.Owner.X.fvente.A.O')], -2),
    // Acheter au joueur : jusqu'à la valeur, volontiers ; au-delà, non.
    d('achat-avantageux', [matches('achat.Owner.X.A.offert!M'), matches('achat.Owner.X.A.valeur!V'), cmp('lte', 'M', 'V')], 3),
    d('achat-trop-cher', [matches('achat.Owner.X.A.offert!M'), matches('achat.Owner.X.A.valeur!V'), cmp('gt', 'M', 'V')], -3),
    d('refus-achat-cher', [matches('refusachat.Owner.X.A.offert!M'), matches('refusachat.Owner.X.A.valeur!V'), cmp('gt', 'M', 'V')], 3),
    d('don-en-suspens', [matches('attente.Owner.X.fdon')], -1),
    d('gratitude', [matches('gratitude.Owner.X')], 2),
    // cadeaux
    d('cadeau-en-suspens', [matches('attente.Owner.X.fcadeau.O')], -1),
    d('accepter-cadeau', [matches('cadeau.Owner.X'), ...H('lt', 20)], 2),
    d('refuser-cadeau', [matches('refuscadeau.Owner.X'), ...H('gte', 20)], 3),
    // ordre public
    d('ordre', [matches('arrestation.Owner.X')], 4),
  ];
}

/** Les rôles connus par les familles (pour `role.X.<rôle>`). */
export const ROLES_BIBLIOTHEQUE = [
  'marchand', 'garde', 'juge', 'pretre', 'guerisseur', 'mage', 'maitresse_guilde', 'receptionniste', 'taverniere', 'forgeronne', 'passeuse', 'souverain', 'fonctionnaire', 'noble', 'ombre', 'membre_guilde',
] as const;
