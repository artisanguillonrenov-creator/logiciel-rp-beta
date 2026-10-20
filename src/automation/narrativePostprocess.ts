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
import { extrairePeriodiqueGroupe, extraireTourGroupe } from '../engine/extractionGroupee';

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

type ModeExtraction = NonNullable<DiagnosticEtape['mode']>;

export async function calculerRattrapageNarratif(
  story: StoryState,
  appSettings: AppSettings,
): Promise<NarrativeDerivedPatch | null> {
  const debutPostTraitement = Date.now();
  const etapesDiagnostic: DiagnosticEtape[] = [];
  const mesurer = async <T>(nom: string, mode: ModeExtraction, action: () => Promise<T>, raisonRepli?: string): Promise<T> => {
    const debut = Date.now();
    try {
      const resultat = await action();
      etapesDiagnostic.push({
        nom,
        categorie: 'post-traitement',
        statut: raisonRepli ? 'repli' : 'ok',
        dureeMs: Date.now() - debut,
        raison: raisonRepli,
        mode,
      });
      return resultat;
    } catch (erreur) {
      etapesDiagnostic.push({
        nom,
        categorie: 'post-traitement',
        statut: 'erreur',
        dureeMs: Date.now() - debut,
        raison: erreur instanceof Error ? erreur.message : 'Erreur inconnue',
        mode,
      });
      throw erreur;
    }
  };
  // Un bloc valide de l'appel groupé est appliqué tel quel ; sinon l'appel
  // séparé du module prend le relais, si bien qu'aucun état n'est perdu.
  const executer = <B, T>(nom: string, bloc: B | null | undefined, appliquer: (bloc?: B) => Promise<T>, raisonRepli?: string) =>
    bloc !== null && bloc !== undefined
      ? mesurer(nom, 'groupé', () => appliquer(bloc))
      : mesurer(nom, 'séparé', () => appliquer(undefined), raisonRepli);
  const appelGroupe = async <B>(nom: string, action: () => Promise<B | null>): Promise<B | null> => {
    const debut = Date.now();
    try {
      const blocs = await action();
      etapesDiagnostic.push({
        nom,
        categorie: 'post-traitement',
        statut: blocs ? 'ok' : 'repli',
        dureeMs: Date.now() - debut,
        raison: blocs ? undefined : 'Réponse groupée inexploitable : appels séparés.',
        mode: 'groupé',
      });
      return blocs;
    } catch (erreur) {
      etapesDiagnostic.push({
        nom,
        categorie: 'post-traitement',
        statut: 'repli',
        dureeMs: Date.now() - debut,
        raison: `${erreur instanceof Error ? erreur.message : 'Appel groupé impossible'} : appels séparés.`,
        mode: 'groupé',
      });
      return null;
    }
  };
  const raisonRepli = (groupeTente: boolean, blocs: object | null) => {
    if (!groupeTente) return undefined;
    return blocs ? 'Bloc groupé absent ou invalide : repli sur l’appel séparé.' : 'Appel groupé échoué : repli sur l’appel séparé.';
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

  const groupee = appSettings.extractionGroupee !== false;
  const messagesSecurises = messagesPourProfil(story.messages, appSettings);
  const personnageNom = filtrerTextePourProfil(story.meta.personnageNom, appSettings.profilContenu) || 'Personnage';
  const paquet = paquetMonde(mondeIdDe(story.meta));
  const capitales = donneesMonde(mondeIdDe(story.meta)).capitales;
  const depuisIndex = story.memoire.dernierMessageIndexMaj;

  const periodicPromise = periodicDue
    ? (async () => {
        const blocs = groupee
          ? await appelGroupe('Extraction groupée — périodique', () => extrairePeriodiqueGroupe({
              appSettings,
              storyId: story.meta.id,
              messages: messagesSecurises,
              depuisIndex,
              personnageNom,
              memoire: story.memoire,
              directeur: story.directeur,
              monde: story.monde,
              social: story.social,
              chapitres: paquet.chapitres,
            }))
          : null;
        const repli = raisonRepli(groupee, blocs);
        return Promise.all([
          executer('Mémoire L0-L5', blocs?.memoire, (extraction) => mettreAJourMemoire({
            appSettings,
            storyId: story.meta.id,
            memoireActuelle: story.memoire,
            messages: messagesSecurises,
            personnageNom,
          }, extraction), repli),
          executer('Directeur narratif', blocs?.directeur, (analyse) => mettreAJourDirecteur({
            appSettings,
            storyId: story.meta.id,
            directeurActuel: story.directeur,
            messages: messagesSecurises,
            depuisIndex,
          }, analyse), repli),
          executer('Simulation du monde', blocs?.monde, (appels) => mettreAJourMonde({
            appSettings,
            storyId: story.meta.id,
            mondeActuel: story.monde,
            chapitres: paquet.chapitres,
            messages: messagesSecurises,
            depuisIndex,
          }, appels), repli),
          executer('Social / engagements', blocs?.social, (appels) => mettreAJourSocial({
            appSettings,
            storyId: story.meta.id,
            socialActuel: story.social,
            messages: messagesSecurises,
            depuisIndex,
          }, appels), repli),
        ] as const);
      })()
    : null;

  const sceneActuelle = lireEtatScene(story, capitales);
  // L'appel « tour » ne regroupe que lorsque les deux analyses sont dues et
  // que l'extrait du lore couvre les nouveaux messages de la scène ; sinon
  // l'état de scène garde son appel dédié, comme avant.
  const tourGroupe = groupee && sceneDue && loreDue && sceneActuelle.majMessageIndex >= loreDepuisIndex;
  const tourPromise = tourGroupe
    ? appelGroupe('Extraction groupée — tour', () => extraireTourGroupe({
        appSettings,
        storyId: story.meta.id,
        messages: messagesSecurises,
        loreDepuisIndex,
        personnageNom,
        loreExistant: story.loreEmergent,
        nomMonde: paquet.nomPourExtractionLore,
        sceneActuelle,
        capitales,
      }))
    : Promise.resolve(null);

  const lorePromise = loreDue
    ? tourPromise.then((blocs) => executer('Lore émergent', blocs?.lore, (candidats) => mettreAJourLoreEmergent({
        appSettings,
        storyId: story.meta.id,
        existants: story.loreEmergent,
        messages: messagesSecurises,
        depuisIndex: loreDepuisIndex,
        personnageNom,
        nomMonde: paquet.nomPourExtractionLore,
      }, candidats), raisonRepli(tourGroupe, blocs)))
    : null;

  // État de scène (ville, lieu, présents, temps écoulé) : à chaque tour,
  // en parallèle et sans retarder l'affichage.
  const scenePromise = sceneDue
    ? tourPromise.then((blocs) => executer('État de scène', blocs?.scene, async (releve) => releve ?? releverEtatScene({
        appSettings,
        storyId: story.meta.id,
        actuel: sceneActuelle,
        messages: messagesSecurises,
        capitales,
        personnageNom,
      }), raisonRepli(tourGroupe, blocs))).catch(() => null)
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
