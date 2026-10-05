import type { EntreeLoreEmergent, StoryState } from '../types';
import type { PromptImageStructure, ProfilCadrage } from './visualBible';

// État visuel persistant V2 (refonte du système d'illustration) : la seule
// source de vérité sur l'apparence COURANTE des personnages, le décor courant
// et les deux dernières scènes illustrées d'une histoire. Il est stocké dans
// StoryState.etatVisuel (donc migré, sauvegardé et synchronisé avec
// l'histoire) ; les fichiers image eux-mêmes restent dans sceneImagesStore et
// pnjAvatarsStore, indexés par révision / identifiant.
//
// Règle de canon : cet état n'est jamais réinventé à chaque génération. Il ne
// change que par des ChangementVisuel justifiés par un événement narratif
// effectivement présent dans le texte (voir appliquerChangementsVisuels).

export const VERSION_ETAT_VISUEL = 1;
export const MAX_SCENES_ILLUSTREES = 2;
const MAX_ELEMENTS_LISTE = 8;
const MAX_LONGUEUR_VALEUR = 160;

export const ID_ASSET_JOUEUR = '__joueur__';

export interface EtatVisuelPersonnage {
  /** Nom normalisé : clé stable de l'entrée. */
  cle: string;
  nom: string;
  /** '__joueur__' ou id du PNJ dans le lore émergent ; absent pour un figurant. */
  assetId?: string;
  tenue: string;
  armure: string;
  coiffure: string;
  proprete: string;
  armesVisibles: string[];
  accessoires: string[];
  blessures: string[];
  cicatrices: string[];
  salissures: string[];
  transformations: string[];
  objetsPortes: string[];
  /** Index (StoryState.messages) du dernier changement accepté. */
  majAuMessage: number;
}

export interface EtatVisuelDecor {
  lieu: string;
  typeLieu: string;
  architecture: string;
  disposition: string;
  heure: string;
  meteo: string;
  lumiere: string;
  sourcesLumineuses: string[];
  degats: string[];
  incendies: string[];
  ouvertures: string[];
  objetsImportants: string[];
  mobilier: string[];
  traces: string[];
  majAuMessage: number;
}

export interface PersonnageVisibleResolu {
  nom: string;
  type: 'joueur' | 'pnj' | 'figurant';
  assetId?: string;
  /** PNJ « permanent » du lore émergent : prioritaire pour les références. */
  principal: boolean;
}

export type ModeIllustration = 'nouvelle' | 'regenerer' | 'autre-cadrage' | 'autre-angle' | 'autre-composition';

export interface SceneIllustree {
  revision: string;
  messageIndex: number;
  creeLe: number;
  profil: ProfilCadrage;
  personnagesVisibles: PersonnageVisibleResolu[];
  /** Canon visuel de la scène : réutilisé tel quel par une régénération. */
  structure: PromptImageStructure;
  regenerations: number;
}

export interface EtatVisuelHistoire {
  version: number;
  /** Compteur monotone : sert à ne jamais écraser un état plus récent. */
  sequence: number;
  personnages: EtatVisuelPersonnage[];
  decor: EtatVisuelDecor | null;
  /** Au plus MAX_SCENES_ILLUSTREES, de la plus ancienne à la plus récente. */
  scenesIllustrees: SceneIllustree[];
  /** Nombre de messages déjà analysés par la direction artistique. */
  derniereAnalyseIndex: number;
}

export function etatVisuelVide(): EtatVisuelHistoire {
  return {
    version: VERSION_ETAT_VISUEL,
    sequence: 0,
    personnages: [],
    decor: null,
    scenesIllustrees: [],
    derniereAnalyseIndex: 0,
  };
}

export function lireEtatVisuel(story: StoryState): EtatVisuelHistoire {
  return story.etatVisuel ?? etatVisuelVide();
}

/**
 * Une sauvegarde de l'écran peut porter une copie de l'histoire chargée avant
 * la dernière illustration : l'état visuel déjà persisté, plus récent, doit
 * alors être conservé plutôt qu'écrasé.
 */
