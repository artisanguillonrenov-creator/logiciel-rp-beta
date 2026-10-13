import type { AppSettings, StoryState } from '../types';
import { calculerRevisionNarrative } from '../automation/storyRevision';
import { lireReglagesVisuels } from '../concepteur/reglagesVisuelsStore';
import { consoliderContratScene, type ContratVisuel } from './contratVisuel';
import { extraireMotsClesScene, extractionDeRepli, texteDerniereScene, type ResultatExtraction } from './extracteurVisuel';
import { construireContexteNarrateurPourIllustration } from './generateTurn';
import { collecterCandidatsScene } from './images';
import type { ReferenceCandidate, TraceIllustration } from './moteurVisuel';
import {
  contratRegeneration,
  integrerChangementsVisuels,
  negatifCanonDuContrat,
  nouvelleSceneIllustree,
} from './sceneVisuelle';
import {
  lireEtatVisuel,
  projeterEtatVisuel,
  type EtatVisuelHistoire,
  type ModeIllustration,
  type SceneIllustree,
} from './visualState';

/**
 * Préparation d'une illustration de scène, PARTAGÉE par le jeu et par
 * l'aperçu de scène de l'Atelier : même extraction, même consolidation par le
 * canon, même collecte de références. Rien n'est enregistré ici.
 */
export interface ScenePreparee {
  revision: string;
  contrat: ContratVisuel;
  negatifCanon: string[];
  /** État visuel à enregistrer avec l'image (inchangé pour une régénération). */
  etat: EtatVisuelHistoire;
  scene: SceneIllustree;
  candidats: ReferenceCandidate[];
  extraction?: TraceIllustration['extraction'];
  regeneration: boolean;
}

/**
 * modele : relevé par le narrateur (un appel) ; repli : relevé local sans IA ;
 * auto : réutilise la scène déjà illustrée de cette révision si elle existe,
 * sinon relevé local (aperçu sans appel IA implicite).
 */
export type SourceExtraction = 'modele' | 'repli' | 'auto';

export async function preparerScene(
  story: StoryState,
  settings: AppSettings,
  mode: ModeIllustration,
  options: { extraction?: SourceExtraction; signal?: AbortSignal } = {},
): Promise<ScenePreparee> {
  const revision = calculerRevisionNarrative(story);
  const etatInitial = projeterEtatVisuel(lireEtatVisuel(story), story);
  const existante = etatInitial.scenesIllustrees.find((s) => s.revision === revision);
  const precedentes = etatInitial.scenesIllustrees.filter((s) => s.revision !== revision);
  const source = options.extraction ?? 'modele';

  if (existante && (mode !== 'nouvelle' || source === 'auto')) {
    const contrat = contratRegeneration(existante, story, mode === 'nouvelle' ? 'regenerer' : mode);
    return {
      revision,
      contrat,
      negatifCanon: negatifCanonDuContrat(contrat, story),
      etat: etatInitial,
      scene: { ...existante, contrat, profil: contrat.typeScene, regenerations: existante.regenerations + 1, creeLe: Date.now() },
      candidats: await collecterCandidatsScene(story, contrat, precedentes),
      regeneration: true,
    };
  }

  let resultat: ResultatExtraction;
  if (source === 'modele') {
    const reglages = await lireReglagesVisuels();
    // Même contexte que pour répondre au joueur ; sans lui (lore ou
    // embeddings indisponibles), l'extraction garde son contexte propre.
    const contexteNarrateur = await construireContexteNarrateurPourIllustration(story, settings).catch(() => undefined);
    resultat = await extraireMotsClesScene(story, settings, etatInitial, {
      contexteNarrateur, consigne: reglages.consigneExtraction, signal: options.signal,
    });
  } else {
    resultat = { extraction: extractionDeRepli(story), parModele: false, rejets: [], erreur: 'Relevé local (aucun appel au narrateur).' };
  }
  const { etat, rejetes } = integrerChangementsVisuels(story, etatInitial, resultat.extraction);
  const { contrat, negatifCanon } = consoliderContratScene({
    story,
    extraction: resultat.extraction,
    etat,
    texteScene: texteDerniereScene(story),
    parModele: resultat.parModele,
    rejetsExtraction: [...resultat.rejets, ...rejetes.map((r) => `changement « ${r.changement.champ} » de ${r.changement.nom ?? 'décor'} refusé : ${r.raison}`)],
  });
  return {
    revision,
    contrat,
    negatifCanon,
    etat,
    scene: nouvelleSceneIllustree(story, revision, contrat),
    candidats: await collecterCandidatsScene(story, contrat, precedentes),
    extraction: { parModele: resultat.parModele, brute: resultat.brute, erreur: resultat.erreur, rejets: resultat.rejets },
    regeneration: false,
  };
}
