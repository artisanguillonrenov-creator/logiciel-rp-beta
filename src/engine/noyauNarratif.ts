import type { StoryState } from '../types';

// Noyau narratif V12 (repris de la V13, elyndor-narrative-core.js) : l'état
// narratif structuré qui fait autorité sur le récit.
// - ledger : journal des événements de chaque tour ;
// - canon : faits versionnés (sujet.prédicat = valeur, avec validité) ;
// - beliefs : ce que chaque personnage sait ou croit, et par quel vecteur ;
// - rumors, reputation, debts : rumeurs qui se propagent, réputation par
//   faction (seulement si l'acte est connu), dettes narratives ;
// - storylets / simulationQueue : opportunités et activités hors écran.
// Le narrateur termine sa réponse par un bloc JSON masqué (« delta ») que le
// logiciel valide avant de l'intégrer : ce qui est incomplet, contradictoire
// ou non étayé par le texte final part en quarantaine au lieu du canon.
//
// Le format des données (clés anglaises, `narrativeCore`) est celui de la
// V13 pour que les histoires restent compatibles entre les deux versions.

export const VERSION_NOYAU = '12.0.0';
export const MARQUEUR_ETAT = '<<<ELYNDOR_STATE_V12>>>';
export const FIN_ETAT = '<<<END_ELYNDOR_STATE_V12>>>';

// Plafonds réduits par rapport à la V13 (ledger 5 000…) : l'état est
// réécrit à chaque sauvegarde, sur téléphone comme sur le web.
const MAX = { ledger: 2000, canon: 2000, beliefs: 2500, rumors: 500, reputation: 400, debts: 400, quarantine: 200, audit: 80, simulation: 150 };

type Obj = Record<string, any>;

export interface NarrativeCoreState {
  version: string;
  _seq: number;
  createdAt: number;
  updatedAt: number;
  authoritative: boolean;
  clock: { day: number; minute: number; label: string; lastAdvanceMinutes: number };
  ledger: Obj[];
  canon: Obj[];
  beliefs: Obj[];
  rumors: Obj[];
  reputation: Obj[];
  debts: Obj[];
  storylets: Obj[];
  bdi: Obj[];
  simulationQueue: Obj[];
  quarantine: Obj[];
  inspector: { lastContext: Obj | null; lastCommit: Obj | null; audit: Obj[] };
  migration: { legacyImported: boolean; sourceVersion: number | null; at: number | null };
}

type HistoireAvecNoyau = StoryState & { narrativeCore: NarrativeCoreState };

const MOTS_VIDES = new Set(
  'avec dans pour mais plus comme tout elle elles leur leurs nous vous cette ceci cela sans sous alors encore entre apres avant vers dont tres bien fait faire etre avait sont sera ses son sur une des les que qui aux par pas dans du de la le un une au aux en et ou a à il ils on ce ces se sa son ses ne ni car puis donc'.split(/\s+/),
);
const SYNONYMES: Record<string, string[]> = {
  promesse: ['promis', 'jure', 'juré', 'engagement', 'serment'],
  trahison: ['trahi', 'betrayal', 'mensonge', 'trompe'],
  tuer: ['tue', 'tué', 'mort', 'assassine', 'assassiné', 'meurtre'],
  peur: ['craint', 'terreur', 'effraie', 'effrayé'],
  colere: ['furieux', 'furieuse', 'haine', 'hostile', 'hostilite'],
  voyage: ['part', 'quitte', 'arrive', 'rejoint', 'route', 'trajet'],
  secret: ['cache', 'caché', 'ignore', 'sait', 'connait', 'connaît'],
  dette: ['doit', 'redevable', 'faveur'],
  blessure: ['blesse', 'blessé', 'plaie', 'sang', 'fracture'],
};

