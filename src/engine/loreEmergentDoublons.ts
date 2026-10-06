import type { EntreeLoreEmergent } from '../types';

// Un même PNJ ne doit avoir qu'une fiche. Le rapprochement par embeddings
// (emergentLore.ts) compare « nom — description » : quand la description
// change d'un tour à l'autre (« marchand d'esclaves », puis « accompagne
// William »), le score passe sous le seuil et une deuxième fiche « Marcus »
// était créée, avec son propre portrait. Avec plusieurs fiches du même nom,
// indexerLocuteurs refusait aussi de choisir et la réplique restait sans
// portrait. Le nom fait donc foi avant la description.

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
 * Fusionne les fiches d'une même entité (même catégorie, même nom). La plus
 * ancienne garde son identifiant ; les autres identifiants passent dans
 * `alias`, pour retrouver un portrait déjà généré sous l'un d'eux.
 */
export function fusionnerDoublonsLore(entrees: EntreeLoreEmergent[]): EntreeLoreEmergent[] {
  const resultat: EntreeLoreEmergent[] = [];
  for (const entree of entrees) {
    const i = resultat.findIndex((r) => memeEntiteLore(r, entree));
    if (i < 0) {
      resultat.push(entree);
      continue;
    }
    const base = resultat[i];
    const alias = [...new Set([...(base.alias ?? []), entree.id, ...(entree.alias ?? [])])].filter((id) => id !== base.id);
    resultat[i] = {
      ...base,
      titre: meilleurTitre(base.titre, entree.titre),
      contenu: entree.contenu.length > base.contenu.length ? entree.contenu : base.contenu,
      statut: base.statut === 'permanent' || entree.statut === 'permanent' ? 'permanent' : 'provisoire',
      premiereMention: Math.min(base.premiereMention, entree.premiereMention),
      dernierAcces: Math.max(base.dernierAcces, entree.dernierAcces),
      alias,
    };
  }
  return resultat;
}
