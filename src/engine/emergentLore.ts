import type { AppSettings, CategorieLoreEmergent, EntreeLoreEmergent, Message } from '../types';
import type { ElyndorEntryChargee } from './loreLoader';
import { configurationLLM, appellerModele } from './openrouter';
import { obtenirEmbeddings, similariteCosinus } from './embeddings';
import { filtrerTextePourProfil, texteCompatibleAvecProfil } from './contenuAdulte';
import { fusionnerDoublonsLore, memeEntiteLore } from './loreEmergentDoublons';

const CATEGORIES: CategorieLoreEmergent[] = ['pnj', 'objet', 'lieu', 'faction', 'evenement'];
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
  storyId?: string,
): Promise<CandidatLoreEmergent[]> {
  const existantsVisibles = appSettings.profilContenu === 'adulte'
    ? existants
    : existants.filter((e) => texteCompatibleAvecProfil(`${e.titre}\n${e.contenu}`, appSettings.profilContenu));
  const existantsTexte = existantsVisibles.length
    ? existantsVisibles.map((e) => `- [${e.categorie}] ${e.titre}`).join('\n')
    : 'Aucun.';

  try {
    const sortie = await appellerModele({
      ...configurationLLM(appSettings),
      storyId,
      temperature: 0.2,
      maxTokens: 500,
      diagnosticLabel: 'Lore émergent',
      messages: [
        {
          role: 'system',
          content: `Tu identifies les éléments de MONDE nouveaux et durables introduits dans un extrait de jeu de rôle : PNJ nommés destinés à revenir, lieux nommés, factions, objets marquants, événements qui feront date. Réponds UNIQUEMENT avec un JSON strict :
{"candidats": [{"categorie": "pnj|objet|lieu|faction|evenement", "titre": "...", "contenu": "description factuelle en une ou deux phrases"}]}

Pour un élément déjà répertorié, reprends EXACTEMENT le titre de la liste ci-dessous, sans le compléter ni le reformuler.
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
    const nomJoueurNormalise = personnageNom.trim().toLowerCase();
    return parsed.candidats
      .filter((c: any) => c && typeof c.titre === 'string' && c.titre.trim())
      .filter((c: any) => String(c.titre).trim().toLowerCase() !== nomJoueurNormalise)
      .map((c: any): CandidatLoreEmergent => ({
        categorie: CATEGORIES.includes(c.categorie) ? c.categorie : 'pnj',
        titre: String(c.titre).trim(),
        contenu: String(c.contenu ?? '').trim(),
      }))
      .filter((c: CandidatLoreEmergent) => texteCompatibleAvecProfil(`${c.titre}\n${c.contenu}`, appSettings.profilContenu));
  } catch {
    return [];
  }
}

export interface MiseAJourLoreEmergentOptions {
  appSettings: AppSettings;
  existants: EntreeLoreEmergent[];
  messages: Message[];
  depuisIndex: number;
  personnageNom: string;
  /** Histoire concernée (journal de diagnostic). */
  storyId?: string;
}

export async function mettreAJourLoreEmergent({
  appSettings,
  existants,
  messages,
  depuisIndex,
  personnageNom,
  storyId,
}: MiseAJourLoreEmergentOptions): Promise<EntreeLoreEmergent[]> {
  const nouveauxMessages = messages.slice(depuisIndex);
  if (nouveauxMessages.length === 0) return existants;

  const transcript = nouveauxMessages
    .map((m) => `${m.role === 'user' ? 'Joueur' : 'Narrateur'} : ${m.content}`)
    .join('\n');

  const candidats = await extraireCandidats(appSettings, transcript, existants, personnageNom, storyId);
  if (candidats.length === 0) return fusionnerDoublonsLore(existants);

  const entrees = fusionnerDoublonsLore(existants);
  const confirmer = (index: number, candidat: CandidatLoreEmergent) => {
    const existant = entrees[index];
    entrees[index] = {
      ...existant,
      contenu: candidat.contenu.length > existant.contenu.length ? candidat.contenu : existant.contenu,
      statut: 'permanent',
      dernierAcces: messages.length,
    };
  };
  // Le nom fait foi : un PNJ déjà connu est reconnu même si sa description a changé.
  const sansNomConnu = candidats.filter((candidat) => {
    const index = entrees.findIndex((e) => memeEntiteLore(e, candidat));
    if (index >= 0) confirmer(index, candidat);
    return index < 0;
  });
  if (sansNomConnu.length === 0) return entrees;

  try {
    const textesExistants = entrees.map((e) =>
      filtrerTextePourProfil(`${e.titre} — ${e.contenu}`, appSettings.profilContenu)
      || `[${e.categorie}] entrée antérieure masquée par le profil Grand public`,
    );
    const textesCandidats = sansNomConnu.map((c) => `${c.titre} — ${c.contenu}`);
    const { vecteurs } = await obtenirEmbeddings([...textesExistants, ...textesCandidats], appSettings, 'Lore émergent — rapprochement');
    const vecteursExistants = vecteurs.slice(0, entrees.length);
    const vecteursCandidats = vecteurs.slice(entrees.length);

    sansNomConnu.forEach((candidat, i) => {
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
        confirmer(meilleurIndex, candidat);
      } else {
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

    return fusionnerDoublonsLore(entrees);
  } catch {
    return entrees;
  }
}

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
