/** Retire toute clé connue et toute valeur Authorization reproduite par une API. */
export function masquerSecrets(detail: string, secrets: Array<string | undefined> = []): string {
  let propre = detail.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [masqué]');
  for (const secret of secrets) {
    if (secret) propre = propre.split(secret).join('[clé masquée]');
  }
  return propre.slice(0, 500);
}

/**
 * Retire du texte les blocs délimités par des balises de raisonnement
 * explicitement connues (voir reasoningPolicy.ts), sans toucher au reste —
 * jamais de regex générique qui risquerait de supprimer de la narration RP
 * légitime. `balises` par défaut à ['think'] pour compatibilité avec les
 * appels historiques (Infermatic).
 */
export function nettoyerRaisonnementInterne(contenu: string, balises: string[] = ['think']): string {
  let propre = contenu;
  for (const balise of balises) {
    const nom = balise.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    propre = propre.replace(new RegExp(`<${nom}\\b[^>]*>[\\s\\S]*?<\\/${nom}\\s*>`, 'gi'), '');
    propre = propre.replace(new RegExp(`<${nom}\\b[^>]*>[\\s\\S]*$`, 'gi'), '');
    propre = propre.replace(new RegExp(`<\\/${nom}\\s*>`, 'gi'), '');
  }
  return propre.trim();
}
