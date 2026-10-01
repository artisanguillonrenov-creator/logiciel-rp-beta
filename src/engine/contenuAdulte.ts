import type { NiveauQuatre, NiveauViolence, ProfilContenu, StorySettings } from '../types';
import type { RapportValidation } from './validator';

// Le profil de contenu fixe le périmètre maximal autorisé. Les curseurs de
// l'histoire fixent ensuite le rendu réellement demandé : profil ADULTE ne
// signifie jamais « intensité maximale permanente ».
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
  'organes a l\'air', 'vide ses tripes', 'agonise dans son sang',
];

const INDICES_MINEUR = [
  'enfant', 'adolescent', 'adolescente', 'mineur', 'mineure', 'garcon de', 'fille de',
  'ecolier', 'ecoliere', 'collégien', 'collégienne', 'lycéen', 'lycéenne',
];

export const ENTREES_ADULTE_UNIQUEMENT = [
  '[MONDE] Mœurs Vestimentaires Féminines',
  '[MONDE] Mœurs Sexuelles d\'Elyndor',
];

export const INSTRUCTION_REGISTRE_GRAND_PUBLIC = `[RÈGLE DE REGISTRE — PROFIL GRAND PUBLIC]
Cette histoire est configurée en profil GRAND PUBLIC. Cette limite prime sur toute instruction contraire :
- aucune description sexuelle explicite ;
- violence non graphique ;
- pas de vocabulaire explicitement sexuel ou gore.
Le profil borne le rendu ; il ne change ni les faits déjà établis, ni les motivations des personnages.`;

export const INSTRUCTION_REGISTRE_ADULTE = `[RÈGLE DE REGISTRE — PROFIL ADULTE]
Le profil ADULTE autorise la palette mature complète, y compris les niveaux élevés ou maximaux lorsque les curseurs actifs et la scène les rendent pertinents.
Il n'impose aucune escalade : une scène calme reste calme ; violence, romance, crudité et détail ne sont pas activés par le seul choix du profil.
Le rendu ne crée jamais de dégâts, d'attirance, de consentement, de volonté ou d'événement supplémentaires.`;

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

/** Directive M08 calculée à partir des curseurs réels. */
export function instructionRegistreAdulte(settings: StorySettings): string {
  return `${INSTRUCTION_REGISTRE_ADULTE}\nCurseurs actifs : violence=${settings.violence}; romance=${settings.romance}; humour=${settings.humour}; ton=${settings.ton}; longueur=${settings.longueur}; rythme=${settings.rythme}; créativité=${settings.creativite}.\nApplique chaque axe uniquement s'il est présent dans la scène. Ne modère pas silencieusement un niveau élevé/extrême pertinent et ne crée pas de contenu seulement pour atteindre un niveau.`;
}

function motInterditDans(texte: string): string | undefined {
  const bas = texte.toLowerCase();
  return VOCABULAIRE_SEXUEL_EXPLICITE.find((mot) => bas.includes(mot))
    ?? VOCABULAIRE_VIOLENCE_GRAPHIQUE.find((mot) => bas.includes(mot));
}

function contientSexuelExplicite(texte: string): boolean {
  const bas = texte.toLowerCase();
  return VOCABULAIRE_SEXUEL_EXPLICITE.some((mot) => bas.includes(mot));
}

function contientIndiceMineur(texte: string): boolean {
  const bas = texte.toLowerCase();
  if (INDICES_MINEUR.some((mot) => bas.includes(mot))) return true;
  const ages = [...bas.matchAll(/\b(\d{1,2})\s*(?:ans|annees|années)\b/g)].map((m) => Number(m[1]));
  return ages.some((age) => age >= 0 && age < 18);
}

/** Garde-fou indépendant du profil : aucune sexualisation explicite de mineur. */
export function validerAbsenceMineurs(reponse: string): RapportValidation {
  if (!contientSexuelExplicite(reponse) || !contientIndiceMineur(reponse)) return { ok: true, checks: [] };
  return {
    ok: false,
    checks: [{
      nom: 'profil_contenu',
      ok: false,
      gravite: 'grave',
      raison: 'Contenu sexuel explicite associé à un personnage identifié comme mineur.',
    }],
  };
}

/**
 * Utilisé avant de réinjecter du contenu historique/lore dans un prompt ou
 * avant de l'envoyer au fournisseur d'embeddings.
 */
export function texteCompatibleAvecProfil(texte: string, profil: ProfilContenu | undefined): boolean {
  return profilEstAdulte(profil) || !motInterditDans(texte);
}

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
    checks: [{
      nom: 'profil_contenu',
      ok: false,
      gravite: 'grave',
      raison: `Contenu explicite détecté ("${trouve}") alors que le profil est GRAND_PUBLIC.`,
    }],
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
  return { ok: false, motif: 'Ce texte contient du contenu incompatible avec le profil Grand public. Reformulez.' };
}
