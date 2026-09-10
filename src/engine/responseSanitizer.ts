/** Retire toute clé connue et toute valeur Authorization reproduite par une API. */
export function masquerSecrets(detail: string, secrets: Array<string | undefined> = []): string {
  let propre = detail.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [masqué]');
  for (const secret of secrets) {
    if (secret) propre = propre.split(secret).join('[clé masquée]');
  }
  return propre.slice(0, 500);
}

/** Nettoie les raisonnements Infermatic sans toucher aux tool_calls structurés. */
export function nettoyerRaisonnementInterne(contenu: string): string {
  let propre = contenu.replace(/<think\b[^>]*>[\s\S]*?<\/think\s*>/gi, '');
  propre = propre.replace(/<think\b[^>]*>[\s\S]*$/gi, '');
  propre = propre.replace(/<\/think\s*>/gi, '');
  return propre.trim();
}
