import type { NiveauQuatre, NiveauViolence, ProfilContenu, StorySettings } from '../types';
import type { RapportValidation } from './validator';

// Contrôle d'âge (brief Phase 2). Le monde d'Elyndor est explicite par
// défaut ([MÉTA] Registre et Style Narratif, entrées Elyndor Mœurs
// Vestimentaires/Sexuelles) : en profil GRAND_PUBLIC, ce vocabulaire est
// retiré du prompt ET détecté en sortie par le validateur — le
// plafonnement est imposé par le logiciel, pas laissé à la discrétion du
// modèle.
//
// Deux listes distinctes (sexuel / violence graphique) — un audit externe
// a signalé que la première était trop courte pour être un filet fiable ;
// élargie ici sans prétendre à l'exhaustivité (un simple mot-à-mot ne
// remplacera jamais un vrai classifieur, voir la note plus bas sur les
// limites de cette approche).
const VOCABULAIRE_SEXUEL_EXPLICITE = [
  'bite', 'queue', 'chatte', 'gland', 'sperme', 'sucer', 'gicler',
  'mouillée', 'bander', 'jouir', 'baiser', 'baise', 'seins nus', 'entrejambe',
  'pénètre', 'pénétration', 'érection', 'orgasme', 'masturb', 'fellation',
  'branler', 'clitoris', 'sexe dressé', 'nue devant lui', 'nue devant elle',
  'membre dur', 'écarte les cuisses', 'lèvres intimes',
];

const VOCABULAIRE_VIOLENCE_GRAPHIQUE = [
  'éventre', 'éviscère', 'entrailles', 'décapite', 'égorge', 'dépèce',
  'boyaux', 'lambeaux de chair', 'mutile', 'tranche la gorge',
  'gicle de sang', 'giclée de sang', 'mare de sang', 'os transperce',
  'membre arraché', 'arrache un bras', 'arrache une jambe', 'crâne éclate',
  'organes à l’air', 'vide ses tripes', 'agonise dans son sang',
];

// Titres des entrées Elyndor à ne jamais injecter en profil GRAND_PUBLIC,
// quel que soit leur score de pertinence sémantique.
export const ENTREES_ADULTE_UNIQUEMENT = [
  '[MONDE] Mœurs Vestimentaires Féminines',
  "[MONDE] Mœurs Sexuelles d'Elyndor",
];

// Remplace [MÉTA] Registre et Style Narratif (qui impose un registre cru en
// permanence) quand le profil est GRAND_PUBLIC.
export const INSTRUCTION_REGISTRE_GRAND_PUBLIC = `[RÈGLE DE REGISTRE — PROFIL GRAND PUBLIC]
Cette histoire est configurée en profil GRAND PUBLIC. Cette consigne prime sur toute instruction de registre plus explicite ci-dessus.
- Aucune description sexuelle explicite : les scènes intimes s'arrêtent avant le détail physique (ellipse ou fondu au noir).
- Violence suggérée plutôt que graphique : les combats et blessures se décrivent par leurs conséquences narratives, pas par le détail anatomique du traumatisme.
- Pas de vocabulaire cru ou vulgaire dans la narration ou les dialogues.`;

const ORDRE_VIOLENCE: NiveauViolence[] = ['faible', 'modere', 'eleve', 'extreme'];
const ORDRE_QUATRE: NiveauQuatre[] = ['aucun', 'faible', 'modere', 'eleve'];

// Plafonne réellement (ne relève jamais un choix déjà plus bas que le
// maximum autorisé — un joueur qui a choisi "Aucun" pour la romance reste à
// "Aucun" en GRAND_PUBLIC, on ne le remonte pas artificiellement à "Faible").
function plafonner<T extends string>(valeur: T, ordre: T[], max: T): T {
  return ordre.indexOf(valeur) > ordre.indexOf(max) ? max : valeur;
}

export const VIOLENCE_MAX_GRAND_PUBLIC: NiveauViolence = 'faible';
export const ROMANCE_MAX_GRAND_PUBLIC: NiveauQuatre = 'faible';

