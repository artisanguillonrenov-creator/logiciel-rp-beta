import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppSettings, Persona, Plugin, StoryMeta, StoryState } from '../types';
import { VERSION_SCHEMA_HISTOIRE } from '../types';
import { viderCacheEmbeddings } from './embeddingsStore';

// Levée quand la sauvegarde d'une histoire échoue faute de place (quota de
// stockage du navigateur dépassé) même après tentative de libération
// d'espace — voir ecrireAvecRetraitSurQuota. Contrairement au cache
// d'embeddings (pure optimisation, un échec d'écriture y est avalé sans
// bruit), une histoire est une vraie donnée du joueur : l'appelant doit
// savoir que la sauvegarde n'a pas eu lieu plutôt que de croire à tort que
// tout est enregistré.
export class ErreurStockage extends Error {}

// Écrit dans AsyncStorage ; si le quota est dépassé, libère de la place en
// vidant le cache d'embeddings (jamais de donnée du joueur, uniquement des
// vecteurs recalculables — voir embeddingsStore.ts) puis retente une seule
// fois avant d'abandonner. Cas réel observé le 3 sept. : une histoire assez
// longue (53 messages, contenu explicite) faisait à elle seule dépasser le
// quota, avec l'échec d'écriture jusqu'ici non rattrapé.
async function ecrireAvecRetraitSurQuota(cle: string, valeur: string): Promise<void> {
  try {
    await AsyncStorage.setItem(cle, valeur);
  } catch {
    try {
      await viderCacheEmbeddings();
      await AsyncStorage.setItem(cle, valeur);
    } catch {
      throw new ErreurStockage(
        "Le stockage de ton navigateur est plein : cette réponse s'affiche mais n'a pas pu être sauvegardée. Supprime ou exporte une ancienne histoire (menu des histoires) avant de continuer, sinon ce dernier échange sera perdu si tu quittes ou recharges la page.",
      );
    }
  }
}

const KEYS = {
  settings: '@rp_beta/settings',
  storiesIndex: '@rp_beta/stories_index',
  story: (id: string) => `@rp_beta/story/${id}`,
  personas: '@rp_beta/personas',
  plugins: '@rp_beta/plugins',
  catalogueTraduction: (langue: string) => `@rp_beta/i18n/${langue}`,
};

const DEFAULT_SETTINGS: AppSettings = {
  openRouterApiKey: '',
  model: 'anthropic/claude-sonnet-4.5',
  // Grand public par défaut (fail-safe) : sans ce champ, tout le filtrage de
  // contenu (validerEntreeUtilisateur, validerProfilContenuHeuristique,
  // plafonnerCurseurs...) traite l'absence de choix comme équivalente à
  // "adulte" (aucune restriction) — voir contenuAdulte.ts, tous ces contrôles
  // testent `!== 'grand_public'`. Un appareil qui n'a jamais explicitement
  // choisi son profil démarre donc désormais filtré, pas grand ouvert ; ça
  // ne change rien pour un profil déjà sauvegardé explicitement (le spread
  // dans getSettings ne touche que les installs neuves/non déclarées).
  profilContenu: 'grand_public',
};

export async function getSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(KEYS.settings);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.settings, JSON.stringify(settings));
}

