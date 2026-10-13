import type { LoreEntry } from '../types';
import { similariteCosinus } from './embeddings';
import type { ElyndorEntryChargee } from './loreLoader';
import {
  calculerScoreHybrideLore,
  preparerRequeteLore,
  raisonsScoreLore,
  SEUIL_LORE_HYBRIDE,
  statsCorpusLore,
  type DetailsScoreLore,
  type RequetePreparee,
  type StatsCorpusLore,
} from './loreScoring';

/**
 * Recherche du lore par passages : chaque entrée est découpée en passages
 * de quelques centaines de caractères, tous notés à chaque tour, et seuls
 * les meilleurs partent au narrateur dans un budget fixe. Remplace l'envoi
 * d'entrées entières coupées à leurs 650 premiers caractères, qui perdait
 * justement la partie utile (ex. une ligne de la table d'âge).
 *
 * Trois niveaux de priorité :
 * - P0 : fiches certaines pour la scène (nom cité dans le message ou la
 *   scène courante, intention du joueur). Leur meilleur passage est choisi
 *   en premier ; s'il ne tient pas, il est raccourci, jamais écarté en silence ;
 * - P1 : passages qui répondent au message du joueur ;
 * - P2 : passages qui suivent la scène et la mémoire (enrichissement).
 * Quand le budget manque, P2 s'efface d'abord ; toute perte de P0 est signalée
 * dans le rapport.
 */
export const BUDGET_LORE_PASSAGES = 2500;
const TAILLE_MAX_PASSAGE = 600;
const TAILLE_MIN_PASSAGE = 160;
// Les entrées toujours actives d'autrefois (Mœurs, Ratio de vieillissement…)
// ne sont plus envoyées d'office : leurs passages passent devant à pertinence égale.
const BONUS_ENTREE_CONSTANTE = 0.08;
// Un nom canonique cité dans la scène (royaume, PNJ, guilde…) remonte sa fiche.
const BONUS_ANCRE = 0.5;
const SEPARATEUR_PASSAGES = '\n…\n';
// Une seule fiche ne doit pas occuper tout le budget du lore.
const MAX_PASSAGES_PAR_ENTREE = 3;
// Part maximale du budget que les fiches P0 peuvent occuper.
const PART_MAX_P0 = 0.7;
// Un passage P0 raccourci reste lisible : en dessous, il est signalé manquant.
const TAILLE_MIN_P0_RACCOURCI = 200;

export type NiveauContexte = 'P0' | 'P1' | 'P2';

export interface PassageLore extends ElyndorEntryChargee {
  entreeId: string;
  ordre: number;
  entreeConstante: boolean;
}

function couperLigne(ligne: string): string[] {
  if (ligne.length <= TAILLE_MAX_PASSAGE) return [ligne];
  // Pas de lookbehind dans l'expression : tous les moteurs JS de l'app ne le gèrent pas.
  const phrases = (ligne.match(/[^.!?]+[.!?]*/g) ?? [ligne]).map((p) => p.trim()).filter(Boolean);
  const morceaux: string[] = [];
  let courant = '';
  for (const phrase of phrases) {
    if (courant && (courant + ' ' + phrase).length > TAILLE_MAX_PASSAGE) {
      morceaux.push(courant);
      courant = '';
    }
    courant = courant ? `${courant} ${phrase}` : phrase;
    while (courant.length > TAILLE_MAX_PASSAGE) {
      morceaux.push(courant.slice(0, TAILLE_MAX_PASSAGE));
      courant = courant.slice(TAILLE_MAX_PASSAGE);
    }
  }
  if (courant) morceaux.push(courant);
  return morceaux;
}

/** Coupe un paragraphe trop long ligne par ligne (tables, listes), puis par phrases. */
function couperLong(texte: string): string[] {
  if (texte.length <= TAILLE_MAX_PASSAGE) return [texte];
  const morceaux: string[] = [];
  let courant = '';
  for (const ligne of texte.split('\n').flatMap(couperLigne)) {
    if (courant && courant.length + ligne.length + 1 > TAILLE_MAX_PASSAGE) {
      morceaux.push(courant);
      courant = '';
    }
    courant = courant ? `${courant}\n${ligne}` : ligne;
  }
  if (courant) morceaux.push(courant);
  return morceaux;
}

