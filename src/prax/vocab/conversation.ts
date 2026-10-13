/**
 * Conversation : orateurs, sujets et répliques (Versu §X). Une conversation est
 * une pratique à deux avec un ORATEUR désigné et un SUJET courant ; une
 * réplique est une action ordinaire qui dit une ligne et applique des effets.
 *
 * Reprend `prax-vocab/src/conversation.rs` (Prax, BSD-3-Clause).
 */
import { Condition, matches, not_ } from '../core/query';
import { Action, Outcome, action, del, insert } from '../core/types';

export const talkPath = (x: string, y: string): string => `practice.converse.${x}.${y}`;
export const talkingWith = (x: string, y: string): Condition => matches(talkPath(x, y));

/** Ouvre une conversation : `opener` parle d'abord, sur `topic`. */
export function beginConversation(opener: string, other: string, topic: string): Outcome[] {
  const base = talkPath(opener, other);
  return [
    insert(base),
    insert(`${base}.speaker!${opener}`),
    insert(`${base}.listener!${other}`),
    insert(`${base}.topic!${topic}`),
    insert(`${base}.visited.${topic}`),
    insert(`${opener}.chattedWith.${other}`),
    insert(`${other}.chattedWith.${opener}`),
  ];
}

const CONV_P = 'practice.converse.A.B';

function speakerConds(): Condition[] {
  return [matches(`${CONV_P}.speaker!Actor`), matches(`${CONV_P}.listener!Partner`)];
}

function passTurn(): Outcome[] {
  return [insert(`${CONV_P}.speaker!Partner`), insert(`${CONV_P}.listener!Actor`)];
}

/** Une réplique dite une fois par orateur, sur `topic`, avec ses effets ; passe la parole. */
export function quip(key: string, label: string, topic: string, conds: readonly Condition[], effects: readonly Outcome[]): Action {
  const when = [...speakerConds(), matches(`${CONV_P}.topic!${topic}`), not_(`${CONV_P}.said.${key}.Actor`), ...conds];
  const then = [insert(`${CONV_P}.said.${key}.Actor`), ...effects, ...passTurn()];
  return action(label, when, then);
}

/** Change de sujet (pas déjà dessus, pas déjà couvert) ; passe la parole. */
export function changeSubject(label: string, newTopic: string): Action {
  const when = [...speakerConds(), not_(`${CONV_P}.topic!${newTopic}`), not_(`${CONV_P}.visited.${newTopic}`)];
  const then = [insert(`${CONV_P}.topic!${newTopic}`), insert(`${CONV_P}.visited.${newTopic}`), ...passTurn()];
  return action(label, when, then);
}

/** Termine la conversation. */
export function endConversation(label: string): Action {
  return action(label, speakerConds(), [del(CONV_P)]);
}
