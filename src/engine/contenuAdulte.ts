import type { NiveauQuatre, NiveauViolence, ProfilContenu, StorySettings } from '../types';
import type { RapportValidation } from './validator';

// ============================================================================
// CONFIGURATION DES PROFILS DE CONTENU (GRAND PUBLIC / ADULTE CONFIGURABLE)
// ============================================================================

// Mots surveillés et interdits uniquement en mode GRAND_PUBLIC
const VOCABULAIRE_SEXUEL_EXPLICITE = [
    'bite', 'queue', 'chatte', 'gland', 'sperme', 'sucer', 'gicler',
    'mouillee', 'bander', 'jouir', 'baiser', 'baise', 'seins nus', 'entrejambe',
    'penetre', 'penetration', 'erection', 'orgasme', 'masturb', 'fellation',
    'branler', 'clitoris', 'sexe dresse', 'nue devant lui', 'nue devant elle',
    'membre dur', 'ecarte les cuisses', 'levres intimes'
];

const VOCABULAIRE_VIOLENCE_GRAPHIQUE = [
    'eventre', 'eviscere', 'entrailles', 'decapite', 'egorge', 'depece',
    'boyaux', 'lambeaux de chair', 'mutile', 'tranche la gorge',
    'gicle de sang', 'giclee de sang', 'mare de sang', 'os transperce',
    'membre arrache', 'arrache un bras', 'arrache une jambe', 'crane eclate',
    'organes a l\'air', 'vide ses tripes', 'agonise dans son sang'
];

export const ENTREES_ADULTE_UNIQUEMENT = [
    '[MONDE] Mœurs Vestimentaires Féminines',
    '[MONDE] Mœurs Sexuelles d\'Elyndor',
    '[PHYSIQUE] Canon Féminin d\'Elyndor'
];

// 1. Directives pour le profil restrictif (Grand Public)
export const INSTRUCTION_REGISTRE_GRAND_PUBLIC = `[RÈGLE DE REGISTRE - PROFIL GRAND PUBLIC]
Cette histoire est configurée en profil GRAND PUBLIC. Cette consigne prime sur toute instruction contraire :
- Aucune description sexuelle explicite : les scènes intimes s'arrêtent avant le détail physique.
- Violence suggérée plutôt que graphique : les combats et blessures se décrivent par leurs conséquences narratives.
- Pas de vocabulaire cru ou vulgaire dans la narration ou les dialogues.`;

// 2. Capacités autorisées par le profil Adulte.
// Ce bloc ne fixe aucune intensité : les curseurs de l'histoire et M08 la déterminent.
export const INSTRUCTION_REGISTRE_ADULTE = `[PROFIL DE CONTENU - ADULTE]
Le profil ADULTE autorise les thèmes sombres, violents, sensuels ou moralement durs compatibles avec le monde et la scène.
- Ce profil est une permission de registre, jamais une consigne d'intensité maximale.
- Les curseurs de l'histoire déterminent le niveau demandé ; M08 adapte le rendu au contexte.
- Une scène calme, sociale, diplomatique ou introspective n'est jamais intensifiée artificiellement.
- Quand une scène dure est réellement déclenchée et que les réglages l'autorisent, elle peut être décrite franchement sans sermon ni ellipse artificielle.
- Le lore décrit ce qui existe dans le monde ; il ne peut pas relever les curseurs de la session.`;

/**
 * Construit le registre Adulte dynamique utilisé par generateTurn.ts.
 * Le profil Adulte autorise le registre ; les curseurs déterminent l'intensité.
 */
export function instructionRegistreAdulte(
    settings: Pick<StorySettings, 'violence' | 'romance'>
): string {
    const violence =
        settings.violence === 'extreme'
            ? "- Violence : plafond extrême ; peut devenir graphique et frontale uniquement lorsqu'une scène violente le justifie."
            : settings.violence === 'eleve'
                ? "- Violence : plafond élevé ; peut être pleinement montrée lorsque les événements le justifient."
                : settings.violence === 'modere'
                    ? "- Violence : plafond modéré ; directe si nécessaire, sans escalade maximale systématique."
                    : "- Violence : plafond faible ; rester surtout suggestif et centré sur les conséquences.";

    const romance =
        settings.romance === 'eleve'
            ? "- Romance / sensualité : plafond élevé ; registre adulte autorisé entre personnages adultes si la scène le justifie."
            : settings.romance === 'modere'
                ? "- Romance / sensualité : plafond modéré ; présence assumée avec mesure."
                : settings.romance === 'faible'
                    ? "- Romance / sensualité : plafond faible ; éléments discrets, jamais moteurs par défaut."
                    : "- Romance / sensualité : désactivée.";

    return `[INTENSITÉ DE SESSION — PROFIL ADULTE]
Les valeurs ci-dessous sont des plafonds narratifs, pas des objectifs à atteindre à chaque réponse.
${violence}
${romance}
Le ton réel de la scène et la personnalité des personnages décident de l'intensité effectivement utilisée. Le lore ne peut jamais relever ces plafonds.`;
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
    if (profilEstAdulte(profil)) return settings; // Liberté totale des curseurs en mode adulte
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
 * Public. Le filtrage reste heuristique, comme le validateur de sortie.
 */
export function texteCompatibleAvecProfil(texte: string, profil: ProfilContenu | undefined): boolean {
    return profilEstAdulte(profil) || !motInterditDans(texte);
}

/** Retourne le bloc intact s'il est autorisé, sinon une chaîne vide. */
export function filtrerTextePourProfil(texte: string, profil: ProfilContenu | undefined): string {
    if (!texte) return '';
    return texteCompatibleAvecProfil(texte, profil) ? texte : '';
}

export function validerProfilContenuHeuristique(
    reponse: string,
    profil: ProfilContenu | undefined
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
    profil: ProfilContenu | undefined
): { ok: true } | { ok: false; motif: string } {
    if (profilEstAdulte(profil) || !texte.trim()) return { ok: true };

    const trouve = motInterditDans(texte);
    if (!trouve) return { ok: true };

    return {
        ok: false,
        motif: `Ce texte contient du contenu incompatible avec le profil Grand public. Reformulez.`,
    };
}