/** Découpe par paragraphes, regroupe les plus courts, coupe les plus longs. */
export function decouperEnPassages(contenu: string): string[] {
  const paragraphes = contenu.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean).flatMap(couperLong);
  const passages: string[] = [];
  for (const paragraphe of paragraphes) {
    const dernier = passages[passages.length - 1];
    if (dernier !== undefined && (dernier.length < TAILLE_MIN_PASSAGE || paragraphe.length < TAILLE_MIN_PASSAGE)
      && dernier.length + paragraphe.length + 1 <= TAILLE_MAX_PASSAGE) {
      passages[passages.length - 1] = `${dernier}\n${paragraphe}`;
    } else {
      passages.push(paragraphe);
    }
  }
  return passages;
}

// --- Index de passages -----------------------------------------------------
// Découper et analyser tout le lore à chaque réponse coûtait du temps pour rien :
// une fiche inchangée garde ses passages (et leur analyse lexicale) d'un tour à
// l'autre. La clé change dès que le contenu, le titre, les clés ou la priorité
// changent : une fiche éditée ou publiée est la seule à être reconstruite.
const CACHE_PASSAGES_MAX = 2000;
const passagesParObjet = new WeakMap<object, PassageLore[]>();
const passagesParCle = new Map<string, PassageLore[]>();

