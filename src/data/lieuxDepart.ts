// Lieux de départ proposés à l'étape Personnage — factions et institutions
// d'Elyndor fournies par le porteur de projet.
export interface LieuDepart {
  id: string;
  nom: string;
  description: string;
}

export const LIEUX_DEPART: LieuDepart[] = [
  {
    id: 'marches-esclaves',
    nom: 'Marchés aux esclaves',
    description: '',
  },
  {
    id: 'guilde-marchands',
    nom: 'Guilde des Marchands',
    description: 'Siège mondial à Istanbul, antennes partout.',
  },
  {
    id: 'ordre-mages',
    nom: 'Ordre des Mages',
    description: 'Une tour par capitale, sauf Delhi.',
  },
  {
    id: 'guilde-ombres',
    nom: 'Guilde des Ombres',
    description: 'Officiellement inexistante.',
  },
  {
    id: 'guilde-aventuriers',
    nom: 'Guilde des Aventuriers',
    description: 'Antenne royale dans chaque royaume.',
  },
];
