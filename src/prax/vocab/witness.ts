/**
 * Témoignage écrit : l'asymétrie d'information née de l'observation. Ce qu'une
 * action laisse voir est une propriété que l'auteur ÉNONCE (`observable`) ; un
 * événement vu devient une croyance `<témoin>.believes.<événement>.seen`.
 *
 * La co-présence est du VOCABULAIRE DU MONDE : chaque monde fournit un gabarit
 * reliant les variables fixes `Witness` et `Actor`.
 *
 * Reprend `prax-vocab/src/witness.rs` (Prax, BSD-3-Clause).
 */
import { Condition, matches, neq } from '../core/query';
import { Action, Outcome, forEach, insert, renameVars } from '../core/types';
import { beliefAbout } from './beliefs';

export type CoPresence = readonly Condition[];

/** Le dépôt du témoignage : chaque personnage co-présent (sauf l'acteur) croit `event` avec provenance `seen`. */
export function witnessed(copresence: CoPresence, event: string): Outcome {
  return forEach([...copresence, neq('Witness', 'Actor')], [insert(`${beliefAbout('Witness', event)}.seen`)]);
}

/** Déclare l'apparence publique d'une action. */
export function observable(copresence: CoPresence, event: string, act: Action): Action {
  return { ...act, then: [...act.then, witnessed(copresence, event)] };
}

/** Condition : `who` a vu `event` de ses yeux. */
export function saw(who: string, event: string): Condition {
  return matches(`${beliefAbout(who, event)}.seen`);
}

/** Recible un gabarit de co-présence : `Witness` devient `v` (une variable). */
export function asRole(v: string, copresence: CoPresence): Condition[] {
  return renameVars(new Map([['Witness', v]]), copresence);
}
