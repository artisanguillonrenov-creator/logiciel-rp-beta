import type { RelationPersonnage, StoryState } from '../types';
import { classerLexical } from './rechercheLexicale';
import { contientExpression, normaliserTexte } from './texteRecherche';

// Mémoire narrative : vue de RÉCUPÉRATION des échanges joueur → narrateur.
// Chaque échange devient un événement indexé (lieu, présents, action,
// conséquence), sans aucun appel au modèle. Ce n'est pas un second canon : le
// noyau narratif V12 (noyauNarratif.ts) reste l'autorité sur l'état de
// l'histoire. Quand son registre connaît un tour, c'est lui qui fournit le lieu,
// l'heure et les témoins de l'événement ; sinon le lieu est « inconnu » (sauf
// pour le tout dernier échange, que la scène en cours date avec certitude).
// À chaque tour, une poignée de « blocs de contexte » est choisie pour la scène :
// le dernier événement, les événements passés pertinents, ce que chaque PNJ
// présent a réellement vu (règle 4 : pas d'omniscience), les relations, les
// engagements ouverts, les faits canon et la zone du monde en cours.

export type NiveauBloc = 'P0' | 'P1' | 'P2';

export interface EvenementNarratif {
  id: string;
  messageIndex: number;
  timestamp: number;
  /** Lieu au moment des faits ; absent = inconnu (jamais déduit du lieu actuel). */
  lieu?: string;
  lieuSource: 'registre' | 'scene-actuelle' | 'inconnu';
  /** Heure du monde au moment des faits, quand le registre V12 la connaît. */
  temps?: string;
  dateChronique?: string;
  /** Personnes présentes ou témoins directs : seules à pouvoir s'en souvenir en personne. */
  participants: string[];
  /** Noms cités dans le récit sans y être présents (rumeur, évocation). */
  mentionnes: string[];
  /** D'où vient la liste des présents : registre V12 ou repérage dans le texte. */
  fiabilitePresence: 'registre' | 'heuristique';
  actionJoueur: string;
  resultat: string;
  /** Identifiants des deux messages : sert à ne rappeler un échange qu'une fois. */
  messageIds: string[];
}

export interface BlocContexte {
  id: string;
  type: 'scene' | 'event' | 'npc_memory' | 'relation' | 'engagement' | 'canon' | 'world';
  priorite: number;
  niveau: NiveauBloc;
  source: string;
  texte: string;
  messageIds?: string[];
}

const BUDGET_BLOCS = 1900;
// Au-delà, l'index remonterait des milliers d'échanges pour un gain nul :
// les plus anciens sont déjà couverts par le résumé et les faits.
const MAX_MESSAGES_INDEXES = 2400;
const MAX_EVENEMENTS = 1200;

// Rôles génériques qui ne désignent pas un personnage suivi.
const PARTICIPANTS_IGNORES = new Set([
  'narrateur', 'garde', 'gardes', 'la captive', 'le captif', 'captive', 'captif', 'inconnue', 'inconnu',
  "l'inconnue", "l'inconnu", 'foule', 'voix', 'homme', 'femme',
].map(normaliserTexte));

// Coupe à la dernière phrase complète quand elle n'est pas trop tôt.
function resumer(texte: unknown, max: number): string {
  const propre = String(texte ?? '').replace(/\s+/g, ' ').trim();
  if (propre.length <= max) return propre;
  const coupe = propre.slice(0, Math.max(0, max - 1));
  const fin = Math.max(coupe.lastIndexOf('. '), coupe.lastIndexOf('! '), coupe.lastIndexOf('? '));
  return `${(fin > Math.floor(max * 0.55) ? coupe.slice(0, fin + 1) : coupe).trimEnd()}…`;
}

function personnagesConnus(story: StoryState): string[] {
  const noms = new Set<string>();
  for (const r of story.social.relations) if (r.nom.trim()) noms.add(r.nom.trim());
  for (const l of story.loreEmergent) if (l.categorie === 'pnj' && l.titre.trim()) noms.add(l.titre.trim());
  return [...noms];
}

