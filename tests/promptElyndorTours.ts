// Tours types d'Elyndor pour le test de non-régression du prompt système
// (chantier multi-mondes, phase 0). Reproduit la chaîne de calculerSelectionLore
// et construireCtxBase (generateTurn.ts, non importable sous Node) sur les
// éléments qui dépendent du monde : Lore Core, bloc et titre du lore, fiche de
// scène et rôles canon. Aucun élément variable : dates et identifiants fixés,
// pas de bruit aléatoire dans la sélection.
import elyndorRaw from '../src/data/elyndorLore.json';
import { chargerLoreElyndor } from '../src/engine/loreLoader';
import { construirePassages, selectionnerPassagesDetaille, viderIndexPassages } from '../src/engine/passagesLore';
import { resoudreEntitesScene } from '../src/engine/entitesScene';
import { preparerTour } from '../src/engine/ficheScene';
import { construireSystemPrompt } from '../src/engine/promptBuilder';
import { ENTREES_ADULTE_UNIQUEMENT, texteCompatibleAvecProfil } from '../src/engine/contenuAdulte';
import { CONSIGNE_SCENARIO } from '../src/engine/scenarioGenerator';
import { creerNouvelleHistoire } from '../src/engine/story';
import type { Message, ProfilContenu, StoryState } from '../src/types';

const REGLAGES = {
  creativite: 'moyenne', longueur: 'moyenne', ton: 'sombre_realiste', violence: 'modere',
  romance: 'modere', humour: 'faible', liberteJoueur: 'elevee', rythme: 'normal',
} as const;

interface TourType {
  nom: string;
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
    contexte: { lieu: tour.lieu, ambiance: 'Dark fantasy politique et aventure', dateChronique: '', objectifs: '' },
    settings: { ...REGLAGES },
    raceOrigineId: 'humains',
    sexe: 'Femme',
  });
  story.meta.id = `histoire-${tour.nom}`;
  story.meta.createdAt = 1;
  story.meta.updatedAt = 1;
  story.messages = (tour.echanges ?? []).flatMap(([joueur, narrateur], i): Message[] => [
    { id: `u${i}`, role: 'user', content: joueur, timestamp: 1000 + i * 2 },
    { id: `a${i}`, role: 'assistant', content: narrateur, timestamp: 1001 + i * 2 },
  ]);
  return story;
}

export function promptTourType(tour: TourType): string {
  viderIndexPassages();
  const story = histoire(tour);
  const profil = tour.profil;
  const lore = chargerLoreElyndor(elyndorRaw as any);
  const pool = profil === 'adulte'
    ? lore
    : lore.filter((e) => !ENTREES_ADULTE_UNIQUEMENT.includes(e.titre) && texteCompatibleAvecProfil(`${e.titre}\n${e.contenu}`, profil));
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
  const { entrees } = selectionnerPassagesDetaille(passages, requeteScene, {
    requeteMessage,
    ancres: resolution.ancresP0,
    raisonsAncres: resolution.raisons,
  });
  return construireSystemPrompt({
    meta: story.meta,
    settings: story.settings,
    resume: '',
    faits: [],
    loreElyndor: entrees,
    messagesRecents: story.messages,
    messageJoueur: tour.message,
    ficheScene: preparation.fiche,
  });
}

/** Instantané complet : prompts des tours types et consigne du scénario de départ. */
export function instantaneElyndor(): Record<string, string> {
  const sortie: Record<string, string> = {};
  for (const tour of TOURS_TYPES) sortie[tour.nom] = promptTourType(tour);
  sortie['consigne-scenario'] = CONSIGNE_SCENARIO;
  return sortie;
}
