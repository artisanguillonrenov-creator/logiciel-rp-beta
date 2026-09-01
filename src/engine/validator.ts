import type { Fact, MoteurInference, StoryMeta } from '../types';
import { appellerModele } from './openrouter';

// Tournures qui trahissent une décision prise à la place du joueur —
// violation de la règle 7 (l'IA ne contrôle jamais le joueur) et de
// [MÉTA] Agentivité du Joueur. Vérification locale, gratuite, avant tout
// appel réseau supplémentaire.
const TOURNURES_INTERDITES = [
  'tu décides de',
  'tu décides que',
  'tu choisis de',
  'tu choisis que',
  'tu acceptes de',
  'tu refuses de',
  'tu penses que',
  'tu te dis que',
  'tu ressens le besoin de',
  'tu es convaincu',
  'tu préfères',
  'tu optes pour',
  'tu te sens obligé',
  'tu réalises que tu dois',
];

// Suite de validation complète (brief Phase 2) : les six contrôles nommés
// dans le brief, chacun avec un niveau de gravité propre plutôt qu'un
// simple ok/échec global.
export type NomCheck =
  | 'continuite' // Continuity — cohérence avec ce qui vient de se passer
  | 'canon' // Canon — respect du lore/des personnages fichés
  | 'etat_du_monde' // World State — objets, blessures, lieux, statuts en cours
  | 'engagement' // Commitment — promesses/contrats actifs non ignorés
  | 'contrat_joueur' // Player Contract — agentivité, l'IA ne décide jamais pour le joueur
  | 'repetition_contradiction' // Repetition/Contradiction — le texte ne se contredit pas lui-même, pas de boucle
  | 'profil_contenu'; // Contrôle d'âge — dépassement du plafond GRAND_PUBLIC (contenuAdulte.ts)

export type Gravite = 'mineur' | 'modere' | 'grave';

const ORDRE_GRAVITE: Record<Gravite, number> = { mineur: 1, modere: 2, grave: 3 };

export interface ResultatCheck {
  nom: NomCheck;
  ok: boolean;
  gravite: Gravite;
  raison: string;
  // Renseignés uniquement pour une violation de canon patchable
  // localement (un nom de personnage mal utilisé) — voir determinerStrategie.
  nomIncorrect?: string;
  nomCorrect?: string;
}

export interface RapportValidation {
  ok: boolean;
  checks: ResultatCheck[];
}

export function rapportOk(): RapportValidation {
  return { ok: true, checks: [] };
}

export function fusionnerRapports(...rapports: RapportValidation[]): RapportValidation {
  const checks = rapports.flatMap((r) => r.checks);
  return { ok: checks.every((c) => c.ok), checks };
}

export function validerAgentiviteHeuristique(reponse: string): RapportValidation {
  const texte = reponse.toLowerCase();
  const tournure = TOURNURES_INTERDITES.find((t) => texte.includes(t));
  if (!tournure) return rapportOk();
  return {
    ok: false,
    checks: [
      {
        nom: 'contrat_joueur',
        ok: false,
        gravite: 'grave',
        raison: `Tournure suspecte détectée : "${tournure}" (décision imposée au joueur).`,
      },
    ],
  };
}

export interface ValidationLLMOptions {
  apiKey: string;
  model: string;
  reponse: string;
  faits: Fact[];
  meta: StoryMeta;
  moteurInference?: MoteurInference;
}

const NOMS_CHECKS: NomCheck[] = [
  'continuite',
  'canon',
  'etat_du_monde',
  'engagement',
  'contrat_joueur',
  'repetition_contradiction',
];

/**
 * Suite de validation complète (brief Phase 2), en un seul appel modèle
 * pour rester économique : les six contrôles nommés (Continuity, Canon,
 * World State, Commitment, Player Contract, Repetition/Contradiction),
 * chacun avec sa propre gravité — remplace l'ancien ok/raisons global de
 * la bêta.
 */
