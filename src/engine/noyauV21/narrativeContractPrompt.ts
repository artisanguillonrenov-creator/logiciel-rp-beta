// Elyndor — Noyau narratif natif V2.1
// Projection compacte du NarrativeContract vers le prompt du modèle.
//
// Ce module n'ajoute aucune règle et ne modifie aucun état. Il transforme
// uniquement les décisions déjà prises par le Kernel en consignes lisibles
// pour l'interprète narratif, en conservant la séparation entre faits,
// savoirs, limites, résolution et rendu.

import type { ModeSortieM01 } from './m01-production';
import type { NarrativeContractV21 } from './narrativeContract';

function propre(valeur: unknown): string {
  return String(valeur ?? '').replace(/\s+/g, ' ').trim();
}

function tronquer(texte: string, max: number): string {
  const propreTexte = propre(texte);
  if (propreTexte.length <= max) return propreTexte;
  return `${propreTexte.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
}

function ajouterListe(
  lignes: string[],
  titre: string,
  valeurs: string[],
  maxItems: number,
  maxParItem = 320,
): void {
  const propres = valeurs.map(propre).filter(Boolean).slice(0, maxItems);
  if (!propres.length) return;
  lignes.push(`${titre}:`);
  for (const valeur of propres) lignes.push(`- ${tronquer(valeur, maxParItem)}`);
}

function libelleMode(mode: ModeSortieM01): string {
  switch (mode) {
    case 'hors_fiction': return 'réponse hors fiction';
    case 'clarification': return 'clarification ciblée';
    case 'suspendue': return 'fiction suspendue';
    default: return 'scène narrative';
  }
}

function formaterProfil(contrat: NarrativeContractV21): string {
  const profil = contrat.rendu.profil;
  return [
    `mode=${profil.mode}`,
    profil.ton ? `ton=${profil.ton}` : '',
    `violence=${profil.violence}`,
    `romance=${profil.romance}`,
    profil.crudite ? `crudité=${profil.crudite}` : '',
    profil.detail ? `détail=${profil.detail}` : '',
    profil.longueur ? `longueur=${profil.longueur}` : '',
    profil.rythme ? `rythme=${profil.rythme}` : '',
    profil.creativite ? `créativité=${profil.creativite}` : '',
    profil.humour ? `humour=${profil.humour}` : '',
  ].filter(Boolean).join(' · ');
}

/**
 * Rend le contrat du tour suffisamment compact pour être injecté une seule
 * fois avant l'appel modèle. Les transitions proposées et diagnostics internes
 * ne sont volontairement pas envoyés au narrateur : ils restent côté noyau.
 */
export function formaterNarrativeContractV21(
  contrat: NarrativeContractV21,
  modeSortie: ModeSortieM01,
): string {
  const lignes: string[] = [
    '[NARRATIVE KERNEL V2.1 — CONTRAT DU TOUR]',
    'Ce bloc provient du noyau applicatif et fait autorité pour cette réponse. Mets-le en scène sans réciter ses mécanismes.',
    `Mode de sortie : ${libelleMode(modeSortie)}.`,
    `Initiative du joueur : ${tronquer(contrat.initiativeJoueur, 700) || 'aucune initiative exploitable'}`,
  ];

  const scene = contrat.scene;
  const sceneResume = [
    scene.lieu ? `lieu=${scene.lieu}` : '',
    scene.momentFictif ? `moment=${scene.momentFictif}` : '',
    scene.enjeu ? `enjeu=${scene.enjeu}` : '',
    scene.ambiance ? `ambiance=${scene.ambiance}` : '',
    scene.participants.length ? `participants=${scene.participants.join(', ')}` : '',
  ].filter(Boolean).join(' · ');
  if (sceneResume) lignes.push(`Scène : ${tronquer(sceneResume, 900)}`);

  ajouterListe(
    lignes,
    'Faits décisifs déjà établis',
    contrat.faitsDecisifs.map((fait) => fait.contenu),
    10,
    360,
  );

  ajouterListe(
    lignes,
    'Savoirs situés — ne pas les transférer à un autre acteur sans transmission',
    contrat.savoirsSitues.map(
      (savoir) => `${savoir.acteurId} [${savoir.statut}] ${savoir.contenu}`,
    ),
    12,
    360,
  );

  ajouterListe(
    lignes,
    'Intentions PNJ préparées — pas des résultats garantis',
    contrat.intentionsPnj.map(
      (intention) => `${intention.acteurId}: ${intention.intention}`,
    ),
    8,
    320,
  );

  ajouterListe(
    lignes,
    'Résolutions déjà déterminées',
    contrat.resolutions.map(
      (resolution) => `${resolution.etat}: ${resolution.resume}`,
    ),
    8,
    360,
  );

  ajouterListe(
    lignes,
    'Contraintes applicables',
    contrat.contraintesApplicables,
    18,
    340,
  );

  ajouterListe(
    lignes,
    'Limites actives',
    contrat.limites.map(
      (limite) =>
        `${limite.theme}: ${limite.autorisee ? 'autorisé' : 'non autorisé'} · portée=${limite.portee}` +
        `${limite.intensite ? ` · intensité=${limite.intensite}` : ''}` +
        `${limite.signalActuel ? ` · signal=${limite.signalActuel}` : ''}`,
    ),
    8,
    320,
  );

  lignes.push(`Profil de rendu : ${formaterProfil(contrat)}.`);
  ajouterListe(lignes, 'Directives de rendu', contrat.rendu.directives, 12, 320);
  ajouterListe(lignes, 'Dimensions de rendu actives', contrat.rendu.dimensionsActives, 10, 180);

  ajouterListe(
    lignes,
    'À montrer dans la réponse',
    contrat.miseEnScene.pointsAMontrer,
    12,
    340,
  );
  ajouterListe(
    lignes,
    'Interdits narratifs pour ce tour',
    contrat.miseEnScene.interditsNarratifs,
    14,
    340,
  );
  ajouterListe(
    lignes,
    'Décisions qui restent au joueur',
    contrat.miseEnScene.choixReservesAuJoueur.map((choix) => choix.description),
    8,
    320,
  );

  if (contrat.blocage) {
    lignes.push(`Blocage : ${tronquer(contrat.blocage.raison, 520)}`);
  }
  if (contrat.clarification) {
    lignes.push(`Clarification à demander : ${tronquer(contrat.clarification.question, 520)}`);
    lignes.push('Ne poursuis pas la résolution litigieuse avant cette clarification.');
  }

  if (modeSortie === 'hors_fiction') {
    lignes.push('Réponds hors fiction à la demande présente ; ne transforme pas cet échange en événement du monde.');
  } else if (modeSortie === 'suspendue') {
    lignes.push('La fiction est suspendue pour ce tour : n’ajoute aucun nouvel événement fictif pour contourner le blocage.');
  } else if (modeSortie === 'clarification') {
    lignes.push('Pose uniquement la clarification utile, sans inventer l’issue manquante.');
  }

  return lignes.join('\n');
}
