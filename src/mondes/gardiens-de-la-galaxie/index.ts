import type { ChapitreMonde, EntreeLoreBrute, LieuDepart, PaquetMonde, SituationDepart } from '../types';
import lorebook from './lorebook.json';
import chapitres from './chapitres.json';
import monde from './monde.json';
import { LORE_CORE } from './core';

// Les Gardiens de la Galaxie, version films : Lore Core, 49 entrées,
// 8 chapitres et fiche du monde (monde.json) fournis par William, branchés
// sans modification. Création libre du personnage (aucun module de races ni
// de rôles canon) ; départ fixe au Kyln.

// La création ne sait pas saisir une situation à texte libre : la situation
// « Autre raison (à écrire) » (id « libre ») de monde.json n'est pas proposée.
// Le joueur peut toujours écrire sa raison dans « Personnaliser cette ouverture ».
const SITUATIONS_KYLN: SituationDepart[] = monde.depart.situationsParLieu.kyln.filter((s) => s.id !== 'libre');

export const PAQUET_GARDIENS_DE_LA_GALAXIE: PaquetMonde = {
  id: monde.id,
  carte: {
    nom: monde.carte.nom,
    genre: monde.carte.genre,
    // Image provisoire, en attendant l'illustration du monde.
    get image() {
      return require('../../../assets/scenes/creation-preferences.png');
    },
    description: monde.carte.description,
    tags: monde.carte.tags,
  },
  marque: { titre: monde.marque.titre },
  synopsis: monde.synopsis,
  core: LORE_CORE,
  lorebook: lorebook as unknown as { entries: EntreeLoreBrute[] },
  titreLore: monde.titreLore,
  consigneScenario: monde.consigneScenario,
  nomPourExtractionLore: monde.nomPourExtractionLore,
  entreesAdulteUniquement: monde.entreesAdulteUniquement,
  chapitres: chapitres as ChapitreMonde[],
  modules: {
    depart: {
      mode: 'liste',
      lieux: monde.depart.lieux as LieuDepart[],
      situationsParLieu: { kyln: SITUATIONS_KYLN },
    },
  },
};
