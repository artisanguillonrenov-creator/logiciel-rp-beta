import type { Plugin } from '../types';
import type { ElyndorEntryChargee } from './loreLoader';

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

  const entreesValidees = entrees.map((e: any, i: number) => {
    if (!e || typeof e.titre !== 'string' || !e.titre.trim() || typeof e.contenu !== 'string' || !e.contenu.trim()) {
      throw new Error(`Entrée ${i + 1} invalide : "titre" et "contenu" (texte) sont requis.`);
    }
    return { titre: e.titre.trim(), contenu: e.contenu.trim() };
  });

  return {
    id: `plugin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nom: nom.trim() || 'Pack sans nom',
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
