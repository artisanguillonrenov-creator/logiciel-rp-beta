import { chargerLoreMonde, type ElyndorEntryChargee } from '../engine/loreLoader';
import { construireRolesCanon, type RoleCanon } from '../engine/rolesCanon';
import { paquetMonde } from './index';
import type { PaquetMonde } from './types';

/** Données d'un monde préparées pour le moteur, calculées une fois par monde. */
export interface DonneesMonde {
  paquet: PaquetMonde;
  /** Lorebook canonique chargé (identifiants « <mondeId>-<n> »), sans les éditions de l'Atelier. */
  lore: ElyndorEntryChargee[];
  /** Rôles fixés par ville (module rolesCanon) ; vide sans module. */
  rolesCanon: RoleCanon[];
  /** Villes où des rôles sont fixés ; vide sans module. */
  capitales: string[];
}

const cache = new Map<string, DonneesMonde>();

export function donneesMonde(id?: string | null): DonneesMonde {
  const paquet = paquetMonde(id);
  const existant = cache.get(paquet.id);
  if (existant) return existant;
  const lore = chargerLoreMonde(paquet.lorebook, paquet.id);
  const module = paquet.modules?.rolesCanon;
  const rolesCanon = module ? construireRolesCanon(lore, module.roles) : [];
  const capitales = module?.lieux ?? [...new Set(rolesCanon.map((r) => r.ville))];
  const donnees = { paquet, lore, rolesCanon, capitales };
  cache.set(paquet.id, donnees);
  return donnees;
}
