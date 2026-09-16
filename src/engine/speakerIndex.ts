// Un prénom partagé n'identifie pas un locuteur : mieux vaut aucun portrait
// que le visage d'un autre personnage. Les noms complets restent prioritaires.
export function indexerLocuteurs<T extends { id: string; titre: string }>(personnages: T[]): Map<string, T> {
  const complets = new Map<string, T[]>();
  const prenoms = new Map<string, T[]>();
  for (const personnage of personnages) {
    const nom = personnage.titre.trim().toLocaleLowerCase('fr');
    if (!nom) continue;
    complets.set(nom, [...(complets.get(nom) ?? []), personnage]);
    const prenom = nom.split(/\s+/)[0];
    if (prenom.length > 2) prenoms.set(prenom, [...(prenoms.get(prenom) ?? []), personnage]);
  }
  const index = new Map<string, T>();
  for (const [nom, candidats] of complets) {
    if (candidats.length === 1) index.set(nom, candidats[0]);
  }
  for (const [prenom, candidats] of prenoms) {
    if (!complets.has(prenom) && candidats.length === 1) index.set(prenom, candidats[0]);
  }
  return index;
}
