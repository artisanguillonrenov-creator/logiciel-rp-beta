/**
 * La boucle de tours en tourniquet (`Prax.Loop`) : le prochain personnage
 * vivant, avec la frontière de tour du moteur déclenchée une fois par tour
 * complet (v44) ; et l'action d'un PNJ avec engagement (v35) : tant que sa
 * signature de motivation ne change pas et que son intention reste offerte, il
 * l'exécute sans redélibérer.
 *
 * Reprend `prax-core/src/turn.rs` (Prax, BSD-3-Clause).
 */
import { State } from './engine';
import { EffectStep, GroundedAction } from './perform';
import { groundedActionEq, motiveSignatureEq } from './planner';
import { Character } from './types';

function nextLiving(st: State, names: readonly string[], cursor: number): number | null {
  const n = names.length;
  for (let k = 1; k <= n; k++) {
    const i = (((cursor + k) % n) + n) % n;
    if (!st.dbHas(`dead.${names[i]}`)) return i;
  }
  return null;
}

/**
 * Passe au prochain personnage vivant et le renvoie, en exécutant la frontière
 * de tour à chaque retour au début du tourniquet. Lève une erreur si toute la
 * distribution est morte.
 */
export function advance(st: State): Character {
  const names = st.characters.map((c) => c.name);
  if (names.length === 0) throw new Error('Prax.Loop.advance : la distribution est vide');
  const cursor = st.cursor;
  const i = nextLiving(st, names, cursor);
  if (i === null) throw new Error('Prax.Loop.advance : aucun personnage vivant');
  if (i <= cursor) {
    st.roundBoundary();
    const j = nextLiving(st, names, st.cursor);
    if (j === null) throw new Error('Prax.Loop.advance : aucun personnage vivant');
    st.setCursor(j);
    return st.characters[j];
  }
  st.setCursor(i);
  return st.characters[i];
}

/** Fait agir un PNJ (v35) ; renvoie l'action exécutée, s'il y en a une. */
export function npcAct(st: State, depth: number, actor: Character): GroundedAction | null {
  return npcActLogged(st, depth, actor, () => {});
}

export function npcActLogged(st: State, depth: number, actor: Character, observe: (s: EffectStep) => void): GroundedAction | null {
  const name = actor.name;
  const sig = st.motiveSignature(actor);
  const intent = st.intentionOf(name);
  if (intent !== undefined && motiveSignatureEq(intent.basis, sig) && stillOffered(st, actor, intent.act)) {
    return act(st, intent.act, observe);
  }
  const chosen = st.pickAction(depth, actor);
  st.setIntention(name, { act: chosen, basis: sig });
  return act(st, chosen, observe);
}

function stillOffered(st: State, actor: Character, action: GroundedAction | null): boolean {
  if (action === null) return true;
  return st.candidateActions(actor).some((g) => groundedActionEq(g, action));
}

function act(st: State, chosen: GroundedAction | null, observe: (s: EffectStep) => void): GroundedAction | null {
  if (chosen !== null) st.performActionLogged(chosen, observe);
  return chosen;
}

/** Joue `steps` tours de PNJ et renvoie la narration de chaque action exécutée. */
export function runNpcTicks(st: State, depth: number, steps: number): string[] {
  const labels: string[] = [];
  for (let k = 0; k < steps; k++) {
    const actor = advance(st);
    const ga = npcAct(st, depth, actor);
    if (ga !== null) labels.push(ga.label);
  }
  return labels;
}
