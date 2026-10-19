import type { EntreeLoreBrute, PaquetMonde } from '../types';
import lorebook from './lorebook.json';
import { LORE_CORE } from './core';

// Les Cendres du Monde : survie post-apocalyptique réaliste sur la Terre
// réelle, en 2046. Lore Core et 34 entrées « fondations » fournis par
// William, branchés sans modification. Aucun module de races ni de rôles
// canon (le monde n'a volontairement ni lieux, ni PNJ, ni factions nommés) ;
// départ libre ; consigne de scénario et titre du lore par défaut.
export const PAQUET_CENDRES_DU_MONDE: PaquetMonde = {
  id: 'cendres-du-monde',
  carte: {
    nom: 'Les Cendres du Monde',
    genre: 'Survie post-apocalyptique réaliste',
    // Image provisoire, en attendant l'illustration du monde.
    get image() {
      return require('../../../assets/scenes/creation-point-depart.png');
    },
    description: 'La Terre en 2046, vingt ans après la chute. Survie, reconstruction, rencontres : aucune quête n’est imposée.',
    tags: ['Post-apocalyptique', 'Réaliste', 'Survie'],
  },
  marque: {
    titre: 'LES CENDRES DU MONDE',
  },
  // Synopsis provisoire, à confirmer.
  synopsis: [
    'Vingt ans après l’Effondrement, la Terre n’a plus d’États, seulement des fermes, des hameaux et des routes fissurées.',
    'Quelque part, un feu de cuisine, une radio qui grésille, un voisin qui n’a pas encore décidé s’il peut vous faire confiance.',
    'Personne ne vous dit quoi faire. Le monde, lui, ne vous attend pas.',
  ],
  core: LORE_CORE,
  lorebook: lorebook as unknown as { entries: EntreeLoreBrute[] },
  nomPourExtractionLore: 'Les Cendres du Monde',
  modules: {
    depart: { mode: 'libre' },
  },
};
