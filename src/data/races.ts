// Races jouables d'Elyndor, résumées depuis le lore complet
// (src/data/elyndorLore.json) pour le sélecteur de l'étape Personnage.
export interface RaceElyndor {
  id: string;
  nom: string;
  sousTitre: string;
  description: string;
}

export const RACES_ELYNDOR: RaceElyndor[] = [
  {
    id: 'humains',
    nom: 'Humains',
    sousTitre: 'Europe — Paris',
    description:
      "Adaptabilité et ambition individuelle ; des vies courtes qui poussent à l'urgence d'accomplir. Grandes maisons nobles, clergé influent, bourgeoisie montante.",
  },
  {
    id: 'hauts-elfes',
    nom: 'Hauts-Elfes',
    sousTitre: 'Asie de l\'Est — Tokyo',
    description:
      'Magie comme droit de naissance, castes rigides, patience de siècles. Traits parfaits, port altier, beauté froide entretenue par la magie.',
  },
  {
    id: 'elfes-noirs',
    nom: 'Elfes Noirs',
    sousTitre: 'Asie du Sud — Delhi',
    description:
      "Noblesse guerrière où le mérite militaire prime sur la lignée. Peau mate à brun sombre, cheveux argentés, port martial.",
  },
  {
    id: 'valkyries',
    nom: 'Valkyries',
    sousTitre: 'Régions nordiques — Oslo',
    description:
      'Honneur au combat comme unique monnaie sociale — mourir au lit est la vraie défaite. Tresses de guerre, cicatrices portées fièrement.',
  },
  {
    id: 'amazones-nordiques',
    nom: 'Amazones Nordiques',
    sousTitre: 'Grandes forêts nordiques',
    description:
      'Clans matriarcaux forestiers, cousins sauvages des Valkyries. Chasse, pistage, autosuffisance.',
  },
  {
    id: 'sultanats',
    nom: 'Sultanats',
    sousTitre: 'Moyen-Orient, Afrique du Nord — Istanbul',
    description:
      'Le commerce comme art de vivre et quasi-religion. Hospitalité fastueuse, parole donnée sacrée.',
  },
  {
    id: 'amazones-sombres',
    nom: 'Amazones Sombres',
    sousTitre: 'Afrique subsaharienne — Lagos',
    description:
      "Matriarcat en lignées, fierté forgée par l'ostracisme mondial. La magie des Voiles, interdite, se transmet en silence.",
  },
  {
    id: 'orques-nobles',
    nom: 'Orques Nobles',
    sousTitre: 'Afrique australe — Johannesburg',
    description:
      "L'honneur du clan avant tout, mémoire orale parfaite des dettes et des dons, force mise au service du droit.",
  },
  {
    id: 'orcs',
    nom: 'Orcs',
    sousTitre: 'Amérique centrale — Mexico',
    description: 'La force fait le droit — tout se règle en duel. Les scarifications racontent les victoires.',
  },
  {
    id: 'hommes-betes',
    nom: 'Hommes-Bêtes',
    sousTitre: 'Amérique du Nord — New York',
    description:
      'Meutes territoriales à l\'instinct sacré, hiérarchies souples mais réelles. Traits animaux marqués — oreilles, queues, pelages.',
  },
  {
    id: 'tribus-primales',
    nom: 'Tribus Primales',
    sousTitre: 'Amérique du Sud — Bogotá',
    description: 'Le monde est habité par les esprits ; chamanes en transe, présages avant chaque décision.',
  },
  {
    id: 'sirenes',
    nom: 'Sirènes',
    sousTitre: 'Pacifique Sud — Sydney',
    description:
      'Thalassocratie du chant : le pouvoir se chante, la mer est mère et loi. Formes amphibies, chant qui apaise ou trouble.',
  },
  {
    id: 'naga-marines',
    nom: 'Naga Marines',
    sousTitre: 'Profondeurs du Pacifique — Auckland',
    description: 'Le peuple le plus ancien et le plus lent — la mémoire est leur culte, chaque mot est pesé.',
  },
  {
    id: 'nains',
    nom: 'Nains',
    sousTitre: 'Grandes chaînes de montagnes — Zurich',
    description:
      'La forge est prière, le registre est vérité. Clans de forge en compétition d\'excellence, mémoire des dettes sur trois générations.',
  },
  {
    id: 'geantes',
    nom: 'Géantes',
    sousTitre: 'Plus hauts sommets — Katmandou',
    description:
      'Contemplation des cimes, patience de décennies. Quelques centaines d\'individus au monde, toutes connues de nom entre elles.',
  },
];
