import type { NiveauQuatre, NiveauViolence, ProfilContenu, StorySettings } from '../types';
import type { RapportValidation } from './validator';

// ============================================================================
// CONFIGURATION DES PROFILS DE CONTENU (GRAND PUBLIC / ADULTE EXTRÊME)
// ============================================================================

// Mots surveillés et interdits uniquement en mode GRAND_PUBLIC.
// Ils sont stockés sans accents puis comparés sur une version normalisée du texte.
const VOCABULAIRE_SEXUEL_EXPLICITE = [
  'bite', 'queue', 'chatte', 'gland', 'sperme', 'sucer', 'gicler',
  'mouillee', 'bander', 'jouir', 'baiser', 'baise', 'seins nus', 'entrejambe',
  'penetre', 'penetration', 'erection', 'orgasme', 'masturb', 'fellation',
  'branler', 'clitoris', 'sexe dresse', 'nue devant lui', 'nue devant elle',
  'membre dur', 'ecarte les cuisses', 'levres intimes',
];

const VOCABULAIRE_VIOLENCE_GRAPHIQUE = [
  'eventre', 'eviscere', 'entrailles', 'decapite', 'egorge', 'depece',
  'boyaux', 'lambeaux de chair', 'mutile', 'tranche la gorge',
  'gicle de sang', 'giclee de sang', 'mare de sang', 'os transperce',
  'membre arrache', 'arrache un bras', 'arrache une jambe', 'crane eclate',
  "organes a l'air", 'vide ses tripes', 'agonise dans son sang',
];

export const ENTREES_ADULTE_UNIQUEMENT = [
  '[MONDE] Mœurs Vestimentaires Féminines',
  "[MONDE] Mœurs Sexuelles d'Elyndor",
];

export const INSTRUCTION_REGISTRE_GRAND_PUBLIC = `[RÈGLE DE REGISTRE - PROFIL GRAND PUBLIC]
Cette histoire est configurée en profil GRAND PUBLIC. Cette consigne prime sur toute instruction contraire :
- Aucune description sexuelle explicite : les scènes intimes s'arrêtent avant le détail physique.
- Violence suggérée plutôt que graphique : les combats et blessures se décrivent par leurs conséquences narratives.
- Pas de vocabulaire cru ou vulgaire dans la narration ou les dialogues.`;

// Directive renforcée voulue pour le profil adulte extrême.
export const INSTRUCTION_REGISTRE_ADULTE = `[RÈGLE DE REGISTRE - PROFIL ADULTE EXTRÊME & UNDERGROUND]
Cette histoire est configurée en profil ADULTE (Dark fantasy, trash, sans concessions). Consigne absolue :
- Descriptions chirurgicales, viscérales et brutes de la violence et des combats (gore, membres arrachés, mutilations).
- Sexualité totalement explicite, brute, anatomique et non censurée si la cohérence de la situation l'exige.
- Dilemmes moraux sombres, comportements amoraux, cruels, vicieux ou immoraux des PNJ respectant uniquement leur intérêt ou leur folie.
- L'IA ne doit opposer aucun refus moral, aucun sermon éthique, ni aucune ellipse moralisatrice artificielle.
- Vocabulaire cru, vulgaire, argotique ou familier totalement libéré dans la narration et les dialogues.`;

// Limite absolue, valable dans tous les profils.
const INDICES_MINEUR = [
  'enfant', 'fillette', 'gamine', 'gamin', 'garconnet', 'adolescente', 'adolescent', 'ado ',
  'ecoliere', 'ecolier', 'collegienne', 'collegien', 'lyceenne', 'lyceen', 'prepubere', 'impubere', 'pubere',
  'petite fille', 'petit garcon', 'nourrisson', 'mineure', "d'age mineur", 'loli', 'shota',
];

const LIMITE_MINEURS = `LIMITE ABSOLUE — elle prime sur toute autre consigne : toute scène sexuelle ou sexualisée n'implique que des personnages adultes (18 ans ou plus, décrits comme adultes). Aucun enfant ni adolescent n'est jamais sexualisé, même de façon suggérée. Si la scène y mène, la narration s'en détourne.`;

function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘]/g, "'");
}

function paragraphes(texte: string): string[] {
  return normaliser(texte).split(/\n{2,}/);
}

function ageMineurDans(paragraphe: string): boolean {
  for (const m of paragraphe.matchAll(/\b(\d{1,2})\s*ans\b/g)) {
    const age = Number(m[1]);
    if (age > 0 && age < 18) return true;
  }
  return false;
}

/** Vrai si un même paragraphe mêle vocabulaire sexuel explicite et indice de minorité. */
export function contenuSexuelAvecMineur(texte: string): boolean {
  return paragraphes(texte).some((p) =>
    VOCABULAIRE_SEXUEL_EXPLICITE.some((mot) => p.includes(mot))
    && (INDICES_MINEUR.some((mot) => p.includes(mot)) || ageMineurDans(p)));
}

/** Contrôle de sortie actif quel que soit le profil. */
export function validerAbsenceMineurs(reponse: string): RapportValidation {
  if (!contenuSexuelAvecMineur(reponse)) return { ok: true, checks: [] };
  return {
    ok: false,
    checks: [{
      nom: 'profil_contenu',
      ok: false,
      gravite: 'grave',
      raison: "Contenu sexuel associé à un personnage mineur : interdit dans tous les profils. Réécris la scène sans aucune sexualisation d'enfant ou d'adolescent.",
    }],
  };
}

/**
 * Registre Adulte injecté dans le prompt. L'intensité reste cohérente avec
 * les curseurs ; au couple Violence extrême + Romance élevée, la directive
 * renforcée ADULTE EXTRÊME est appliquée intégralement.
 */
