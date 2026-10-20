import type { AppSettings, DiagnosticEtape, DiagnosticPostTraitement, Message, StoryState } from '../types';
import { doitMettreAJourMemoire, mettreAJourMemoire } from '../engine/memory';
import { mettreAJourDirecteur } from '../engine/storyDirector';
import { mettreAJourMonde } from '../engine/worldSimulation';
import { mettreAJourSocial } from '../engine/socialDynamics';
import { mettreAJourLoreEmergent } from '../engine/emergentLore';
import { consoliderRegistrePnj } from '../engine/registrePnj';
import { filtrerTextePourProfil } from '../engine/contenuAdulte';
import { mondeIdDe, paquetMonde } from '../mondes';
import { donneesMonde } from '../mondes/donnees';
import { lireEtatScene, releverEtatScene } from '../engine/etatScene';

/**
 * Post-traitement narratif pur (sans le noyau d'automatismes) : calcule
 * l'état dérivé d'une histoire après un tour. narrativeRoutines.ts
 * l'enregistre comme routine story.postprocess.
 */
export type NarrativeDerivedPatch = Pick<
  StoryState,
  'memoire' | 'directeur' | 'monde' | 'social' | 'loreEmergent' | 'loreEmergentDernierIndex' | 'scene' | 'pnjLorebook'
> & { diagnosticPostTraitement?: DiagnosticPostTraitement; minutesEcoulees?: number };

/** Écart minimal, en messages, entre deux relevés du lore émergent. */
export const INTERVALLE_LORE_EMERGENT = 3;

export function loreEmergentDu(story: StoryState): boolean {
  return story.messages.length - (story.loreEmergentDernierIndex ?? 0) >= INTERVALLE_LORE_EMERGENT;
}

/**
 * L'état de scène pilote ville, lieu, présents et horloge : il est relevé
 * dès qu'un nouveau message existe, indépendamment de la cadence du lore.
 */
export function etatSceneDu(story: StoryState): boolean {
  return (story.scene?.majMessageIndex ?? 0) < story.messages.length;
}

export function besoinRattrapageNarratif(story: StoryState): boolean {
  return (
    doitMettreAJourMemoire(story.messages, story.memoire.dernierMessageIndexMaj) ||
    loreEmergentDu(story) ||
    // Une histoire jamais relevée (scène absente) ne déclenche pas à elle
    // seule un rattrapage au démarrage : le prochain tour s'en charge.
    (!!story.scene && etatSceneDu(story))
  );
}

function messagesPourProfil(messages: Message[], appSettings: AppSettings): Message[] {
  if (appSettings.profilContenu === 'adulte') return messages;
  return messages.map((message) => ({
    ...message,
    content: filtrerTextePourProfil(message.content, appSettings.profilContenu)
      || '[Contenu antérieur masqué par le profil Grand public.]',
  }));
}

