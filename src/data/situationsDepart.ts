// Situations de départ proposées à l'étape "Point de départ" — archétypes
// de scène d'ouverture, génériques (pas liés à un monde particulier)
// contrairement aux races et lieux de départ.
export interface SituationDepart {
  id: string;
  nom: string;
  description: string;
}

export const SITUATIONS_DEPART: SituationDepart[] = [
  {
    id: 'rendez-vous-discret',
    nom: 'Rendez-vous discret',
    description: 'Une rencontre tenue secrète, sur invitation ou convocation.',
  },
  {
    id: 'arrivee-en-ville',
    nom: 'Arrivée en ville',
    description: "Le personnage pose le pied quelque part pour la première fois, ou après une longue absence.",
  },
  {
    id: 'poursuite-fuite',
    nom: 'Poursuite / Fuite',
    description: 'Le personnage fuit quelque chose ou quelqu\'un — ou traque une cible.',
  },
  {
    id: 'reveil-trouble',
    nom: 'Réveil après une nuit trouble',
    description: 'Le personnage reprend connaissance sans souvenir clair de ce qui vient de se passer.',
  },
  {
    id: 'mission-guilde',
    nom: 'Mission de guilde',
    description: 'Un contrat, une commande ou un ordre vient d\'être accepté.',
  },
  {
    id: 'ceremonie-officielle',
    nom: 'Cérémonie officielle',
    description: 'Un événement public et codifié — audience, procès, célébration.',
  },
  {
    id: 'rencontre-fortuite',
    nom: 'Rencontre fortuite',
    description: 'Un croisement imprévu qui va tout changer.',
  },
  {
    id: 'capture-interrogatoire',
    nom: 'Capture / interrogatoire',
    description: 'Le personnage est aux mains de quelqu\'un d\'autre — captif, suspect ou témoin retenu.',
  },
];
