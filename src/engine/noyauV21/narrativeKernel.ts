// Elyndor — Narrative Behavior Kernel V2.1
//
// Orchestrateur pur des quinze responsabilités M01 à M15.
// Aucun appel modèle, aucune persistance et aucune duplication d'autorité :
// les moteurs spécialisés proposent, M01 assemble un NarrativeContract compact.

import {
  executerM01,
  type ContributionSceneM01,
  type EntreeM01,
  type SortieM01,
} from './m01-production';
import { executerM02, type EntreeM02, type SortieM02 } from './m02-continuite';
import { executerM03, type EntreeM03, type SortieM03 } from './m03-esprit-personnages';
import { executerM04, type EntreeM04, type SortieM04 } from './m04-dynamiques-sociales';
import { executerM05, type EntreeM05, type SortieM05 } from './m05-engagements-institutions';
import {
  executerM06,
  type EntreeM06,
  type SortieM06,
  type TentativeMaterielleM06,
} from './m06-lois-monde-scene';
import { executerM07, type EntreeM07, type SortieM07 } from './m07-agentivite-joueur';
import { executerM08, type EntreeM08, type SortieM08 } from './m08-registre-style';
import { executerM09, type EntreeM09, type SortieM09 } from './m09-archetypes-universels';
import { executerM10, type EntreeM10, type SortieM10 } from './m10-profils-sociaux-universels';
import { executerM11, type EntreeM11, type SortieM11 } from './m11-rythme-narratif-long-terme';
import { executerM12, type EntreeM12, type SortieM12 } from './m12-dynamique-groupe';
import { executerM13, type EntreeM13, type SortieM13 } from './m13-consentement-limites-signaux';
import { executerM14, type EntreeM14, type SortieM14 } from './m14-resolution-actions';
import { executerM15, type EntreeM15, type SortieM15 } from './m15-circulation-information';
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

type SansContexte<T extends { contexte: ContexteNarratifV21 }> = Omit<T, 'contexte'>;
type ResultatSpecialiseV21 = ResultatMoteur<ContributionSceneM01>;

/**
 * M14 exige normalement tentatives + données de résolution. Au niveau Kernel,
 * l'adaptateur peut les omettre : M14 conservera alors explicitement l'inconnu
 * au lieu d'inventer une compétence, une opposition ou une issue.
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

function normaliser(valeur: unknown): string {
  return String(valeur ?? '')
    .trim()
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
    const texte = String(valeur ?? '').trim();
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
    const id = String(cle(valeur) ?? '').trim();
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
  const ids = new Set([...Object.keys(automatiques), ...Object.keys(explicites ?? {})]);
  for (const id of ids) {
    // Une sélection explicite de l'adaptateur prime ; sinon M09 comble seulement
    // les champs encore manquants de M03.
    resultat[id] = uniquesTextes(explicites?.[id] ?? automatiques[id] ?? []);
  }
  return resultat;
}

function tentativesM06DepuisM07(sortieM07: SortieM07): TentativeMaterielleM06[] {
  return sortieM07.tentativesAResoudre.map((tentative) => ({ tentative }));
}

function selectionnerBlocagePrioritaire(
  resultats: ResultatSpecialiseV21[],
): BlocageNarratif | undefined {
  return resultats
    .map((resultat) => resultat.blocage)
    .filter((blocage): blocage is BlocageNarratif => Boolean(blocage))
    .sort((a, b) => ORDRE_BLOCAGES[a.type] - ORDRE_BLOCAGES[b.type])[0];
}

function collecterTransitions(resultats: ResultatSpecialiseV21[]): PropositionTransition[] {
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
  resultats: ResultatSpecialiseV21[],
  transitions: PropositionTransition[],
): DiagnosticNarrativeKernelV21 {
  const controles = collecterControles(sorties.m01.contrat);
  return {
    version: VERSION_NARRATIVE_KERNEL_V21,
    moteursExecutes: [
      'M01', 'M02', 'M03', 'M04', 'M05', 'M06', 'M07', 'M08',
      'M09', 'M10', 'M11', 'M12', 'M13', 'M14', 'M15',
    ],
    moteursAvecTransition: resultats.filter((r) => r.transitions.length > 0).map((r) => r.moteur),
    moteursAvecAlerte: resultats.filter((r) => r.alertes.length > 0).map((r) => r.moteur),
    moteursAvecBlocage: resultats.filter((r) => Boolean(r.blocage)).map((r) => r.moteur),
    transitionsProposees: transitions.length,
    controles,
    controlesEnEchec: controles.filter((controle) => !controle.ok),
    blocagePrioritaire: selectionnerBlocagePrioritaire(resultats),
    alertes: uniquesTextes(resultats.flatMap((resultat) => resultat.alertes)),
    modeSortie: sorties.m01.modeSortie,
    autorisePoursuiteFiction: sorties.m01.autorisePoursuiteFiction,
  };
}

/**
 * Exécute les quinze responsabilités pour un tour, localement et sans LLM.
 *
 * Dépendances propagées automatiquement :
 * - M09 -> M03 : archétypes uniquement pour les champs individuels manquants ;
 * - M07 -> M06 : tentative minimale, sans inventer moyens/risques ;
 * - M13 -> M08 : périmètre de rendu réellement autorisé ;
 * - M07 + M13 -> M14 : tentatives et limites de résolution ;
 * - M02..M15 -> M01 : contributions compactes et transitions proposées.
 *
 * Tous les autres échanges doivent provenir du contexte ou de l'adaptateur.
 */
