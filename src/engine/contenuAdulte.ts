import type { ProfilContenu, StorySettings } from '../types';
import type { RapportValidation } from './validator';

// Contrôle d'âge (brief Phase 2). Le monde d'Elyndor est explicite par
// défaut ([MÉTA] Registre et Style Narratif, entrées Elyndor Mœurs
// Vestimentaires/Sexuelles) : en profil GRAND_PUBLIC, ce vocabulaire est
// retiré du prompt ET détecté en sortie par le validateur — le
// plafonnement est imposé par le logiciel, pas laissé à la discrétion du
// modèle.
const VOCABULAIRE_EXPLICITE = [
  'bite', 'queue', 'chatte', 'gland', 'sperme', 'sucer', 'gicler',
  'mouillée', 'bander', 'jouir', 'baiser', 'baise', 'seins nus', 'entrejambe',
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

export function plafonnerCurseurs(settings: StorySettings, profil: ProfilContenu | undefined): StorySettings {
  if (profil !== 'grand_public') return settings;
  return { ...settings, violence: 'faible', romance: 'faible' };
}

/**
 * Contrôle heuristique local (gratuit, avant tout appel réseau) : détecte
 * un dépassement du plafond de contenu en profil GRAND_PUBLIC. Complète la
 * suite de validation Phase 2 comme un check supplémentaire.
 */
export function validerProfilContenuHeuristique(
  reponse: string,
  profil: ProfilContenu | undefined,
): RapportValidation {
  if (profil !== 'grand_public') return { ok: true, checks: [] };

  const texte = reponse.toLowerCase();
  const trouve = VOCABULAIRE_EXPLICITE.find((mot) => texte.includes(mot));
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