export async function getStoriesIndex(): Promise<StoryMeta[]> {
  const raw = await AsyncStorage.getItem(KEYS.storiesIndex);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveStoriesIndex(index: StoryMeta[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.storiesIndex, JSON.stringify(index));
}

// Compatibilité de sauvegarde d'une version à l'autre (esprit de
// l'auto-updater du brief Phase 2) : une histoire sauvegardée par une
// version antérieure de l'app est mise à niveau au chargement plutôt que
// de casser ou de perdre les données du joueur.
function migrerHistoire(data: any): StoryState {
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

export async function getStory(id: string): Promise<StoryState | null> {
  const raw = await AsyncStorage.getItem(KEYS.story(id));
  if (!raw) return null;
  try {
    return migrerHistoire(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function saveStory(story: StoryState): Promise<void> {
  story.meta.updatedAt = Date.now();
  await ecrireAvecRetraitSurQuota(KEYS.story(story.meta.id), JSON.stringify(story));
  const index = await getStoriesIndex();
  const existingPos = index.findIndex((m) => m.id === story.meta.id);
  if (existingPos >= 0) {
    index[existingPos] = story.meta;
  } else {
    index.push(story.meta);
  }
  await saveStoriesIndex(index);
}

export async function deleteStory(id: string): Promise<void> {
  await AsyncStorage.removeItem(KEYS.story(id));
  const index = await getStoriesIndex();
  await saveStoriesIndex(index.filter((m) => m.id !== id));
}

// Renomme l'entrée "Charger Conversation" sans la faire remonter en tête
// de liste : contrairement à saveStory, ne touche pas updatedAt (renommer
// n'est pas "reprendre la partie").
export async function renommerStory(id: string, titre: string): Promise<void> {
  const story = await getStory(id);
  if (!story) return;
  const storyMaj: StoryState = { ...story, meta: { ...story.meta, titre: titre.trim() || undefined } };
  await ecrireAvecRetraitSurQuota(KEYS.story(id), JSON.stringify(storyMaj));
  const index = await getStoriesIndex();
  const pos = index.findIndex((m) => m.id === id);
  if (pos >= 0) {
    index[pos] = storyMaj.meta;
    await saveStoriesIndex(index);
  }
}

// Bibliothèque de personas (brief Phase 2) : réutiliser {{user}} d'une
// histoire à l'autre sans ressaisir nom/description à chaque création.
export async function getPersonas(): Promise<Persona[]> {
  const raw = await AsyncStorage.getItem(KEYS.personas);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function savePersona(persona: Persona): Promise<void> {
  const personas = await getPersonas();
  const existingPos = personas.findIndex((p) => p.id === persona.id);
  if (existingPos >= 0) {
    personas[existingPos] = persona;
  } else {
    personas.push(persona);
  }
  await AsyncStorage.setItem(KEYS.personas, JSON.stringify(personas));
}

export async function deletePersona(id: string): Promise<void> {
  const personas = await getPersonas();
  await AsyncStorage.setItem(KEYS.personas, JSON.stringify(personas.filter((p) => p.id !== id)));
}

// Packs de contenu / plugins "esprit" (brief Phase 2) : rejoignent le pool
// de lore sélectionnable — voir convertirPluginsPourSelection dans
// src/engine/plugins.ts.
export async function getPlugins(): Promise<Plugin[]> {
  const raw = await AsyncStorage.getItem(KEYS.plugins);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function installerPlugin(plugin: Plugin): Promise<void> {
  const plugins = await getPlugins();
  plugins.push(plugin);
  await AsyncStorage.setItem(KEYS.plugins, JSON.stringify(plugins));
}

export async function supprimerPlugin(id: string): Promise<void> {
  const plugins = await getPlugins();
  await AsyncStorage.setItem(KEYS.plugins, JSON.stringify(plugins.filter((p) => p.id !== id)));
}

// Sélecteur de langue (Ajouts_A_Integrer.md) : catalogue de traductions
// texte-source (français) → texte traduit, un par langue, construit à la
// volée par lot au fil de l'utilisation (voir src/i18n/traduction.ts) et
// mis en cache ici pour ne jamais retraduire deux fois la même chaîne sur
// un même appareil.
export async function getCatalogueTraduction(langue: string): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(KEYS.catalogueTraduction(langue));
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function fusionnerCatalogueTraduction(langue: string, ajout: Record<string, string>): Promise<void> {
  const existant = await getCatalogueTraduction(langue);
  await AsyncStorage.setItem(KEYS.catalogueTraduction(langue), JSON.stringify({ ...existant, ...ajout }));
}
