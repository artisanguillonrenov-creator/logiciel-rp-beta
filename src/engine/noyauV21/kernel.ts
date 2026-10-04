// Elyndor — Noyau narratif natif V2.1
// Orchestrateur local du Narrative Behavior Kernel.
//
// Ce module ne contacte aucun modèle. Il coordonne les quinze responsabilités
// M01 à M15 sur un même ContexteNarratifV21 puis remet à M01 leurs contributions
// afin de produire un NarrativeContractV21 compact pour un seul tour.
//
// Aucune transition n'est persistée ici : les sorties des moteurs restent des
// propositions jusqu'à validation explicite par la couche d'intégration.

import { executerM01, type SortieM01 } from './m01-production';
import { executerM02, type EntreeM02, type SortieM02 } from './m02-continuite';
import { executerM03, type EntreeM03, type SortieM03 } from './m03-esprit-personnages';
import { executerM04, type EntreeM04, type SortieM04 } from './m04-dynamiques-sociales';
import { executerM05, type EntreeM05, type SortieM05 } from './m05-engagements-institutions';
import { executerM06, type EntreeM06, type SortieM06 } from './m06-lois-monde-scene';
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
  ContexteNarratifV21,
  ControleNarratif,
  IdMoteurNarratif,
  PropositionTransition,
  ResultatMoteur,
} from './types';
import type { ContributionSceneM01 } from './m01-production';

export const VERSION_KERNEL_V21 = '2.1' as const;

/**
 * Paramètres spécialisés facultatifs préparés par l'adaptateur applicatif.
 * Le contexte commun n'est jamais dupliqué : Kernel l'injecte lui-même.
 */
export interface EntreesMoteursKernelV21 {
  m02?: Omit<EntreeM02, 'contexte'>;
  m03?: Omit<EntreeM03, 'contexte'>;
  m04?: Omit<EntreeM04, 'contexte'>;
  m05?: Omit<EntreeM05, 'contexte'>;
  m06?: Omit<EntreeM06, 'contexte'>;
  m07?: Omit<EntreeM07, 'contexte'>;
  m08?: Omit<EntreeM08, 'contexte'>;
  m09?: Omit<EntreeM09, 'contexte'>;
  m10?: Omit<EntreeM10, 'contexte'>;
  m11?: Omit<EntreeM11, 'contexte'>;
  m12?: Omit<EntreeM12, 'contexte'>;
  m13?: Omit<EntreeM13, 'contexte'>;
  m14?: Omit<EntreeM14, 'contexte'>;
  m15?: Omit<EntreeM15, 'contexte'>;
}

export interface EntreeKernelV21 {
  contexte: ContexteNarratifV21;
  moteurs?: EntreesMoteursKernelV21;
  controlesSupplementaires?: ControleNarratif[];
}

