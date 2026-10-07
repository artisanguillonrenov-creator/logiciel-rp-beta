import type { LoreEntry } from '../types';
import { similariteCosinus } from './embeddings';
import type { ElyndorEntryChargee } from './loreLoader';
import { calculerScoreHybrideLore, SEUIL_LORE_HYBRIDE } from './loreScoring';

/**
 * Recherche du lore par passages : chaque entrée est découpée en passages
 * de quelques centaines de caractères, tous notés à chaque tour, et seuls
 * les meilleurs partent au narrateur dans un budget fixe. Remplace l'envoi
 * d'entrées entières coupées à leurs 650 premiers caractères, qui perdait
 * justement la partie utile (ex. une ligne de la table d'âge).
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

export function construirePassages(entrees: ElyndorEntryChargee[]): PassageLore[] {
  return entrees.flatMap((entree) =>
    decouperEnPassages(entree.contenu).map((contenu, ordre) => ({
      ...entree,
      id: `${entree.id}#${ordre}`,
      contenu,
      constant: false,
      entreeId: entree.id,
      ordre,
      entreeConstante: entree.constant,
    })),
  );
}

export interface OptionsPassages {
  vecteurRequete?: number[];
  vecteursPassages?: Record<string, number[]>;
  /** Identifiants d'entrées dont le nom canonique est cité dans la scène. */
  ancres?: Set<string>;
  budget?: number;
  /** Ouverture d'histoire : un peu de hasard pour varier les détails convoqués. */
  aleatoire?: boolean;
}

/**
 * Note tous les passages et garde les meilleurs dans le budget. Les passages
 * retenus d'une même entrée sont regroupés sous son titre, dans leur ordre
 * d'origine ; les entrées sont rangées par meilleur passage.
 */
export function selectionnerPassages(passages: PassageLore[], requete: string, options: OptionsPassages = {}): LoreEntry[] {
  const budget = options.budget ?? BUDGET_LORE_PASSAGES;
  const notes = passages
    .map((passage) => {
      const vecteur = options.vecteursPassages?.[passage.id];
      const similarite = vecteur && options.vecteurRequete ? similariteCosinus(options.vecteurRequete, vecteur) : undefined;
      const details = calculerScoreHybrideLore(
        {
          titre: passage.titre,
          contenu: passage.contenu,
          primaryKeys: passage.primaryKeys ?? passage.motsClesPrimaires,
          secondaryKeys: passage.secondaryKeys ?? passage.motsClesSecondaires,
          negativeKeys: passage.negativeKeys ?? passage.motsClesNegatifs,
          priority: passage.priority,
          category: passage.category,
          scope: passage.scope,
        },
        requete,
        similarite,
      );
      if (details.score === 0) return { passage, score: 0 };
      const score = details.score
        + (passage.entreeConstante ? BONUS_ENTREE_CONSTANTE : 0)
        + (options.aleatoire ? Math.random() * 0.1 : 0);
      return { passage, score };
    });
  // L'ancre (nom cité) ne relève que le meilleur passage de sa fiche : sinon
  // une ville citée occupait le budget avec tous ses passages.
  const meilleurParAncre = new Map<string, { passage: PassageLore; score: number }>();
  for (const note of notes) {
    if (!options.ancres?.has(note.passage.entreeId) || note.score === 0) continue;
    const actuel = meilleurParAncre.get(note.passage.entreeId);
    if (!actuel || note.score > actuel.score) meilleurParAncre.set(note.passage.entreeId, note);
  }
  for (const note of meilleurParAncre.values()) note.score += BONUS_ANCRE;
  const classees = notes
    .filter((n) => n.score >= SEUIL_LORE_HYBRIDE)
    .sort((a, b) => b.score - a.score || a.passage.priority - b.passage.priority);

  const parEntree = new Map<string, { titre: string; score: number; passages: PassageLore[] }>();
  let utilise = 0;
  for (const { passage, score } of classees) {
    const groupe = parEntree.get(passage.entreeId);
    if (groupe && groupe.passages.length >= MAX_PASSAGES_PAR_ENTREE) continue;
    const cout = passage.contenu.length + (groupe ? SEPARATEUR_PASSAGES.length : passage.titre.length + 6);
    if (utilise + cout > budget) continue;
    utilise += cout;
    if (groupe) groupe.passages.push(passage);
    else parEntree.set(passage.entreeId, { titre: passage.titre, score, passages: [passage] });
  }

  return [...parEntree.entries()].map(([id, groupe]) => ({
    id,
    titre: groupe.titre,
    contenu: groupe.passages.sort((a, b) => a.ordre - b.ordre).map((p) => p.contenu).join(SEPARATEUR_PASSAGES),
    score: groupe.score,
  }));
}
