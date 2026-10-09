import { corrigerEtiquettes } from './controlesCoherence';
import { FIN_ETAT, MARQUEUR_ETAT } from './noyauNarratif';
import { appliquerPatchLocal, reponseFaitParlerLeJoueur, retirerRepliqueDuJoueur, type RapportValidation } from './validator';
import { verifierEntitesCanoniques } from './verificationCanon';

/**
 * Corrections déterministes AVANT le dernier comptage, jamais après.
 * Toute mutation invalide le STATE DELTA généré pour le texte antérieur :
 * l'appelant doit utiliser le repli dérivé du texte final.
 */
export function preparerNarrationPourPublication(
  texte: string,
  canon: string,
  personnageNom: string,
  nomsConnus: string[],
): { texte: string; modifie: boolean } {
  let resultat = texte.trim();
  const verificationCanon = verifierEntitesCanoniques(resultat, canon);
  if (!verificationCanon.ok) resultat = appliquerPatchLocal(resultat, verificationCanon);
  if (reponseFaitParlerLeJoueur(resultat, personnageNom)) {
    resultat = retirerRepliqueDuJoueur(resultat, personnageNom);
  }
  resultat = corrigerEtiquettes(resultat, nomsConnus).trim();
  return { texte: resultat, modifie: resultat !== texte };
}

/** Un texte non validé ne doit pas être enregistré comme tour RP. */
export function exigerNarrationValide(texte: string, rapport: RapportValidation): void {
  if (!texte.trim()) throw new Error('Narration vide : tour non enregistré.');
  if (texte.includes(MARQUEUR_ETAT) || texte.includes(FIN_ETAT)) {
    throw new Error('Marqueur technique dans le texte visible : tour non enregistré.');
  }
  if (!rapport.ok) {
    const raisons = rapport.checks.filter((check) => !check.ok).map((check) => check.raison);
    throw new Error(`Narration refusée avant publication : ${raisons.join(' | ') || 'contrat narratif non respecté'}`);
  }
}

/**
 * Un delta appartenant à une ancienne variante ne doit jamais modifier le canon
 * d'une variante éditée. Le noyau déduira un état prudent du récit retenu.
 */
export function deltaAssocieAuTexte(avant: string, apres: string, delta: unknown): unknown {
  return avant === apres ? delta : null;
}
