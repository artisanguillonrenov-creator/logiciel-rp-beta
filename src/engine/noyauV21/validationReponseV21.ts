// Elyndor — Noyau narratif natif V2.1
// Validation locale d'une réponse proposée contre le NarrativeContract.
//
// Aucun appel modèle, aucune mutation et aucune canonisation dans ce module.
// Il fournit un rapport déterministe que le pipeline pourra fusionner avec
// ses autres contrôles avant d'accepter la narration et ses conséquences.

import type {
  Gravite,
  NomCheck,
  RapportValidation,
  ResultatCheck,
} from '../validator';
import type { ModeSortieM01 } from './m01-production';
import type { NarrativeContractV21 } from './narrativeContract';

export interface EntreeValidationReponseV21 {
  reponse: string;
  contrat: NarrativeContractV21;
  modeSortie: ModeSortieM01;
}

export interface DiagnosticValidationReponseV21 {
  longueurReponse: number;
  fuiteMecaniqueInterne: string[];
  marqueursFiction: string[];
  questionPresente: boolean;
  clarificationAttendue?: string;
  couvertureClarification?: number;
  controlesContratEnEchec: string[];
  protectionMortActive: boolean;
}

export interface SortieValidationReponseV21 {
  rapport: RapportValidation;
  diagnostic: DiagnosticValidationReponseV21;
}

const MOTS_VIDES = new Set(
  'a au aux avec ce ces dans de des du elle en et eux il ils je la le les leur lui ma mais me mes moi mon ne nos notre nous on ou par pas pour que qui sa se ses son sur ta te tes toi ton tu un une vos votre vous'.split(/\s+/),
);

