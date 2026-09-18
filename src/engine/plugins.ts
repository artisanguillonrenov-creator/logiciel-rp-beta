import type { Plugin } from '../types';
import type { ElyndorEntryChargee } from './loreLoader';

const MAX_ENTREES_PAR_PACK = 50;
const MAX_LONGUEUR_NOM = 120;
const MAX_LONGUEUR_TITRE = 240;
const MAX_LONGUEUR_CONTENU = 6_000;
const MAX_TAILLE_PACK = 120_000;

/**
 * Analyse et valide le JSON d'un pack de contenu collé par l'utilisateur
 * (plugin "esprit", brief Phase 2) : uniquement une liste d'entrées
 * titre/contenu, aucun code — donc rien à exécuter ni à isoler.
 */
export function analyserPackJson(nom: string, texteJson: string): Plugin {
  let parsed: unknown;
  try {
    parsed = JSON.parse(texteJson);
  } catch {
    throw new Error('JSON invalide. Vérifie la syntaxe du pack.');
  }

  const entrees = Array.isArray(parsed) ? parsed : (parsed as any)?.entrees;
  if (!Array.isArray(entrees) || entrees.length === 0) {
    throw new Error('Le pack doit contenir un tableau non vide d\'entrées {"titre", "contenu"}.');
  }
  if (entrees.length > MAX_ENTREES_PAR_PACK) {
    throw new Error(`Un pack ne peut pas dépasser ${MAX_ENTREES_PAR_PACK} entrées.`);
  }

  const entreesValidees = entrees.map((e: any, i: number) => {
    if (!e || typeof e.titre !== 'string' || !e.titre.trim() || typeof e.contenu !== 'string' || !e.contenu.trim()) {
      throw new Error(`Entrée ${i + 1} invalide : "titre" et "contenu" (texte) sont requis.`);
    }
    const titre = e.titre.trim();
    const contenu = e.contenu.trim();
    if (titre.length > MAX_LONGUEUR_TITRE || contenu.length > MAX_LONGUEUR_CONTENU) {
      throw new Error(`Entrée ${i + 1} trop longue : ${MAX_LONGUEUR_TITRE} caractères pour le titre et ${MAX_LONGUEUR_CONTENU} pour le contenu maximum.`);
    }
    return { titre, contenu };
  });

  const nomNormalise = nom.trim().slice(0, MAX_LONGUEUR_NOM) || 'Pack sans nom';
  if (JSON.stringify(entreesValidees).length > MAX_TAILLE_PACK) {
    throw new Error(`La taille totale d'un pack ne peut pas dépasser ${MAX_TAILLE_PACK} caractères.`);
  }

  return {
    id: `plugin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nom: nomNormalise,
    entrees: entreesValidees,
    installeLe: Date.now(),
  };
}

/**
 * Convertit les packs installés au format attendu par le sélecteur
 * sémantique du lore Elyndor, pour qu'ils rejoignent le même pool de
 * sélection que le lorebook statique et le lore émergent — traitées à
 * l'identique d'une entrée Elyndor normale (constant: false, sélectionnées
 * par similarité comme les autres) plutôt que comme une catégorie à part.
 * Une entrée explicitement mentionnée doit désormais avoir de bien
 * meilleures chances d'être retenue grâce au plafond relevé (4 → 18, voir
 * selectionnerLoreElyndorSemantique), sans pour autant s'imposer dans
 * chaque tour comme le ferait "constant: true".
 */
export function convertirPluginsPourSelection(plugins: Plugin[]): ElyndorEntryChargee[] {
  return plugins.flatMap((plugin) =>
    plugin.entrees.map((entree, i) => ({
      id: `${plugin.id}-${i}`,
      titre: `[PACK — ${plugin.nom}] ${entree.titre}`,
      contenu: entree.contenu,
      motsClesNegatifs: [],
      priority: 100,
      constant: false,
    })),
  );
}