function empreinte(texte: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

type EntreeRegistre = {
  location?: unknown;
  worldTime?: unknown;
  witnesses?: unknown;
  actors?: unknown;
  targets?: unknown;
  source?: { kind?: string; assistantMessageId?: string | null };
};

function textes(valeur: unknown): string[] {
  return Array.isArray(valeur) ? valeur.map((v) => String(v ?? '').trim()).filter(Boolean) : [];
}

/** Tours validés du registre V12, par identifiant du message du narrateur. */
function registreParMessage(story: StoryState): Map<string, EntreeRegistre> {
  const carte = new Map<string, EntreeRegistre>();
  for (const e of (story.narrativeCore?.ledger ?? []) as EntreeRegistre[]) {
    // Les événements « legacy » ont été datés avec le lieu du jour de la migration : non fiables.
    if (e?.source?.kind === 'turn' && e.source.assistantMessageId) carte.set(e.source.assistantMessageId, e);
  }
  return carte;
}

interface Presence {
  presents: string[];
  mentionnes: string[];
}

function presences(story: StoryState, texte: string, noms: { nom: string; cle: string }[], entree?: EntreeRegistre): Presence {
  const presents = new Map<string, string>();
  const mentionnes = new Map<string, string>();
  const ajouter = (cible: Map<string, string>, nom: string) => {
    const propre = nom.replace(/\s+/g, ' ').trim();
    const cle = normaliserTexte(propre);
    if (cle && !PARTICIPANTS_IGNORES.has(cle)) cible.set(cle, propre);
  };
  ajouter(presents, story.meta.personnageNom);
  // Locuteurs des répliques « NOM : « … » » (format imposé au narrateur) : forcément présents.
  const repliques = /(?:^|\n)\s*([A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý0-9'’ _-]{1,38})\s*:\s*[«"]/gm;
  const locuteurs: string[] = [];
  for (let m = repliques.exec(texte); m; m = repliques.exec(texte)) locuteurs.push(m[1]);
  const normalise = normaliserTexte(texte);
  const citesConnus = noms.filter(({ cle }) => cle && contientExpression(normalise, cle));
  if (entree) {
    // Le registre V12 sait qui a assisté à la scène : un nom seulement cité n'y était pas.
    for (const n of [...textes(entree.witnesses), ...textes(entree.actors), ...textes(entree.targets)]) ajouter(presents, n);
    for (const { nom } of citesConnus) ajouter(mentionnes, nom);
  } else {
    // Historique sans registre : repérage dans le texte (tout nom cité compte comme présent).
    for (const { nom } of citesConnus) ajouter(presents, nom);
  }
  for (const l of locuteurs) ajouter(presents, l);
  for (const cle of presents.keys()) mentionnes.delete(cle);
  return { presents: [...presents.values()].slice(0, 12), mentionnes: [...mentionnes.values()].slice(0, 12) };
}

// Chaque échange est analysé une fois : tant que ses deux messages, les noms
// connus et sa fiche du registre ne changent pas, l'événement est repris tel quel.
const CACHE_EVENEMENTS_MAX = 4000;
const cacheEvenements = new Map<string, EvenementNarratif>();

/** Reconstruit l'index des événements à partir des messages (déterministe). */
export function synchroniserMemoireNarrative(story: StoryState): EvenementNarratif[] {
  const evenements: EvenementNarratif[] = [];
  const { messages } = story;
  const noms = personnagesConnus(story).map((nom) => ({ nom, cle: normaliserTexte(nom) }));
  const signatureNoms = empreinte(noms.map((n) => n.cle).sort().join('|'));
  const registre = registreParMessage(story);
  const lieuActuel = (story.scene?.lieu || story.meta.contexte.lieu || '').trim() || undefined;
  const dernierNarrateurId = messages.at(-1)?.role === 'assistant' ? messages.at(-1)!.id : undefined;

  for (let i = Math.max(0, messages.length - MAX_MESSAGES_INDEXES - 4); i < messages.length - 1; i++) {
    const joueur = messages[i];
    const narrateur = messages[i + 1];
    if (joueur.role !== 'user' || narrateur.role !== 'assistant') continue;
    const entree = registre.get(narrateur.id);
    const estDernier = narrateur.id === dernierNarrateurId;
    const cle = [
      story.meta.id, joueur.id, narrateur.id, signatureNoms, empreinte(joueur.content), empreinte(narrateur.content),
      entree ? `${String(entree.location ?? '')}|${String(entree.worldTime ?? '')}|${textes(entree.witnesses).join(',')}|${textes(entree.actors).join(',')}` : '-',
      estDernier ? `dernier:${lieuActuel ?? ''}` : '',
    ].join('§');
    let evenement = cacheEvenements.get(cle);
    if (!evenement) {
      const presence = presences(story, `${joueur.content}\n${narrateur.content}`, noms, entree);
      const lieuRegistre = entree ? String(entree.location ?? '').trim() : '';
      evenement = {
        id: `evt:${joueur.id}:${narrateur.id}`,
        messageIndex: i + 1,
        timestamp: narrateur.timestamp || joueur.timestamp || Date.now(),
        // Jamais le lieu actuel pour un échange ancien : seul le dernier est certain.
        lieu: lieuRegistre || (estDernier ? lieuActuel : undefined),
        lieuSource: lieuRegistre ? 'registre' : estDernier && lieuActuel ? 'scene-actuelle' : 'inconnu',
        temps: entree && entree.worldTime ? String(entree.worldTime) : undefined,
        dateChronique: estDernier ? story.meta.contexte.dateChronique || undefined : undefined,
        participants: presence.presents,
        mentionnes: presence.mentionnes,
        fiabilitePresence: entree ? 'registre' : 'heuristique',
        actionJoueur: resumer(joueur.content, 230),
        resultat: resumer(narrateur.content, 390),
        messageIds: [joueur.id, narrateur.id],
      };
      if (cacheEvenements.size >= CACHE_EVENEMENTS_MAX) cacheEvenements.delete(cacheEvenements.keys().next().value as string);
      cacheEvenements.set(cle, evenement);
    }
    evenements.push(evenement);
    i += 1;
  }
  return evenements.slice(-MAX_EVENEMENTS);
}

/** Vide le cache d'événements (tests). */
export function viderCacheEvenements(): void {
  cacheEvenements.clear();
}

/** Ce qu'un personnage peut savoir d'un événement. */
export type AccesEvenement = 'present' | 'mentionne' | 'inconnu';

export function accesEvenement(e: EvenementNarratif, nom: string): AccesEvenement {
  const cle = normaliserTexte(nom);
  if (!cle) return 'inconnu';
  if (e.participants.some((p) => normaliserTexte(p) === cle)) return 'present';
  if (e.mentionnes.some((p) => normaliserTexte(p) === cle)) return 'mentionne';
  return 'inconnu';
}

function texteEvenement(e: EvenementNarratif): string {
  return [
    `Lieu: ${e.lieu ?? 'inconnu'}`,
    e.temps ? `Heure: ${e.temps}` : '',
    e.dateChronique ? `Période: ${e.dateChronique}` : '',
    e.participants.length ? `Présents: ${e.participants.join(', ')}` : '',
    `Action du joueur: ${e.actionJoueur}`,
    `Conséquence observée: ${e.resultat}`,
  ].filter(Boolean).join('\n');
}

function texteRelation(r: RelationPersonnage): string {
  return `${r.nom}: confiance ${r.confiance}, respect ${r.respect}, peur ${r.peur}, affection ${r.affection}, hostilité ${r.hostilite}${r.faction ? `, faction ${r.faction}` : ''}.`;
}

export interface RejetBloc {
  id: string;
  type: BlocContexte['type'];
  niveau: NiveauBloc;
  cause: 'budget' | 'doublon' | 'deja-fourni';
}

export interface ResultatBlocs {
  blocs: BlocContexte[];
  totalCaracteres: number;
  rejetes: RejetBloc[];
  /** Perte d'un bloc P0 : jamais silencieuse. */
  manques: string[];
}

export interface OptionsBlocs {
  /** Messages déjà rappelés par une autre source (noyau V12, souvenirs) : pas répétés ici. */
  exclureMessageIds?: ReadonlySet<string>;
  budget?: number;
}

const RANG: Record<NiveauBloc, number> = { P0: 0, P1: 1, P2: 2 };

/** Choisit les blocs de contexte du tour, par niveau puis priorité, dans le budget. */
export function construireBlocsContexte(
  story: StoryState,
  messageJoueur: string,
  evenements = synchroniserMemoireNarrative(story),
  options: OptionsBlocs = {},
): ResultatBlocs {
  const budgetBlocs = options.budget ?? BUDGET_BLOCS;
  const requete = [messageJoueur, story.meta.contexte.lieu, story.meta.contexte.objectifs, ...story.messages.slice(-3).map((m) => m.content)]
    .filter(Boolean)
    .join('\n');
  const requeteNormalisee = normaliserTexte(requete);
  const candidats: BlocContexte[] = [];
  const rejetes: RejetBloc[] = [];
  const manques: string[] = [];
  const ajouter = (bloc: BlocContexte) => {
    if (!bloc.texte.trim()) return;
    const cle = normaliserTexte(bloc.texte);
    if (candidats.some((c) => normaliserTexte(c.texte) === cle)) {
      rejetes.push({ id: bloc.id, type: bloc.type, niveau: bloc.niveau, cause: 'doublon' });
      return;
    }
    candidats.push(bloc);
  };

  const dernier = evenements.at(-1);
  ajouter({
    id: 'scene-actuelle',
    type: 'scene',
    priorite: 100,
    niveau: 'P0',
    source: 'scene',
    texte: [
      story.meta.contexte.lieu ? `Lieu actuel: ${story.meta.contexte.lieu}.` : '',
      story.meta.contexte.dateChronique ? `Période: ${story.meta.contexte.dateChronique}.` : '',
      dernier ? `Dernier événement établi: ${resumer(dernier.resultat, 300)}` : '',
    ].filter(Boolean).join(' '),
    messageIds: dernier?.messageIds,
  });

  const dejaFournis = options.exclureMessageIds;
  const dejaVu = (e: EvenementNarratif) => !!dejaFournis && e.messageIds.some((id) => dejaFournis.has(id));
  const anciens = evenements.slice(0, -1);
  for (const r of classerLexical({
    requete,
    items: anciens.filter((e) => !dejaVu(e)),
    titreDe: (e) => `${e.lieu ?? ''} ${e.participants.join(' ')}`,
    texteDe: texteEvenement,
    dateDe: (e) => e.timestamp,
    budget: { maxResultats: 4, maxCaracteres: 1150, maxCaracteresParResultat: 330 },
  })) {
    ajouter({ id: r.item.id, type: 'event', priorite: Math.min(94, 72 + Math.round(r.score)), niveau: 'P1', source: `ledger:${r.item.messageIndex}`, texte: r.extrait, messageIds: r.item.messageIds });
  }
  for (const e of anciens) if (dejaVu(e)) rejetes.push({ id: e.id, type: 'event', niveau: 'P1', cause: 'deja-fourni' });

  const pnjDeLaScene = personnagesConnus(story)
    .filter((nom) => {
      const cle = normaliserTexte(nom);
      return cle.length >= 2 && contientExpression(requeteNormalisee, cle);
    })
    .slice(0, 3);
  for (const nom of pnjDeLaScene) {
    const cle = normaliserTexte(nom);
    // Seuls les événements auxquels ce PNJ était présent : une simple mention ne fait pas un souvenir.
    const vus = evenements.filter((e) => accesEvenement(e, nom) === 'present').slice(-2);
    if (vus.length) {
      ajouter({
        id: `npc:${cle}`,
        type: 'npc_memory',
        priorite: 96,
        niveau: 'P1',
        source: `pnj:${nom}`,
        texte: `Mémoire accessible à ${nom} (événements auxquels ce PNJ a été présent):\n${vus.map((e) => `- ${resumer(e.resultat, 240)}`).join('\n')}`,
        messageIds: vus.flatMap((e) => e.messageIds),
      });
    }
  }

  for (const relation of story.social.relations) {
    const cle = normaliserTexte(relation.nom);
    if (cle && contientExpression(requeteNormalisee, cle)) {
      ajouter({ id: `relation:${relation.id}`, type: 'relation', priorite: 91, niveau: 'P1', source: 'social', texte: texteRelation(relation) });
    }
  }

  for (const r of classerLexical({
    requete,
    items: story.social.engagements.filter((e) => !e.honore && !e.rompu),
    titreDe: (e) => e.partie,
    texteDe: (e) => `${e.type} ${e.description} ${e.partie}`,
    budget: { maxResultats: 2, maxCaracteres: 450, maxCaracteresParResultat: 220 },
  })) {
    ajouter({ id: `engagement:${r.item.id}`, type: 'engagement', priorite: 93, niveau: 'P1', source: 'engagements', texte: `${r.item.type} envers ${r.item.partie}: ${r.item.description}` });
  }

  for (const r of classerLexical({
    requete,
    items: story.memoire.faits.filter((f) => f.niveau === 'canon' || f.niveau === 'consolide'),
    titreDe: (f) => f.type,
    texteDe: (f) => f.texte,
    budget: { maxResultats: 3, maxCaracteres: 520, maxCaracteresParResultat: 220 },
  })) {
    ajouter({ id: `canon:${r.item.id}`, type: 'canon', priorite: r.item.niveau === 'canon' ? 97 : 88, niveau: r.item.niveau === 'canon' ? 'P0' : 'P1', source: `memoire:${r.item.niveau}`, texte: r.item.texte });
  }

  const lieu = story.meta.contexte.lieu || '';
  const zone = lieu ? story.monde.zones.find((z) => contientExpression(z.nom, lieu) || contientExpression(lieu, z.nom)) : undefined;
  if (zone) ajouter({ id: `world:${zone.id}`, type: 'world', priorite: 86, niveau: 'P2', source: 'monde', texte: `${zone.nom} — ${zone.description}` });

  candidats.sort((a, b) => RANG[a.niveau] - RANG[b.niveau] || b.priorite - a.priorite);
  const blocs: BlocContexte[] = [];
  let total = 0;
  for (const bloc of candidats) {
    const taille = bloc.texte.length + 38;
    if (blocs.length && total + taille > budgetBlocs) {
      // Un bloc P0 trop long est raccourci plutôt qu'écarté ; P1 et P2 s'effacent.
      const place = budgetBlocs - total - 38;
      if (bloc.niveau === 'P0' && place >= 160) {
        blocs.push({ ...bloc, texte: resumer(bloc.texte, place) });
        total = budgetBlocs;
        continue;
      }
      rejetes.push({ id: bloc.id, type: bloc.type, niveau: bloc.niveau, cause: 'budget' });
      if (bloc.niveau === 'P0') manques.push(`bloc ${bloc.type} « ${bloc.id} » absent : budget de mémoire épuisé`);
      continue;
    }
    if (!blocs.length && taille > budgetBlocs) {
      blocs.push({ ...bloc, texte: resumer(bloc.texte, budgetBlocs - 40) });
      total = budgetBlocs;
      break;
    }
    blocs.push(bloc);
    total += taille;
  }
  return { blocs, totalCaracteres: total, rejetes, manques };
}

/**
 * Un échange n'est rappelé qu'une fois. Le noyau V12 fait autorité, puis la
 * mémoire des événements, puis les souvenirs bruts (mêmes messages sous une
 * autre forme) : une source plus basse ne répète pas ce qu'une plus haute
 * a déjà fourni.
 */
export function ecarterDoublons<S extends { message: { id: string } }>(entree: {
  blocs: BlocContexte[];
  idsNoyau: ReadonlySet<string>;
  souvenirs: S[];
}): { blocsUtiles: BlocContexte[]; souvenirsUtiles: S[]; doublonsEcartes: number } {
  const blocsUtiles = entree.blocs.filter((b) => !(b.type === 'event' && b.messageIds?.some((id) => entree.idsNoyau.has(id))));
  const couverts = new Set([...entree.idsNoyau, ...blocsUtiles.flatMap((b) => b.messageIds ?? [])]);
  const souvenirsUtiles = entree.souvenirs.filter((s) => !couverts.has(s.message.id));
  return {
    blocsUtiles,
    souvenirsUtiles,
    doublonsEcartes: (entree.blocs.length - blocsUtiles.length) + (entree.souvenirs.length - souvenirsUtiles.length),
  };
}

export function formaterBlocsContexte(blocs: BlocContexte[], avecConsigne = true): string {
  if (!blocs.length) return '';
  return [
    ...(avecConsigne ? ['Utilise uniquement ces blocs comme rappels factuels. Un PNJ ne doit pas connaître un événement auquel il n’a pas eu accès.'] : []),
    ...blocs.map((b) => `- [${b.type} | ${b.source} | P${b.priorite}] ${b.texte}`),
  ].join('\n');
}

export function debugBlocsContexte(blocs: BlocContexte[]): string[] {
  return blocs.map((b) => `[${b.niveau} · P${b.priorite} ${b.type}] ${b.source} — ${resumer(b.texte, 210)}`);
}
