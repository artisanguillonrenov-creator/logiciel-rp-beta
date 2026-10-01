// Elyndor — Noyau narratif natif V2.1
// M02 — Continuité.
//
// M02 conserve l'histoire applicable : événements validés, états connus,
// provenance, rectifications et lacunes. Il ne recalcule jamais le sens des
// transitions appartenant à M03–M15 ; il mémorise et restitue leur résultat.

import type { ContributionSceneM01 } from './m01-production';
import type {
  BlocageNarratif,
  ContexteNarratifV21,
  ControleNarratif,
  DomaineEtatNarratif,
  EvenementNarratif,
  IdMoteurNarratif,
  PropositionTransition,
  ResultatMoteur,
} from './types';

export const MOTEUR_M02 = 'M02' as const;

export type TypeConflitFactuelM02 =
  | 'contradiction'
  | 'lacune'
  | 'branche_incompatible'
  | 'ordre_ambigu';

/**
 * État fourni à M02 par le moteur propriétaire de son domaine.
 * M02 le conserve ; il n'en redéfinit ni les règles ni la sémantique.
 */
export interface EtatInstantaneM02 {
  cle: string;
  domaine: DomaineEtatNarratif;
  proprietaire: IdMoteurNarratif;
  valeur: unknown;
  ordre: number;
  momentFictif?: string;
  sourceIds: string[];
  actif?: boolean;
}

export interface InstantaneContinuiteM02 {
  id: string;
  histoireId: string;
  varianteId?: string;
  ordre: number;
  momentFictif?: string;
  etats: EtatInstantaneM02[];
}

/**
 * Recherche ciblée d'antécédents. Elle évite de recharger tout le dialogue
 * lorsqu'un sous-ensemble de sources suffit à restaurer la continuité.
 */
export interface DemandeRecuperationM02 {
  id: string;
  termes?: string[];
  entiteIds?: string[];
  evenementIds?: string[];
  cleEtats?: string[];
  maxSouvenirs?: number;
  critiquePourIssue?: boolean;
  questionClarification?: string;
}

/**
 * Rectification déjà autorisée par le noyau. M02 enregistre sa portée dans la
 * chronologie ; il ne fabrique pas lui-même l'autorisation ni les effets d'un
 * autre domaine.
 */
export interface AmendementAutoriseM02 {
  id: string;
  cleEtat: string;
  domaine: DomaineEtatNarratif;
  proprietaire: IdMoteurNarratif;
  nouvelleValeur: unknown;
  justification: string;
  sourceIds: string[];
  portee: string;
  ordre?: number;
  momentFictif?: string;
  retroactif?: boolean;
  dependances?: string[];
}

export interface EntreeM02 {
  contexte: ContexteNarratifV21;
  evenementsValides?: EvenementNarratif[];
  instantanes?: InstantaneContinuiteM02[];
  heureFictive?: string;
  demandesRecuperation?: DemandeRecuperationM02[];
  amendementsAutorises?: AmendementAutoriseM02[];
}

export interface EtatCourantM02 extends EtatInstantaneM02 {
  instantaneId: string;
  amendeParId?: string;
}

export interface SouvenirPertinentM02 {
  evenement: EvenementNarratif;
  score: number;
  raisons: string[];
}

export interface ConflitFactuelM02 {
  id: string;
  type: TypeConflitFactuelM02;
  description: string;
  cleEtat?: string;
  evenementId?: string;
  sourceIds: string[];
  critique: boolean;
}

export interface SortieM02 {
  moteur: typeof MOTEUR_M02;
  resultat: ResultatMoteur<ContributionSceneM01>;
  chronologie: EvenementNarratif[];
  etatCourant: EtatCourantM02[];
  souvenirsPertinents: SouvenirPertinentM02[];
  conflitsFactuels: ConflitFactuelM02[];
  heureFictive?: string;
  alertes: string[];
}

interface EvenementOrdonne {
  evenement: EvenementNarratif;
  indexOriginal: number;
  messageIndex?: number;
}

interface EtatSelectionne {
  etat: EtatCourantM02;
  score: number;
}

function texte(valeur: unknown): string {
  return String(valeur ?? '').trim();
}

