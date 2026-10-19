import type { EntreeLoreBrute, PaquetMonde } from '../types';
import lorebook from './lorebook.json';
import { LORE_CORE } from './core';
import { SYNOPSIS_ELYNDOR } from './synopsis';
import { RACES_ELYNDOR } from './races';
import { LIEUX_DEPART } from './lieuxDepart';
import { SITUATIONS_PAR_LIEU } from './situationsDepart';
import {
  CONSIGNE_SCENARIO_ELYNDOR,
  DETECTION_RACES_ELYNDOR,
  ENTREES_ADULTE_ELYNDOR,
  FICHES_ROLES_ELYNDOR,
  VISUELS_RACES_ELYNDOR,
} from './moteur';

// Premier paquet monde : Elyndor, tel qu'il existait avant le chantier
// multi-mondes. Aucune donnée n'a été modifiée en le regroupant ici.
export const PAQUET_ELYNDOR: PaquetMonde = {
  id: 'elyndor',
  carte: {
    nom: 'Elyndor',
    genre: 'Dark fantasy politique et aventure',
    get image() {
      return require('../../../assets/scenes/cour-des-serments.png');
    },
    description:
      "Un monde de royaumes, de guildes et de tensions anciennes où chaque décision peut laisser une trace durable.",
    tags: ['Fantasy', 'Politique', 'Aventure', 'Sombre'],
  },
  marque: {
    titre: 'ELYNDOR',
    get fond() {
      return require('../../../assets/scenes/accueil.png');
    },
  },
  synopsis: SYNOPSIS_ELYNDOR,
  core: LORE_CORE,
  lorebook: lorebook as unknown as { entries: EntreeLoreBrute[] },
  titreLore: 'LORE ELYNDOR PERTINENT',
  consigneScenario: CONSIGNE_SCENARIO_ELYNDOR,
  nomPourExtractionLore: 'Elyndor',
  entreesAdulteUniquement: ENTREES_ADULTE_ELYNDOR,
  modules: {
    races: {
      liste: RACES_ELYNDOR,
      get portraits() {
        return (require('./portraits') as typeof import('./portraits')).PORTRAITS_ELYNDOR;
      },
      detection: DETECTION_RACES_ELYNDOR,
      visuels: VISUELS_RACES_ELYNDOR,
    },
    depart: { mode: 'liste', lieux: LIEUX_DEPART, situationsParLieu: SITUATIONS_PAR_LIEU },
    rolesCanon: { roles: FICHES_ROLES_ELYNDOR },
  },
};
