import type { AppSettings, StoryState } from '../types';
import { ELYNDOR_CLOUD_MODELE, ELYNDOR_CLOUD_MODELE_EMBEDDINGS, podElyndorCloud } from './elyndorCloud';
import { ELYNDOR_CLOUD_MODELE_IMAGE } from './elyndorCloudImages';
import type { EntreeJournal } from './journalDiagnostic';

// Export « Diagnostic » : un seul fichier JSON avec tout ce qu'il faut pour
// analyser une partie sans supposition — l'histoire complète telle qu'elle est
// enregistrée (messages, diagnostic de chaque tour, mémoire, PNJ, état
// visuel…), le journal détaillé (prompts envoyés, réponses brutes, images) et
// la version exacte de l'app et des modèles.

export interface InfosApplication {
  version?: string | null;
  runtimeVersion?: string | null;
  updateId?: string | null;
  miseAJourDu?: string | null;
  canal?: string | null;
  plateforme: string;
}

const CLE_SENSIBLE = /(api.?key|token|secret|password|mot.?de.?passe)/i;

/** Réglages sans aucune valeur sensible (les clés héritées sont déjà vidées, ceinture et bretelles). */
export function reglagesSansSecrets(settings: AppSettings): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(settings as unknown as Record<string, unknown>).filter(([cle]) => !CLE_SENSIBLE.test(cle)),
  );
}

export function construireExportDiagnostic(params: {
  story: StoryState;
  settings: AppSettings;
  journal: EntreeJournal[];
  application: InfosApplication;
  maintenant?: Date;
}): Record<string, unknown> {
  const { story, settings, journal, application } = params;
  const tours = story.messages.filter((m) => m.role === 'assistant');
  return {
    format: 'elyndor-diagnostic',
    version: 1,
    exporteLe: (params.maintenant ?? new Date()).toISOString(),
    application,
    elyndorCloud: {
      pod: podElyndorCloud(),
      modeleNarration: ELYNDOR_CLOUD_MODELE,
      modeleImage: ELYNDOR_CLOUD_MODELE_IMAGE,
      modeleEmbeddings: ELYNDOR_CLOUD_MODELE_EMBEDDINGS,
    },
    resume: {
      messages: story.messages.length,
      reponsesNarrateur: tours.length,
      toursAvecDiagnostic: tours.filter((m) => m.diagnosticTour).length,
      entreesJournal: journal.length,
      appelsIAJournalises: journal.filter((e) => e.type === 'appel-ia').length,
      imagesJournalisees: journal.filter((e) => e.type === 'image').length,
      erreursJournalisees: journal.filter((e) => e.statut === 'erreur' || e.type === 'erreur').length,
      // Le journal ne couvre que les parties jouées depuis son ajout, et
      // garde les entrées les plus récentes au-delà de 8 Mo.
      debutJournal: journal[0]?.date ?? null,
    },
    reglages: reglagesSansSecrets(settings),
    histoire: story,
    journal,
  };
}
