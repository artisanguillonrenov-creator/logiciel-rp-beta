import { extraireAncresDetaillees, type ElyndorEntryChargee } from './loreLoader';
import { contientExpression } from './texteRecherche';

/**
 * Résolution des entités d'une scène, avant toute recherche.
 *
 * Distingue ce qui est CERTAIN pour la scène en cours (nom écrit dans le
 * message du joueur, la dernière réponse du narrateur, la ville ou la
 * destination) de ce qui est seulement ÉVOQUÉ (nom présent dans le résumé ou
 * les faits d'un récit passé). Seules les entités certaines reçoivent le
 * statut P0 : une « Paris » citée dans un souvenir ne remplace pas la ville où
 * se trouve le joueur. Quand un même nom désigne plusieurs fiches (homonymes),
 * la ville tranche ; sinon l'ambiguïté est signalée, jamais devinée.
 */
export interface AmbiguiteEntite {
  alias: string;
  candidats: string[];
  /** Identifiant retenu grâce à la ville, s'il y en a un seul. */
  resolu?: string;
}

export interface ResolutionEntites {
  ville?: string;
  lieuActuel?: string;
  destination?: string;
  presents: string[];
  /** Fiches certaines pour la scène : leur meilleur passage est protégé (P0). */
  ancresP0: Set<string>;
  /** Fiches seulement évoquées par le résumé ou les faits : pas d'ancre. */
  evoquees: Set<string>;
  ambigus: AmbiguiteEntite[];
  /** Pourquoi chaque fiche est P0 (diagnostic concepteur). */
  raisons: Map<string, string>;
}

export interface ParametresResolution {
  pool: ElyndorEntryChargee[];
  messageJoueur: string;
  ville?: string;
  lieuActuel?: string;
  destination?: string;
  /** Fiches visées par l'intention du joueur (« Guilde des Aventuriers »…). */
  fichesIntention: string[];
  derniereReponse?: string;
  /** Résumé, faits : pistes de contexte, jamais source d'ancre. */
  memoire: string[];
  presents: string[];
}

function mentionneVille(entree: ElyndorEntryChargee, ville: string): boolean {
  const reperes = [entree.titre, ...(entree.primaryKeys ?? []), ...(entree.secondaryKeys ?? [])].join(' ');
  return contientExpression(reperes, ville);
}

export function resoudreEntitesScene(p: ParametresResolution): ResolutionEntites {
  const courant = [
    p.messageJoueur,
    p.ville && `Ville : ${p.ville}`,
    p.lieuActuel,
    p.destination,
    ...p.fichesIntention,
    p.derniereReponse,
  ].filter((t): t is string => !!t).join('\n');

  const ancresP0 = new Set<string>();
  const raisons = new Map<string, string>();
  const ambigus: AmbiguiteEntite[] = [];

  const parAlias = new Map<string, ReturnType<typeof extraireAncresDetaillees>>();
  for (const ancre of extraireAncresDetaillees(courant, p.pool)) {
    parAlias.set(ancre.alias, [...(parAlias.get(ancre.alias) ?? []), ancre]);
  }
  for (const [alias, groupe] of parAlias) {
    if (groupe.length === 1) {
      ancresP0.add(groupe[0].entree.id);
      raisons.set(groupe[0].entree.id, `nom cité : « ${alias} »`);
      continue;
    }
    // Homonymes : la ville de la scène départage, sinon on ne tranche pas.
    const locales = p.ville ? groupe.filter((g) => mentionneVille(g.entree, p.ville!)) : [];
    if (locales.length === 1) {
      ancresP0.add(locales[0].entree.id);
      raisons.set(locales[0].entree.id, `nom cité : « ${alias} » (homonymes départagés par la ville ${p.ville})`);
      ambigus.push({ alias, candidats: groupe.map((g) => g.entree.titre), resolu: locales[0].entree.id });
    } else {
      ambigus.push({ alias, candidats: groupe.map((g) => g.entree.titre) });
    }
  }

  for (const entree of p.pool) {
    if (ancresP0.has(entree.id)) continue;
    if (p.fichesIntention.some((f) => contientExpression(entree.titre, f))) {
      ancresP0.add(entree.id);
      raisons.set(entree.id, 'intention du joueur');
    }
  }

  const evoquees = new Set<string>();
  const memoire = p.memoire.filter(Boolean).join('\n');
  if (memoire) {
    for (const ancre of extraireAncresDetaillees(memoire, p.pool)) {
      if (!ancresP0.has(ancre.entree.id)) evoquees.add(ancre.entree.id);
    }
  }

  return {
    ville: p.ville,
    lieuActuel: p.lieuActuel,
    destination: p.destination,
    presents: p.presents,
    ancresP0,
    evoquees,
    ambigus,
    raisons,
  };
}
