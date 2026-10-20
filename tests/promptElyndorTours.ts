// Tours types d'Elyndor pour le test de non-régression du prompt système
// (chantier multi-mondes, phase 0). Reproduit la chaîne de calculerSelectionLore
// et construireCtxBase (generateTurn.ts, non importable sous Node) sur les
// éléments qui dépendent du monde : Lore Core, bloc et titre du lore, fiche de
// scène et rôles canon. Aucun élément variable : dates et identifiants fixés,
// pas de bruit aléatoire dans la sélection.
import { donneesMonde } from '../src/mondes/donnees';
import { construirePassages, selectionnerPassagesDetaille, viderIndexPassages, type RapportSelectionLore } from '../src/engine/passagesLore';
import { resoudreEntitesScene } from '../src/engine/entitesScene';
import { preparerTour } from '../src/engine/ficheScene';
import { construireSystemPrompt } from '../src/engine/promptBuilder';
import { instructionRegistreAdulte, texteCompatibleAvecProfil } from '../src/engine/contenuAdulte';
import { etatChapitre, formaterChapitre } from '../src/engine/chapitres';
import { consigneScenarioDe } from '../src/engine/scenarioGenerator';
import { paquetMonde, titreLoreDe } from '../src/mondes';
import { creerNouvelleHistoire } from '../src/engine/story';
import type { LoreEntry, Message, ProfilContenu, StoryState } from '../src/types';

const REGLAGES = {
  creativite: 'moyenne', longueur: 'moyenne', ton: 'sombre_realiste', violence: 'modere',
  romance: 'modere', humour: 'faible', liberteJoueur: 'elevee', rythme: 'normal',
} as const;

export interface TourType {
  nom: string;
  /** Monde de l'histoire ; absent : histoire sans mondeId (Elyndor). */
  mondeId?: string;
  /** Chapitre en cours (monde à chapitres) ; absent : premier chapitre. */
  chapitreId?: string;
  /** Profil Adulte : ajoute le registre Adulte comme construireCtxBase (hors instantané). */
  avecRegistreAdulte?: boolean;
  lieu: string;
  profil: ProfilContenu;
  message: string;
  echanges?: [string, string][];
}

export const TOURS_TYPES: TourType[] = [
  { nom: 'guilde-paris', lieu: 'Paris', profil: 'grand_public', message: 'Je me rends à la Guilde des Aventuriers de Paris.' },
  { nom: 'taverne-tokyo', lieu: 'Tokyo', profil: 'grand_public', message: 'Je demande à la tavernière ce qu’elle sait des Portes Astra.' },
  {
    nom: 'forge-historique', lieu: 'Paris', profil: 'grand_public', message: 'Je cherche une forge pour réparer mon épée avant de partir pour Delhi.',
    echanges: [
      ['Je salue l’elfe noire assise près du feu.', 'L’elfe noire lève ses yeux argentés vers toi sans un mot.'],
      ['Je lui demande d’où elle vient.', '« De Delhi », répond-elle enfin, la main posée sur sa lame.'],
    ],
  },
  { nom: 'adulte-istanbul', lieu: 'Istanbul', profil: 'adulte', message: 'Je questionne la courtisane du bazar sur les mœurs sexuelles d’Elyndor et le canon féminin.' },
  { nom: 'grand-public-istanbul', lieu: 'Istanbul', profil: 'grand_public', message: 'Je questionne la courtisane du bazar sur les mœurs sexuelles d’Elyndor et le canon féminin.' },
];

