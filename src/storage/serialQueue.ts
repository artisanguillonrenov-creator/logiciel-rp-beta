// Une erreur est rendue à son appelant sans empoisonner les opérations suivantes.
export function creerFileSerie() {
  let attente: Promise<unknown> = Promise.resolve();
  return function executer<T>(operation: () => Promise<T>): Promise<T> {
    const resultat = attente.then(operation);
    attente = resultat.catch(() => {});
    return resultat;
  };
}