export function etatVisuelLePlusRecent(
  aSauvegarder: EtatVisuelHistoire | undefined,
  persiste: EtatVisuelHistoire | undefined,
): EtatVisuelHistoire | undefined {
  if (!persiste) return aSauvegarder;
  if (!aSauvegarder) return persiste;
  return persiste.sequence > aSauvegarder.sequence ? persiste : aSauvegarder;
}

// ---------------------------------------------------------------------------
// Critère unique d'éligibilité visuelle des PNJ
// ---------------------------------------------------------------------------

/**
 * Seul critère qui décide si un PNJ peut recevoir un avatar, servir de
 * référence et apparaître dans la description visuelle. Il suit le lore
 * émergent actuel : un PNJ nommé est enregistré dès sa première apparition
 * (« provisoire ») pour que son portrait puisse exister immédiatement ; le
 * statut « permanent » ne sert qu'à le prioriser parmi les références.
 */
export function estPnjVisuel(entree: EntreeLoreEmergent, personnageNom: string): boolean {
  if (entree.categorie !== 'pnj') return false;
  const titre = entree.titre.trim().toLowerCase();
  return !!titre && titre !== personnageNom.trim().toLowerCase();
}

export function listerPnjVisuels(story: StoryState): EntreeLoreEmergent[] {
  return story.loreEmergent.filter((entree) => estPnjVisuel(entree, story.meta.personnageNom));
}

// ---------------------------------------------------------------------------
// Normalisation et vérification d'un événement narratif établi
// ---------------------------------------------------------------------------

