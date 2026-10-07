import elyndorRaw from '../data/elyndorLore.json';
import { chargerLoreElyndor } from './loreLoader';
import { construireRolesCanon } from './rolesCanon';

/** Canon statique d'Elyndor partagé : fiches, rôles fixés par ville, capitales. */
export const LORE_ELYNDOR_CANON = chargerLoreElyndor(elyndorRaw as any);
export const ROLES_CANON = construireRolesCanon(LORE_ELYNDOR_CANON);
export const CAPITALES = [...new Set(ROLES_CANON.map((r) => r.ville))];