export function executerNarrativeKernelV21(
  entree: EntreeNarrativeKernelV21,
): SortieNarrativeKernelV21 {
  const { contexte } = entree;
  const options = entree.moteurs ?? {};

  const m02 = executerM02({ contexte, ...(options.m02 ?? {}) });
  const m15 = executerM15({ contexte, ...(options.m15 ?? {}) });
  const m13 = executerM13({ contexte, ...(options.m13 ?? {}) });

  // M07 identifie l'intention ; M06 vérifie ensuite la matérialité des tentatives.
  const m07 = executerM07({ contexte, ...(options.m07 ?? {}) });
  const m06 = executerM06({
    contexte,
    ...(options.m06 ?? {}),
    tentatives: options.m06?.tentatives ?? tentativesM06DepuisM07(m07),
  });

  const m09 = executerM09({ contexte, ...(options.m09 ?? {}) });
  const m10 = executerM10({ contexte, ...(options.m10 ?? {}) });
  const m03 = executerM03({
    contexte,
    ...(options.m03 ?? {}),
    archetypeIdsParPnj: fusionnerArchetypesM03(
      m09.archetypeIdsParPnj,
      options.m03?.archetypeIdsParPnj,
    ),
  });

  const m12 = executerM12({ contexte, ...(options.m12 ?? {}) });

  // Les facteurs M14 ne sont jamais inventés. Si l'adaptateur ne fournit pas
  // donnees, M14 marque les tentatives concernées comme information manquante.
  const m14 = executerM14({
    contexte,
    ...(options.m14 ?? {}),
    tentatives: options.m14?.tentatives ?? m07.tentativesAResoudre,
    donnees: options.m14?.donnees ?? [],
    perimetreM13: options.m14?.perimetreM13 ?? m13.perimetre,
  });

  const m05 = executerM05({ contexte, ...(options.m05 ?? {}) });
  const m04 = executerM04({ contexte, ...(options.m04 ?? {}) });
  const m11 = executerM11({ contexte, ...(options.m11 ?? {}) });
  const m08 = executerM08({
    contexte,
    ...(options.m08 ?? {}),
    perimetreM13: options.m08?.perimetreM13 ?? m13.perimetrePourM08,
  });

  const resultatsSpecialises: ResultatSpecialiseV21[] = [
    m02.resultat,
    m03.resultat,
    m04.resultat,
    m05.resultat,
    m06.resultat,
    m07.resultat,
    m08.resultat,
    m09.resultat,
    m10.resultat,
    m11.resultat,
    m12.resultat,
    m13.resultat,
    m14.resultat,
    m15.resultat,
  ];

  // M01 est exécuté en dernier : il assemble, mais ne recalcule aucun domaine.
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

  return {
    version: VERSION_NARRATIVE_KERNEL_V21,
    contrat: m01.contrat,
    moteurs,
    transitionsProposees,
    diagnostic: construireDiagnostic(moteurs, resultatsSpecialises, transitionsProposees),
  };
}