// Valeurs de curseur réellement sélectionnables à l'écran de création en
// profil GRAND_PUBLIC — l'interface ne doit jamais afficher un choix que le
// moteur plafonnerait silencieusement ensuite (voir CreateScreen.tsx).
export function valeursAutoriseesViolence(profil: ProfilContenu | undefined): NiveauViolence[] {
  if (profil !== 'grand_public') return ORDRE_VIOLENCE;
  return ORDRE_VIOLENCE.filter((v) => ORDRE_VIOLENCE.indexOf(v) <= ORDRE_VIOLENCE.indexOf(VIOLENCE_MAX_GRAND_PUBLIC));
}

export function valeursAutoriseesRomance(profil: ProfilContenu | undefined): NiveauQuatre[] {
  if (profil !== 'grand_public') return ORDRE_QUATRE;
  return ORDRE_QUATRE.filter((v) => ORDRE_QUATRE.indexOf(v) <= ORDRE_QUATRE.indexOf(ROMANCE_MAX_GRAND_PUBLIC));
}

export function plafonnerCurseurs(settings: StorySettings, profil: ProfilContenu | undefined): StorySettings {
  if (profil !== 'grand_public') return settings;
  return {
    ...settings,
    violence: plafonner(settings.violence, ORDRE_VIOLENCE, VIOLENCE_MAX_GRAND_PUBLIC),
    romance: plafonner(settings.romance, ORDRE_QUATRE, ROMANCE_MAX_GRAND_PUBLIC),
  };
}

function motInterditDans(texte: string): string | undefined {
  const bas = texte.toLowerCase();
  return VOCABULAIRE_SEXUEL_EXPLICITE.find((mot) => bas.includes(mot)) ?? VOCABULAIRE_VIOLENCE_GRAPHIQUE.find((mot) => bas.includes(mot));
}

/**
 * Contrôle heuristique local (gratuit, avant tout appel réseau) : détecte
 * un dépassement du plafond de contenu en profil GRAND_PUBLIC. Complète la
 * suite de validation Phase 2 comme un check supplémentaire.
 *
 * Limite assumée : une correspondance de mots-clés ne détecte pas tout
 * contenu explicite (paraphrase, euphémisme…) — c'est un filet
 * supplémentaire au-dessus du filtrage de lore et de la consigne de
 * registre imposée au modèle, pas une garantie absolue à elle seule. Voir
 * generateTurn.ts : en cas de détection persistante après tentative de
 * correction, la réponse n'est jamais affichée (fail-closed).
 */
export function validerProfilContenuHeuristique(
  reponse: string,
  profil: ProfilContenu | undefined,
): RapportValidation {
  if (profil !== 'grand_public') return { ok: true, checks: [] };

  const trouve = motInterditDans(reponse);
  if (!trouve) return { ok: true, checks: [] };

  return {
    ok: false,
    checks: [
      {
        nom: 'profil_contenu',
        ok: false,
        gravite: 'grave',
        raison: `Contenu explicite détecté ("${trouve}") alors que le profil est GRAND_PUBLIC.`,
      },
    ],
  };
}

// Levée quand une réponse générée reste hors-limites GRAND_PUBLIC après
// tentative de correction — voir genererTour, genererMessageOuverture,
// genererScenarioDepart. Volontairement fail-closed : mieux vaut un tour
// raté (le joueur réessaie) qu'une réponse interdite affichée quand même.
export class ErreurProfilContenu extends Error {}

/**
 * Filtre centralisé pour tout texte tapé par le joueur (message, champs de
 * création de personnage, scénario, contexte de l'histoire...) — un seul
 * point de contrôle plutôt qu'un filtre différent par écran, pour ne pas
 * laisser de trou entre deux formulaires qui divergeraient avec le temps.
 * Contrairement à validerProfilContenuHeuristique (sortie du modèle,
 * réparable), un texte du joueur qui déclenche ce filtre est simplement
 * refusé à l'envoi : rien à réparer, c'est à lui de reformuler.
 */
export function validerEntreeUtilisateur(
  texte: string,
  profil: ProfilContenu | undefined,
): { ok: true } | { ok: false; motif: string } {
  if (profil !== 'grand_public' || !texte.trim()) return { ok: true };

  const trouve = motInterditDans(texte);
  if (!trouve) return { ok: true };

  return {
    ok: false,
    motif: 'Ce texte contient du contenu incompatible avec le profil Grand public. Reformule, ou passe en profil Adulte dans Réglages.',
  };
}
