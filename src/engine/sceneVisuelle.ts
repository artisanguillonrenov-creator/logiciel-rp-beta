import type { StoryState } from '../types';
import { varierCadrage } from './cadrageVisuel';
import {
  contratDepuisStructureHeritee,
  raceDuPersonnage,
  type ContratVisuel,
  type ExtractionMotsCles,
  type PersonnageContrat,
} from './contratVisuel';
import { negatifVisuelRace } from './racePnj';
import { textesNarratifsEtablis } from './extracteurVisuel';
import {
  appliquerChangementsVisuels,
  messageEtablissant,
  resoudrePersonnagesVisibles,
  type ChangementRejete,
  type ChangementVisuel,
  type EntreeJournalVisuel,
  type EtatVisuelHistoire,
  type ModeIllustration,
  type PersonnageVisibleResolu,
  type SceneIllustree,
} from './visualState';

/**
 * Étapes pures de l'illustration d'une scène (testables sans réseau) :
 * intégration des changements visuels établis, contrat d'une régénération,
 * enregistrement de la scène illustrée.
 */

/**
 * Applique les changements visuels proposés par l'extraction : chacun doit
 * citer le récit ; il est rattaché au message qui l'établit (journal) pour
 * pouvoir être retiré si ce message disparaît (édition, autre branche).
 */
export function integrerChangementsVisuels(
  story: StoryState,
  etatInitial: EtatVisuelHistoire,
  extraction: Pick<ExtractionMotsCles, 'changementsVisuels'>,
): { etat: EtatVisuelHistoire; acceptes: ChangementVisuel[]; rejetes: ChangementRejete[] } {
  const changements = extraction.changementsVisuels.map((c) => ({
    ...c,
    // Même résolveur que les personnages visibles : « Sylvana » et
    // « Sylvana Nocturne » visent la même entrée d'état visuel.
    nom: c.nom ? resoudrePersonnagesVisibles(story, [c.nom])[0]?.nom ?? c.nom : c.nom,
  }));
  const resultat = appliquerChangementsVisuels(
    etatInitial,
    changements,
    textesNarratifsEtablis(story, etatInitial.derniereAnalyseIndex),
    story.messages.length,
    (nom) => resoudrePersonnagesVisibles(story, [nom])[0]?.assetId,
  );
  const depuis = Math.max(0, Math.min(etatInitial.derniereAnalyseIndex, story.messages.length) - 10);
  const nouvelles: EntreeJournalVisuel[] = resultat.acceptes.map((changement) => {
    const source = messageEtablissant(story, changement.evenement, depuis);
    return { messageId: source?.id ?? 'fiche', messageIndex: source?.index ?? 0, changement };
  });
  const journalAvant = etatInitial.journal ?? [];
  const dernier = story.messages[story.messages.length - 1];
  return {
    etat: {
      ...resultat.etat,
      derniereAnalyseIndex: story.messages.length,
      derniereAnalyseMessageId: dernier?.id,
      journal: [...journalAvant, ...nouvelles],
      // L'état antérieur au journal (histoires commencées avant la V3) sert
      // de base quand il faut rejouer le journal sans un message disparu.
      base: etatInitial.base ?? (journalAvant.length ? undefined : { personnages: etatInitial.personnages, decor: etatInitial.decor }),
    },
    acceptes: resultat.acceptes,
    rejetes: resultat.rejetes,
  };
}

/** Relie les personnages d'un contrat (ancien ou récent) aux identités actuelles. */
export function reresoudrePersonnages(contrat: ContratVisuel, story: StoryState): ContratVisuel {
  const personnages = contrat.personnages.map((p): PersonnageContrat => {
    const resolu = resoudrePersonnagesVisibles(story, [p.nom])[0];
    if (!resolu || resolu.type === 'figurant') return p;
    return { ...p, nom: resolu.nom, type: resolu.type, assetId: resolu.assetId, principal: resolu.principal, cle: resolu.assetId ?? p.cle };
  });
  return { ...contrat, personnages };
}

export function negatifCanonDuContrat(contrat: ContratVisuel, story: StoryState): string[] {
  return contrat.personnages
    .map((p) => raceDuPersonnage(story, p))
    .filter((r): r is NonNullable<typeof r> => !!r)
    .map((r) => negatifVisuelRace(r))
    .filter(Boolean);
}

/**
 * Régénération : même contrat (personnages, identités, tenues, blessures,
 * lieu, action, objets) ; seule la prise de vue demandée change. Aucune
 * nouvelle extraction.
 */
export function contratRegeneration(scene: SceneIllustree, story: StoryState, mode: ModeIllustration): ContratVisuel {
  const base = scene.contrat ?? (scene.structure ? contratDepuisStructureHeritee(scene.structure) : null);
  if (!base) throw new Error('Cette scène ne contient pas de description réutilisable.');
  const contrat = reresoudrePersonnages(base, story);
  return { ...contrat, cadrage: varierCadrage(contrat.cadrage, contrat.typeScene, mode, scene.regenerations + 1) };
}

function versResolu(p: PersonnageContrat): PersonnageVisibleResolu {
  return { nom: p.nom, type: p.type === 'canon' ? 'figurant' : p.type, assetId: p.assetId, principal: p.principal };
}

export function nouvelleSceneIllustree(
  story: StoryState,
  revision: string,
  contrat: ContratVisuel,
  regenerations = 0,
): SceneIllustree {
  return {
    revision,
    messageIndex: story.messages.length,
    messageId: story.messages[story.messages.length - 1]?.id,
    creeLe: Date.now(),
    profil: contrat.typeScene,
    personnagesVisibles: contrat.personnages.map(versResolu),
    // Les rejets et la provenance détaillée restent au diagnostic : l'histoire
    // ne garde que ce qui sert à régénérer la scène.
    contrat: { ...contrat, rejets: [], provenance: contrat.provenance.slice(0, 1) },
    regenerations,
  };
}

/** Lieu représenté par une scène illustrée (pour la continuité de décor). */
export function lieuDeScene(scene: SceneIllustree): string | undefined {
  return scene.contrat?.lieu[0] ?? scene.structure?.decor?.lieu;
}