function empreinteRapide(texte: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function cleEntree(e: ElyndorEntryChargee): string {
  const cles = [e.primaryKeys ?? e.motsClesPrimaires, e.secondaryKeys ?? e.motsClesSecondaires, e.negativeKeys ?? e.motsClesNegatifs]
    .map((l) => (l ?? []).join('\u0001')).join('\u0002');
  return [e.id, e.titre, e.contenu.length, empreinteRapide(e.contenu), e.priority, e.constant, e.category ?? '', e.scope ?? '', cles].join('|');
}

function passagesDe(entree: ElyndorEntryChargee): PassageLore[] {
  const parObjet = passagesParObjet.get(entree);
  if (parObjet) return parObjet;
  const cle = cleEntree(entree);
  let passages = passagesParCle.get(cle);
  if (!passages) {
    // Le passage est lui-même « notable » : mêmes clés que sa fiche, pour que son
    // analyse lexicale (loreScoring.indexerEntreeLore) soit mémorisée sur l'objet.
    passages = decouperEnPassages(entree.contenu).map((contenu, ordre) => ({
      ...entree,
      id: `${entree.id}#${ordre}`,
      contenu,
      primaryKeys: entree.primaryKeys ?? entree.motsClesPrimaires,
      secondaryKeys: entree.secondaryKeys ?? entree.motsClesSecondaires,
      negativeKeys: entree.negativeKeys ?? entree.motsClesNegatifs,
      constant: false,
      entreeId: entree.id,
      ordre,
      entreeConstante: entree.constant,
    }));
    if (passagesParCle.size >= CACHE_PASSAGES_MAX) passagesParCle.delete(passagesParCle.keys().next().value as string);
    passagesParCle.set(cle, passages);
  }
  passagesParObjet.set(entree, passages);
  return passages;
}

export function construirePassages(entrees: ElyndorEntryChargee[]): PassageLore[] {
  return entrees.flatMap(passagesDe);
}

/** Vide l'index (tests, ou changement de lore publié connu de l'appelant). */
export function viderIndexPassages(): void {
  passagesParCle.clear();
  derniereStats = null;
}

// --- Sélection ---------------------------------------------------------------

export interface OptionsPassages {
  vecteurRequete?: number[];
  vecteursPassages?: Record<string, number[]>;
  /** Identifiants d'entrées certaines pour la scène (P0) : voir entitesScene.ts. */
  ancres?: Set<string>;
  /** Pourquoi chaque ancre est P0, pour le diagnostic. */
  raisonsAncres?: Map<string, string>;
  budget?: number;
  /** Message du joueur (avec la ville en cours) : la moitié du budget lui revient d'abord. */
  requeteMessage?: string;
  vecteurMessage?: number[];
  /** Ouverture d'histoire : un peu de hasard pour varier les détails convoqués. */
  aleatoire?: boolean;
}

type Note = { passage: PassageLore; score: number; details?: DetailsScoreLore };

export interface RejetLore {
  id: string;
  titre: string;
  cause: 'budget' | 'quota-fiche';
  score: number;
}

export interface RetenuLore {
  id: string;
  titre: string;
  niveau: NiveauContexte;
  score: number;
  raison: string;
  caracteres: number;
  raccourci: boolean;
}

export interface RapportSelectionLore {
  budget: number;
  utilise: number;
  passagesAnalyses: number;
  retenus: RetenuLore[];
  rejetes: RejetLore[];
  /** Pertes sur du P0 : jamais silencieuses. */
  manques: string[];
}

// Rareté des mots sur l'ensemble des passages (IDF de BM25), calculée une fois
// par liste de passages : la liste est elle-même mémorisée tant que le lore ne change pas.
// La liste est reconstruite à chaque tour, mais ses passages (objets mémorisés)
// changent rarement : la signature compare les objets eux-mêmes, sans recalcul.
let derniereStats: { passages: PassageLore[]; stats: StatsCorpusLore } | null = null;

function statsDe(passages: PassageLore[]): StatsCorpusLore {
  const precedente = derniereStats;
  if (precedente && precedente.passages.length === passages.length && precedente.passages.every((p, i) => p === passages[i])) {
    return precedente.stats;
  }
  const stats = statsCorpusLore(passages);
  derniereStats = { passages: [...passages], stats };
  return stats;
}

function noterPassages(
  passages: PassageLore[],
  requete: RequetePreparee,
  vecteurRequete: number[] | undefined,
  options: OptionsPassages,
  avecBonusConstante: boolean,
): Note[] {
  const stats = statsDe(passages);
  const notes = passages.map((passage): Note => {
    const vecteur = options.vecteursPassages?.[passage.id];
    const similarite = vecteur && vecteurRequete ? similariteCosinus(vecteurRequete, vecteur) : undefined;
    const details = calculerScoreHybrideLore(passage, requete, similarite, stats);
    if (details.score === 0) return { passage, score: 0, details };
    const score = details.score
      + (avecBonusConstante && passage.entreeConstante ? BONUS_ENTREE_CONSTANTE : 0)
      + (options.aleatoire ? Math.random() * 0.1 : 0);
    return { passage, score, details };
  });
  // L'ancre (nom cité) ne relève que le meilleur passage de sa fiche : sinon
  // une ville citée occupait le budget avec tous ses passages.
  const meilleurParAncre = new Map<string, Note>();
  for (const note of notes) {
    if (!options.ancres?.has(note.passage.entreeId) || note.score === 0) continue;
    const actuel = meilleurParAncre.get(note.passage.entreeId);
    if (!actuel || note.score > actuel.score) meilleurParAncre.set(note.passage.entreeId, note);
  }
  for (const note of meilleurParAncre.values()) note.score += BONUS_ANCRE;
  return notes;
}

function classer(notes: Note[]): Note[] {
  return notes
    .filter((n) => n.score >= SEUIL_LORE_HYBRIDE)
    .sort((a, b) => b.score - a.score || a.passage.priority - b.passage.priority);
}

/** Raccourcit un texte à la dernière phrase complète qui tient, sinon coupe net. */
function raccourcir(texte: string, max: number): string {
  if (texte.length <= max) return texte;
  const coupe = texte.slice(0, Math.max(0, max - 1));
  const fin = Math.max(coupe.lastIndexOf('. '), coupe.lastIndexOf('! '), coupe.lastIndexOf('? '), coupe.lastIndexOf('\n'));
  return `${(fin > max * 0.5 ? coupe.slice(0, fin + 1) : coupe).trimEnd()}…`;
}

interface Groupe {
  titre: string;
  score: number;
  niveau: NiveauContexte;
  raison: string;
  raccourci: boolean;
  passages: { passage: PassageLore; contenu: string }[];
}

const RANG_NIVEAU: Record<NiveauContexte, number> = { P0: 0, P1: 1, P2: 2 };

/**
 * Note tous les passages et garde les meilleurs dans le budget. Les fiches
 * certaines pour la scène (ancres, P0) passent en premier ; avec un message
 * du joueur (requeteMessage), la moitié du budget va ensuite aux passages qui
 * y répondent (« allons à la guilde » → Guilde des Aventuriers, maîtresse de
 * guilde de la ville) ; le reste suit la scène et la mémoire de l'histoire
 * (requete). Les passages d'une même entrée sont regroupés sous son titre,
 * dans leur ordre d'origine.
 */
export function selectionnerPassagesDetaille(
  passages: PassageLore[],
  requete: string,
  options: OptionsPassages = {},
): { entrees: LoreEntry[]; rapport: RapportSelectionLore } {
  const budget = options.budget ?? BUDGET_LORE_PASSAGES;
  const requeteScene = preparerRequeteLore(requete);
  const notesScene = noterPassages(passages, requeteScene, options.vecteurRequete, options, true);
  const notesMessage = options.requeteMessage?.trim()
    ? noterPassages(passages, preparerRequeteLore(options.requeteMessage), options.vecteurMessage, options, false)
    : undefined;

  const parEntree = new Map<string, Groupe>();
  const retenus = new Set<string>();
  const rejets = new Map<string, RejetLore>();
  const manques: string[] = [];
  let utilise = 0;

  const coutDe = (passage: PassageLore, contenu: string) =>
    contenu.length + (parEntree.has(passage.entreeId) ? SEPARATEUR_PASSAGES.length : passage.titre.length + 6);

  const ajouter = (note: Note, niveauPasse: NiveauContexte, contenu: string, raisonPasse: string, raccourci = false) => {
    const { passage, score } = note;
    // Une fiche certaine pour la scène reste P0, même retenue par une autre passe.
    const ancree = !!options.ancres?.has(passage.entreeId);
    const niveau: NiveauContexte = ancree ? 'P0' : niveauPasse;
    const raison = ancree ? (options.raisonsAncres?.get(passage.entreeId) ?? 'nom canonique cité') : raisonPasse;
    utilise += coutDe(passage, contenu);
    retenus.add(passage.id);
    const groupe = parEntree.get(passage.entreeId);
    if (groupe) {
      groupe.passages.push({ passage, contenu });
      if (RANG_NIVEAU[niveau] < RANG_NIVEAU[groupe.niveau]) { groupe.niveau = niveau; groupe.raison = raison; }
      groupe.raccourci = groupe.raccourci || raccourci;
    } else {
      parEntree.set(passage.entreeId, { titre: passage.titre, score, niveau, raison, raccourci, passages: [{ passage, contenu }] });
    }
  };

  const remplir = (classees: Note[], plafond: number, niveau: NiveauContexte) => {
    for (const note of classees) {
      const { passage } = note;
      if (retenus.has(passage.id)) continue;
      const groupe = parEntree.get(passage.entreeId);
      if (groupe && groupe.passages.length >= MAX_PASSAGES_PAR_ENTREE) {
        if (!rejets.has(passage.entreeId)) rejets.set(passage.entreeId, { id: passage.entreeId, titre: passage.titre, cause: 'quota-fiche', score: note.score });
        continue;
      }
      if (utilise + coutDe(passage, passage.contenu) > plafond) {
        if (!parEntree.has(passage.entreeId) && !rejets.has(passage.entreeId)) {
          rejets.set(passage.entreeId, { id: passage.entreeId, titre: passage.titre, cause: 'budget', score: note.score });
        }
        continue;
      }
      ajouter(note, niveau, passage.contenu, (note.details ? raisonsScoreLore(note.details) : ['pertinence']).join(', '));
    }
  };

  // P0 : le meilleur passage de chaque fiche certaine pour la scène.
  if (options.ancres?.size) {
    const meilleurs = new Map<string, Note>();
    for (const note of (notesMessage ? notesScene.map((n, i) => (notesMessage[i].score > n.score ? notesMessage[i] : n)) : notesScene)) {
      if (!options.ancres.has(note.passage.entreeId) || note.score === 0) continue;
      const actuel = meilleurs.get(note.passage.entreeId);
      if (!actuel || note.score > actuel.score) meilleurs.set(note.passage.entreeId, note);
    }
    // Répartition équitable : une seule fiche certaine peut prendre tout le budget ;
    // plusieurs se partagent au plus PART_MAX_P0 (le reste va au message du joueur).
    // Les fiches courtes restent entières, les longues sont raccourcies de façon
    // égale ; si une part tombe sous la taille lisible, la fiche au score le plus
    // bas est écartée et le manque déclaré.
    let candidats = [...meilleurs.values()].sort((a, b) => b.score - a.score);
    const plafondTotal = (n: number) => (n === 1 ? budget : Math.floor(budget * PART_MAX_P0));
    const repartir = (liste: Note[]) => {
      let disponible = plafondTotal(liste.length) - liste.reduce((n, x) => n + x.passage.titre.length + 6, 0);
      const parLongueur = [...liste].sort((a, b) => a.passage.contenu.length - b.passage.contenu.length);
      const parts = new Map<Note, number>();
      parLongueur.forEach((note, i) => {
        const part = Math.max(0, Math.floor(disponible / (parLongueur.length - i)));
        const alloue = Math.min(note.passage.contenu.length, part);
        parts.set(note, alloue);
        disponible -= alloue;
      });
      return parts;
    };
    let parts = repartir(candidats);
    while (candidats.length > 1 && candidats.some((n) => parts.get(n)! < Math.min(n.passage.contenu.length, TAILLE_MIN_P0_RACCOURCI))) {
      const ecartee = candidats[candidats.length - 1];
      rejets.set(ecartee.passage.entreeId, { id: ecartee.passage.entreeId, titre: ecartee.passage.titre, cause: 'budget', score: ecartee.score });
      candidats = candidats.slice(0, -1);
      parts = repartir(candidats);
    }
    for (const note of candidats) {
      const { passage } = note;
      const alloue = parts.get(note)!;
      if (alloue >= passage.contenu.length) ajouter(note, 'P0', passage.contenu, '');
      else if (alloue >= TAILLE_MIN_P0_RACCOURCI) ajouter(note, 'P0', raccourcir(passage.contenu, alloue), '', true);
      else rejets.set(passage.entreeId, { id: passage.entreeId, titre: passage.titre, cause: 'budget', score: note.score });
    }
  }

  if (notesMessage) remplir(classer(notesMessage), Math.floor(budget / 2), 'P1');
  const combinees = notesMessage
    ? notesScene.map((n, i) => (notesMessage[i].score > n.score ? { ...notesMessage[i] } : n))
    : notesScene;
  remplir(classer(combinees), budget, notesMessage ? 'P2' : 'P1');

  // Manque canonique : une fiche certaine pour la scène qui n'a finalement trouvé aucune place.
  for (const id of options.ancres ?? []) {
    if (parEntree.has(id)) continue;
    const note = rejets.get(id);
    if (note) manques.push(`fiche canonique « ${note.titre} » absente : budget du lore épuisé`);
  }
  const groupes = [...parEntree.entries()].sort((a, b) => RANG_NIVEAU[a[1].niveau] - RANG_NIVEAU[b[1].niveau]);
  const entrees = groupes.map(([id, groupe]): LoreEntry => ({
    id,
    titre: groupe.titre,
    contenu: groupe.passages.sort((a, b) => a.passage.ordre - b.passage.ordre).map((p) => p.contenu).join(SEPARATEUR_PASSAGES),
    score: groupe.score,
    niveau: groupe.niveau,
    raison: groupe.raison,
  }));
  const rapport: RapportSelectionLore = {
    budget,
    utilise,
    passagesAnalyses: passages.length,
    retenus: groupes.map(([id, g]) => ({
      id, titre: g.titre, niveau: g.niveau, score: g.score, raison: g.raison, raccourci: g.raccourci,
      caracteres: g.passages.reduce((n, p) => n + p.contenu.length, 0),
    })),
    rejetes: [...rejets.values()].filter((r) => !parEntree.has(r.id)).sort((a, b) => b.score - a.score).slice(0, 12),
    manques,
  };
  return { entrees, rapport };
}

/** Même sélection, sans le rapport (appelants historiques et interface du lorebook). */
export function selectionnerPassages(passages: PassageLore[], requete: string, options: OptionsPassages = {}): LoreEntry[] {
  return selectionnerPassagesDetaille(passages, requete, options).entrees;
}