const MARQUEURS_INTERNES: Array<{ nom: string; regex: RegExp }> = [
  { nom: 'Narrative Kernel', regex: /\bnarrative\s+kernel\b/i },
  { nom: 'Kernel V2.1', regex: /\bkernel\s+v?2(?:[.,]1)?\b/i },
  { nom: 'métamoteur', regex: /\bm[ée]ta[- ]?moteur/i },
  { nom: 'identifiant M01–M15', regex: /\bM(?:0[1-9]|1[0-5])\b/ },
  { nom: 'contrat narratif', regex: /\bcontrat\s+narratif\b/i },
  { nom: 'transition proposée', regex: /\btransition(?:s)?\s+propos[ée]e?s?\b/i },
  { nom: 'diagnostic adaptateur', regex: /\bdiagnostic\s+(?:de\s+l['’])?adaptateur\b/i },
  { nom: 'moteurs contributeurs', regex: /\bmoteurs?\s+contributeurs?\b/i },
];

function propre(valeur: unknown): string {
  return String(valeur ?? '').replace(/\s+/g, ' ').trim();
}

function normaliser(valeur: unknown): string {
  return propre(valeur)
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function motsSignificatifs(texte: string): string[] {
  const uniques = new Set<string>();
  for (const mot of normaliser(texte).split(' ')) {
    if (mot.length < 4 || MOTS_VIDES.has(mot)) continue;
    uniques.add(mot);
  }
  return [...uniques];
}

function couvertureLexicale(attendu: string, observe: string): number {
  const mots = motsSignificatifs(attendu);
  if (!mots.length) return 1;
  const texte = new Set(motsSignificatifs(observe));
  const retrouves = mots.filter((mot) => texte.has(mot)).length;
  return retrouves / mots.length;
}

function creerCheck(
  nom: NomCheck,
  gravite: Gravite,
  raison: string,
): ResultatCheck {
  return { nom, ok: false, gravite, raison };
}

function rapportDepuisChecks(checks: ResultatCheck[]): RapportValidation {
  return {
    ok: checks.every((check) => check.ok),
    checks,
  };
}

function detecterFuiteInterne(reponse: string): string[] {
  return MARQUEURS_INTERNES
    .filter(({ regex }) => regex.test(reponse))
    .map(({ nom }) => nom);
}

function detecterMarqueursFiction(reponse: string): string[] {
  const marqueurs: string[] = [];

  // Convention Elyndor : narration/actions entre astérisques.
  if (/(^|\n)\s*\*[^*\n]{3,}\*/m.test(reponse)) {
    marqueurs.push('narration entre astérisques');
  }

  // Convention active : NOM : « réplique » pour les PNJ.
  if (/^[ \t]*[A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ0-9 _'’\-]{1,48}[ \t]*:[ \t]*[«"]/m.test(reponse)) {
    marqueurs.push('réplique de PNJ balisée');
  }

  return marqueurs;
}

function protectionMortDefinitiveActive(contrat: NarrativeContractV21): boolean {
  return contrat.limites.some((limite) => {
    const theme = normaliser(limite.theme);
    return !limite.autorisee && theme.includes('mort') && (
      theme.includes('definit') ||
      theme.includes('joueur') ||
      theme.includes('personnage')
    );
  });
}

function reponseDeclareMortDefinitiveDuJoueur(reponse: string): boolean {
  const texte = normaliser(reponse);
  const motifs = [
    /\btu meurs\b/,
    /\btu es mort\b/,
    /\btu es morte\b/,
    /\bta mort est definitive\b/,
    /\bton cadavre\b/,
    /\bton corps sans vie\b/,
  ];
  return motifs.some((motif) => motif.test(texte));
}

function verifierModeSortie(
  entree: EntreeValidationReponseV21,
  marqueursFiction: string[],
): ResultatCheck[] {
  const checks: ResultatCheck[] = [];
  const { modeSortie, reponse, contrat } = entree;

  if (modeSortie === 'suspendue' && marqueursFiction.length > 0) {
    checks.push(creerCheck(
      'continuite',
      'grave',
      `La fiction devait être suspendue, mais la réponse contient encore ${marqueursFiction.join(' et ')}.`,
    ));
  }

  if (modeSortie === 'hors_fiction' && marqueursFiction.length > 0) {
    checks.push(creerCheck(
      'continuite',
      'modere',
      `L'échange devait rester hors fiction, mais la réponse contient ${marqueursFiction.join(' et ')}.`,
    ));
  }

  if (modeSortie === 'clarification') {
    if (!reponse.includes('?')) {
      checks.push(creerCheck(
        'continuite',
        'grave',
        'Le Kernel exige une clarification ciblée, mais la réponse ne pose aucune question.',
      ));
    }
    if (marqueursFiction.length > 0) {
      checks.push(creerCheck(
        'continuite',
        'modere',
        `Le tour devait se limiter à une clarification, mais la réponse poursuit la fiction avec ${marqueursFiction.join(' et ')}.`,
      ));
    }
  }

  if (contrat.clarification) {
    const couverture = couvertureLexicale(contrat.clarification.question, reponse);
    if (couverture < 0.2) {
      checks.push(creerCheck(
        'continuite',
        'modere',
        'La réponse pose éventuellement une question, mais elle ne couvre pas suffisamment la clarification demandée par le contrat du tour.',
      ));
    }
  }

  return checks;
}

function verifierFuiteMecanique(fuites: string[]): ResultatCheck[] {
  if (!fuites.length) return [];
  return [
    creerCheck(
      'repetition_contradiction',
      'modere',
      `La réponse expose des mécanismes internes qui doivent rester invisibles au joueur : ${fuites.join(', ')}.`,
    ),
  ];
}

function verifierProtectionMort(
  contrat: NarrativeContractV21,
  reponse: string,
): ResultatCheck[] {
  if (!protectionMortDefinitiveActive(contrat)) return [];
  if (!reponseDeclareMortDefinitiveDuJoueur(reponse)) return [];

  return [
    creerCheck(
      'contrat_joueur',
      'grave',
      'La réponse déclare une mort définitive du personnage joueur alors que le contrat du tour contient une protection active contre cette issue.',
    ),
  ];
}

function dedoublonnerChecks(checks: ResultatCheck[]): ResultatCheck[] {
  const resultat: ResultatCheck[] = [];
  const vus = new Set<string>();

  for (const check of checks) {
    const cle = `${check.nom}\u0000${check.gravite}\u0000${normaliser(check.raison)}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    resultat.push(check);
  }

  return resultat;
}

/**
 * Vérifie localement la concordance minimale entre une réponse proposée et le
 * contrat calculé avant l'appel modèle.
 *
 * Cette fonction reste volontairement conservatrice : elle ne prétend pas
 * reconstruire sémantiquement toute la scène par heuristique. Les contrôles
 * certains (mode de sortie, fuite des mécanismes, clarification, protection
 * explicite contre la mort définitive) sont bloquants ; les vérifications plus
 * fines de canon, savoirs et causalité restent combinées avec les validateurs
 * spécialisés du pipeline.
 */
export function validerReponseAvecContratV21(
  entree: EntreeValidationReponseV21,
): SortieValidationReponseV21 {
  const reponse = propre(entree.reponse);
  const fuites = detecterFuiteInterne(reponse);
  const marqueursFiction = detecterMarqueursFiction(reponse);
  const protectionMortActive = protectionMortDefinitiveActive(entree.contrat);
  const controlesContratEnEchec = entree.contrat.controles
    .filter((controle) => !controle.ok)
    .map((controle) => `${controle.id}${controle.raison ? `: ${controle.raison}` : ''}`);

  const checks = dedoublonnerChecks([
    ...verifierFuiteMecanique(fuites),
    ...verifierModeSortie(entree, marqueursFiction),
    ...verifierProtectionMort(entree.contrat, reponse),
  ]);

  const clarificationAttendue = entree.contrat.clarification?.question;
  const couvertureClarification = clarificationAttendue
    ? couvertureLexicale(clarificationAttendue, reponse)
    : undefined;

  return {
    rapport: rapportDepuisChecks(checks),
    diagnostic: {
      longueurReponse: reponse.length,
      fuiteMecaniqueInterne: fuites,
      marqueursFiction,
      questionPresente: reponse.includes('?'),
      clarificationAttendue,
      couvertureClarification,
      controlesContratEnEchec,
      protectionMortActive,
    },
  };
}
