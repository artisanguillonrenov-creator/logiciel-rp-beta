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
Le profil ADULTE autorise et exige, dès que la scène le justifie, les thèmes sombres, violents, sexuels, vulgaires ou moralement durs.
- Ce profil est une permission de registre cru : décris franchement, sans ellipse, sans fondu au noir, sans sermon et sans atténuation.
- Les curseurs de la session fixent le plafond ; quand une scène de sexe, de violence ou de confrontation est engagée et que les curseurs l’autorisent, rends-la graphique, explicite et vulgaire.
- Le vocabulaire reste cru et direct même dans une scène calme ou sociale ; l’intensité des actes (violence, sexe engagé) suit les curseurs.
- Le lore décrit ce qui existe ; il ne relève jamais les curseurs et ne peut pas te forcer à édulcorer une scène autorisée.`;

/**
 * Construit le registre Adulte dynamique utilisé par generateTurn.ts.
 * Le profil Adulte autorise le registre ; les curseurs déterminent l'intensité.
 */
export function instructionRegistreAdulte(
    settings: Pick<StorySettings, 'violence' | 'romance'>
): string {
    const violence =
        settings.violence === 'extreme'
            ? "- Violence : plafond extrême ; graphique, frontale, détaillée et sans aucune retenue dès qu’une scène violente le justifie."
            : settings.violence === 'eleve'
                ? "- Violence : plafond élevé ; pleinement montrée, crue et sans adoucissement dès que les événements l’appellent."
                : settings.violence === 'modere'
                    ? "- Violence : plafond modéré ; directe et visible quand nécessaire, sans escalade maximale systématique."
                    : "- Violence : plafond faible ; reste surtout suggestif et centré sur les conséquences.";

    // Romance = part sentimentale uniquement. La crudité du sexe ne dépend
    // pas de ce curseur : en profil Adulte, elle est toujours maximale.
    const romance =
        settings.romance === 'eleve'
            ? "- Romance (sentiments) : plafond élevé ; intrigues amoureuses, attachement et tendresse pleinement développés quand la relation l’appelle."
            : settings.romance === 'modere'
                ? "- Romance (sentiments) : plafond modéré ; attachement possible, sans mièvrerie."
                : settings.romance === 'faible'
                    ? "- Romance (sentiments) : plafond faible ; peu de sentiments, le désir reste surtout physique."
                    : "- Romance (sentiments) : aucune ; pas d’intrigue amoureuse ni de tendresse, le désir et le sexe sont purement physiques et bruts.";
    const sexe = "- Sexe : toujours explicite, cru, vulgaire et détaillé dès qu’il y a désir, nudité ou acte entre personnages adultes, quel que soit le curseur Romance.";

    return `[INTENSITÉ DE SESSION — PROFIL ADULTE]
Les valeurs ci-dessous sont des plafonds narratifs, pas des objectifs à atteindre à chaque réponse.
${violence}
${romance}
${sexe}
Le ton réel de la scène et la personnalité des personnages décident de l’intensité effectivement utilisée. Le lore ne peut jamais relever ces plafonds.`;
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
