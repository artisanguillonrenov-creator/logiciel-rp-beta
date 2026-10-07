import type { AppSettings } from '../types';
import { configurationLLM, appellerModele } from './openrouter';
import { ErreurProfilContenu, INSTRUCTION_REGISTRE_GRAND_PUBLIC, validerProfilContenuHeuristique } from './contenuAdulte';
import { ROLES_CANON } from './canonElyndor';
import { analyserIntention } from './intentionJoueur';

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
  /** Capitale de la race du personnage (« Paris » pour les Humains) : la scène s'y situe. */
  villeDepart?: string;
}

/**
 * Consigne type du scénario de départ : il sert de fil conducteur au
 * narrateur pour la première scène, et nomme le premier interlocuteur que
 * l'ouverture doit utiliser (controleOuverture.ts).
 */
export const CONSIGNE_SCENARIO = `Tu écris le scénario de départ d'une histoire de jeu de rôle dans Elyndor, à partir du monde, du personnage, du lieu, de la situation et du lore fournis. Ce scénario sert de fil conducteur au narrateur pour la première scène.

Écris 4 à 6 phrases au total (900 caractères au plus), au présent, à la deuxième personne (« tu »), qui posent :
1. Le lieu exact : la VILLE DE DÉPART fournie, nommée dans le texte, et l'endroit précis, avec un ou deux détails d'ambiance.
2. La raison de ta présence : ce qui t'amène ici, tiré de la situation choisie et du personnage.
3. La situation déjà en cours quand tu arrives : quelque chose se passe, une tension, une affaire, un danger.
4. Le premier interlocuteur, celui qui va t'interpeller : si le lore fixe quelqu'un pour ce lieu dans cette ville (voir PERSONNAGES FIXÉS PAR LE LORE), c'est lui, avec son nom exact ; sinon un personnage local mineur (marchand, garde, habitant…) avec un nom simple et une raison concrète de te parler.
5. Une amorce de dialogue autorisée : une seule courte réplique de ce personnage, sur sa propre ligne, au format NOM EN MAJUSCULES : « … ». Le scénario s'arrête sur cette réplique.

Interdits : terminer par une question au joueur (« Que fais-tu ? ») ; décider à ta place ce que tu dis, fais ou penses au-delà de ton arrivée ; résoudre la situation ; inventer un royaume, une grande guilde, un souverain ou une religion absents du lore. Réponds uniquement avec le texte du scénario, sans titre ni préambule.`;

/** Personnages fixés par le lore pour le lieu choisi (maîtresses de guilde, réceptionnistes…), par capitale. */
export function personnagesFixesDuLieu(lieuNom: string | undefined): string {
  if (!lieuNom) return '';
  const { roles } = analyserIntention(lieuNom, ROLES_CANON);
  return ROLES_CANON
    .filter((r) => roles.includes(r.role))
    .map((r) => `- ${r.ville} — ${r.libelle} : ${r.nom} (${r.description.slice(0, 110)}…)`)
    .join('\n');
}

/**
 * Génère le texte de scénario d'ouverture, à l'étape "Point de départ" du
 * parcours de création — le joueur déclenche lui-même la génération (bouton
 * "Générer avec l'IA"), qui reprend tout ce qu'il a déjà renseigné
 * (personnage, monde, lieu, situation) plus un extrait du lorebook dédié au
 * lieu choisi, pour rester ancré dans Elyndor plutôt que générique.
 */
/**
 * Question générique finale (« Que fais-tu ? ») retirée ; étiquette de
 * réplique mise en majuscules (« Vendeur : « » → « VENDEUR : « »), format
 * attendu par l'écran de conversation.
 */
export function nettoyerScenario(brut: string): string {
  return brut
    .trim()
    .replace(/\n*[^\n.!»]*\b(que fais-tu|que vas-tu faire|qu'est-ce que tu vas faire|que faites-vous)\s*\?\s*$/i, '')
    .replace(/^([ \t]*)([A-ZÀ-Ý][A-Za-zÀ-ÿ' -]{1,40}?)([ \t]*:[ \t]*[«"“])/gm, (_t, debut: string, nom: string, fin: string) => `${debut}${nom.toLocaleUpperCase('fr')}${fin}`)
    .trim();
}

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
    p.villeDepart && `VILLE DE DÉPART : ${p.villeDepart} (capitale de la race du personnage : la scène s'y déroule)`,
    p.mondeNom && `MONDE : ${p.mondeNom}${p.mondeDescription ? ` — ${p.mondeDescription}` : ''}`,
    `PERSONNAGE :\n${lignesPersonnage}`,
    p.lieuNom && `LIEU DE DÉPART : ${p.lieuNom}${p.lieuDescription ? ` — ${p.lieuDescription}` : ''}`,
    p.situationNom && `SITUATION DE DÉPART : ${p.situationNom}${p.situationDescription ? ` — ${p.situationDescription}` : ''}`,
    p.extraitLore && `EXTRAIT DU LOREBOOK SUR CE LIEU :\n${p.extraitLore}`,
    personnagesFixesDuLieu(p.lieuNom) && `PERSONNAGES FIXÉS PAR LE LORE POUR CE LIEU (prends celui de la ville de départ) :\n${personnagesFixesDuLieu(p.lieuNom)}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const instructionRegistre =
    p.appSettings.profilContenu === 'grand_public' ? `\n\n${INSTRUCTION_REGISTRE_GRAND_PUBLIC}` : '';

  const contenu = await appellerModele({
    ...configurationLLM(p.appSettings),
    temperature: 0.9,
    maxTokens: 450,
    messages: [
      {
        role: 'system',
        content: CONSIGNE_SCENARIO + instructionRegistre,
      },
      { role: 'user', content: contexte },
    ],
  });

  // Une question générique finale (« Que fais-tu ? ») est retirée.
  const texte = nettoyerScenario(contenu);
  if (!validerProfilContenuHeuristique(texte, p.appSettings.profilContenu).ok) {
    throw new ErreurProfilContenu('Scénario généré hors des limites du profil Grand public — réessaie.');
  }
  return texte;
}