export function normaliserVisuel(valeur: unknown): string {
  return String(valeur ?? '')
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function jetonsSignificatifs(valeur: string): string[] {
  return normaliserVisuel(valeur).split(' ').filter((mot) => mot.length >= 3);
}

/**
 * Vrai si l'événement invoqué pour justifier un changement visuel figure
 * réellement dans le texte narratif : citation (normalisée) ou, à défaut,
 * au moins 75 % de ses mots significatifs présents dans un même passage.
 */
export function evenementEtabli(evenement: string, textesNarratifs: readonly string[]): boolean {
  const cible = normaliserVisuel(evenement);
  const mots = jetonsSignificatifs(evenement);
  if (cible.length < 8 || mots.length < 2) return false;
  return textesNarratifs.some((texte) => {
    const source = normaliserVisuel(texte);
    if (source.includes(cible)) return true;
    const motsSource = new Set(source.split(' '));
    const presents = mots.filter((mot) => motsSource.has(mot)).length;
    return presents / mots.length >= 0.75;
  });
}

// ---------------------------------------------------------------------------
// Changements visuels
// ---------------------------------------------------------------------------

const CHAMPS_PERSONNAGE_SCALAIRES = ['tenue', 'armure', 'coiffure', 'proprete'] as const;
const CHAMPS_PERSONNAGE_LISTES = [
  'armesVisibles', 'accessoires', 'blessures', 'cicatrices', 'salissures', 'transformations', 'objetsPortes',
] as const;
const CHAMPS_DECOR_SCALAIRES = ['lieu', 'typeLieu', 'architecture', 'disposition', 'heure', 'meteo', 'lumiere'] as const;
const CHAMPS_DECOR_LISTES = [
  'sourcesLumineuses', 'degats', 'incendies', 'ouvertures', 'objetsImportants', 'mobilier', 'traces',
] as const;

export interface ChangementVisuel {
  cible: 'personnage' | 'decor';
  nom?: string;
  champ: string;
  operation: 'definir' | 'ajouter' | 'retirer';
  valeur: string;
  /** Passage du récit qui établit ce changement (citation). */
  evenement: string;
}

export interface ChangementRejete {
  changement: ChangementVisuel;
  raison: string;
}

export interface ResultatChangements {
  etat: EtatVisuelHistoire;
  acceptes: ChangementVisuel[];
  rejetes: ChangementRejete[];
}

function borner(valeur: string): string {
  const t = valeur.replace(/\s+/g, ' ').trim();
  return t.length <= MAX_LONGUEUR_VALEUR ? t : `${t.slice(0, MAX_LONGUEUR_VALEUR - 1).trimEnd()}…`;
}

function personnageVide(nom: string, assetId: string | undefined, index: number): EtatVisuelPersonnage {
  return {
    cle: normaliserVisuel(nom),
    nom,
    assetId,
    tenue: '', armure: '', coiffure: '', proprete: '',
    armesVisibles: [], accessoires: [], blessures: [], cicatrices: [], salissures: [], transformations: [], objetsPortes: [],
    majAuMessage: index,
  };
}

function decorVide(index: number): EtatVisuelDecor {
  return {
    lieu: '', typeLieu: '', architecture: '', disposition: '', heure: '', meteo: '', lumiere: '',
    sourcesLumineuses: [], degats: [], incendies: [], ouvertures: [], objetsImportants: [], mobilier: [], traces: [],
    majAuMessage: index,
  };
}

function modifierListe(liste: string[], operation: ChangementVisuel['operation'], valeur: string): string[] {
  const cle = normaliserVisuel(valeur);
  if (operation === 'retirer') {
    return liste.filter((element) => {
      const n = normaliserVisuel(element);
      return n !== cle && !n.includes(cle) && !cle.includes(n);
    });
  }
  if (operation === 'definir') return valeur ? [valeur] : [];
  if (liste.some((element) => normaliserVisuel(element) === cle)) return liste;
  return [...liste, valeur].slice(-MAX_ELEMENTS_LISTE);
}

function estDans<T extends string>(liste: readonly T[], champ: string): champ is T {
  return (liste as readonly string[]).includes(champ);
}

/**
 * Applique des changements proposés par la direction artistique. Chaque
 * changement doit citer un événement narratif présent dans `textesNarratifs`
 * (narration, fiche du joueur, fiche du PNJ) : sinon il est rejeté et l'état
 * reste inchangé. Le résultat est une nouvelle valeur, l'état d'entrée n'est
 * jamais muté.
 */
export function appliquerChangementsVisuels(
  etatInitial: EtatVisuelHistoire,
  changements: readonly ChangementVisuel[],
  textesNarratifs: readonly string[],
  messageIndex: number,
  resoudreAssetId: (nom: string) => string | undefined = () => undefined,
): ResultatChangements {
  const etat: EtatVisuelHistoire = {
    ...etatInitial,
    personnages: etatInitial.personnages.map((p) => ({ ...p })),
    decor: etatInitial.decor ? { ...etatInitial.decor } : null,
  };
  const acceptes: ChangementVisuel[] = [];
  const rejetes: ChangementRejete[] = [];

  for (const brut of changements) {
    const valeur = borner(String(brut.valeur ?? ''));
    const changement: ChangementVisuel = { ...brut, valeur };
    if (!['definir', 'ajouter', 'retirer'].includes(changement.operation)) {
      rejetes.push({ changement, raison: 'opération inconnue' });
      continue;
    }
    if (!valeur && changement.operation !== 'definir') {
      rejetes.push({ changement, raison: 'valeur vide' });
      continue;
    }
    if (!evenementEtabli(changement.evenement ?? '', textesNarratifs)) {
      rejetes.push({ changement, raison: 'aucun événement narratif établi' });
      continue;
    }

    if (changement.cible === 'personnage') {
      const nom = String(changement.nom ?? '').trim();
      const cle = normaliserVisuel(nom);
      if (!cle) {
        rejetes.push({ changement, raison: 'personnage non nommé' });
        continue;
      }
      const champValide = estDans(CHAMPS_PERSONNAGE_SCALAIRES, changement.champ)
        || estDans(CHAMPS_PERSONNAGE_LISTES, changement.champ);
      if (!champValide) {
        rejetes.push({ changement, raison: `champ personnage inconnu : ${changement.champ}` });
        continue;
      }
      let personnage = etat.personnages.find((p) => p.cle === cle);
      if (!personnage) {
        personnage = personnageVide(nom, resoudreAssetId(nom), messageIndex);
        etat.personnages.push(personnage);
      }
      if (estDans(CHAMPS_PERSONNAGE_SCALAIRES, changement.champ)) {
        personnage[changement.champ] = changement.operation === 'retirer' ? '' : valeur;
      } else if (estDans(CHAMPS_PERSONNAGE_LISTES, changement.champ)) {
        personnage[changement.champ] = modifierListe(personnage[changement.champ], changement.operation, valeur);
      }
      personnage.majAuMessage = messageIndex;
      acceptes.push(changement);
      continue;
    }

    if (changement.cible === 'decor') {
      const champValide = estDans(CHAMPS_DECOR_SCALAIRES, changement.champ)
        || estDans(CHAMPS_DECOR_LISTES, changement.champ);
      if (!champValide) {
        rejetes.push({ changement, raison: `champ décor inconnu : ${changement.champ}` });
        continue;
      }
      let decor = etat.decor ?? decorVide(messageIndex);
      if (
        changement.champ === 'lieu'
        && changement.operation === 'definir'
        && decor.lieu
        && normaliserVisuel(decor.lieu) !== normaliserVisuel(valeur)
      ) {
        // Nouveau lieu : son état propre repart de zéro ; l'heure, la météo
        // et la lumière ambiante continuent, elles, de s'appliquer.
        const suite = decorVide(messageIndex);
        decor = { ...suite, heure: decor.heure, meteo: decor.meteo, lumiere: decor.lumiere };
      }
      if (estDans(CHAMPS_DECOR_SCALAIRES, changement.champ)) {
        decor[changement.champ] = changement.operation === 'retirer' ? '' : valeur;
      } else if (estDans(CHAMPS_DECOR_LISTES, changement.champ)) {
        decor[changement.champ] = modifierListe(decor[changement.champ], changement.operation, valeur);
      }
      decor.majAuMessage = messageIndex;
      etat.decor = decor;
      acceptes.push(changement);
      continue;
    }

    rejetes.push({ changement, raison: 'cible inconnue' });
  }

  if (acceptes.length > 0) etat.sequence = etatInitial.sequence + 1;
  return { etat, acceptes, rejetes };
}

// ---------------------------------------------------------------------------
// Historique glissant des scènes illustrées
// ---------------------------------------------------------------------------

/**
 * Ajoute une scène à l'historique glissant : A → [A], B → [A, B],
 * C → [B, C] (A évincée). Une régénération de la même révision remplace la
 * scène en place, sans faire tourner l'historique.
 */
export function ajouterSceneIllustree(
  scenes: readonly SceneIllustree[],
  nouvelle: SceneIllustree,
  max = MAX_SCENES_ILLUSTREES,
): { scenes: SceneIllustree[]; evincees: SceneIllustree[] } {
  const index = scenes.findIndex((scene) => scene.revision === nouvelle.revision);
  if (index >= 0) {
    const copie = [...scenes];
    copie[index] = nouvelle;
    return { scenes: copie, evincees: [] };
  }
  const toutes = [...scenes, nouvelle];
  const surplus = Math.max(0, toutes.length - max);
  return { scenes: toutes.slice(surplus), evincees: toutes.slice(0, surplus) };
}

// ---------------------------------------------------------------------------
// Personnages visibles
// ---------------------------------------------------------------------------

/**
 * Relie les noms déclarés visibles par le modèle narratif aux identités
 * connues (joueur, PNJ du lore émergent). Un nom sans fiche reste un
 * figurant : décrit dans le prompt, jamais associé à une image de référence.
 */
export function resoudrePersonnagesVisibles(story: StoryState, noms: readonly string[]): PersonnageVisibleResolu[] {
  const nomJoueur = normaliserVisuel(story.meta.personnageNom);
  const premierJoueur = nomJoueur.split(' ')[0] ?? '';
  const pnj = listerPnjVisuels(story);
  const resultat: PersonnageVisibleResolu[] = [];
  const deja = new Set<string>();

  for (const brut of noms) {
    const nom = String(brut ?? '').trim();
    const cle = normaliserVisuel(nom);
    if (!cle) continue;

    let resolu: PersonnageVisibleResolu;
    if (
      cle === nomJoueur
      || (premierJoueur.length > 2 && cle === premierJoueur)
      || ['joueur', 'user', 'protagoniste', 'personnage principal'].includes(cle)
    ) {
      resolu = { nom: story.meta.personnageNom, type: 'joueur', assetId: ID_ASSET_JOUEUR, principal: true };
    } else {
      const trouve = pnj.find((entree) => {
        const titre = normaliserVisuel(entree.titre);
        const premier = titre.split(' ')[0] ?? '';
        return titre === cle || (premier.length > 2 && (premier === cle || cle.split(' ')[0] === premier));
      });
      resolu = trouve
        ? { nom: trouve.titre, type: 'pnj', assetId: trouve.id, principal: trouve.statut === 'permanent' }
        : { nom, type: 'figurant', principal: false };
    }
    const identifiant = resolu.assetId ?? `figurant:${normaliserVisuel(resolu.nom)}`;
    if (deja.has(identifiant)) continue;
    deja.add(identifiant);
    resultat.push(resolu);
  }
  return resultat;
}

/** Ancienne détection par nom, conservée uniquement comme repli hors ligne. */
export function pnjMentionneDansTexte(pnj: EntreeLoreEmergent, texteSceneMinuscule: string): boolean {
  const titre = pnj.titre.trim().toLowerCase();
  if (!titre) return false;
  if (texteSceneMinuscule.includes(titre)) return true;
  const premierMot = titre.split(/\s+/)[0];
  return premierMot.length > 2 && texteSceneMinuscule.includes(premierMot);
}

export function detecterPersonnagesParRepli(story: StoryState, texteScene: string): PersonnageVisibleResolu[] {
  const minuscule = texteScene.toLowerCase();
  const noms = [
    story.meta.personnageNom,
    ...listerPnjVisuels(story).filter((pnj) => pnjMentionneDansTexte(pnj, minuscule)).map((pnj) => pnj.titre),
  ];
  return resoudrePersonnagesVisibles(story, noms).slice(0, 4);
}

// ---------------------------------------------------------------------------
// Priorité des références visuelles
// ---------------------------------------------------------------------------

export type TypeReference =
  | 'joueur-portrait'
  | 'joueur-avatar'
  | 'pnj-principal'
  | 'pnj-secondaire'
  | 'scene-precedente'
  | 'scene-avant-derniere';

const PRIORITE_REFERENCE: Record<TypeReference, number> = {
  'joueur-portrait': 0,
  'joueur-avatar': 1,
  'pnj-principal': 2,
  'pnj-secondaire': 3,
  'scene-precedente': 4,
  'scene-avant-derniere': 5,
};

export interface ReferenceVisuelle {
  type: TypeReference;
  uri: string;
  libelle: string;
}

/**
 * Trie les références par priorité (identité des personnages visibles
 * d'abord, continuité de décor ensuite) puis tronque à la limite du
 * fournisseur : une scène précédente ne peut jamais évincer un visage.
 */
export function ordonnerReferences(candidats: readonly ReferenceVisuelle[], max: number): ReferenceVisuelle[] {
  const vus = new Set<string>();
  return candidats
    .map((ref, ordre) => ({ ref, ordre }))
    .filter(({ ref }) => !!ref.uri)
    .sort((a, b) => PRIORITE_REFERENCE[a.ref.type] - PRIORITE_REFERENCE[b.ref.type] || a.ordre - b.ordre)
    .map(({ ref }) => ref)
    .filter((ref) => {
      if (vus.has(ref.uri)) return false;
      vus.add(ref.uri);
      return true;
    })
    .slice(0, Math.max(0, max));
}
