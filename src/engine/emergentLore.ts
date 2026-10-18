import type { AppSettings, CategorieLoreEmergent, EntreeLoreEmergent, Message, ProfilMonde } from '../types';
import type { ElyndorEntryChargee } from './loreLoader';
import { configurationLLM, appellerModele } from './openrouter';
import { filtrerTextePourProfil, texteCompatibleAvecProfil } from './contenuAdulte';
import { cleNomLore, fusionnerDoublonsLore, memeEntiteLore } from './loreEmergentDoublons';

const CATEGORIES: CategorieLoreEmergent[] = ['objet', 'lieu', 'faction', 'evenement', 'creature', 'ressource', 'coutume'];

function idEntree(): string {
  return `emergent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface CandidatLoreEmergent {
  categorie: CategorieLoreEmergent;
  titre: string;
  contenu: string;
  profilMonde?: ProfilMonde;
  /** Seul un identifiant confirmé autorise une fusion de PNJ homonymes. */
  entreeExistanteId?: string;
}

const CHAMPS_MONDE: Array<keyof ProfilMonde> = ['localisation','origine','apparence','architecture','dimensions','acces','activites','occupants','materiaux','proprietes','fabrication','rarete','organisation','hierarchie','objectifs','territoire','ressources','alliances','habitat','comportement','capacites','faiblesses','traditions','croyances','histoire','referencesPnj'];
function nettoyerProfilMonde(brut: unknown): ProfilMonde | undefined {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return undefined;
  const profil: ProfilMonde = {};
  for (const champ of CHAMPS_MONDE) {
    const valeur = (brut as Record<string, unknown>)[champ];
    if (typeof valeur === 'string' && valeur.trim()) profil[champ] = valeur.trim().slice(0, 500);
  }
  return Object.keys(profil).length ? profil : undefined;
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
  const existantsTexte = existantsVisibles.filter(e => e.categorie !== 'pnj').length
    ? existantsVisibles.filter(e => e.categorie !== 'pnj').map((e) => `- [${e.categorie}] ID=${e.id} ${e.titre}${e.categorie === 'pnj' ? ` (${e.profilPnj?.profession ?? 'rôle inconnu'})` : ''}`).join('\n')
    : 'Aucun.';

  try {
    const sortie = await appellerModele({
      ...configurationLLM(appSettings),
      storyId,
      temperature: 0.2,
      maxTokens: 2600,
      diagnosticLabel: 'Lore émergent',
      messages: [
        {
          role: 'system',
          content: `Tu es le job du LORE ÉMERGENT DU MONDE d'Elyndor. Les PNJ et leurs fiches sont gérés par un registre distinct : ne crée JAMAIS de candidat de catégorie pnj. Identifie uniquement les éléments de monde pertinents, durables et nommés introduits dans l'extrait : lieux, objets, factions, événements importants, créatures, ressources et coutumes. Ignore les détails anecdotiques et les figurants.
Réponds UNIQUEMENT avec un JSON strict : {"candidats":[{"categorie":"lieu|objet|faction|evenement|creature|ressource|coutume","entreeExistanteId":null,"titre":"Nom précis","contenu":"Faits établis dans le récit","profilMonde":{"localisation":"","origine":"","apparence":"","architecture":"","dimensions":"","acces":"","activites":"","occupants":"","materiaux":"","proprietes":"","fabrication":"","rarete":"","organisation":"","hierarchie":"","objectifs":"","territoire":"","ressources":"","alliances":"","habitat":"","comportement":"","capacites":"","faiblesses":"","traditions":"","croyances":"","histoire":"","referencesPnj":""}}]}.
Complète les champs spécialisés pertinents dès la première apparition avec des caractéristiques plausibles et cohérentes, sans contredire les faits déjà établis. Laisse vides les champs non pertinents ou réellement inconnus. Le champ contenu ne rapporte QUE les faits narrés, jamais les inventions de complétion. N'invente jamais un événement vécu, une découverte du joueur ou une conséquence d'action. Les changements provoqués par le joueur restent propres à cette histoire. Les PNJ liés sont référencés par identifiant confirmé dans referencesPnj ; n'invente pas d'identifiant.
Pour enrichir un élément existant, indique son entreeExistanteId exact et conserve son titre et ses caractéristiques. Ne fusionne pas des homonymes sans identité confirmée. Éléments existants :
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
      .filter((c: any) => c && CATEGORIES.includes(c.categorie) && typeof c.titre === 'string' && c.titre.trim())
      .filter((c: any) => String(c.titre).trim().toLowerCase() !== nomJoueurNormalise)
      .map((c: any): CandidatLoreEmergent => ({
        categorie: CATEGORIES.includes(c.categorie) ? c.categorie : 'objet',
        titre: String(c.titre).trim(),
        contenu: String(c.contenu ?? '').trim(),
        profilMonde: c.categorie !== 'pnj' ? nettoyerProfilMonde(c.profilMonde) : undefined,
        entreeExistanteId: typeof c.entreeExistanteId === 'string' ? c.entreeExistanteId.trim() || undefined : undefined,
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
      // Les traits initiaux font autorité : on complète les lacunes sans écraser l'identité.
      profilPnj: existant.profilPnj,
      profilMonde: { ...(candidat.profilMonde ?? {}), ...(existant.profilMonde ?? {}) },
      statut: 'permanent',
      dernierAcces: messages.length,
    };
  };
  // Les PNJ sont rattachés par ID validé ; un nom complet unique sert de
  // repli. Un prénom seul ou une homonymie ne permet jamais de décider.
  const idsAvant = new Set(entrees.map(e => e.id));
  const trouver = (candidat: CandidatLoreEmergent): number => {
    if (candidat.categorie !== 'pnj') {
      if (candidat.entreeExistanteId) {
        const index = entrees.findIndex(e => e.id === candidat.entreeExistanteId && e.categorie === candidat.categorie);
        if (index >= 0) return index;
      }
      return entrees.findIndex(e => memeEntiteLore(e, candidat));
    }
    if (candidat.entreeExistanteId) {
      return entrees.findIndex(e => e.categorie === 'pnj' && e.id === candidat.entreeExistanteId);
    }
    const cle = cleNomLore(candidat.titre);
    if (!cle.includes(' ')) return -1;
    const indices = entrees.flatMap((e, i) =>
      e.categorie === 'pnj' && idsAvant.has(e.id) && cleNomLore(e.titre) === cle ? [i] : []);
    return indices.length === 1 ? indices[0] : -1;
  };
  const sansNomConnu = candidats.filter(candidat => {
    const index = trouver(candidat);
    if (index >= 0) confirmer(index, candidat);
    return index < 0;
  });
  if (sansNomConnu.length === 0) return entrees;

  // Création déterministe et locale : aucun embedding ne peut bloquer l'entrée.
  // Les noms déjà connus ont été rapprochés plus haut ; un nouveau nom crée une fiche.
  for (const candidat of sansNomConnu) {
    const deja = trouver(candidat);
    if (deja >= 0) { confirmer(deja, candidat); continue; }
    entrees.push({
      id: idEntree(), categorie: candidat.categorie, titre: candidat.titre,
      contenu: candidat.contenu, profilMonde: candidat.profilMonde,
      statut: 'provisoire', premiereMention: messages.length, dernierAcces: messages.length,
    });
  }
  return fusionnerDoublonsLore(entrees);
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
