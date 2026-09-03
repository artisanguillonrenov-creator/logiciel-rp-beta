import type { AppSettings } from '../types';
import { appellerModele } from '../engine/openrouter';

// Traduction de l'interface et de la conversation (sélecteur de langue) :
// le moteur narratif raisonne et écrit toujours en français en interne
// (prompt système, lore, mémoire — voir src/engine/promptBuilder.ts) pour
// ne jamais complexifier ce pipeline déjà réglé finement. Cette couche
// traduit uniquement ce qui est affiché à l'écran, par lot, en réutilisant
// le même modèle déjà configuré plutôt qu'un service de traduction séparé.
// Chaque chaîne traduite est mise en cache (src/storage/storage.ts) par
// texte source exact — jamais retraduite deux fois pour une même langue.

function extraireJson(texte: string): string {
  const debut = texte.indexOf('[');
  const fin = texte.lastIndexOf(']');
  if (debut === -1 || fin === -1 || fin < debut) return texte;
  return texte.slice(debut, fin + 1);
}

/**
 * Traduit un lot de chaînes françaises vers la langue cible, en préservant
 * l'ordre et le nombre d'éléments. En cas d'échec (réseau, réponse
 * inexploitable), retourne les textes source tels quels plutôt que de
 * bloquer l'affichage sur une erreur — la traduction est un enrichissement,
 * jamais une condition pour voir l'application.
 */
export async function traduireLot(textes: string[], langueCible: string, appSettings: AppSettings): Promise<string[]> {
  if (textes.length === 0) return [];
  try {
    const contenu = await appellerModele({
      apiKey: appSettings.openRouterApiKey,
      model: appSettings.model,
      moteurInference: appSettings.moteurInference,
      temperature: 0.2,
      maxTokens: Math.min(4000, Math.max(400, textes.join(' ').length * 3)),
      messages: [
        {
          role: 'system',
          content:
            `Tu traduis des textes d'une application de jeu de rôle textuel, du français vers ${langueCible}. ` +
            "Réponds UNIQUEMENT avec un tableau JSON de chaînes, exactement dans le même ordre et le même nombre " +
            "d'éléments que la liste reçue — une traduction par élément, sans numérotation, sans markdown, sans " +
            "commentaire autour. Préserve tel quel tout texte entre doubles accolades (ex. {{user}}), ainsi que la " +
            'ponctuation de mise en forme comme *texte* (action) ou "texte" (dialogue).',
        },
        { role: 'user', content: JSON.stringify(textes) },
      ],
    });

    const parsed = JSON.parse(extraireJson(contenu));
    if (Array.isArray(parsed) && parsed.length === textes.length && parsed.every((t) => typeof t === 'string')) {
      return parsed as string[];
    }
  } catch {
    // repli ci-dessous
  }
  return textes;
}
