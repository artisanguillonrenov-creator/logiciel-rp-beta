import type { AppSettings, CategorieLoreEmergent, EntreeLoreEmergent, Message } from '../types';
import type { ElyndorEntryChargee } from './loreLoader';
import { appellerModele } from './openrouter';
import { obtenirEmbeddings, similariteCosinus } from './embeddings';

const CATEGORIES: CategorieLoreEmergent[] = ['pnj', 'objet', 'lieu', 'faction', 'evenement'];

// Même seuil que la déduplication des faits de mémoire (memory.ts), pour
// une cohérence de comportement entre les deux pipelines.
const SEUIL_RECONNAISSANCE = 0.86;

function idEntree(): string {
  return `emergent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface CandidatLoreEmergent {
  categorie: CategorieLoreEmergent;
  titre: string;
  contenu: string;
}

async function extraireCandidats(
  appSettings: AppSettings,
  transcript: string,
  existants: EntreeLoreEmergent[],
  personnageNom: string,
): Promise<CandidatLoreEmergent[]> {
  const existantsTexte = existants.length
    ? existants.map((e) => `- [${e.categorie}] ${e.titre}`).join('\n')
    : 'Aucun.';

  try {
    const sortie = await appellerModele({
      apiKey: appSettings.openRouterApiKey,
      model: appSettings.model,
      moteurInference: appSettings.moteurInference,
      temperature: 0.2,
      maxTokens: 500,
      messages: [
        {
          role: 'system',
          content: `Tu identifies les éléments de MONDE nouveaux et durables introduits dans un extrait de jeu de rôle : PNJ nommés destinés à revenir, lieux nommés, factions, objets marquants, événements qui feront date. Réponds UNIQUEMENT avec un JSON strict :
{"candidats": [{"categorie": "pnj|objet|lieu|faction|evenement", "titre": "...", "contenu": "description factuelle en une ou deux phrases"}]}

Pour un PNJ, le "titre" doit être son NOM PROPRE dès que le texte en révèle un (ex. "Kaelen"), jamais son rôle ou son métier ("Marchand", "Garde") même si c'est ainsi qu'il est le plus souvent désigné dans l'extrait — un rôle générique comme titre ferait ensuite confondre ce PNJ précis avec n'importe quelle autre mention du même mot. N'utilise un rôle en titre que si aucun nom propre n'est donné nulle part dans l'extrait.
N'inclus JAMAIS ${personnageNom} — c'est le personnage du joueur, pas un PNJ, quelle que soit la fréquence à laquelle il est mentionné.
Ignore les figurants sans nom, les objets ou lieux anecdotiques sans suite probable. Ne réinvente rien : décris uniquement ce que le texte établit. Ce qui est déjà répertorié (ne le reprends que si une information nouvelle importante s'y ajoute) :
${existantsTexte}`,
        },
        { role: 'user', content: transcript },
      ],
    });

    const match = sortie.match(/\{[\s\S]*\}/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed.candidats)) return [];
    // Filet de sécurité déterministe : même si le modèle l'inclut malgré la
    // consigne, le personnage joueur ne devient jamais une fiche PNJ (son
    // propre avatar généré et affiché comme s'il s'agissait d'un PNJ,
    // constaté en usage réel).
    const nomJoueurNormalise = personnageNom.trim().toLowerCase();
    return parsed.candidats
      .filter((c: any) => c && typeof c.titre === 'string' && c.titre.trim())
      .filter((c: any) => String(c.titre).trim().toLowerCase() !== nomJoueurNormalise)
      .map((c: any): CandidatLoreEmergent => ({
        categorie: CATEGORIES.includes(c.categorie) ? c.categorie : 'pnj',
        titre: String(c.titre).trim(),
        contenu: String(c.contenu ?? '').trim(),
      }));
  } catch {
    return [];
  }
}

export interface MiseAJourLoreEmergentOptions {
  appSettings: AppSettings;
  existants: EntreeLoreEmergent[];
  messages: Message[];
  // Index (dans `messages`) à partir duquel scanner.
  depuisIndex: number;
  // Nom du personnage joueur — jamais extrait comme PNJ (voir extraireCandidats).
  personnageNom: string;
}

/**
 * Pipeline de lore émergent (brief Phase 2) : extrait les candidats de la
 * période récente, puis valide chaque candidat avant tout ajout permanent
 * — une première mention reste "provisoire" (pas injectée dans le
 * contexte) ; ce n'est qu'une fois reconfirmé lors d'une mise à jour
 * ultérieure (rapproché par similarité d'embeddings, comme la
 * consolidation de la mémoire) qu'une entrée devient "permanent" et
 * rejoint le pool de lore sélectionnable.
 */
export async function mettreAJourLoreEmergent({
  appSettings,
  existants,
  messages,
  depuisIndex,
  personnageNom,
}: MiseAJourLoreEmergentOptions): Promise<EntreeLoreEmergent[]> {
  const nouveauxMessages = messages.slice(depuisIndex);
  if (nouveauxMessages.length === 0) return existants;

  const transcript = nouveauxMessages
    .map((m) => `${m.role === 'user' ? 'Joueur' : 'Narrateur'} : ${m.content}`)
    .join('\n');

  const candidats = await extraireCandidats(appSettings, transcript, existants, personnageNom);
  if (candidats.length === 0) return existants;

  try {
    const entrees = [...existants];
    const textesExistants = entrees.map((e) => `${e.titre} — ${e.contenu}`);
    const textesCandidats = candidats.map((c) => `${c.titre} — ${c.contenu}`);
    const { vecteurs } = await obtenirEmbeddings([...textesExistants, ...textesCandidats], appSettings);
    const vecteursExistants = vecteurs.slice(0, entrees.length);
    const vecteursCandidats = vecteurs.slice(entrees.length);

    candidats.forEach((candidat, i) => {
      let meilleurIndex = -1;
      let meilleurScore = SEUIL_RECONNAISSANCE;
      vecteursExistants.forEach((v, j) => {
        const score = similariteCosinus(vecteursCandidats[i], v);
        if (score > meilleurScore) {
          meilleurScore = score;
          meilleurIndex = j;
        }
      });

      if (meilleurIndex >= 0) {
        // Reconfirmé : validé, devient (ou reste) permanent.
        const existant = entrees[meilleurIndex];
        entrees[meilleurIndex] = {
          ...existant,
          contenu: candidat.contenu.length > existant.contenu.length ? candidat.contenu : existant.contenu,
          statut: 'permanent',
          dernierAcces: messages.length,
        };
      } else {
        // Première mention : provisoire, pas encore injectée dans le
        // contexte tant qu'elle n'est pas reconfirmée.
        entrees.push({
          id: idEntree(),
          categorie: candidat.categorie,
          titre: candidat.titre,
          contenu: candidat.contenu,
          statut: 'provisoire',
          premiereMention: messages.length,
          dernierAcces: messages.length,
        });
      }
    });

    return entrees;
  } catch {
    // Échec de l'appel d'embeddings servant à la déduplication (réseau,
    // quota dépassé — plusieurs appels partent souvent en même temps à
    // l'ouverture d'une histoire : sélection de lore, génération des
    // avatars... — d'où un risque de collision plus élevé à ce moment-là).
    // On NE crée PAS les candidats à l'aveugle : sans embeddings pour les
    // comparer aux fiches existantes, impossible de savoir si un candidat
    // est un PNJ déjà connu ou réellement nouveau. Les ajouter quand même
    // créerait une fiche en double (un nouvel id) pour un PNJ déjà établi
    // à chaque fois que cet appel échoue — constaté en usage réel : PNJ
    // dupliqués avec un nouvel avatar généré à chaque réouverture, l'ancien
    // jamais nettoyé. Mieux vaut perdre cette observation (retentée
    // naturellement au prochain tour, depuisIndex n'avance pas) que de
    // corrompre le lore avec des doublons.
    return existants;
  }
}

/**
 * Convertit les entrées de lore émergent "permanent" au format attendu par
 * le sélecteur sémantique du lore Elyndor, pour qu'elles rejoignent le même
 * pool de sélection que le lorebook statique.
 */
export function convertirLoreEmergentPourSelection(entrees: EntreeLoreEmergent[]): ElyndorEntryChargee[] {
  return entrees
    .filter((e) => e.statut === 'permanent')
    .map((e) => ({
      id: e.id,
      titre: `[${e.categorie.toUpperCase()} — établi en jeu] ${e.titre}`,
      contenu: e.contenu,
      motsClesNegatifs: [],
      priority: 100,
      constant: false,
    }));
}
