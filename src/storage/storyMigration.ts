import type { StoryState } from '../types';
import { VERSION_SCHEMA_HISTOIRE } from '../types';

// Compatibilité de sauvegarde d'une version à l'autre (esprit de
// l'auto-updater du brief Phase 2) : une histoire sauvegardée par une
// version antérieure de l'app est mise à niveau au chargement plutôt que
// de casser ou de perdre les données du joueur.
export function migrerHistoire(data: any): StoryState {
  if (!data?.meta?.id || !Array.isArray(data.messages) || data.version > VERSION_SCHEMA_HISTOIRE) {
    throw new Error('Sauvegarde invalide ou issue d’une version plus récente.');
  }
  let migree = data;
  if (!migree.version || migree.version < 2) {
    // v1 -> v2 : les faits de mémoire gagnent niveau/dernierAcces (mémoire
    // L0-L5). Un fait déjà là est considéré "canon" (actif) par défaut.
    migree = {
      ...migree,
      version: 2,
      memoire: {
        ...migree.memoire,
        faits: (migree.memoire?.faits ?? []).map((f: any) => ({
          ...f,
          niveau: f.niveau ?? 'canon',
          dernierAcces: f.dernierAcces ?? migree.memoire?.dernierMessageIndexMaj ?? 0,
        })),
      },
    };
  }
  if (migree.version < 3) {
    // v2 -> v3 : ajout du pool de lore émergent (PNJ récurrents, lieux,
    // factions, objets, événements marquants créés en cours de partie).
    migree = { ...migree, version: 3, loreEmergent: migree.loreEmergent ?? [] };
  }
  if (migree.version < 4) {
    // v3 -> v4 : curseurs violence/romance (contrôle d'âge, brief Phase 2).
    migree = {
      ...migree,
      version: 4,
      settings: {
        ...migree.settings,
        violence: migree.settings?.violence ?? 'modere',
        romance: migree.settings?.romance ?? 'modere',
      },
    };
  }
  if (migree.version < 5) {
    // v4 -> v5 : panneau Contexte de l'Histoire (lieu, ambiance, date,
    // objectifs — brief Phase 2). Vide par défaut pour une histoire créée
    // avant l'étape "Histoire" du nouveau parcours.
    migree = {
      ...migree,
      version: 5,
      meta: {
        ...migree.meta,
        contexte: migree.meta?.contexte ?? { lieu: '', ambiance: '', dateChronique: '', objectifs: '' },
      },
    };
  }
  if (migree.version < 6) {
    // v5 -> v6 : Story Director / Scene Director (arc, tension, beats de
    // foreshadowing en attente de payoff — brief Phase 2). Repart neutre
    // pour une histoire déjà en cours, le curseur de stagnation s'aligne
    // dès la première mise à jour du directeur.
    migree = {
      ...migree,
      version: 6,
      directeur: migree.directeur ?? {
        arcActuel: '',
        tension: 'calme',
        dernierBeatIndex: migree.messages?.length ?? 0,
        beats: [],
      },
    };
  }
  if (migree.version < 7) {
    // v6 -> v7 : World Simulation + State Machine (zones, flags, compteurs,
    // déclencheurs — brief Phase 2). Monde vide par défaut, se peuple au
    // fil des mises à jour périodiques suivantes.
    migree = {
      ...migree,
      version: 7,
      monde: migree.monde ?? { zones: [], flags: {}, compteurs: {}, declencheurs: [] },
    };
  }
  if (migree.version < 8) {
    // v7 -> v8 : engagements (promesses/dettes/contrats) et relations
    // sociales multi-axes — brief Phase 2. Vide par défaut.
    migree = {
      ...migree,
      version: 8,
      social: migree.social ?? { engagements: [], relations: [] },
    };
  }
  if (migree.version < 9) {
    // v8 -> v9 : Préférences narratives étendues (ton, humour, liberté du
    // joueur, rythme) — écran Préférences enrichi. Valeurs neutres par
    // défaut pour une histoire créée avant cet ajout.
    migree = {
      ...migree,
      version: 9,
      settings: {
        ...migree.settings,
        ton: migree.settings?.ton ?? 'sombre_realiste',
        humour: migree.settings?.humour ?? 'faible',
        liberteJoueur: migree.settings?.liberteJoueur ?? 'elevee',
        rythme: migree.settings?.rythme ?? 'normal',
      },
    };
  }
  return { ...migree, version: VERSION_SCHEMA_HISTOIRE };
}
