/**
 * `WorldError` — les refus de construction d'un monde (gardes bruyantes).
 * Une violation d'invariant du moteur lève une `Error` ordinaire ; une
 * contradiction logique reste un fait interrogeable (`contradiction`), jamais
 * une erreur.
 *
 * Reprend `prax-core/src/error.rs` (Prax, licence BSD-3-Clause).
 */
export type WorldErrorKind =
  | 'TrailingOperator'
  | 'PathTooLong'
  | 'NestedSubquery'
  | 'DuplicateActionName'
  | 'DuplicateFunctionName'
  | 'DuplicateScheduleRuleName'
  | 'MultiSegmentRuleName'
  | 'MultiSegmentCharacterName'
  | 'NonPositivePeriod'
  | 'ReservedVarClash'
  | 'SeedOutOfDomain'
  | 'DrawOdds'
  | 'LifetimeOnNonInsert'
  | 'GatheringDuration'
  | 'NotASinglePathSegment'
  | 'DuplicateJunctionName'
  | 'ZeroDelayJunction'
  | 'ReservedFamilyAuthored'
  | 'NoPlayableCastMember'
  | 'PatternVariables'
  | 'PersistFormat';

export class WorldError extends Error {
  readonly kind: WorldErrorKind;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(kind: WorldErrorKind, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'WorldError';
    this.kind = kind;
    this.details = details;
  }
}

export const worldErrors = {
  trailingOperator: (sentence: string, op: string) =>
    new WorldError('TrailingOperator', `Chemin Prax ${JSON.stringify(sentence)} : opérateur final ${JSON.stringify(op)} — une phrase finit par un nom, pas par un opérateur`, { sentence, op }),
  pathTooLong: (sentence: string, segments: number) =>
    new WorldError('PathTooLong', `Chemin Prax ${JSON.stringify(sentence)} : ${segments} segments dépassent la limite de 32`, { sentence, segments }),
  nestedSubquery: () =>
    new WorldError('NestedSubquery', 'Condition Prax : une sous-requête est imbriquée dans une autre — les sous-requêtes ne s’imbriquent pas'),
  duplicateActionName: (practice: string, action: string) =>
    new WorldError('DuplicateActionName', `Pratique ${JSON.stringify(practice)} : deux actions nommées ${JSON.stringify(action)} — le nom d’une action est une clé`, { practice, action }),
  duplicateFunctionName: (fn: string) =>
    new WorldError('DuplicateFunctionName', `Fonction ${JSON.stringify(fn)} déjà enregistrée`, { function: fn }),
  duplicateScheduleRuleName: (name: string) =>
    new WorldError('DuplicateScheduleRuleName', `Règle de calendrier ${JSON.stringify(name)} déjà enregistrée`, { name }),
  multiSegmentRuleName: (name: string) =>
    new WorldError('MultiSegmentRuleName', `Le nom d’une règle de calendrier doit être un seul segment : ${JSON.stringify(name)}`, { name }),
  multiSegmentCharacterName: (name: string) =>
    new WorldError('MultiSegmentCharacterName', `Le nom d’un personnage doit être un seul segment : ${JSON.stringify(name)}`, { name }),
  nonPositivePeriod: (name: string) =>
    new WorldError('NonPositivePeriod', `La règle de calendrier ${JSON.stringify(name)} doit avoir une période positive`, { name }),
  reservedVarClash: (context: string, v: string, extra: string) =>
    new WorldError('ReservedVarClash', `Prax ${context} : un fragment écrit ${JSON.stringify(v)} — l’espace de noms Prax est réservé au moteur${extra}`, { context, var: v, extra }),
  seedOutOfDomain: (seed: number, lo: number, hi: number) =>
    new WorldError('SeedOutOfDomain', `Graine ${seed} hors du domaine [${lo}, ${hi}] du dé`, { seed, lo, hi }),
  drawOdds: (num: number, den: number) =>
    new WorldError('DrawOdds', `Chances ${num}/${den} : il faut 0 < num < den`, { num, den }),
  lifetimeOnNonInsert: (outcome: string) =>
    new WorldError('LifetimeOnNonInsert', `Seule une insertion peut porter une durée de vie, reçu : ${outcome}`, { outcome }),
  gatheringDuration: (name: string, period: number, duration: number) =>
    new WorldError('GatheringDuration', `Rassemblement ${JSON.stringify(name)} : il faut 0 < durée < période (durée ${duration} / période ${period})`, { name, period, duration }),
  notASinglePathSegment: (context: string, name: string) =>
    new WorldError('NotASinglePathSegment', `Prax ${context} : ${JSON.stringify(name)} doit être un seul segment non vide (sans « . » ni « ! »)`, { context, name }),
  duplicateJunctionName: (scene: string, junction: string) =>
    new WorldError('DuplicateJunctionName', `Scène ${JSON.stringify(scene)} : deux jonctions nommées ${JSON.stringify(junction)}`, { scene, junction }),
  zeroDelayJunction: (scene: string, junction: string, delay: number) =>
    new WorldError('ZeroDelayJunction', `Scène ${JSON.stringify(scene)}, jonction ${JSON.stringify(junction)} : un délai de ${delay} — une jonction minutée demande au moins un tour`, { scene, junction, delay }),
  reservedFamilyAuthored: (site: string, sentence: string, family: string) =>
    new WorldError('ReservedFamilyAuthored', `${site} écrit ${JSON.stringify(sentence)} — la famille ${JSON.stringify(family)} est réservée aux jonctions minutées`, { site, sentence, family }),
  noPlayableCastMember: () => new WorldError('NoPlayableCastMember', 'Script : aucun personnage jouable'),
  patternVariables: (context: string, pattern: string, needs: string) =>
    new WorldError('PatternVariables', `Prax ${context} : le motif ${JSON.stringify(pattern)} doit ${needs}`, { context, pattern, needs }),
  persistFormat: (message: string) => new WorldError('PersistFormat', `Sauvegarde Prax : ${message}`),
};
