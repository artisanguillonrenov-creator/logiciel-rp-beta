// Elyndor — Narrative Behavior Kernel V2.1
//
// Orchestrateur pur des quinze responsabilités M01 à M15.
// Il ne fait aucun appel modèle, ne persiste aucun état et ne remplace aucun
// propriétaire de domaine. Il coordonne les moteurs, propage seulement les
// dépendances explicitement sûres et produit un NarrativeContract compact via M01.

import {
  executerM01,
  type EntreeM01,
  type SortieM01,
} from './m01-production';
import {
  executerM02,
  type EntreeM02,
  type SortieM02,
} from './m02-continuite';
import {
  executerM03,
  type EntreeM03,
  type SortieM03,
} from './m03-esprit-personnages';
import {
  executerM04,
  type EntreeM04,
  type SortieM04,
} from './m04-dynamiques-sociales';
import {
  executerM05,
  type EntreeM05,
  type SortieM05,
} from './m05-engagements-institutions';
import {
  executerM06,
  type EntreeM06,
  type SortieM06,
  type TentativeMaterielleM06,
} from './m06-lois-monde-scene';
import {
  executerM07,
  type EntreeM07,
  type SortieM07,
} from './m07-agentivite-joueur';
import {
  executerM08,
  type EntreeM08,
  type SortieM08,
} from './m08-registre-style';
import {
  executerM09,
  type EntreeM09,
  type SortieM09,
} from './m09-archetypes-universels';
import {
  executerM10,
  type EntreeM10,
  type SortieM10,
} from './m10-profils-sociaux-universels';
import {
  executerM11,
  type EntreeM11,
  type SortieM11,
} from './m11-rythme-narratif-long-terme';
import {
  executerM12,
  type EntreeM12,
  type SortieM12,
} from './m12-dynamique-groupe';
import {
  executerM13,
  type EntreeM13,
  type SortieM13,
} from './m13-consentement-limites-signaux';
import {
  executerM14,
  type EntreeM14,
  type SortieM14,
} from './m14-resolution-actions';
import {
  executerM15,
  type EntreeM15,
  type SortieM15,
} from './m15-circulation-information';
import type { NarrativeContractV21 } from './narrativeContract';
import type {
  BlocageNarratif,
  ContexteNarratifV21,
  ControleNarratif,
  IdMoteurNarratif,
  PropositionTransition,
  ResultatMoteur,
} from './types';

export const VERSION_NARRATIVE_KERNEL_V21 = '2.1' as const;

/**
 * Les adaptateurs applicatifs préparent les données propres à chaque moteur.
 * Le Kernel ajoute toujours lui-même le ContexteNarratifV21 partagé.
 */
type SansContexte<T extends { contexte: ContexteNarratifV21 }> = Omit<T, 'contexte'>;

/**
 * M14 possède deux champs obligatoires parce qu'il ne doit jamais inventer les
 * facteurs d'une résolution. Ils deviennent facultatifs au niveau Kernel :
 * en leur absence, la tentative reste explicitement à clarifier dans M14.
 */
export type OptionsM14KernelV21 = Partial<Omit<EntreeM14, 'contexte'>>;

export interface OptionsMoteursKernelV21 {
  m02?: SansContexte<EntreeM02>;
  m03?: SansContexte<EntreeM03>;
  m04?: SansContexte<EntreeM04>;
  m05?: SansContexte<EntreeM05>;
  m06?: SansContexte<EntreeM06>;
  m07?: SansContexte<EntreeM07>;
  m08?: SansContexte<EntreeM08>;
  m09?: SansContexte<EntreeM09>;
  m10?: SansContexte<EntreeM10>;
  m11?: SansContexte<EntreeM11>;
  m12?: SansContexte<EntreeM12>;
  m13?: SansContexte<EntreeM13>;
  m14?: OptionsM14KernelV21;
  m15?: SansContexte<EntreeM15>;

  /** M01 assemble les contributions ; on n'autorise pas un second tableau parallèle. */
  m01?: Pick<EntreeM01, 'controlesSupplementaires'>;
}

export interface EntreeNarrativeKernelV21 {
  contexte: ContexteNarratifV21;
  moteurs?: OptionsMoteursKernelV21;
}

export interface SortiesMoteursKernelV21 {
  m01: SortieM01;
  m02: SortieM02;
  m03: SortieM03;
  m04: SortieM04;
  m05: SortieM05;
  m06: SortieM06;
  m07: SortieM07;
  m08: SortieM08;
  m09: SortieM09;
  m10: SortieM10;
  m11: SortieM11;
  m12: SortieM12;
  m13: SortieM13;
  m14: SortieM14;
  m15: SortieM15;
}

export interface DiagnosticNarrativeKernelV21 {
  version: typeof VERSION_NARRATIVE_KERNEL_V21;
  moteursExecutes: IdMoteurNarratif[];
  moteursAvecTransition: IdMoteurNarratif[];
  moteursAvecAlerte: IdMoteurNarratif[];
  moteursAvecBlocage: IdMoteurNarratif[];
  transitionsProposees: number;
  controles: ControleNarratif[];
  controlesEnEchec: ControleNarratif[];
  blocagePrioritaire?: BlocageNarratif;
  alertes: string[];
  modeSortie: SortieM01['modeSortie'];
  autorisePoursuiteFiction: boolean;
}

