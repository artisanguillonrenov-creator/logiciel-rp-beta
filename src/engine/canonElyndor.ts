import { donneesMonde } from '../mondes/donnees';

/** Canon statique d'Elyndor partagé : fiches, rôles fixés par ville, capitales. */
const ELYNDOR = donneesMonde('elyndor');
export const LORE_ELYNDOR_CANON = ELYNDOR.lore;
export const ROLES_CANON = ELYNDOR.rolesCanon;
export const CAPITALES = ELYNDOR.capitales;