export interface SortiesMoteursKernelV21 {
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

export interface DiagnosticKernelV21 {
  version: typeof VERSION_KERNEL_V21;
  moteursExecutes: IdMoteurNarratif[];
  moteursContributeurs: IdMoteurNarratif[];
  nombreTransitionsProposees: number;
  nombreControles: number;
  nombreAlertes: number;
  bloque: boolean;
  modeSortie: SortieM01['modeSortie'];
}

export interface SortieKernelV21 {
  version: typeof VERSION_KERNEL_V21;
  contrat: NarrativeContractV21;
  coordination: SortieM01;
  moteurs: SortiesMoteursKernelV21;
  transitionsProposees: PropositionTransition[];
  alertes: string[];
  diagnostic: DiagnosticKernelV21;
}

function uniquesTextes(valeurs: Iterable<string>): string[] {
  const resultat: string[] = [];
  const vus = new Set<string>();

  for (const valeur of valeurs) {
    const texte = String(valeur ?? '').trim();
    if (!texte) continue;
    const cle = texte.toLocaleLowerCase('fr');
    if (vus.has(cle)) continue;
    vus.add(cle);
    resultat.push(texte);
  }

  return resultat;
}

function uniquesTransitions(valeurs: Iterable<PropositionTransition>): PropositionTransition[] {
  const resultat: PropositionTransition[] = [];
  const vus = new Set<string>();

  for (const transition of valeurs) {
    if (!transition?.id || vus.has(transition.id)) continue;
    vus.add(transition.id);
    resultat.push(transition);
  }

  return resultat;
}

function resultatsSpecialises(sorties: SortiesMoteursKernelV21): ResultatMoteur<ContributionSceneM01>[] {
  return [
    sorties.m02.resultat,
    sorties.m03.resultat,
    sorties.m04.resultat,
    sorties.m05.resultat,
    sorties.m06.resultat,
    sorties.m07.resultat,
    sorties.m08.resultat,
    sorties.m09.resultat,
    sorties.m10.resultat,
    sorties.m11.resultat,
    sorties.m12.resultat,
    sorties.m13.resultat,
    sorties.m14.resultat,
    sorties.m15.resultat,
  ];
}

/**
 * Exécute localement un tour du noyau V2.1.
 *
 * Ordre choisi :
 * - M02 établit d'abord la continuité disponible ;
 * - M13/M07/M06 cadrent limites, agentivité et possibilités ;
 * - M15/M09/M10 préparent savoirs et repères ;
 * - M03/M04/M05/M12/M14/M11/M08 produisent leurs contributions spécialisées ;
 * - M01 assemble enfin le NarrativeContract.
 *
 * Cet ordre n'est pas une hiérarchie de vérité. Chaque moteur reste propriétaire
 * de son domaine et M01 ne fait qu'assembler les résultats du tour.
 */
export function executerKernelV21(entree: EntreeKernelV21): SortieKernelV21 {
  const { contexte } = entree;
  const parametres = entree.moteurs ?? {};

  const m02 = executerM02({ contexte, ...(parametres.m02 ?? {}) });
  const m13 = executerM13({ contexte, ...(parametres.m13 ?? {}) });
  const m07 = executerM07({ contexte, ...(parametres.m07 ?? {}) });
  const m06 = executerM06({ contexte, ...(parametres.m06 ?? {}) });
  const m15 = executerM15({ contexte, ...(parametres.m15 ?? {}) });
  const m09 = executerM09({ contexte, ...(parametres.m09 ?? {}) });
  const m10 = executerM10({ contexte, ...(parametres.m10 ?? {}) });

  // M09 ne remplace jamais M03. Lorsque l'appelant n'a pas fourni sa propre
  // sélection d'archétypes, la sortie de M09 sert seulement à remplir les
  // champs encore indéfinis de M03.
  const m03 = executerM03({
    contexte,
    ...(parametres.m03 ?? {}),
    archetypeIdsParPnj:
      parametres.m03?.archetypeIdsParPnj ?? m09.archetypeIdsParPnj,
  });

  const m04 = executerM04({ contexte, ...(parametres.m04 ?? {}) });
  const m05 = executerM05({ contexte, ...(parametres.m05 ?? {}) });
  const m12 = executerM12({ contexte, ...(parametres.m12 ?? {}) });
  const m14 = executerM14({
    contexte,
    tentatives: parametres.m14?.tentatives ?? [],
    donnees: parametres.m14?.donnees ?? [],
    perimetreM13: parametres.m14?.perimetreM13,
  });
  const m11 = executerM11({ contexte, ...(parametres.m11 ?? {}) });
  const m08 = executerM08({ contexte, ...(parametres.m08 ?? {}) });

  const moteurs: SortiesMoteursKernelV21 = {
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

  const resultats = resultatsSpecialises(moteurs);
  const coordination = executerM01({
    contexte,
    contributions: resultats,
    controlesSupplementaires: entree.controlesSupplementaires,
  });

  const transitionsProposees = uniquesTransitions([
    ...resultats.flatMap((resultat) => resultat.transitions),
    ...coordination.contrat.transitionsProposees,
  ]);

  const alertes = uniquesTextes([
    ...resultats.flatMap((resultat) => resultat.alertes),
    ...coordination.alertes,
  ]);

  const moteursExecutes: IdMoteurNarratif[] = [
    'M02',
    'M13',
    'M07',
    'M06',
    'M15',
    'M09',
    'M10',
    'M03',
    'M04',
    'M05',
    'M12',
    'M14',
    'M11',
    'M08',
    'M01',
  ];

  return {
    version: VERSION_KERNEL_V21,
    contrat: coordination.contrat,
    coordination,
    moteurs,
    transitionsProposees,
    alertes,
    diagnostic: {
      version: VERSION_KERNEL_V21,
      moteursExecutes,
      moteursContributeurs: coordination.contrat.moteursContributeurs,
      nombreTransitionsProposees: transitionsProposees.length,
      nombreControles: coordination.contrat.controles.length,
      nombreAlertes: alertes.length,
      bloque: coordination.contrat.blocage !== undefined,
      modeSortie: coordination.modeSortie,
    },
  };
}
