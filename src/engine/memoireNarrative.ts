import type { RelationPersonnage, StoryState } from '../types';
import { classerLexical, normaliserRecherche } from './rechercheLexicale';

// Mémoire narrative (reprise de la V13) : chaque échange joueur → narrateur
// devient un événement indexé (lieu, présents, action, conséquence), sans
// aucun appel au modèle. À chaque tour, une poignée de « blocs de contexte »
// est choisie pour la scène : le dernier événement, les événements passés
// pertinents, ce que chaque PNJ présent a réellement vu (règle 4 : pas
// d'omniscience), les relations, les engagements ouverts, les faits canon et
// la zone du monde en cours.

export interface EvenementNarratif {
  id: string;
  messageIndex: number;
  timestamp: number;
  lieu?: string;
  dateChronique?: string;
  participants: string[];
  actionJoueur: string;
  resultat: string;
}

export interface BlocContexte {
  id: string;
  type: 'scene' | 'event' | 'npc_memory' | 'relation' | 'engagement' | 'canon' | 'world';
  priorite: number;
  source: string;
  texte: string;
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
]);

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

function participants(story: StoryState, texte: string): string[] {
  const trouves = new Map<string, string>();
  const ajouter = (nom: string) => {
    const propre = nom.replace(/\s+/g, ' ').trim();
    const cle = normaliserRecherche(propre);
    if (cle && !PARTICIPANTS_IGNORES.has(cle)) trouves.set(cle, propre);
  };
  ajouter(story.meta.personnageNom);
  const normalise = normaliserRecherche(texte);
  for (const nom of personnagesConnus(story)) {
    const cle = normaliserRecherche(nom);
    if (cle && normalise.includes(cle)) ajouter(nom);
  }
  // Locuteurs des répliques « NOM : « … » » (format imposé au narrateur).
  const repliques = /(?:^|\n)\s*([A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý0-9'’ _-]{1,38})\s*:\s*[«"]/gm;
  for (let m = repliques.exec(texte); m; m = repliques.exec(texte)) ajouter(m[1]);
  return [...trouves.values()].slice(0, 12);
}

/** Reconstruit l'index des événements à partir des messages (déterministe). */
export function synchroniserMemoireNarrative(story: StoryState): EvenementNarratif[] {
  const evenements: EvenementNarratif[] = [];
  const { messages } = story;
  for (let i = Math.max(0, messages.length - MAX_MESSAGES_INDEXES - 4); i < messages.length - 1; i++) {
    const joueur = messages[i];
    const narrateur = messages[i + 1];
    if (joueur.role !== 'user' || narrateur.role !== 'assistant') continue;
    evenements.push({
      id: `evt:${joueur.id}:${narrateur.id}`,
      messageIndex: i + 1,
      timestamp: narrateur.timestamp || joueur.timestamp || Date.now(),
      lieu: story.meta.contexte.lieu || undefined,
      dateChronique: story.meta.contexte.dateChronique || undefined,
      participants: participants(story, `${joueur.content}\n${narrateur.content}`),
      actionJoueur: resumer(joueur.content, 230),
      resultat: resumer(narrateur.content, 390),
    });
    i += 1;
  }
  return evenements.slice(-MAX_EVENEMENTS);
}

function texteEvenement(e: EvenementNarratif): string {
  return [
    e.lieu ? `Lieu: ${e.lieu}` : '',
    e.dateChronique ? `Période: ${e.dateChronique}` : '',
    e.participants.length ? `Présents: ${e.participants.join(', ')}` : '',
    `Action du joueur: ${e.actionJoueur}`,
    `Conséquence observée: ${e.resultat}`,
  ].filter(Boolean).join('\n');
}

function texteRelation(r: RelationPersonnage): string {
  return `${r.nom}: confiance ${r.confiance}, respect ${r.respect}, peur ${r.peur}, affection ${r.affection}, hostilité ${r.hostilite}${r.faction ? `, faction ${r.faction}` : ''}.`;
}

export interface ResultatBlocs {
  blocs: BlocContexte[];
  totalCaracteres: number;
}

/** Choisit les blocs de contexte du tour, par priorité, dans le budget. */
export function construireBlocsContexte(story: StoryState, messageJoueur: string, evenements = synchroniserMemoireNarrative(story)): ResultatBlocs {
  const requete = [messageJoueur, story.meta.contexte.lieu, story.meta.contexte.objectifs, ...story.messages.slice(-3).map((m) => m.content)]
    .filter(Boolean)
    .join('\n');
  const requeteNormalisee = normaliserRecherche(requete);
  const candidats: BlocContexte[] = [];
  const ajouter = (bloc: BlocContexte) => {
    if (!bloc.texte.trim()) return;
    const cle = normaliserRecherche(bloc.texte);
    if (!candidats.some((c) => normaliserRecherche(c.texte) === cle)) candidats.push(bloc);
  };

  const dernier = evenements.at(-1);
  ajouter({
    id: 'scene-actuelle',
    type: 'scene',
    priorite: 100,
    source: 'scene',
    texte: [
      story.meta.contexte.lieu ? `Lieu actuel: ${story.meta.contexte.lieu}.` : '',
      story.meta.contexte.dateChronique ? `Période: ${story.meta.contexte.dateChronique}.` : '',
      dernier ? `Dernier événement établi: ${resumer(dernier.resultat, 300)}` : '',
    ].filter(Boolean).join(' '),
  });

  for (const r of classerLexical({
    requete,
    items: evenements.slice(0, -1),
    titreDe: (e) => `${e.lieu ?? ''} ${e.participants.join(' ')}`,
    texteDe: texteEvenement,
    dateDe: (e) => e.timestamp,
    budget: { maxResultats: 4, maxCaracteres: 1150, maxCaracteresParResultat: 330 },
  })) {
    ajouter({ id: r.item.id, type: 'event', priorite: Math.min(94, 72 + Math.round(r.score)), source: `ledger:${r.item.messageIndex}`, texte: r.extrait });
  }

  const pnjDeLaScene = personnagesConnus(story)
    .filter((nom) => {
      const cle = normaliserRecherche(nom);
      return cle.length >= 2 && requeteNormalisee.includes(cle);
    })
    .slice(0, 3);
  for (const nom of pnjDeLaScene) {
    const cle = normaliserRecherche(nom);
    const vus = evenements.filter((e) => e.participants.some((p) => normaliserRecherche(p) === cle)).slice(-2);
    if (vus.length) {
      ajouter({
        id: `npc:${cle}`,
        type: 'npc_memory',
        priorite: 96,
        source: `pnj:${nom}`,
        texte: `Mémoire accessible à ${nom} (événements auxquels ce PNJ a été présent):\n${vus.map((e) => `- ${resumer(e.resultat, 240)}`).join('\n')}`,
      });
    }
  }

  for (const relation of story.social.relations) {
    const cle = normaliserRecherche(relation.nom);
    if (cle && requeteNormalisee.includes(cle)) {
      ajouter({ id: `relation:${relation.id}`, type: 'relation', priorite: 91, source: 'social', texte: texteRelation(relation) });
    }
  }

  for (const r of classerLexical({
    requete,
    items: story.social.engagements.filter((e) => !e.honore && !e.rompu),
    titreDe: (e) => e.partie,
    texteDe: (e) => `${e.type} ${e.description} ${e.partie}`,
    budget: { maxResultats: 2, maxCaracteres: 450, maxCaracteresParResultat: 220 },
  })) {
    ajouter({ id: `engagement:${r.item.id}`, type: 'engagement', priorite: 93, source: 'engagements', texte: `${r.item.type} envers ${r.item.partie}: ${r.item.description}` });
  }

  for (const r of classerLexical({
    requete,
    items: story.memoire.faits.filter((f) => f.niveau === 'canon' || f.niveau === 'consolide'),
    titreDe: (f) => f.type,
    texteDe: (f) => f.texte,
    budget: { maxResultats: 3, maxCaracteres: 520, maxCaracteresParResultat: 220 },
  })) {
    ajouter({ id: `canon:${r.item.id}`, type: 'canon', priorite: r.item.niveau === 'canon' ? 97 : 88, source: `memoire:${r.item.niveau}`, texte: r.item.texte });
  }

  const lieu = normaliserRecherche(story.meta.contexte.lieu || '');
  const zone = lieu ? story.monde.zones.find((z) => normaliserRecherche(z.nom).includes(lieu)) : undefined;
  if (zone) ajouter({ id: `world:${zone.id}`, type: 'world', priorite: 86, source: 'monde', texte: `${zone.nom} — ${zone.description}` });

  candidats.sort((a, b) => b.priorite - a.priorite);
  const blocs: BlocContexte[] = [];
  let total = 0;
  for (const bloc of candidats) {
    const taille = bloc.texte.length + 38;
    if (blocs.length && total + taille > BUDGET_BLOCS) continue;
    if (!blocs.length && taille > BUDGET_BLOCS) {
      blocs.push({ ...bloc, texte: resumer(bloc.texte, 1860) });
      total = BUDGET_BLOCS;
      break;
    }
    blocs.push(bloc);
    total += taille;
  }
  return { blocs, totalCaracteres: total };
}

export function formaterBlocsContexte(blocs: BlocContexte[]): string {
  if (!blocs.length) return '';
  return [
    'Utilise uniquement ces blocs comme rappels factuels. Un PNJ ne doit pas connaître un événement auquel il n’a pas eu accès.',
    ...blocs.map((b) => `- [${b.type} | ${b.source} | P${b.priorite}] ${b.texte}`),
  ].join('\n');
}

export function debugBlocsContexte(blocs: BlocContexte[]): string[] {
  return blocs.map((b) => `[P${b.priorite} ${b.type}] ${b.source} — ${resumer(b.texte, 210)}`);
}
