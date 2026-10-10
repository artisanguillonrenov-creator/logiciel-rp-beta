import { normaliserLore } from '../engine/loreScoring';
import { validerFiche, type FicheEditable } from './lorebookModele';

const MAX_MOTS_CLES = 32;

/** Prépare la proposition à afficher ; aucune sauvegarde ni publication. */
function motsCles(
  proposes: unknown,
  existants: readonly string[],
  dejaPresents: Set<string>,
): string[] {
  const valides = Array.isArray(proposes) && proposes.every(v => typeof v === 'string')
    ? proposes as string[]
    : [...existants];
  const resultat: string[] = [];
  for (const brut of valides) {
    const valeur = brut.trim();
    const cle = normaliserLore(valeur);
    if (!cle || valeur.length > 120 || dejaPresents.has(cle)) continue;
    dejaPresents.add(cle);
    resultat.push(valeur);
    if (resultat.length >= MAX_MOTS_CLES) break;
  }
  return resultat;
}

/**
 * Les alias lexicaux sont dédupliqués entre champs pour éviter de gaspiller
 * des emplacements. Un mot-clé négatif ne peut pas exclure une expression
 * déjà classée comme positive.
 */
export function preparerFicheLoreProposee(original: FicheEditable, brute: unknown): FicheEditable {
  if (!brute || typeof brute !== 'object' || Array.isArray(brute)) {
    throw new Error('Proposition IA invalide : objet JSON attendu.');
  }
  const resultat = brute as Record<string, unknown>;
  const titre = typeof resultat.titre === 'string' && resultat.titre.trim()
    ? resultat.titre : original.titre;
  const utilises = new Set<string>();
  const primaryKeys = motsCles(resultat.primaryKeys, original.primaryKeys, utilises);
  // Pour une création, le titre constitue un alias lexical fiable même si
  // le modèle omet exceptionnellement la liste de mots-clés principaux.
  if (!primaryKeys.length) primaryKeys.push(...motsCles([titre], [], utilises));
  const secondaryKeys = motsCles(resultat.secondaryKeys, original.secondaryKeys, utilises);
  const negativeKeys = motsCles(resultat.negativeKeys, original.negativeKeys, utilises);

  return validerFiche({
    titre,
    contenu: resultat.contenu,
    category: resultat.category ?? original.category,
    priority: typeof resultat.priority === 'number' && Number.isInteger(resultat.priority)
      ? resultat.priority : original.priority,
    constant: typeof resultat.constant === 'boolean' ? resultat.constant : original.constant,
    actif: typeof resultat.actif === 'boolean' ? resultat.actif : original.actif,
    scope: resultat.scope ?? original.scope,
    primaryKeys,
    secondaryKeys,
    negativeKeys,
    dossiers: resultat.dossiers ?? original.dossiers,
  });
}