function normaliser(valeur: unknown): string {
  return texte(valeur)
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function jetons(valeur: unknown): Set<string> {
  return new Set(
    normaliser(valeur)
      .split(' ')
      .filter((mot) => mot.length >= 3),
  );
}

function uniquesTextes(valeurs: Iterable<string>): string[] {
  const resultat: string[] = [];
  const vus = new Set<string>();

  for (const valeur of valeurs) {
    const propre = valeur.trim();
    if (!propre) continue;
    const cle = normaliser(propre);
    if (!cle || vus.has(cle)) continue;
    vus.add(cle);
    resultat.push(propre);
  }

  return resultat;
}

function uniquesParCle<T>(valeurs: Iterable<T>, cle: (valeur: T) => string): T[] {
  const resultat: T[] = [];
  const vus = new Set<string>();

  for (const valeur of valeurs) {
    const id = cle(valeur);
    if (vus.has(id)) continue;
    vus.add(id);
    resultat.push(valeur);
  }

  return resultat;
}

function serialiserStable(valeur: unknown): string {
  if (valeur === null || typeof valeur !== 'object') return JSON.stringify(valeur);
  if (Array.isArray(valeur)) return `[${valeur.map(serialiserStable).join(',')}]`;

  const objet = valeur as Record<string, unknown>;
  const entrees = Object.keys(objet)
    .sort()
    .map((cle) => `${JSON.stringify(cle)}:${serialiserStable(objet[cle])}`);
  return `{${entrees.join(',')}}`;
}

function messageIndexEvenement(evenement: EvenementNarratif): number | undefined {
  const indices = evenement.sources
    .map((source) => source.messageIndex)
    .filter((index): index is number => typeof index === 'number' && Number.isFinite(index));

  if (indices.length === 0) return undefined;
  return Math.max(...indices);
}

function empreinteEvenement(evenement: EvenementNarratif): string {
  return serialiserStable({
    resume: evenement.resume,
    acteurs: [...evenement.acteurs].sort(),
    cibles: [...(evenement.cibles ?? [])].sort(),
    lieu: evenement.lieu ?? '',
    tempsFictif: evenement.tempsFictif ?? '',
    causes: [...(evenement.causes ?? [])].sort(),
    categorie: evenement.categorie ?? '',
    canonique: evenement.canonique,
  });
}

function construireChronologie(
  evenements: EvenementNarratif[],
): { chronologie: EvenementNarratif[]; conflits: ConflitFactuelM02[] } {
  const parId = new Map<string, EvenementNarratif>();
  const ordrePremiereOccurrence = new Map<string, number>();
  const conflits: ConflitFactuelM02[] = [];

  evenements.forEach((evenement, index) => {
    if (!evenement.canonique) return;

    const precedent = parId.get(evenement.id);
    if (!precedent) {
      parId.set(evenement.id, evenement);
      ordrePremiereOccurrence.set(evenement.id, index);
      return;
    }

    if (empreinteEvenement(precedent) !== empreinteEvenement(evenement)) {
      conflits.push({
        id: `m02-event-${evenement.id}`,
        type: 'contradiction',
        evenementId: evenement.id,
        description: `Deux versions canoniques incompatibles portent l'identifiant ${evenement.id}.`,
        sourceIds: uniquesTextes([
          ...precedent.sources.map((source) => source.id),
          ...evenement.sources.map((source) => source.id),
        ]),
        critique: true,
      });
    }
  });

  const ordonnes: EvenementOrdonne[] = [...parId.values()].map((evenement) => ({
    evenement,
    indexOriginal: ordrePremiereOccurrence.get(evenement.id) ?? 0,
    messageIndex: messageIndexEvenement(evenement),
  }));

  ordonnes.sort((a, b) => {
    if (a.messageIndex !== undefined && b.messageIndex !== undefined) {
      if (a.messageIndex !== b.messageIndex) return a.messageIndex - b.messageIndex;
    }
    return a.indexOriginal - b.indexOriginal;
  });

  return {
    chronologie: ordonnes.map((element) => element.evenement),
    conflits,
  };
}

function instantaneCompatible(
  contexte: ContexteNarratifV21,
  instantane: InstantaneContinuiteM02,
): boolean {
  if (instantane.histoireId !== contexte.cadre.histoireId) return false;

  const varianteCourante = contexte.cadre.varianteId ?? '';
  const varianteInstantane = instantane.varianteId ?? '';
  return varianteCourante === varianteInstantane;
}

function construireEtatCourant(
  contexte: ContexteNarratifV21,
  instantanes: InstantaneContinuiteM02[],
): { etats: EtatCourantM02[]; conflits: ConflitFactuelM02[]; alertes: string[] } {
  const compatibles = instantanes
    .filter((instantane) => instantaneCompatible(contexte, instantane))
    .sort((a, b) => a.ordre - b.ordre);
  const incompatibles = instantanes.filter((instantane) => !instantaneCompatible(contexte, instantane));
  const courant = new Map<string, EtatCourantM02>();
  const conflits: ConflitFactuelM02[] = [];
  const alertes = incompatibles.map(
    (instantane) =>
      `Instantané ${instantane.id} ignoré : il appartient à une autre histoire ou variante.`,
  );

  for (const instantane of compatibles) {
    for (const etat of instantane.etats) {
      const precedent = courant.get(etat.cle);

      if (
        precedent &&
        precedent.ordre === etat.ordre &&
        serialiserStable(precedent.valeur) !== serialiserStable(etat.valeur)
      ) {
        conflits.push({
          id: `m02-state-${normaliser(etat.cle)}-${etat.ordre}`,
          type: 'ordre_ambigu',
          cleEtat: etat.cle,
          description: `Deux états incompatibles de même ordre existent pour ${etat.cle}.`,
          sourceIds: uniquesTextes([...precedent.sourceIds, ...etat.sourceIds]),
          critique: true,
        });
        continue;
      }

      if (!precedent || etat.ordre >= precedent.ordre) {
        courant.set(etat.cle, {
          ...etat,
          instantaneId: instantane.id,
          momentFictif: etat.momentFictif ?? instantane.momentFictif,
        });
      }
    }
  }

  return { etats: [...courant.values()], conflits, alertes };
}

function appliquerAmendements(
  etats: EtatCourantM02[],
  amendements: AmendementAutoriseM02[],
): { etats: EtatCourantM02[]; transitions: PropositionTransition[]; alertes: string[] } {
  const courant = new Map(etats.map((etat) => [etat.cle, { ...etat }] as const));
  const transitions: PropositionTransition[] = [];
  const alertes: string[] = [];

  for (const amendement of amendements) {
    const precedent = courant.get(amendement.cleEtat);
    const ordre = amendement.ordre ?? (precedent?.ordre ?? 0) + 1;

    if (precedent && amendement.proprietaire !== precedent.proprietaire) {
      alertes.push(
        `Rectification ${amendement.id} : propriétaire ${amendement.proprietaire} différent de l'état conservé ${precedent.proprietaire}.`,
      );
    }

    courant.set(amendement.cleEtat, {
      cle: amendement.cleEtat,
      domaine: amendement.domaine,
      proprietaire: amendement.proprietaire,
      valeur: amendement.nouvelleValeur,
      ordre,
      momentFictif: amendement.momentFictif ?? precedent?.momentFictif,
      sourceIds: uniquesTextes([...amendement.sourceIds, ...(precedent?.sourceIds ?? [])]),
      actif: precedent?.actif ?? true,
      instantaneId: precedent?.instantaneId ?? `rectification:${amendement.id}`,
      amendeParId: amendement.id,
    });

    transitions.push({
      id: `m02-rectification-${amendement.id}`,
      moteurProprietaire: MOTEUR_M02,
      domaine: 'chronologie',
      cibleIds: [amendement.cleEtat],
      justification: amendement.justification,
      sourceIds: amendement.sourceIds,
      valeurProposee: {
        type: 'rectification_ciblee',
        cleEtat: amendement.cleEtat,
        domaine: amendement.domaine,
        proprietaire: amendement.proprietaire,
        nouvelleValeur: amendement.nouvelleValeur,
        portee: amendement.portee,
        retroactif: amendement.retroactif === true,
        dependances: amendement.dependances ?? [],
        momentFictif: amendement.momentFictif,
      },
      perceptible: false,
      transmissible: false,
    });
  }

  return { etats: [...courant.values()], transitions, alertes };
}

function corpusEvenement(evenement: EvenementNarratif): string {
  return [
    evenement.resume,
    evenement.lieu ?? '',
    ...evenement.acteurs,
    ...(evenement.cibles ?? []),
    ...(evenement.causes ?? []),
  ].join(' ');
}

function termesImplicites(contexte: ContexteNarratifV21): string[] {
  return uniquesTextes([
    contexte.scene.lieu ?? '',
    contexte.scene.enjeu ?? '',
    ...contexte.scene.participants,
    contexte.cadre.initiativeJoueur,
  ]);
}

function scorerEvenement(
  evenement: EvenementNarratif,
  demande: DemandeRecuperationM02 | undefined,
  termesScene: string[],
): { score: number; raisons: string[] } {
  let score = 0;
  const raisons: string[] = [];
  const corpus = normaliser(corpusEvenement(evenement));
  const tokensCorpus = jetons(corpus);

  if (demande?.evenementIds?.includes(evenement.id)) {
    score += 100;
    raisons.push('événement explicitement demandé');
  }

  for (const entiteId of demande?.entiteIds ?? []) {
    const cible = normaliser(entiteId);
    const entites = [...evenement.acteurs, ...(evenement.cibles ?? [])].map(normaliser);
    if (cible && entites.includes(cible)) {
      score += 25;
      raisons.push(`entité demandée : ${entiteId}`);
    }
  }

  const termes = [...(demande?.termes ?? []), ...termesScene];
  for (const terme of termes) {
    const tokensTerme = jetons(terme);
    if (tokensTerme.size === 0) continue;
    let communs = 0;
    for (const token of tokensTerme) if (tokensCorpus.has(token)) communs += 1;
    if (communs > 0) {
      score += communs * 3;
      raisons.push(`correspondance : ${terme}`);
    }
  }

  return { score, raisons: uniquesTextes(raisons) };
}

function selectionnerSouvenirs(
  contexte: ContexteNarratifV21,
  chronologie: EvenementNarratif[],
  demandes: DemandeRecuperationM02[],
): SouvenirPertinentM02[] {
  const termesScene = termesImplicites(contexte);
  const demandesEffectives = demandes.length > 0 ? demandes : [undefined];
  const selection: SouvenirPertinentM02[] = [];

  for (const demande of demandesEffectives) {
    const max = Math.max(1, Math.min(30, demande?.maxSouvenirs ?? 8));
    const scores = chronologie
      .map((evenement) => {
        const resultat = scorerEvenement(evenement, demande, termesScene);
        return { evenement, ...resultat };
      })
      .filter((element) => element.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, max);

    if (scores.length === 0 && !demande) {
      for (const evenement of chronologie.slice(-max)) {
        selection.push({
          evenement,
          score: 1,
          raisons: ['antécédent récent du contexte déjà sélectionné'],
        });
      }
    } else {
      selection.push(...scores);
    }
  }

  return uniquesParCle(selection, (souvenir) => souvenir.evenement.id).sort((a, b) => b.score - a.score);
}

function detecterLacunes(
  chronologie: EvenementNarratif[],
  etats: EtatCourantM02[],
  demandes: DemandeRecuperationM02[],
): ConflitFactuelM02[] {
  const idsEvenements = new Set(chronologie.map((evenement) => evenement.id));
  const clesEtats = new Set(etats.map((etat) => etat.cle));
  const conflits: ConflitFactuelM02[] = [];

  for (const demande of demandes) {
    for (const evenementId of demande.evenementIds ?? []) {
      if (idsEvenements.has(evenementId)) continue;
      conflits.push({
        id: `m02-gap-event-${demande.id}-${evenementId}`,
        type: 'lacune',
        evenementId,
        description: `L'événement demandé ${evenementId} n'est pas disponible dans les sources récupérées.`,
        sourceIds: [],
        critique: demande.critiquePourIssue === true,
      });
    }

    for (const cleEtat of demande.cleEtats ?? []) {
      if (clesEtats.has(cleEtat)) continue;
      conflits.push({
        id: `m02-gap-state-${demande.id}-${normaliser(cleEtat)}`,
        type: 'lacune',
        cleEtat,
        description: `Aucun état fiable n'est disponible pour ${cleEtat}.`,
        sourceIds: [],
        critique: demande.critiquePourIssue === true,
      });
    }
  }

  return conflits;
}

function scoreEtat(etat: EtatCourantM02, contexte: ContexteNarratifV21, demandes: DemandeRecuperationM02[]): number {
  if (etat.actif === false) return 0;
  let score = 0;
  const corpus = `${etat.cle} ${etat.domaine} ${serialiserStable(etat.valeur)}`;
  const tokens = jetons(corpus);

  for (const demande of demandes) {
    if (demande.cleEtats?.includes(etat.cle)) score += 100;
    for (const terme of [...(demande.termes ?? []), ...(demande.entiteIds ?? [])]) {
      for (const token of jetons(terme)) if (tokens.has(token)) score += 4;
    }
  }

  for (const terme of termesImplicites(contexte)) {
    for (const token of jetons(terme)) if (tokens.has(token)) score += 1;
  }

  return score;
}

function selectionnerEtatsUtiles(
  contexte: ContexteNarratifV21,
  etats: EtatCourantM02[],
  demandes: DemandeRecuperationM02[],
): EtatSelectionne[] {
  const scores = etats
    .map((etat) => ({ etat, score: scoreEtat(etat, contexte, demandes) }))
    .filter((element) => element.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  if (scores.length > 0 || demandes.length > 0) return scores;

  return etats
    .filter((etat) => etat.actif !== false)
    .sort((a, b) => b.ordre - a.ordre)
    .slice(0, 8)
    .map((etat) => ({ etat, score: 1 }));
}

function contrainteEtat(etat: EtatCourantM02): string {
  const moment = etat.momentFictif ? ` (${etat.momentFictif})` : '';
  return `Continuité — ${etat.cle}${moment} : ${serialiserStable(etat.valeur)}`;
}

function blocageDepuisConflits(
  conflits: ConflitFactuelM02[],
  demandes: DemandeRecuperationM02[],
): BlocageNarratif | undefined {
  const critique = conflits.find((conflit) => conflit.critique);
  if (!critique) return undefined;

  const demande = demandes.find((candidate) => candidate.critiquePourIssue === true);
  return {
    type: critique.type === 'lacune' ? 'information_manquante' : 'contradiction',
    raison: critique.description,
    questionClarification:
      demande?.questionClarification ??
      (critique.type === 'lacune'
        ? 'Peux-tu préciser uniquement l’élément manquant qui conditionne cette issue ?'
        : undefined),
  };
}

function controleContinuite(conflits: ConflitFactuelM02[]): ControleNarratif {
  const critiques = conflits.filter((conflit) => conflit.critique);
  return critiques.length === 0
    ? { id: 'continuite', ok: true }
    : {
        id: 'continuite',
        ok: false,
        raison: critiques.map((conflit) => conflit.description).join(' | '),
      };
}

function contributionPourM01(
  souvenirs: SouvenirPertinentM02[],
  etatsUtiles: EtatSelectionne[],
  controle: ControleNarratif,
): ContributionSceneM01 {
  return {
    faits: souvenirs.map((souvenir) => ({
      id: souvenir.evenement.id,
      contenu: souvenir.evenement.resume,
      sources: souvenir.evenement.sources,
      prioritaire: souvenir.score >= 25,
    })),
    contraintes: etatsUtiles.map(({ etat }) => contrainteEtat(etat)),
    controles: [controle],
  };
}

/**
 * Exécute M02 sans appel de modèle et sans modifier les stockages de la partie.
 *
 * Les événements canoniques sont conservés, les instantanés sont réduits au
 * dernier état fiable par clé, les recherches restent ciblées et une lacune
 * n'est jamais transformée en souvenir inventé. Les rectifications autorisées
 * deviennent des transitions de chronologie à valider/persister par le Kernel.
 */
export function executerM02(entree: EntreeM02): SortieM02 {
  const { contexte } = entree;
  const evenements = entree.evenementsValides ?? contexte.evenementsPertinents;
  const instantanes = entree.instantanes ?? [];
  const demandes = entree.demandesRecuperation ?? [];
  const amendements = entree.amendementsAutorises ?? [];

  const historique = construireChronologie(evenements);
  const etatInitial = construireEtatCourant(contexte, instantanes);
  const rectifications = appliquerAmendements(etatInitial.etats, amendements);
  const lacunes = detecterLacunes(historique.chronologie, rectifications.etats, demandes);
  const conflitsFactuels = [
    ...historique.conflits,
    ...etatInitial.conflits,
    ...lacunes,
  ];

  const souvenirsPertinents = selectionnerSouvenirs(contexte, historique.chronologie, demandes);
  const etatsUtiles = selectionnerEtatsUtiles(contexte, rectifications.etats, demandes);
  const controle = controleContinuite(conflitsFactuels);
  const blocage = blocageDepuisConflits(conflitsFactuels, demandes);
  const alertes = uniquesTextes([
    ...etatInitial.alertes,
    ...rectifications.alertes,
    ...conflitsFactuels
      .filter((conflit) => !conflit.critique)
      .map((conflit) => conflit.description),
  ]);

  const resultat: ResultatMoteur<ContributionSceneM01> = {
    moteur: MOTEUR_M02,
    contribution: contributionPourM01(souvenirsPertinents, etatsUtiles, controle),
    transitions: rectifications.transitions,
    contraintes: [],
    alertes,
    blocage,
  };

  return {
    moteur: MOTEUR_M02,
    resultat,
    chronologie: historique.chronologie,
    etatCourant: rectifications.etats,
    souvenirsPertinents,
    conflitsFactuels,
    heureFictive: entree.heureFictive ?? contexte.scene.momentFictif,
    alertes,
  };
}
