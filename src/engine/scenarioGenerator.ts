import type { AppSettings } from '../types';
import { appellerModele } from './openrouter';
import { ErreurProfilContenu, INSTRUCTION_REGISTRE_GRAND_PUBLIC, validerProfilContenuHeuristique } from './contenuAdulte';

export interface ParametresGenerationScenario {
  appSettings: AppSettings;
  mondeNom?: string;
  mondeDescription?: string;
  personnageNom: string;
  sexe?: string;
  raceNom?: string;
  raceDescription?: string;
  age?: string;
  apparence?: string;
  description?: string;
  lieuNom?: string;
  lieuDescription?: string;
  situationNom?: string;
  situationDescription?: string;
  extraitLore?: string;
}

/**
 * Génère le texte de scénario d'ouverture, à l'étape "Point de départ" du
 * parcours de création — le joueur déclenche lui-même la génération (bouton
 * "Générer avec l'IA"), qui reprend tout ce qu'il a déjà renseigné
 * (personnage, monde, lieu, situation) plus un extrait du lorebook dédié au
 * lieu choisi, pour rester ancré dans Elyndor plutôt que générique.
 */
export async function genererScenarioDepart(p: ParametresGenerationScenario): Promise<string> {
  const lignesPersonnage = [
    `Nom : ${p.personnageNom || 'non précisé'}`,
    p.sexe && `Sexe : ${p.sexe}`,
    p.raceNom && `Race : ${p.raceNom}${p.raceDescription ? ` (${p.raceDescription})` : ''}`,
    p.age && `Âge : ${p.age}`,
    p.apparence && `Apparence : ${p.apparence}`,
    p.description && `Description : ${p.description}`,
  ]
    .filter(Boolean)
    .join('\n');

  const contexte = [
    p.mondeNom && `MONDE : ${p.mondeNom}${p.mondeDescription ? ` — ${p.mondeDescription}` : ''}`,
    `PERSONNAGE :\n${lignesPersonnage}`,
    p.lieuNom && `LIEU DE DÉPART : ${p.lieuNom}${p.lieuDescription ? ` — ${p.lieuDescription}` : ''}`,
    p.situationNom && `SITUATION DE DÉPART : ${p.situationNom}${p.situationDescription ? ` — ${p.situationDescription}` : ''}`,
    p.extraitLore && `EXTRAIT DU LOREBOOK SUR CE LIEU :\n${p.extraitLore}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const instructionRegistre =
    p.appSettings.profilContenu === 'grand_public' ? `\n\n${INSTRUCTION_REGISTRE_GRAND_PUBLIC}` : '';

  const contenu = await appellerModele({
    apiKey: p.appSettings.openRouterApiKey,
    model: p.appSettings.model,
    moteurInference: p.appSettings.moteurInference,
    temperature: 0.9,
    maxTokens: 280,
    messages: [
      {
        role: 'system',
        content:
          "Tu écris le scénario d'ouverture d'une histoire de jeu de rôle, à partir des informations fournies (monde, personnage, lieu, situation, lore). 3 à 5 phrases, à la troisième personne, temps présent, qui plantent la scène juste avant que l'histoire ne commence — sans dialogue, sans résoudre la situation, juste le point de départ. Reste cohérent avec le lore fourni. Réponds uniquement avec le texte du scénario, sans titre ni préambule." +
          instructionRegistre,
      },
      { role: 'user', content: contexte },
    ],
  });

  const texte = contenu.trim();
  if (!validerProfilContenuHeuristique(texte, p.appSettings.profilContenu).ok) {
    throw new ErreurProfilContenu('Scénario généré hors des limites du profil Grand public — réessaie.');
  }
  return texte;
}
