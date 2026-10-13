/**
 * Entreprises : un comportement à long horizon comme ensemble de parties. Un
 * TYPE de projet est du vocabulaire écrit ; une INSTANCE naît quand le
 * planificateur d'un personnage disposé choisit l'action « entreprendre ». La
 * poursuite est un désir nommé qui compte les parties achevées par le
 * propriétaire. Un plan est un ENSEMBLE de parties (dépendances `after`,
 * besoins `needs`), pas une chaîne.
 *
 * Reprend `prax-vocab/src/project.rs` (Prax, BSD-3-Clause).
 */
import { worldErrors } from '../core/errors';
import { Condition, eq, matches, not_ } from '../core/query';
import { Action, Desire, Outcome, Practice, action, authoredVarClash, desire, insert, practice, want } from '../core/types';

export interface Part {
  readonly name: string;
  readonly label: string;
  readonly after: readonly string[];
  readonly needs: readonly Condition[];
  readonly yields: readonly Outcome[];
}

export function part(name: string, label: string, after: readonly string[], needs: readonly Condition[], yields: readonly Outcome[]): Part {
  return { name, label, after, needs, yields };
}

/** Une entreprise écrite : l'action d'entreprendre, la pratique des parties, le désir de poursuite. */
export function endeavor(pid: string, w: number, ulabel: string, gate: readonly Condition[], parts: readonly Part[]): [Action, Practice, Desire] {
  if (parts.length === 0) throw worldErrors.patternVariables('Project.endeavor', pid, 'have parts (an endeavor is work)');
  if (pid.includes('.') || pid.includes('!')) throw worldErrors.notASinglePathSegment('Project.endeavor: id', pid);
  const names = parts.map((p) => p.name);
  const punct = names.find((n) => n.includes('.') || n.includes('!'));
  if (punct !== undefined) throw worldErrors.notASinglePathSegment(`Project.endeavor ${JSON.stringify(pid)}: part name (it keys the ledger)`, punct);
  const seen = new Set<string>();
  for (const n of names) {
    if (seen.has(n)) throw worldErrors.notASinglePathSegment(`Project.endeavor ${JSON.stringify(pid)}: duplicate part name`, n);
    seen.add(n);
  }
  for (const p of parts)
    for (const e of p.after)
      if (!names.includes(e))
        throw worldErrors.patternVariables(`Project.endeavor ${JSON.stringify(pid)}: part ${JSON.stringify(p.name)}`, e, 'name an actual part (a dangling dependency edge)');
  for (const p of parts) {
    const v = authoredVarClash([], p.needs, p.yields)[0];
    if (v !== undefined) throw worldErrors.reservedVarClash(`Project.endeavor ${JSON.stringify(pid)}: part ${JSON.stringify(p.name)}`, v, '');
  }
  let reachable = parts.filter((p) => p.after.length === 0).map((p) => p.name);
  for (;;) {
    const next = [...reachable];
    for (const p of parts) if (p.after.every((e) => next.includes(e)) && !next.includes(p.name)) next.push(p.name);
    if (next.length === reachable.length) break;
    reachable = next;
  }
  const unreachable = names.find((n) => !reachable.includes(n));
  if (unreachable !== undefined)
    throw worldErrors.patternVariables(
      `Project.endeavor ${JSON.stringify(pid)}: part ${JSON.stringify(unreachable)}`,
      unreachable,
      'be reachable (its dependency edges form or feed a cycle) -- unreachable',
    );

  const inst = (suffix: string) => `practice.${pid}${suffix}`;
  const ledger = (n: string) => inst(`.Owner.did.${n}`);
  const undertake = action(ulabel, [...gate, not_(inst('.Actor'))], [insert(inst('.Actor'))]);
  const partAction = (p: Part): Action =>
    action(p.label, [eq('Actor', 'Owner'), not_(ledger(p.name)), ...p.after.map((d) => matches(ledger(d))), ...p.needs], [insert(ledger(p.name)), ...p.yields]);
  const proj = practice(pid, { name: `[Owner] pursues ${pid}`, roles: ['Owner'], actions: parts.map(partAction) });
  const pursuit = desire(`pursues-${pid}`, want([matches(inst('.Owner.did.P'))], w));
  return [undertake, proj, pursuit];
}