function histoire(tour: TourType): StoryState {
  const story = creerNouvelleHistoire({
    personnageNom: 'Ael',
    personnageDescription: 'Voyageuse humaine, ancienne messagère.',
    pointDeDepart: `${tour.lieu}, à l’aube.`,
    // Une histoire d'un autre monde prend le genre de son paquet comme ambiance.
    contexte: { lieu: tour.lieu, ambiance: tour.mondeId ? paquetMonde(tour.mondeId).carte.genre : 'Dark fantasy politique et aventure', dateChronique: '', objectifs: '' },
    settings: { ...REGLAGES },
    raceOrigineId: tour.mondeId ? undefined : 'humains',
    sexe: 'Femme',
    mondeId: tour.mondeId,
  });
  if (tour.chapitreId) story.monde = { ...story.monde, chapitreId: tour.chapitreId };
  story.meta.id = `histoire-${tour.nom}`;
  story.meta.createdAt = 1;
  story.meta.updatedAt = 1;
  story.messages = (tour.echanges ?? []).flatMap(([joueur, narrateur], i): Message[] => [
    { id: `u${i}`, role: 'user', content: joueur, timestamp: 1000 + i * 2 },
    { id: `a${i}`, role: 'assistant', content: narrateur, timestamp: 1001 + i * 2 },
  ]);
  return story;
}

/** Lore retenu pour un tour type et prompt système qui en résulte. */
export function selectionTourType(tour: TourType): { entrees: LoreEntry[]; prompt: string; rapport: RapportSelectionLore } {
  viderIndexPassages();
  const story = histoire(tour);
  const profil = tour.profil;
  const paquet = paquetMonde(story.meta.mondeId);
  const lore = donneesMonde(paquet.id).lore;
  const entreesAdulte = paquet.entreesAdulteUniquement ?? [];
  const pool = profil === 'adulte'
    ? lore
    : lore.filter((e) => !entreesAdulte.includes(e.titre) && texteCompatibleAvecProfil(`${e.titre}\n${e.contenu}`, profil));
  const passages = construirePassages(pool);
  const preparation = preparerTour(story, tour.message);
  const { ville, intention } = preparation;
  const derniereReponse = [...story.messages].reverse().find((m) => m.role === 'assistant')?.content;
  const garder = (textes: (string | false | undefined)[]) => textes
    .filter((t): t is string => !!t && texteCompatibleAvecProfil(t, profil)).join('\n');
  const requeteMessage = garder([ville && `Ville : ${ville}`, intention.lieu && `Lieu visé : ${intention.lieu.libelle}`, ...intention.fiches, tour.message]);
  const requeteScene = garder([ville && `Ville : ${ville}`, story.memoire.resume, ...story.memoire.faits.map((f) => f.texte), derniereReponse]);
  const resolution = resoudreEntitesScene({
    pool,
    messageJoueur: tour.message,
    ville,
    lieuActuel: story.scene?.lieu || undefined,
    destination: intention.lieu?.libelle,
    fichesIntention: intention.fiches,
    derniereReponse,
    memoire: [story.memoire.resume, ...story.memoire.faits.map((f) => f.texte)],
    presents: story.scene?.presents ?? [],
  });
  const { entrees, rapport } = selectionnerPassagesDetaille(passages, requeteScene, {
    requeteMessage,
    ancres: resolution.ancresP0,
    raisonsAncres: resolution.raisons,
  });
  const prompt = construireSystemPrompt({
    loreCore: paquet.core,
    titreLore: titreLoreDe(paquet),
    chapitre: formaterChapitre(etatChapitre(paquet.chapitres, story.monde, story.messages.length)) || undefined,
    registreAdulte: tour.avecRegistreAdulte && profil === 'adulte' ? instructionRegistreAdulte(story.settings) : undefined,
    meta: story.meta,
    settings: story.settings,
    resume: '',
    faits: [],
    loreElyndor: entrees,
    messagesRecents: story.messages,
    messageJoueur: tour.message,
    ficheScene: preparation.fiche,
  });
  return { entrees, prompt, rapport };
}

export function promptTourType(tour: TourType): string {
  return selectionTourType(tour).prompt;
}

/** Instantané complet : prompts des tours types et consigne du scénario de départ. */
export function instantaneElyndor(): Record<string, string> {
  const sortie: Record<string, string> = {};
  for (const tour of TOURS_TYPES) sortie[tour.nom] = promptTourType(tour);
  sortie['consigne-scenario'] = consigneScenarioDe(paquetMonde('elyndor'));
  return sortie;
}