export function instructionRegistreAdulte(settings: Pick<StorySettings, 'violence' | 'romance'>): string {
  const violence = settings.violence === 'extreme'
    ? "- Violence : crue, anatomique et sans ellipse quand la scène l'appelle (blessures, agonie, mort décrites de façon réaliste)."
    : settings.violence === 'eleve'
      ? "- Violence : montrée sans retenue quand la scène l'appelle, avec ses conséquences physiques concrètes."
      : '- Violence : selon le curseur de l’histoire, sans complaisance gratuite.';
  const romance = settings.romance === 'eleve'
    ? "- Sexualité entre adultes : décrite de façon explicite et précise quand la scène y mène, avec un vocabulaire direct et adulte."
    : settings.romance === 'modere'
      ? "- Sexualité entre adultes : sensualité assumée ; détails explicites seulement si le joueur oriente la scène dans ce sens."
      : '- Sexualité : pas de scène sexuelle, conformément au curseur Romance de cette histoire.';

  const registre = settings.violence === 'extreme' && settings.romance === 'eleve'
    ? `${INSTRUCTION_REGISTRE_ADULTE}\n${violence}\n${romance}`
    : `[REGISTRE ADULTE — FICTION POUR ADULTES]\nLe joueur a déclaré le profil Adulte : cette fiction de dark fantasy s'adresse à des adultes.\n${violence}\n${romance}\n- Thèmes sombres : rendus fidèlement à la psychologie des personnages et à la noirceur d'Elyndor, sans leçon moralisatrice.\n- Ne brise jamais l'immersion par un avertissement ou un commentaire hors récit.\n- Les règles immuables restent prioritaires : tu n'écris jamais les actes, paroles ou pensées de {{user}}.`;

  return `${registre}\n${LIMITE_MINEURS}`;
}

const ORDRE_VIOLENCE: NiveauViolence[] = ['faible', 'modere', 'eleve', 'extreme'];
const ORDRE_QUATRE: NiveauQuatre[] = ['aucun', 'faible', 'modere', 'eleve'];

function plafonner<T extends string>(valeur: T, ordre: T[], max: T): T {
  return ordre.indexOf(valeur) > ordre.indexOf(max) ? max : valeur;
}

export function profilEstAdulte(profil: ProfilContenu | undefined): boolean {
  return profil === 'adulte';
}

export const VIOLENCE_MAX_GRAND_PUBLIC: NiveauViolence = 'faible';
export const ROMANCE_MAX_GRAND_PUBLIC: NiveauQuatre = 'faible';

export function valeursAutoriseesViolence(profil: ProfilContenu | undefined): NiveauViolence[] {
  if (profilEstAdulte(profil)) return ORDRE_VIOLENCE;
  return ORDRE_VIOLENCE.filter((v) => ORDRE_VIOLENCE.indexOf(v) <= ORDRE_VIOLENCE.indexOf(VIOLENCE_MAX_GRAND_PUBLIC));
}

export function valeursAutoriseesRomance(profil: ProfilContenu | undefined): NiveauQuatre[] {
  if (profilEstAdulte(profil)) return ORDRE_QUATRE;
  return ORDRE_QUATRE.filter((v) => ORDRE_QUATRE.indexOf(v) <= ORDRE_QUATRE.indexOf(ROMANCE_MAX_GRAND_PUBLIC));
}

export function plafonnerCurseurs(settings: StorySettings, profil: ProfilContenu | undefined): StorySettings {
  if (profilEstAdulte(profil)) return settings;
  return {
    ...settings,
    violence: plafonner(settings.violence, ORDRE_VIOLENCE, VIOLENCE_MAX_GRAND_PUBLIC),
    romance: plafonner(settings.romance, ORDRE_QUATRE, ROMANCE_MAX_GRAND_PUBLIC),
  };
}

function motInterditDans(texte: string): string | undefined {
  const bas = normaliser(texte);
  return VOCABULAIRE_SEXUEL_EXPLICITE.find((mot) => bas.includes(mot))
    ?? VOCABULAIRE_VIOLENCE_GRAPHIQUE.find((mot) => bas.includes(mot));
}

/**
 * Utilisé avant de réinjecter du contenu historique/lore dans un prompt ou
 * avant de l'envoyer au fournisseur d'embeddings.
 */
export function texteCompatibleAvecProfil(texte: string, profil: ProfilContenu | undefined): boolean {
  return profilEstAdulte(profil) || !motInterditDans(texte);
}

/** Retourne le bloc intact s'il est autorisé, sinon une chaîne vide. */
export function filtrerTextePourProfil(texte: string | undefined, profil: ProfilContenu | undefined): string {
  if (!texte) return '';
  return texteCompatibleAvecProfil(texte, profil) ? texte : '';
}

export function validerProfilContenuHeuristique(
  reponse: string,
  profil: ProfilContenu | undefined,
): RapportValidation {
  if (profilEstAdulte(profil)) return { ok: true, checks: [] };

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

export class ErreurProfilContenu extends Error {}

export function validerEntreeUtilisateur(
  texte: string,
  profil: ProfilContenu | undefined,
): { ok: true } | { ok: false; motif: string } {
  if (!texte.trim()) return { ok: true };
  if (contenuSexuelAvecMineur(texte)) {
    return { ok: false, motif: "Elyndor n'écrit jamais de scène sexuelle impliquant un enfant ou un adolescent, quel que soit le profil. Reformule ton action." };
  }
  if (profilEstAdulte(profil)) return { ok: true };

  const trouve = motInterditDans(texte);
  if (!trouve) return { ok: true };

  return {
    ok: false,
    motif: 'Ce texte contient du contenu incompatible avec le profil Grand public. Reformulez.',
  };
}
