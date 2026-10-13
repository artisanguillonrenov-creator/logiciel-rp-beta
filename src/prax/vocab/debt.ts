/**
 * Dette : une obligation avec un bénéficiaire. Le fait
 * `debt.<créancier>.<débiteur>.<contenu>` s'ajoute à l'obligation déontique
 * (inchangée).
 *
 * Reprend `prax-vocab/src/debt.rs` (Prax, BSD-3-Clause).
 */
import { worldErrors } from '../core/errors';
import { Condition, matches } from '../core/query';
import { Outcome, del, insert } from '../core/types';
import { discharge, oblige } from './deontic';

const punctuated = (n: string): boolean => n.includes('.') || n.includes('!');

export function debtPath(creditor: string, debtor: string, content: string): string {
  if (punctuated(creditor) || punctuated(debtor)) throw worldErrors.notASinglePathSegment('Debt.debt_path', punctuated(creditor) ? creditor : debtor);
  return `debt.${creditor}.${debtor}.${content}`;
}

export function owe(creditor: string, debtor: string, content: string): Outcome[] {
  return [insert(debtPath(creditor, debtor, content)), oblige(debtor, content)];
}

export function settle(creditor: string, debtor: string, content: string): Outcome[] {
  return [del(debtPath(creditor, debtor, content)), discharge(debtor, content)];
}

export function owes(creditor: string, debtor: string, content: string): Condition {
  return matches(debtPath(creditor, debtor, content));
}
