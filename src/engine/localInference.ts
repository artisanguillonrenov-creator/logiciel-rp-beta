/**
 * Compatibilité temporaire d’erreur uniquement.
 *
 * Le runtime local LiteRT a été supprimé. Cette classe subsiste pour que les
 * anciens écrans puissent encore afficher proprement une erreur issue d’une
 * sauvegarde ou d’un appel historique, sans réintroduire aucune inférence
 * locale ni dépendance native.
 */
export class ErreurMoteurLocal extends Error {
  constructor(message = 'Le moteur local a été retiré. Elyndor utilise uniquement Elyndor Cloud.') {
    super(message);
    this.name = 'ErreurMoteurLocal';
  }
}