export interface SortieNarrativeKernelV21 {
  version: typeof VERSION_NARRATIVE_KERNEL_V21;
  contrat: NarrativeContractV21;
  moteurs: SortiesMoteursKernelV21;
  transitionsProposees: PropositionTransition[];
  diagnostic: DiagnosticNarrativeKernelV21;
}

const ORDRE_BLOCAGES: Record<BlocageNarratif['type'], number> = {
  limite: 0,
  agentivite: 1,
  impossibilite: 2,
  contradiction: 3,
  information_manquante: 4,
  autre: 5,
};

function propre(valeur: unknown): string {
  return String(valeur ?? '').trim();
}

function normaliser(valeur: unknown): string {
  return propre(valeur)
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniquesTextes(valeurs: Iterable<string>): string[] {
  const resultat: string[] = [];
  const vus = new Set<string>();

  for (const valeur of valeurs) {
    const texte = propre(valeur);
    const cle = normaliser(texte);
    if (!cle || vus.has(cle)) continue;
    vus.add(cle);
    resultat.push(texte);
  }

  return resultat;
}

function uniquesParCle<T>(valeurs: Iterable<T>, cle: (valeur: T) => string): T[] {
  const resultat: T[] = [];
  const vus = new Set<string>();

  for (const valeur of valeurs) {
    const id = propre(cle(valeur));
    if (!id || vus.has(id)) continue;
    vus.add(id);
    resultat.push(valeur);
  }

  return resultat;
}

function fusionnerArchetypesM03(
  automatiques: Record<string, string[]>,
  explicites?: Record<string, string[]>,
): Record<string, string[]> {
  const resultat: Record<string, string[]> = {};
  const ids = new Set([
    ...Object.keys(automatiques),
    ...Object.keys(explicites ?? {}),
  ]);

  for (const id of ids) {
    // Les valeurs explicites préparées par l'adaptateur priment. En leur absence,
    // M09 remplit seulement les champs encore manquants de M03.
    const valeurs = explicites?.[id] ?? automatiques[id] ?? [];
    resultat[id] = uniquesTextes(valeurs);
  }

  return resultat;
}

function tentativesM06DepuisM07(sortieM07: SortieM07): TentativeMaterielleM06[] {
  return sortieM07.tentativesAResoudre.map((tentative) => ({ tentative }));
}

function resultatSpecialise(sortie: { resultat: ResultatMoteur }): ResultatMoteur {
  return sortie.resultat;
}

function selectionnerBlocagePrioritaire(
  resultats: ResultatMoteur[],
): BlocageNarratif | undefined {
  return resultats
    .map((resultat) => resultat.blocage)
    .filter((blocage): blocage is BlocageNarratif => Boolean(blocage))
    .sort((a, b) => ORDRE_BLOCAGES[a.type] - ORDRE_BLOCAGES[b.type])[0];
}

function collecterTransitions(resultats: ResultatMoteur[]): PropositionTransition[] {
  return uniquesParCle(
    resultats.flatMap((resultat) => resultat.transitions),
    (transition) => transition.id,
  );
}

function collecterControles(contrat: NarrativeContractV21): ControleNarratif[] {
  return uniquesParCle(
    contrat.controles,
    (controle) => `${controle.id}\u0000${controle.raison ?? ''}`,
  );
}

function construireDiagnostic(
  sorties: SortiesMoteursKernelV21,
  resultats: ResultatMoteur[],
  transitions: PropositionTransition[],
): DiagnosticNarrativeKernelV21 {
  const controles = collecterControles(sorties.m01.contrat);
  const controlesEnEchec = controles.filter((controle) => !controle.ok);

  return {
    version: VERSION_NARRATIVE_KERNEL_V21,
    moteursExecutes: [
      'M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07', 'M08',
      'M09', 'M10', 'M11', 'M12', 'M13', 'M14', 'M15',
    ],
    moteursAvecTransition: resultats
      .filter((resultat) => resultat.transitions.length > 0)
      .map((resultat) => resultat.moteur),
    moteursAvecAlerte: resultats
      .filter((resultat) => resultat.alertes.length > 0)
      .map((resultat) => resultat.moteur),
    moteursAvecBlocage: resultats
      .filter((resultat) => Boolean(resultat.blocage))
      .map((resultat) => resultat.moteur),
    transitionsProposees: transitions.length,
    controles,
    controlesEnEchec,
    blocagePrioritaire: selectionnerBlocagePrioritaire(resultats),
    alertes: uniquesTextes(resultats.flatMap((resultat) => resultat.alertes)),
    modeSortie: sorties.m01.modeSortie,
    autorisePoursuiteFiction: sorties.m01.autorisePoursuiteFiction,
  };
}

/**
 * Exécute le noyau V2.1 pour un tour sans appel LLM et sans mutation persistante.
 *
 * Les dépendances propagées automatiquement sont uniquement celles qui sont
 * explicitement prévues par les contrats des moteurs :
 * - M09 -> M03 : identifiants d'archétypes pour les champs individuels manquants ;
 * - M07 -> M06 : tentative matérielle minimale, sans inventer moyens ni risques ;
 * - M13 -> M08 : périmètre de rendu réellement autorisé ;
 * - M07 + M13 -> M14 : tentatives à résoudre et périmètre de limites ;
 * - M02..M15 -> M01 : contributions, transitions, contrôles et blocages.
 *
 * Les autres échanges de domaine doivent passer par ContexteNarratifV21 ou par
 * l'adaptateur applicatif. Le Kernel ne fabrique jamais une connaissance, une
 * compétence, une clause, une relation ou une conséquence manquante.
 */
export function executerNarrativeKernelV21(
  entree: EntreeNarrativeKernelV21,
): SortieNarrativeKernelV21 {
  const { contexte } = entree;
  const options = entree.moteurs ?? {};

  // Continuité et savoir situé : établir d'abord ce qui est applicable sans
  // modifier l'état. Ces sorties restent des propositions/lectures du contexte.
  const m02 = executerM02({
    contexte,
    ...(options.m02 ?? {}),
  });

  const m15 = executerM15({
    contexte,
    ...(options.m15 ?? {}),
  });

  // Les limites réelles sont prioritaires sur le style et la résolution.
  const m13 = executerM13({
    contexte,
    ...(options.m13 ?? {}),
  });

  // L'intention du joueur est séparée de la faisabilité puis du résultat.
  const m07 = executerM07({
    contexte,
    ...(options.m07 ?? {}),
  });

  const m06 = executerM06({
    contexte,
    ...(options.m06 ?? {}),
    tentatives:
      options.m06?.tentatives ?? tentativesM06DepuisM07(m07),
  });

  // M09 ne caractérise jamais à la place de M03. M10 situe socialement sans
  // inventer ressources ou psychologie.
  const m09 = executerM09({
    contexte,
    ...(options.m09 ?? {}),
  });

  const m10 = executerM10({
    contexte,
    ...(options.m10 ?? {}),
  });

  const m03 = executerM03({
    contexte,
    ...(options.m03 ?? {}),
    archetypeIdsParPnj: fusionnerArchetypesM03(
      m09.archetypeIdsParPnj,
      options.m03?.archetypeIdsParPnj,
    ),
  });

  // La coordination de groupe lit seulement les présences, savoirs et intentions
  // déjà établis ou préparés. Elle ne crée pas de connaissance collective.
  const m12 = executerM12({
    contexte,
    ...(options.m12 ?? {}),
  });

  // M14 ne reçoit aucune compétence ou opposition inventée. Si l'adaptateur n'a
  // pas fourni ses données qualitatives, M14 suspend explicitement la résolution.
  const m14 = executerM14({
    contexte,
    ...(options.m14 ?? {}),
    tentatives: options.m14?.tentatives ?? m07.tentativesAResoudre,
    donnees: options.m14?.donnees ?? [],
    perimetreM13: options.m14?.perimetreM13 ?? m13.perimetre,
  });

  // Les domaines contractuels et sociaux interviennent après les issues connues,
  // mais restent dépendants des données explicites préparées par l'adaptateur.
  const m05 = executerM05({
    contexte,
    ...(options.m05 ?? {}),
  });

  const m04 = executerM04({
    contexte,
    ...(options.m04 ?? {}),
  });

  const m11 = executerM11({
    contexte,
    ...(options.m11 ?? {}),
  });

  const m08 = executerM08({
    contexte,
    ...(options.m08 ?? {}),
    perimetreM13: options.m08?.perimetreM13 ?? m13.perimetrePourM08,
  });

  const resultatsSpecialises: ResultatMoteur[] = [
    resultatSpecialise(m02),
    resultatSpecialise(m03),
    resultatSpecialise(m04),
    resultatSpecialise(m05),
    resultatSpecialise(m06),
    resultatSpecialise(m07),
    resultatSpecialise(m08),
    resultatSpecialise(m09),
    resultatSpecialise(m10),
    resultatSpecialise(m11),
    resultatSpecialise(m12),
    resultatSpecialise(m13),
    resultatSpecialise(m14),
    resultatSpecialise(m15),
  ];

  // M01 est volontairement exécuté en dernier : il assemble les contributions
  // compactes des propriétaires sans recalculer leur état.
  const m01 = executerM01({
    contexte,
    contributions: resultatsSpecialises,
    controlesSupplementaires: options.m01?.controlesSupplementaires,
  });

  const moteurs: SortiesMoteursKernelV21 = {
    m01,
    m02,
    m03,
    m04,
    m05,
    m06,
    m07,
    m08,
    m09,
    m10,
    m11,
    m12,
    m13,
    m14,
    m15,
  };

  const transitionsProposees = collecterTransitions(resultatsSpecialises);
  const diagnostic = construireDiagnostic(
    moteurs,
    resultatsSpecialises,
    transitionsProposees,
  );

  return {
    version: VERSION_NARRATIVE_KERNEL_V21,
    contrat: m01.contrat,
    moteurs,
    transitionsProposees,
    diagnostic,
  };
}
