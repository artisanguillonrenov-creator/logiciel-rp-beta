import type { EntreeLoreEmergent } from '../types';

// Les PNJ homonymes ne sont pas une seule personne. Les autres catégories de lore
// gardent la déduplication lexicale historique ; les PNJ ne fusionnent qu'avec
// une preuve d'identité explicite (ID commun ou alias d'ancien ID déjà attesté).

/** Nom comparable : minuscules, sans accents ni ponctuation (« N'Kala » → « n kala »). */
export function cleNomLore(titre: string): string {
  return titre
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Noms sous lesquels une entrée peut être désignée : « Elfe Noire (N'Kala) » → titre complet, « n kala », « elfe noire ». */
function nomsDe(titre: string): string[] {
  const noms = new Set([cleNomLore(titre)]);
  const parenthese = titre.match(/^(.*?)\(([^)]*)\)\s*$/);
  if (parenthese) {
    noms.add(cleNomLore(parenthese[1]));
    noms.add(cleNomLore(parenthese[2]));
  }
  noms.delete('');
  return [...noms];
}

export function memeEntiteLore(
  a: Pick<EntreeLoreEmergent, 'categorie' | 'titre'>,
  b: Pick<EntreeLoreEmergent, 'categorie' | 'titre'>,
): boolean {
  if (a.categorie !== b.categorie) return false;
  const nomsB = new Set(nomsDe(b.titre));
  return nomsDe(a.titre).some((nom) => nomsB.has(nom));
}

/** Un nom propre seul (« N'Kala ») est préféré à une désignation composée (« Elfe Noire (N'Kala) »). */
function meilleurTitre(a: string, b: string): string {
  const aComposite = a.includes('(');
  const bComposite = b.includes('(');
  if (aComposite !== bComposite) return aComposite ? b : a;
  return a;
}

/**
 * Fusionne les autres éléments du lore par nom ; un PNJ n'est fusionné
 * qu'avec le même ID ou un ancien ID explicitement lié. Deux personnes
 * distinctes gardent deux fiches, même avec un nom identique.
 */
export function fusionnerDoublonsLore(entrees: EntreeLoreEmergent[]): EntreeLoreEmergent[] {
  const resultat: EntreeLoreEmergent[] = [];
  for (const entree of entrees) {
    const i = resultat.findIndex((r) => {
      if (r.categorie === 'pnj' && entree.categorie === 'pnj') {
        return r.id === entree.id || !!r.alias?.includes(entree.id) || !!entree.alias?.includes(r.id);
      }
      return memeEntiteLore(r, entree);
    });
    if (i < 0) {
      resultat.push(entree);
      continue;
    }
    const base = resultat[i];
    const alias = [...new Set([...(base.alias ?? []), entree.id, ...(entree.alias ?? [])])].filter((id) => id !== base.id);
    resultat[i] = {
      ...base,
      titre: meilleurTitre(base.titre, entree.titre),
      profilPnj: base.categorie === 'pnj' ? { ...(entree.profilPnj ?? {}), ...(base.profilPnj ?? {}) } : undefined,
      profilMonde: base.categorie !== 'pnj' ? { ...(entree.profilMonde ?? {}), ...(base.profilMonde ?? {}) } : undefined,
      contenu: entree.contenu.length > base.contenu.length ? entree.contenu : base.contenu,
      statut: base.statut === 'permanent' || entree.statut === 'permanent' ? 'permanent' : 'provisoire',
      premiereMention: Math.min(base.premiereMention, entree.premiereMention),
      dernierAcces: Math.max(base.dernierAcces, entree.dernierAcces),
      alias,
    };
  }
  return resultat;
}
