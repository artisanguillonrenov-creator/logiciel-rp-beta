import type { NiveauQuatre, NiveauViolence, ProfilContenu, StorySettings } from '../types';
import type { RapportValidation } from './validator';

// Contrôle d'âge (brief Phase 2). Le monde d'Elyndor est explicite par
// défaut ([MÉTA] Registre et Style Narratif, entrées Elyndor Mœurs
// Vestimentaires/Sexuelles) : en profil GRAND_PUBLIC, ce vocabulaire est
// retiré du prompt ET détecté en sortie par le validateur — le
// plafonnement est imposé par le logiciel, pas laissé à la discrétion du
// modèle.
//
// IMPORTANT : un profil absent/indéterminé est traité comme GRAND_PUBLIC.
// Seul `adulte` ouvre explicitement les niveaux et contenus supplémentaires.
// Cela évite une fenêtre fail-open pendant l'hydratation des réglages ou sur
// une ancienne installation dont le champ profilContenu n'existait pas.
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

export const ENTREES_ADULTE_UNIQUEMENT = [
  '[MONDE] Mœurs Vestimentaires Féminines',
  "[MONDE] Mœurs Sexuelles d'Elyndor",
];

export const INSTRUCTION_REGISTRE_GRAND_PUBLIC = `[RÈGLE DE REGISTRE — PROFIL GRAND PUBLIC]
Cette histoire est configurée en profil GRAND PUBLIC. Cette consigne prime sur toute instruction de registre plus explicite ci-dessus.
- Aucune description sexuelle explicite : les scènes intimes s'arrêtent avant le détail physique (ellipse ou fondu au noir).
- Violence suggérée plutôt que graphique : les combats et blessures se décrivent par leurs conséquences narratives, pas par le détail anatomique du traumatisme.
- Pas de vocabulaire cru ou vulgaire dans la narration ou les dialogues.`;

const ORDRE_VIOLENCE: NiveauViolence[] = ['faible', 'modere', 'eleve', 'extreme'];
const ORDRE_QUATRE: NiveauQuatre[] = ['aucun', 'faible', 'modere', 'eleve'];

function plafonner<T extends string>(valeur: T, ordre: T[], max: T): T {
  return ordre.indexOf(valeur) > ordre.indexOf(max) ? max : valeur;
}

function profilEstAdulte(profil: ProfilContenu | undefined): boolean {
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
  const bas = texte.toLowerCase();
  return VOCABULAIRE_SEXUEL_EXPLICITE.find((mot) => bas.includes(mot)) ?? VOCABULAIRE_VIOLENCE_GRAPHIQUE.find((mot) => bas.includes(mot));
}

/**
 * Utilisé avant de réinjecter du contenu historique/lore dans un prompt ou
 * avant de l'envoyer au fournisseur d'embeddings. Un ancien récit créé en
 * mode Adulte ne doit pas contourner le profil après un passage en Grand
 * public. Le filtrage reste heuristique, comme le validateur de sortie.
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
  if (profilEstAdulte(profil) || !texte.trim()) return { ok: true };

  const trouve = motInterditDans(texte);
  if (!trouve) return { ok: true };

  return {
    ok: false,
    motif: 'Ce texte contient du contenu incompatible avec le profil Grand public. Reformule, ou passe en profil Adulte dans Réglages.',
  };
}
