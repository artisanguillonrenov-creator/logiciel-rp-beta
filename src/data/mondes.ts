import type { ImageSourcePropType } from 'react-native';

// Mondes proposés à l'étape "Choisir l'histoire" du parcours de création.
// Un seul monde pour l'instant (Elyndor, celui de l'app) — la liste et
// l'écran de sélection sont conçus pour en accueillir d'autres plus tard
// sans changement de structure.
export interface Monde {
  id: string;
  nom: string;
  genre: string;
  image: ImageSourcePropType;
  description: string;
  tags: string[];
}

export const MONDES: Monde[] = [
  {
    id: 'elyndor',
    nom: 'Elyndor',
    genre: 'Dark fantasy politique et aventure',
    image: require('../../assets/scenes/creation-histoire.png'),
    description:
      "Un monde de royaumes, de guildes et de tensions anciennes où chaque décision peut laisser une trace durable.",
    tags: ['Fantasy', 'Politique', 'Aventure', 'Sombre'],
  },
];