export async function calculerRattrapageNarratif(
  story: StoryState,
  appSettings: AppSettings,
): Promise<NarrativeDerivedPatch | null> {
  const debutPostTraitement = Date.now();
  const etapesDiagnostic: DiagnosticEtape[] = [];
  const mesurer = async <T>(nom: string, action: () => Promise<T>): Promise<T> => {
    const debut = Date.now();
    try {
      const resultat = await action();
      etapesDiagnostic.push({ nom, categorie: 'post-traitement', statut: 'ok', dureeMs: Date.now() - debut });
      return resultat;
    } catch (erreur) {
      etapesDiagnostic.push({
        nom,
        categorie: 'post-traitement',
        statut: 'erreur',
        dureeMs: Date.now() - debut,
        raison: erreur instanceof Error ? erreur.message : 'Erreur inconnue',
      });
      throw erreur;
    }
  };

  const periodicDue = doitMettreAJourMemoire(story.messages, story.memoire.dernierMessageIndexMaj);
  const loreDepuisIndex = story.loreEmergentDernierIndex ?? 0;
  const loreDue = loreEmergentDu(story);
  const sceneDue = etatSceneDu(story);
  if (!periodicDue && !loreDue && !sceneDue) return null;

  let memoire = story.memoire;
  let directeur = story.directeur;
  let monde = story.monde;
  let social = story.social;
  let loreEmergent = story.loreEmergent;
  let loreEmergentDernierIndex = loreDepuisIndex;

  const messagesSecurises = messagesPourProfil(story.messages, appSettings);
  const personnageNom = filtrerTextePourProfil(story.meta.personnageNom, appSettings.profilContenu) || 'Personnage';

  const periodicPromise = periodicDue
    ? Promise.all([
        mesurer('Mémoire L0-L5', () => mettreAJourMemoire({
          appSettings,
          storyId: story.meta.id,
          memoireActuelle: story.memoire,
          messages: messagesSecurises,
          personnageNom,
        })),
        mesurer('Directeur narratif', () => mettreAJourDirecteur({
          appSettings,
          storyId: story.meta.id,
          directeurActuel: story.directeur,
          messages: messagesSecurises,
          depuisIndex: story.memoire.dernierMessageIndexMaj,
        })),
        mesurer('Simulation du monde', () => mettreAJourMonde({
          appSettings,
          storyId: story.meta.id,
          mondeActuel: story.monde,
          chapitres: paquetMonde(mondeIdDe(story.meta)).chapitres,
          messages: messagesSecurises,
          depuisIndex: story.memoire.dernierMessageIndexMaj,
        })),
        mesurer('Social / engagements', () => mettreAJourSocial({
          appSettings,
          storyId: story.meta.id,
          socialActuel: story.social,
          messages: messagesSecurises,
          depuisIndex: story.memoire.dernierMessageIndexMaj,
        })),
      ])
    : null;

  const lorePromise = loreDue
    ? mesurer('Lore émergent', () => mettreAJourLoreEmergent({
        appSettings,
        storyId: story.meta.id,
        existants: story.loreEmergent,
        messages: messagesSecurises,
        depuisIndex: loreDepuisIndex,
        personnageNom,
        nomMonde: paquetMonde(mondeIdDe(story.meta)).nomPourExtractionLore,
      }))
    : null;

  // État de scène (ville, lieu, présents, temps écoulé) : à chaque tour,
  // en parallèle et sans retarder l'affichage.
  const scenePromise = sceneDue
    ? mesurer('État de scène', () => releverEtatScene({
        appSettings,
        storyId: story.meta.id,
        actuel: lireEtatScene(story, donneesMonde(mondeIdDe(story.meta)).capitales),
        messages: messagesSecurises,
        capitales: donneesMonde(mondeIdDe(story.meta)).capitales,
        personnageNom,
      })).catch(() => null)
    : null;

  if (!periodicDue) {
    const raison = `Cadence non atteinte : ${story.messages.length - story.memoire.dernierMessageIndexMaj}/8 messages depuis la dernière mise à jour.`;
    for (const nom of ['Mémoire L0-L5', 'Directeur narratif', 'Simulation du monde', 'Social / engagements']) {
      etapesDiagnostic.push({ nom, categorie: 'post-traitement', statut: 'ignoree', dureeMs: 0, raison });
    }
  }
  if (!loreDue) {
    const ecart = story.messages.length - loreDepuisIndex;
    etapesDiagnostic.push({
      nom: 'Lore émergent',
      categorie: 'post-traitement',
      statut: 'ignoree',
      dureeMs: 0,
      raison: ecart > 0
        ? `Cadence non atteinte : ${ecart}/${INTERVALLE_LORE_EMERGENT} messages depuis le dernier relevé du lore émergent.`
        : 'Aucun nouveau message à analyser.',
    });
  }
  if (!sceneDue) {
    etapesDiagnostic.push({ nom: 'État de scène', categorie: 'post-traitement', statut: 'ignoree', dureeMs: 0, raison: 'Aucun nouveau message à analyser.' });
  }

  if (periodicPromise) {
    [memoire, directeur, monde, social] = await periodicPromise;
  }
  if (lorePromise) {
    loreEmergent = await lorePromise;
    loreEmergentDernierIndex = story.messages.length;
  }
  const releve = scenePromise ? await scenePromise : null;

  return {
    memoire,
    directeur,
    monde,
    social,
    loreEmergent,
    loreEmergentDernierIndex,
    pnjLorebook: consoliderRegistrePnj({ ...story, loreEmergent, scene: releve?.scene ?? story.scene }),
    scene: releve?.scene ?? story.scene,
    minutesEcoulees: releve?.minutesEcoulees,
    diagnosticPostTraitement: {
      dureeTotaleMs: Date.now() - debutPostTraitement,
      etapes: etapesDiagnostic,
    },
  };
}