export async function validerReponseLLM({
  apiKey,
  model,
  reponse,
  faits,
  meta,
  moteurInference,
}: ValidationLLMOptions): Promise<RapportValidation> {
  const faitsTexte = faits.length
    ? faits.map((f) => `- [${f.type}]${f.resolue ? ' (résolu)' : ''} ${f.texte}`).join('\n')
    : 'Aucun fait établi.';

  try {
    const sortie = await appellerModele({
      apiKey,
      model,
      moteurInference,
      temperature: 0,
      maxTokens: 500,
      messages: [
        {
          role: 'system',
          content: `Tu es un vérificateur automatique, pas un narrateur. Réponds UNIQUEMENT avec un objet JSON strict, sans texte autour, de la forme :
{"checks": {
  "continuite": {"ok": true, "gravite": "mineur|modere|grave", "raison": ""},
  "canon": {"ok": true, "gravite": "mineur|modere|grave", "raison": "", "nom_incorrect": "", "nom_correct": ""},
  "etat_du_monde": {"ok": true, "gravite": "mineur|modere|grave", "raison": ""},
  "engagement": {"ok": true, "gravite": "mineur|modere|grave", "raison": ""},
  "contrat_joueur": {"ok": true, "gravite": "mineur|modere|grave", "raison": ""},
  "repetition_contradiction": {"ok": true, "gravite": "mineur|modere|grave", "raison": ""}
}}

Le texte à vérifier est une réponse de narrateur de jeu de rôle. Personnage du joueur : ${meta.personnageNom} (${meta.personnageDescription}).

Faits établis à respecter :
${faitsTexte}

Pour chaque contrôle, marque ok=false uniquement en cas de problème réel :
- continuite : le texte contredit ou ignore ce qui vient de se passer dans la scène.
- canon : un personnage fiché est renommé, dénaturé, ou remplacé par une invention. Si le problème est uniquement un nom de personnage mal utilisé, renseigne aussi nom_incorrect et nom_correct (sinon laisse ces deux champs vides).
- etat_du_monde : un objet, une blessure, un lieu ou un statut établi est ignoré ou contredit.
- engagement : une promesse ou un contrat actif (voir faits établis) est ignoré sans raison narrative.
- contrat_joueur : le texte décrit une action, une parole ou une pensée du joueur (${meta.personnageNom}) que rien n'indique qu'il a initiée lui-même.
- repetition_contradiction : le texte se répète ou se contredit lui-même dans sa propre formulation.

"gravite" reflète l'impact réel : mineur (détail cosmétique), modere (gêne la cohérence sans casser la scène), grave (rupture de canon ou de règle immuable). Sois précis et concis dans "raison".`,
        },
        { role: 'user', content: reponse },
      ],
    });

    const match = sortie.match(/\{[\s\S]*\}/);
    if (!match) return rapportOk();
    const parsed = JSON.parse(match[0]);
    const brut = parsed?.checks ?? {};

    const checks: ResultatCheck[] = NOMS_CHECKS.map((nom): ResultatCheck => {
      const c = brut[nom];
      if (!c || typeof c !== 'object') return { nom, ok: true, gravite: 'mineur', raison: '' };
      const gravite: Gravite = ['mineur', 'modere', 'grave'].includes(c.gravite) ? c.gravite : 'modere';
      return {
        nom,
        ok: c.ok !== false,
        gravite,
        raison: typeof c.raison === 'string' ? c.raison : '',
        nomIncorrect: typeof c.nom_incorrect === 'string' && c.nom_incorrect ? c.nom_incorrect : undefined,
        nomCorrect: typeof c.nom_correct === 'string' && c.nom_correct ? c.nom_correct : undefined,
      };
    }).filter((c) => !c.ok || c.raison);

    return { ok: checks.every((c) => c.ok), checks };
  } catch {
    // En cas d'échec du vérificateur (réseau, parsing), on ne bloque pas
    // la génération : la vérification heuristique reste le filet minimal.
    return rapportOk();
  }
}

export type StrategieReparation = 'aucune' | 'patch_local' | 'repair' | 'regeneration_partielle' | 'regeneration_complete';

/**
 * Choisit la stratégie de réparation la plus légère suffisante pour le
 * rapport de validation (brief Phase 2 : "patch local → repair →
 * régénération partielle → complète"), à partir de la gravité des
 * contrôles en échec.
 */
export function determinerStrategie(rapport: RapportValidation): StrategieReparation {
  const echecs = rapport.checks.filter((c) => !c.ok);
  if (echecs.length === 0) return 'aucune';

  const patchable = echecs.every((c) => c.gravite === 'mineur' && c.nomIncorrect && c.nomCorrect);
  if (patchable) return 'patch_local';

  const pireGravite = echecs.reduce<Gravite>(
    (pire, c) => (ORDRE_GRAVITE[c.gravite] > ORDRE_GRAVITE[pire] ? c.gravite : pire),
    'mineur',
  );

  if (pireGravite === 'grave') {
    // Plusieurs points graves à la fois : plus sûr de tout recommencer
    // proprement qu'un patch ciblé multi-points.
    return echecs.length > 1 ? 'regeneration_complete' : 'regeneration_partielle';
  }
  return 'repair';
}

/**
 * Patch local (sans appel modèle) : remplace un nom de personnage mal
 * utilisé par le nom correct, quand le seul problème signalé est
 * exactement ça.
 */
export function appliquerPatchLocal(reponse: string, rapport: RapportValidation): string {
  let texte = reponse;
  for (const c of rapport.checks) {
    if (!c.ok && c.nomIncorrect && c.nomCorrect) {
      texte = texte.split(c.nomIncorrect).join(c.nomCorrect);
    }
  }
  return texte;
}

export interface RepairOptions {
  apiKey: string;
  model: string;
  reponse: string;
  rapport: RapportValidation;
  partiel: boolean;
  moteurInference?: MoteurInference;
}

/**
 * Repair ciblé (léger) ou régénération partielle (même appel, consigne
 * renforcée de ne toucher qu'aux points signalés) : un appel modèle court
 * qui ne renvoie que le texte corrigé, sans reconstruire tout le contexte
 * système — moins coûteux qu'une régénération complète pour un problème
 * localisé.
 */
export async function reparerReponse({
  apiKey,
  model,
  reponse,
  rapport,
  partiel,
  moteurInference,
}: RepairOptions): Promise<string> {
  const points = rapport.checks
    .filter((c) => !c.ok)
    .map((c) => `- (${c.nom}, ${c.gravite}) ${c.raison}`)
    .join('\n');

  const consigne = partiel
    ? "Corrige UNIQUEMENT les points listés ci-dessous, en conservant le reste du texte identique autant que possible (mêmes phrases, même longueur)."
    : 'Corrige les points listés ci-dessous. Réécris le texte pour qu\'il n\'en souffre plus, sans en changer le sens général.';

  const corrige = await appellerModele({
    apiKey,
    model,
    moteurInference,
    temperature: 0.3,
    maxTokens: Math.max(300, Math.ceil(reponse.length / 3)),
    messages: [
      {
        role: 'system',
        content: `Tu corriges un texte de narration de jeu de rôle. Réponds UNIQUEMENT avec le texte corrigé, sans commentaire ni balise autour. ${consigne}\n\nPoints à corriger :\n${points}`,
      },
      { role: 'user', content: reponse },
    ],
  });

  return corrige.trim();
}