const maintenant = () => Date.now();
function nouvelId(prefixe: string, core: NarrativeCoreState): string {
  core._seq = (Number(core._seq) || 0) + 1;
  return `${prefixe}-${String(core._seq).padStart(6, '0')}`;
}
function norm(v: unknown): string {
  return String(v ?? '').toLocaleLowerCase('fr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9'’ -]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function jetons(v: unknown): Set<string> {
  const mots = norm(v).split(' ').filter((x) => x.length >= 3 && !MOTS_VIDES.has(x));
  const resultat = new Set(mots);
  for (const mot of mots) {
    for (const [cle, valeurs] of Object.entries(SYNONYMES)) {
      if (mot === cle || valeurs.includes(mot)) {
        resultat.add(cle);
        valeurs.forEach((x) => resultat.add(x));
      }
    }
  }
  return resultat;
}
function similarite(a: unknown, b: unknown): number {
  const A = jetons(a);
  const B = jetons(b);
  if (!A.size || !B.size) return 0;
  let communs = 0;
  for (const x of A) if (B.has(x)) communs += 1;
  return communs / Math.sqrt(A.size * B.size);
}
function borner(n: unknown, min: number, max: number): number {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : 0;
}
function texte(v: unknown, n = 320): string {
  const t = String(v ?? '').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`;
}
const liste = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const objet = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const uniques = (v: unknown): string[] => [...new Set(liste(v).map((x) => String(x ?? '').trim()).filter(Boolean))];

export function etatNoyauVide(): NarrativeCoreState {
  return {
    version: VERSION_NOYAU,
    _seq: 0,
    createdAt: maintenant(),
    updatedAt: maintenant(),
    authoritative: true,
    clock: { day: 0, minute: 720, label: 'Chronologie relative', lastAdvanceMinutes: 0 },
    ledger: [], canon: [], beliefs: [], rumors: [], reputation: [], debts: [], storylets: [], bdi: [], simulationQueue: [], quarantine: [],
    inspector: { lastContext: null, lastCommit: null, audit: [] },
    migration: { legacyImported: false, sourceVersion: null, at: null },
  };
}

function horloge(c: NarrativeCoreState['clock']): string {
  const jour = Math.max(0, Number(c.day) || 0);
  const minute = Math.max(0, Number(c.minute) || 0) % 1440;
  return `J${jour} ${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

function avancerHorloge(core: NarrativeCoreState, minutes: number): void {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  core.clock.lastAdvanceMinutes = m;
  if (!m) return;
  const total = (Number(core.clock.minute) || 0) + m;
  core.clock.day = (Number(core.clock.day) || 0) + Math.floor(total / 1440);
  core.clock.minute = total % 1440;
}

const NOMBRES: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  onze: 11, douze: 12, quinze: 15, vingt: 20, trente: 30, quarante: 40,
};

// Temps écoulé : annoncé par le delta, sinon déduit du message du joueur.
function deduireTemps(messageJoueur: string, delta: Obj | null): number {
  if (Number(delta?.timeAdvanceMinutes) > 0) return Math.min(525_600, Number(delta!.timeAdvanceMinutes));
  // Nombres en toutes lettres (« deux heures plus tard ») : la V13 ne
  // lisait que les chiffres et retombait sur « plus tard » = 30 min.
  const n = norm(messageJoueur).replace(/\b(une?|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|quinze|vingt|trente|quarante)\b/g, (mot) => String(NOMBRES[mot]));
  const m = n.match(/(\d+)\s*(minute|minutes|heure|heures|jour|jours|semaine|semaines|mois)/);
  if (m) {
    const q = Number(m[1]);
    const u = m[2];
    return q * (u.startsWith('minute') ? 1 : u.startsWith('heure') ? 60 : u.startsWith('jour') ? 1440 : u.startsWith('semaine') ? 10_080 : 43_200);
  }
  if (/le lendemain|jour suivant/.test(n)) return 1440;
  if (/quelques heures plus tard/.test(n)) return 180;
  if (/plus tard/.test(n)) return 30;
  return 0;
}

function tronquerEtat(c: NarrativeCoreState): void {
  const paires: [keyof typeof MAX, number][] = [
    ['ledger', MAX.ledger], ['canon', MAX.canon], ['beliefs', MAX.beliefs], ['rumors', MAX.rumors],
    ['reputation', MAX.reputation], ['debts', MAX.debts], ['quarantine', MAX.quarantine], ['simulation', MAX.simulation],
  ];
  for (const [cle, max] of paires) {
    const champ = cle === 'simulation' ? 'simulationQueue' : cle;
    const valeurs = (c as any)[champ] as any[];
    if (valeurs.length > max) (c as any)[champ] = valeurs.slice(-max);
  }
  if (c.inspector.audit.length > MAX.audit) c.inspector.audit = c.inspector.audit.slice(-MAX.audit);
}

function factActuel(core: NarrativeCoreState, sujet: string, predicat: string): Obj | null {
  const S = norm(sujet);
  const P = norm(predicat);
  return [...core.canon].reverse().find((f) => !f.validToEvent && norm(f.subject) === S && norm(f.predicate) === P) ?? null;
}

export interface EvenementHerite {
  resultat?: string;
  actionJoueur?: string;
  lieu?: string;
  participants?: string[];
  messageIndex?: number;
  timestamp?: number;
}

// Première ouverture d'une histoire antérieure au noyau : on amorce le
// journal avec la mémoire narrative, les faits et les personnages connus.
function importerHeritage(story: HistoireAvecNoyau, evenements: EvenementHerite[]): void {
  const c = story.narrativeCore;
  c.migration = { legacyImported: true, sourceVersion: story.version ?? null, at: maintenant() };
  for (const e of evenements.slice(-300)) {
    c.ledger.push({
      id: nouvelId('legacy', c), type: 'legacy_scene', summary: texte(e.resultat || e.actionJoueur || '', 420), actors: [], targets: [],
      location: e.lieu || '', witnesses: uniques(e.participants), importance: 0.35, public: false, worldTime: horloge(c.clock),
      source: { kind: 'legacy_memory', messageIndex: e.messageIndex }, createdAt: Number(e.timestamp) || maintenant(),
    });
  }
  for (const f of story.memoire.faits.filter((x) => x?.texte).slice(-250)) {
    c.canon.push({
      id: nouvelId('fact', c), subject: 'legacy', predicate: 'established_fact', value: texte(f.texte, 500), validFromEvent: null,
      validToEvent: null, sourceEvent: null, confidence: f.niveau === 'canon' ? 1 : 0.8, createdAt: maintenant(), legacy: true,
    });
  }
  for (const r of story.social.relations) {
    if (!r?.nom) continue;
    c.bdi.push({ id: nouvelId('bdi', c), name: String(r.nom).trim(), beliefs: [], desires: [], intentions: [], updatedAt: maintenant(), legacy: true });
  }
  c.updatedAt = maintenant();
}

/** Garantit un noyau complet et à jour (histoires anciennes, sauvegardes V13). */
export function assurerNoyau(story: StoryState, evenementsHerites: EvenementHerite[] = []): HistoireAvecNoyau {
  const c = objet(story.narrativeCore);
  const base = etatNoyauVide();
  const core: NarrativeCoreState = {
    ...base,
    ...c,
    version: VERSION_NOYAU,
    clock: { ...base.clock, ...objet(c.clock) },
    inspector: { ...base.inspector, ...objet(c.inspector), audit: liste(objet(c.inspector).audit) },
    migration: { ...base.migration, ...objet(c.migration) },
    ledger: liste(c.ledger), canon: liste(c.canon), beliefs: liste(c.beliefs), rumors: liste(c.rumors), reputation: liste(c.reputation),
    debts: liste(c.debts), storylets: liste(c.storylets), bdi: liste(c.bdi), simulationQueue: liste(c.simulationQueue), quarantine: liste(c.quarantine),
  };
  const s: HistoireAvecNoyau = { ...story, narrativeCore: core };
  if (!core.migration.legacyImported) importerHeritage(s, evenementsHerites);
  tronquerEtat(core);
  return s;
}

interface DeltaValide {
  events: Obj[];
  stateChanges: Obj[];
  knowledgeTransfers: Obj[];
  relationshipSignals: Obj[];
  reputationSignals: Obj[];
  commitments: Obj[];
  narrativeDebts: Obj[];
  npcStates: Obj[];
  timeAdvanceMinutes: number;
  scene: Obj;
}

// Le delta proposé par le modèle n'entre jamais tel quel dans le canon.
function validerDelta(story: HistoireAvecNoyau, delta: unknown, texteFinal: string, corrige: boolean): { delta: DeltaValide; quarantaine: Obj[] } {
  const c = story.narrativeCore;
  const d = objet(delta);
  const q: Obj[] = [];
  const propre: DeltaValide = {
    events: [], stateChanges: [], knowledgeTransfers: [], relationshipSignals: [], reputationSignals: [], commitments: [], narrativeDebts: [], npcStates: [],
    timeAdvanceMinutes: Number(d.timeAdvanceMinutes) || 0, scene: objet(d.scene),
  };
  const finalNormalise = norm(texteFinal);
  for (const ev of liste(d.events).slice(0, 12)) {
    if (!ev || !String(ev.summary || '').trim()) { q.push({ kind: 'event', reason: 'event_without_summary', candidate: ev }); continue; }
    // Après une réparation, un événement que le texte final ne raconte plus n'a pas eu lieu.
    if (corrige && similarite(ev.summary, texteFinal) < 0.12) { q.push({ kind: 'event', reason: 'post_repair_mismatch', candidate: ev }); continue; }
    propre.events.push({
      type: texte(ev.type || 'event', 60), summary: texte(ev.summary, 500), actors: uniques(ev.actors).slice(0, 12), targets: uniques(ev.targets).slice(0, 12),
      location: texte(ev.location || propre.scene.location || story.meta?.contexte?.lieu || '', 120), witnesses: uniques(ev.witnesses).slice(0, 24),
      importance: borner(ev.importance ?? 0.5, 0, 1), public: !!ev.public,
    });
  }
  const vus = new Map<string, string>();
  for (const sc of liste(d.stateChanges).slice(0, 20)) {
    if (!sc?.subject || !sc?.predicate || sc.to === undefined) { q.push({ kind: 'state', reason: 'incomplete_change', candidate: sc }); continue; }
    const confiance = borner(sc.confidence ?? 0.75, 0, 1);
    if (confiance < 0.55) { q.push({ kind: 'state', reason: 'low_confidence', candidate: sc }); continue; }
    const cle = `${norm(sc.subject)}|${norm(sc.predicate)}`;
    const valeur = JSON.stringify(sc.to);
    if (vus.has(cle) && vus.get(cle) !== valeur) { q.push({ kind: 'state', reason: 'conflicting_delta', candidate: sc }); continue; }
    vus.set(cle, valeur);
    const actuel = factActuel(c, sc.subject, sc.predicate);
    if (sc.from !== undefined && sc.from !== null && actuel && norm(String(actuel.value)) !== norm(String(sc.from))) {
      q.push({ kind: 'state', reason: 'from_mismatch', candidate: sc, current: actuel.value });
      continue;
    }
    if (corrige && similarite(`${sc.subject} ${sc.predicate} ${String(sc.to)}`, texteFinal) < 0.03 && !finalNormalise.includes(norm(sc.subject))) {
      q.push({ kind: 'state', reason: 'post_repair_unsupported', candidate: sc });
      continue;
    }
    propre.stateChanges.push({ subject: texte(sc.subject, 120), predicate: texte(sc.predicate, 100), from: sc.from, to: sc.to, confidence: confiance });
  }
  for (const kt of liste(d.knowledgeTransfers).slice(0, 24)) {
    if (kt?.knower && kt?.fact) {
      propre.knowledgeTransfers.push({ knower: texte(kt.knower, 120), fact: texte(kt.fact, 500), source: texte(kt.source || 'scene', 120), type: texte(kt.type || 'TOLD', 32).toUpperCase(), confidence: borner(kt.confidence ?? 0.8, 0, 1) });
    }
  }
  for (const rs of liste(d.relationshipSignals).slice(0, 16)) {
    if (rs?.from && rs?.to) propre.relationshipSignals.push({ ...rs, from: texte(rs.from, 100), to: texte(rs.to, 100), reason: texte(rs.reason || '', 300) });
  }
  for (const rp of liste(d.reputationSignals).slice(0, 16)) {
    if (rp?.subject && rp?.faction) {
      propre.reputationSignals.push({ subject: texte(rp.subject, 100), faction: texte(rp.faction, 120), delta: borner(rp.delta, -20, 20), reason: texte(rp.reason || '', 300), knownByPublic: !!rp.knownByPublic });
    }
  }
  for (const cm of liste(d.commitments).slice(0, 12)) {
    if (cm?.description) propre.commitments.push({ type: texte(cm.type || 'commitment', 60), party: texte(cm.party || '', 100), description: texte(cm.description, 420), status: texte(cm.status || 'open', 30) });
  }
  for (const nd of liste(d.narrativeDebts).slice(0, 12)) {
    if (nd?.summary) propre.narrativeDebts.push({ type: texte(nd.type || 'unresolved', 60), source: texte(nd.source || '', 100), target: texte(nd.target || '', 100), summary: texte(nd.summary, 420), urgency: borner(nd.urgency ?? 0.4, 0, 1) });
  }
  for (const ns of liste(d.npcStates).slice(0, 12)) {
    if (ns?.name) {
      propre.npcStates.push({
        name: texte(ns.name, 120), beliefs: uniques(ns.beliefs).slice(0, 10).map((x) => texte(x, 320)),
        desires: uniques(ns.desires).slice(0, 8).map((x) => texte(x, 260)), intentions: uniques(ns.intentions).slice(0, 8).map((x) => texte(x, 260)),
      });
    }
  }
  return { delta: propre, quarantaine: q };
}

// Sans delta exploitable (modèle muet, JSON coupé), le tour est tout de même
// journalisé à partir du texte.
function deltaHeuristique(story: HistoireAvecNoyau, messageJoueur: string, reponse: string): DeltaValide {
  const tout = `${messageJoueur}\n${reponse}`;
  const noms: string[] = [];
  const locuteurs = /(?:^|\n)\s*([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ0-9'’ _-]{1,38})\s*:\s*[«"]/gm;
  for (let m = locuteurs.exec(reponse); m; m = locuteurs.exec(reponse)) noms.push(m[1].trim());
  const type = /\b(tu[eé]|assassin|mort)\b/i.test(tout) ? 'violence' : /\b(promet|jure|serment)\b/i.test(tout) ? 'promise' : /\b(quitte|part|arrive|rejoint)\b/i.test(tout) ? 'movement' : 'scene';
  return {
    events: [{ type, summary: texte(reponse, 420), actors: uniques([story.meta?.personnageNom, ...noms]), targets: [], location: story.meta?.contexte?.lieu || '', witnesses: uniques(noms), importance: type === 'scene' ? 0.3 : 0.65, public: false }],
    stateChanges: [], knowledgeTransfers: [], relationshipSignals: [], reputationSignals: [], commitments: [], narrativeDebts: [],
    npcStates: noms.map((name) => ({ name, beliefs: [], desires: [], intentions: [] })),
    timeAdvanceMinutes: deduireTemps(messageJoueur, null),
    scene: { location: story.meta?.contexte?.lieu || '', changed: false },
  };
}

function ajouterCroyance(c: NarrativeCoreState, porteur: string, fait: string, source: string, type: string, confiance: number, evenement: string | null): void {
  if (!porteur || !fait) return;
  const K = norm(porteur);
  const F = norm(fait);
  const existante = [...c.beliefs].reverse().find((b) => norm(b.knower) === K && norm(b.fact) === F && b.status !== 'superseded');
  if (existante) {
    existante.confidence = Math.max(existante.confidence || 0, confiance || 0);
    existante.updatedAt = maintenant();
    return;
  }
  c.beliefs.push({
    id: nouvelId('belief', c), knower: texte(porteur, 120), fact: texte(fait, 500), source: texte(source || '', 160), type: texte(type || 'TOLD', 32),
    confidence: borner(confiance ?? 0.8, 0, 1), acquiredEvent: evenement || null, status: 'active', createdAt: maintenant(), updatedAt: maintenant(),
  });
}

function appliquerRelations(story: HistoireAvecNoyau, signaux: Obj[], evenement: string | null): void {
  const c = story.narrativeCore;
  for (const s of signaux) {
    const cle = `${norm(s.from)}|${norm(s.to)}`;
    let ligne = c.reputation.find((r) => r.scope === 'personal' && r.key === cle);
    if (!ligne) {
      ligne = { id: nouvelId('rel', c), scope: 'personal', key: cle, subject: s.from, target: s.to, trust: 0, respect: 0, fear: 0, affection: 0, hostility: 0, updatedAt: maintenant() };
      c.reputation.push(ligne);
    }
    for (const axe of ['trust', 'respect', 'fear', 'affection', 'hostility']) ligne[axe] = borner((ligne[axe] || 0) + borner(s[axe] || 0, -10, 10), -100, 100);
    ligne.reason = s.reason || ligne.reason;
    ligne.sourceEvent = evenement;
    ligne.updatedAt = maintenant();
  }
}

// La réputation auprès d'une faction ne bouge que si l'acte y est connu.
function appliquerReputation(c: NarrativeCoreState, signaux: Obj[], evenements: Obj[], evenement: string | null): void {
  const actepublic = evenements.some((e) => e.public);
  for (const s of signaux) {
    const connu = !!s.knownByPublic || actepublic || c.rumors.some((r) => r.status === 'public' && similarite(r.claim, s.reason || s.subject) > 0.08);
    if (!connu) {
      c.quarantine.push({ id: nouvelId('q', c), kind: 'reputation', reason: 'knowledge_gate_blocked', candidate: s, sourceTurn: evenement, createdAt: maintenant() });
      continue;
    }
    const cle = `${norm(s.subject)}|${norm(s.faction)}`;
    let ligne = c.reputation.find((r) => r.scope === 'faction' && r.key === cle);
    if (!ligne) {
      ligne = { id: nouvelId('rep', c), scope: 'faction', key: cle, subject: s.subject, faction: s.faction, score: 0, updatedAt: maintenant() };
      c.reputation.push(ligne);
    }
    ligne.score = borner((ligne.score || 0) + s.delta, -100, 100);
    ligne.reason = s.reason;
    ligne.sourceEvent = evenement;
    ligne.updatedAt = maintenant();
  }
}

function majEtatsPnj(c: NarrativeCoreState, etats: Obj[], evenement: string | null): void {
  for (const s of etats) {
    let ligne = c.bdi.find((x) => norm(x.name) === norm(s.name));
    if (!ligne) {
      ligne = { id: nouvelId('bdi', c), name: s.name, beliefs: [], desires: [], intentions: [], updatedAt: maintenant() };
      c.bdi.push(ligne);
    }
    ligne.beliefs = uniques([...ligne.beliefs, ...s.beliefs]).slice(-20);
    ligne.desires = uniques([...ligne.desires, ...s.desires]).slice(-12);
    ligne.intentions = uniques([...ligne.intentions, ...s.intentions]).slice(-12);
    ligne.sourceEvent = evenement;
    ligne.updatedAt = maintenant();
  }
}

// Une rumeur ne voyage que si du temps passe ou si la scène change, par les
// factions de ceux qui l'ont vue, et se déforme en chemin.
function propagerRumeurs(story: HistoireAvecNoyau, minutes: number, sceneChangee: boolean): void {
  if (!(minutes >= 60 || sceneChangee)) return;
  const c = story.narrativeCore;
  const relations = story.social.relations;
  for (const r of c.rumors.filter((x) => x.status !== 'dead').slice(-40)) {
    const factions = new Set<string>(r.factions || []);
    for (const porteur of r.carriers || []) {
      const rel = relations.find((x) => norm(x.nom) === norm(porteur));
      if (rel?.faction) factions.add(String(rel.faction));
    }
    r.factions = [...factions];
    if (r.factions.length) {
      r.distortion = borner((r.distortion || 0) + 0.08, 0, 0.6);
      r.status = r.factions.length >= 2 ? 'spreading' : 'faction';
      r.updatedAt = maintenant();
      for (const f of r.factions) ajouterCroyance(c, `Faction:${f}`, r.claim, `rumor:${r.id}`, 'RUMOR', Math.max(0.45, 1 - r.distortion), r.originEvent);
    }
  }
}

function evenementsDepuis(c: NarrativeCoreState, idEvenement: string | null): number {
  if (!idEvenement) return c.ledger.length;
  const i = c.ledger.findIndex((e) => e.id === idEvenement);
  return i < 0 ? c.ledger.length : c.ledger.length - 1 - i;
}

function evaluerStorylets(story: HistoireAvecNoyau): void {
  const c = story.narrativeCore;
  const opportunites: Obj[] = [];
  for (const d of c.debts.filter((x) => x.status === 'open').slice(-80)) {
    const age = evenementsDepuis(c, d.createdEvent);
    if (d.urgency >= 0.7 || age >= 14) {
      opportunites.push({ id: `debt:${d.id}`, type: 'narrative_debt_due', priority: Math.round(60 + d.urgency * 35 + Math.min(10, age / 4)), text: `Conséquence potentielle liée à « ${texte(d.summary, 220)} ». Ne la force que si elle découle naturellement de la scène.` });
    }
  }
  for (const r of c.reputation.filter((x) => x.scope === 'faction' && Math.abs(x.score || 0) >= 20).slice(-20)) {
    opportunites.push({ id: `rep:${r.id}`, type: 'reputation_consequence', priority: 70 + Math.min(20, Math.abs(r.score) / 4), text: `La réputation de ${r.subject} auprès de ${r.faction} (${r.score > 0 ? 'positive' : 'négative'}) peut influencer une interaction pertinente.` });
  }
  for (const r of c.rumors.filter((x) => x.status === 'spreading' || x.status === 'public').slice(-12)) {
    opportunites.push({ id: `rumor:${r.id}`, type: 'rumor_surface', priority: 68, text: `Une rumeur circule : « ${texte(r.claim, 220)} ». Elle n'est pas forcément vraie et doit rester distinguée du canon.` });
  }
  c.storylets = opportunites.sort((a, b) => b.priority - a.priority).slice(0, 30);
}

// Six heures ou plus écoulées : les intentions des PNJ arrivent à échéance
// hors écran (candidates, pas des faits acquis).
function planifierHorsEcran(story: HistoireAvecNoyau, minutes: number): void {
  if (minutes < 360) return;
  const c = story.narrativeCore;
  for (const n of c.bdi.filter((x) => x.intentions?.length).slice(-12)) {
    c.simulationQueue.push({ id: nouvelId('sim', c), type: 'offscreen_intention_due', npc: n.name, intention: n.intentions.at(-1), dueAt: horloge(c.clock), status: 'candidate', createdAt: maintenant() });
  }
}

export interface OptionsTour {
  messageJoueur: { id?: string; content: string };
  messageNarrateur: { id?: string; content: string; timestamp?: number };
  delta?: unknown;
  corrige?: boolean;
}

/** Intègre le tour au noyau : événements, canon, croyances, rumeurs, dettes… */
export function validerTour(story: StoryState, options: OptionsTour, evenementsHerites: EvenementHerite[] = []): HistoireAvecNoyau {
  const s = assurerNoyau(story, evenementsHerites);
  const c = s.narrativeCore;
  const { messageJoueur, messageNarrateur } = options;
  const brut = options.delta || deltaHeuristique(s, messageJoueur.content, messageNarrateur.content);
  const { delta: d, quarantaine } = validerDelta(s, brut, messageNarrateur.content || '', !!options.corrige);
  const minutes = deduireTemps(messageJoueur.content || '', d);
  avancerHorloge(c, minutes);

  const engages: Obj[] = [];
  for (const ev of d.events) {
    const id = nouvelId('evt', c);
    const ligne = { id, ...ev, worldTime: horloge(c.clock), source: { kind: 'turn', userMessageId: messageJoueur.id || null, assistantMessageId: messageNarrateur.id || null }, createdAt: messageNarrateur.timestamp || maintenant() };
    c.ledger.push(ligne);
    engages.push(ligne);
    for (const qui of uniques([...ev.actors, ...ev.targets, ...ev.witnesses])) {
      ajouterCroyance(c, qui, ev.summary, id, ev.witnesses.includes(qui) ? 'SEEN' : 'PARTICIPATED', 1, id);
    }
    if (ev.importance >= 0.65 && ev.witnesses.length) {
      c.rumors.push({ id: nouvelId('rumor', c), originEvent: id, claim: ev.summary, carriers: [...ev.witnesses], factions: [], distortion: 0, status: ev.public ? 'public' : 'contained', createdAt: maintenant(), updatedAt: maintenant() });
    }
  }
  const source = engages.at(-1)?.id ?? null;
  for (const sc of d.stateChanges) {
    const actuel = factActuel(c, sc.subject, sc.predicate);
    if (actuel) actuel.validToEvent = source || `turn:${messageNarrateur.id || maintenant()}`;
    c.canon.push({ id: nouvelId('fact', c), subject: sc.subject, predicate: sc.predicate, value: sc.to, validFromEvent: source, validToEvent: null, sourceEvent: source, confidence: sc.confidence, createdAt: maintenant() });
  }
  for (const kt of d.knowledgeTransfers) ajouterCroyance(c, kt.knower, kt.fact, kt.source, kt.type, kt.confidence, source);
  appliquerRelations(s, d.relationshipSignals, source);
  appliquerReputation(c, d.reputationSignals, engages, source);
  for (const cm of d.commitments) {
    c.debts.push({ id: nouvelId('debt', c), kind: 'commitment', type: cm.type, source: cm.party, target: s.meta?.personnageNom || '', summary: cm.description, urgency: 0.45, status: cm.status === 'resolved' ? 'resolved' : 'open', createdEvent: source, createdAt: maintenant(), resolvedEvent: null });
  }
  for (const nd of d.narrativeDebts) c.debts.push({ id: nouvelId('debt', c), kind: 'narrative', ...nd, status: 'open', createdEvent: source, createdAt: maintenant(), resolvedEvent: null });
  majEtatsPnj(c, d.npcStates, source);
  for (const q of quarantaine) c.quarantine.push({ id: nouvelId('q', c), ...q, sourceTurn: messageNarrateur.id || null, createdAt: maintenant() });
  propagerRumeurs(s, minutes, !!d.scene?.changed);
  evaluerStorylets(s);
  planifierHorsEcran(s, minutes);
  c.updatedAt = maintenant();
  c.inspector.lastCommit = {
    at: maintenant(), eventIds: engages.map((e) => e.id), stateChanges: d.stateChanges.length, knowledgeTransfers: d.knowledgeTransfers.length,
    quarantined: quarantaine.length, clock: horloge(c.clock), assistantMessageId: messageNarrateur.id || null,
  };
  c.inspector.audit.push({ kind: 'commit', ...c.inspector.lastCommit });
  tronquerEtat(c);
  return s;
}

/**
 * Régénération ou suppression du dernier échange : retire du noyau ce que
 * ce tour y avait ajouté (événements, faits, croyances, rumeurs, dettes) et
 * rouvre les faits qu'il avait remplacés. Les ajustements de réputation,
 * cumulés, ne sont pas défaits.
 */
export function annulerTour(story: StoryState, idMessageNarrateur: string): StoryState {
  const core = story.narrativeCore;
  if (!core || !idMessageNarrateur) return story;
  const c: NarrativeCoreState = JSON.parse(JSON.stringify(core));
  const retires = new Set(c.ledger.filter((e) => e.source?.assistantMessageId === idMessageNarrateur).map((e) => e.id as string));
  const annule = c.inspector.lastCommit?.assistantMessageId === idMessageNarrateur;
  if (!retires.size && !annule) return story;
  const issuDuTour = (id: unknown) => typeof id === 'string' && (retires.has(id) || id === `turn:${idMessageNarrateur}`);
  c.ledger = c.ledger.filter((e) => !retires.has(e.id));
  c.canon = c.canon.filter((f) => !issuDuTour(f.sourceEvent));
  for (const f of c.canon) if (issuDuTour(f.validToEvent)) f.validToEvent = null;
  c.beliefs = c.beliefs.filter((b) => !issuDuTour(b.acquiredEvent));
  c.rumors = c.rumors.filter((r) => !issuDuTour(r.originEvent));
  c.debts = c.debts.filter((d) => !issuDuTour(d.createdEvent));
  c.quarantine = c.quarantine.filter((q) => q.sourceTurn !== idMessageNarrateur);
  if (annule) {
    const minutes = Number(c.clock.lastAdvanceMinutes) || 0;
    const total = (Number(c.clock.day) || 0) * 1440 + (Number(c.clock.minute) || 0) - minutes;
    c.clock.day = Math.max(0, Math.floor(total / 1440));
    c.clock.minute = Math.max(0, total) % 1440;
    c.clock.lastAdvanceMinutes = 0;
    c.inspector.lastCommit = null;
  }
  const s: HistoireAvecNoyau = { ...story, narrativeCore: c };
  evaluerStorylets(s);
  return s;
}

/** Annule, du plus récent au plus ancien, les tours de réponses supprimées. */
export function annulerTours(story: StoryState, idsMessagesNarrateur: string[]): StoryState {
  return [...idsMessagesNarrateur].reverse().reduce((s, id) => annulerTour(s, id), story);
}

function classerEvenements(story: HistoireAvecNoyau, requete: string): { e: Obj; score: number }[] {
  const c = story.narrativeCore;
  const noms = nomsCites(story, requete);
  const total = c.ledger.length;
  return c.ledger
    .map((e, i) => {
      let score = similarite(`${e.summary} ${e.location} ${(e.actors || []).join(' ')} ${(e.targets || []).join(' ')}`, requete) * 55;
      for (const n of noms) if (norm(JSON.stringify(e)).includes(norm(n))) score += 18;
      score += Math.max(0, 12 - (total - i) / 40);
      score += (e.importance || 0) * 15;
      if (e.location && norm(requete).includes(norm(e.location))) score += 12;
      return { e, score };
    })
    .filter((x) => x.score > 8)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
}

function nomsCites(story: HistoireAvecNoyau, requete: string): string[] {
  const connus = new Set<string>();
  for (const b of story.narrativeCore.bdi) connus.add(b.name);
  for (const r of story.social.relations) if (r?.nom) connus.add(r.nom);
  for (const l of story.loreEmergent) if (l?.categorie === 'pnj' && l?.titre) connus.add(l.titre);
  const q = norm(requete);
  return [...connus].filter((n) => q.includes(norm(n))).slice(0, 6);
}

function texteMonde(story: HistoireAvecNoyau): string {
  const c = story.narrativeCore;
  const lignes = [`Horloge du monde: ${horloge(c.clock)}.`];
  for (const f of c.canon.filter((x) => !x.validToEvent).slice(-18)) if (f.subject !== 'legacy') lignes.push(`${f.subject} — ${f.predicate}: ${String(f.value)}`);
  return lignes.join('\n');
}

function texteSocial(story: HistoireAvecNoyau, requete: string): string {
  const c = story.narrativeCore;
  const noms = nomsCites(story, requete);
  const lignes: string[] = [];
  for (const n of noms) {
    const b = c.bdi.find((x) => norm(x.name) === norm(n));
    if (b) {
      if (b.beliefs.length) lignes.push(`${n} croit/sait: ${b.beliefs.slice(-3).join(' | ')}`);
      if (b.intentions.length) lignes.push(`${n} intention actuelle: ${b.intentions.at(-1)}`);
    }
    for (const x of c.beliefs.filter((y) => norm(y.knower) === norm(n) && y.status === 'active').slice(-4)) lignes.push(`${n} [${x.type}] ${x.fact}`);
  }
  for (const r of c.reputation.filter((x) => x.scope === 'faction').slice(-8)) {
    if (!noms.length || noms.some((n) => norm(n) === norm(r.subject))) lignes.push(`Réputation: ${r.subject} / ${r.faction}: ${r.score}`);
  }
  return lignes.join('\n');
}

export const DIRECTIVE_ETAT = `[STATE DELTA V12 — MACHINE, OBLIGATOIRE]
Apres la narration, ajoute ${MARQUEUR_ETAT}, puis un JSON compact, puis ${FIN_ETAT}. Ce bloc sera masque. Seulement les faits etablis par la scene; omets les champs/listes vides; n'invente rien pour remplir. Cles: events[{type,summary,actors,targets,location,witnesses,importance(0..1),public}], stateChanges[{subject,predicate,from,to,confidence}], knowledgeTransfers[{knower,fact,source,type,confidence}], relationshipSignals[{from,to,trust,respect,fear,affection,hostility,reason}], reputationSignals[{subject,faction,delta,reason,knownByPublic}], commitments[{type,party,description,status}], narrativeDebts[{type,source,target,summary,urgency}], npcStates[{name,beliefs,desires,intentions}], timeAdvanceMinutes, scene{location,changed}. JSON strict uniquement apres le marqueur.`;

export interface ContexteNoyau {
  texte: string;
  directive: string;
  texteMonde: string;
  texteSocial: string;
  compteurs: Obj;
}

/** Canon structuré et opportunités à injecter pour ce tour. */
export function construireContexteNoyau(story: HistoireAvecNoyau, messageJoueur: string): ContexteNoyau {
  const c = story.narrativeCore;
  const requete = String(messageJoueur || '');
  const classes = classerEvenements(story, requete);
  const actuels = c.canon.filter((f) => !f.validToEvent && f.subject !== 'legacy').slice(-20);
  const dettes = c.debts.filter((d) => d.status === 'open').slice(-6);
  const opportunites = c.storylets.slice(0, 5);
  const horsEcran = c.simulationQueue.filter((x) => x.status === 'candidate').slice(-4);
  const noms = nomsCites(story, requete);
  const croyances = c.beliefs.filter((b) => noms.some((n) => norm(n) === norm(b.knower))).slice(-8);
  const lignes = [
    '[ELYNDOR V12 — CANON STRUCTURÉ AUTORITAIRE]',
    `Temps: ${horloge(c.clock)}.`,
    'Le canon structuré ci-dessous prime sur les souvenirs résumés et sur toute supposition. Si une information manque, considère-la comme inconnue au lieu de l’inventer.',
  ];
  if (actuels.length) {
    lignes.push('État canonique actuel:');
    for (const f of actuels.slice(-12)) lignes.push(`- ${f.subject}.${f.predicate} = ${String(f.value)}`);
  }
  if (classes.length) {
    lignes.push('Événements pertinents:');
    for (const x of classes) lignes.push(`- ${x.e.worldTime || ''} ${x.e.summary}`);
  }
  if (croyances.length) {
    lignes.push('Connaissances individuelles (ne pas les partager aux autres PNJ sans transmission):');
    for (const b of croyances) lignes.push(`- ${b.knower} [${b.type}] ${b.fact}`);
  }
  if (dettes.length) {
    lignes.push('Conséquences ouvertes:');
    for (const d of dettes) lignes.push(`- ${d.summary}`);
  }
  if (opportunites.length) {
    lignes.push('Opportunités narratives non obligatoires:');
    for (const o of opportunites) lignes.push(`- ${o.text}`);
  }
  if (horsEcran.length) {
    lignes.push('Activités hors écran arrivées à échéance (candidates, pas des faits acquis):');
    for (const x of horsEcran) lignes.push(`- ${x.npc}: ${x.intention}`);
  }
  const compteurs = {
    ledger: c.ledger.length, canon: c.canon.length, beliefs: c.beliefs.length,
    debts: c.debts.filter((x) => x.status === 'open').length, quarantine: c.quarantine.length,
  };
  return { texte: lignes.join('\n'), directive: DIRECTIVE_ETAT, texteMonde: texteMonde(story), texteSocial: texteSocial(story, requete), compteurs };
}

/**
 * Sépare la narration visible du bloc d'état machine. Tolère un bloc coupé
 * par la limite de tokens ou un marqueur tronqué : rien de ce bloc ne doit
 * jamais apparaître dans le récit.
 */
export function extraireEnveloppeEtat(brut: string): { texte: string; delta: unknown; trouve: boolean } {
  const reponse = String(brut ?? '');
  const i = reponse.lastIndexOf(MARQUEUR_ETAT);
  if (i < 0) {
    const debutPartiel = reponse.search(/<{2,3}\s*(?:END_)?ELYNDOR[\s\S]*$/);
    return { texte: (debutPartiel >= 0 ? reponse.slice(0, debutPartiel) : reponse).trim(), delta: null, trouve: false };
  }
  const j = reponse.indexOf(FIN_ETAT, i + MARQUEUR_ETAT.length);
  const corps = (j >= 0 ? reponse.slice(i + MARQUEUR_ETAT.length, j) : reponse.slice(i + MARQUEUR_ETAT.length)).trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const visible = reponse.slice(0, i).trim();
  try {
    return { texte: visible, delta: JSON.parse(corps), trouve: true };
  } catch {
    return { texte: visible, delta: null, trouve: false };
  }
}

export function diagnosticNoyau(story: StoryState): string[] {
  const c = story.narrativeCore;
  if (!c) return [];
  const dernier = c.inspector?.lastCommit;
  return [
    `[V12] Ledger ${c.ledger.length} · canon ${c.canon.filter((x) => !x.validToEvent).length}/${c.canon.length} · croyances ${c.beliefs.length} · rumeurs ${c.rumors.length}`,
    `[V12] Dettes ouvertes ${c.debts.filter((x) => x.status === 'open').length} · quarantaine ${c.quarantine.length} · horloge ${horloge(c.clock)}`,
    dernier ? `[V12] Dernier tour : ${dernier.eventIds?.length ?? 0} événement(s), ${dernier.stateChanges ?? 0} changement(s) d'état, ${dernier.quarantined ?? 0} en quarantaine` : '[V12] Aucun tour intégré pour l’instant.',
  ];
}
