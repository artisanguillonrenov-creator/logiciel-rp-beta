import type { ElyndorEntryChargee } from './loreLoader';

/**
 * Annuaire des rôles fixés par le lore : pour chaque capitale, qui tient la
 * guilde, l'accueil, la taverne, la forge, la Porte Astra et le trône. Lu
 * dans les fiches « [RÉCURRENT] » (lignes « Paris : Séraphine Duvall — … »),
 * pour que le narrateur utilise ces personnages au lieu d'en inventer.
 */
export type TypeRole = 'maitresse_guilde' | 'receptionniste' | 'taverniere' | 'forgeronne' | 'passeuse' | 'souverain';

export interface RoleCanon {
  role: TypeRole;
  libelle: string;
  ville: string;
  nom: string;
  description: string;
}

const FICHES: { motif: RegExp; role: TypeRole; libelle: string }[] = [
  { motif: /ma[iî]tresses de guilde/i, role: 'maitresse_guilde', libelle: 'Maîtresse de la Guilde des Aventuriers' },
  { motif: /r[ée]ceptionnistes/i, role: 'receptionniste', libelle: 'Réceptionniste de la Guilde des Aventuriers' },
  { motif: /taverni[èe]res/i, role: 'taverniere', libelle: 'Tavernière' },
  { motif: /forgeronnes/i, role: 'forgeronne', libelle: 'Forgeronne' },
  { motif: /passeuses astra/i, role: 'passeuse', libelle: 'Passeuse de la Porte Astra' },
  { motif: /souverains/i, role: 'souverain', libelle: 'Souverain' },
];

function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function construireRolesCanon(entrees: ElyndorEntryChargee[]): RoleCanon[] {
  const roles: RoleCanon[] = [];
  for (const entree of entrees) {
    if (!/r[ée]current/i.test(entree.category ?? entree.titre)) continue;
    const fiche = FICHES.find((f) => f.motif.test(entree.titre));
    if (!fiche) continue;
    for (const ligne of entree.contenu.split('\n')) {
      // « Paris : Séraphine Duvall — Humaine, 45 ans… » ; titres éventuels
      // (« Roi Henri Valmonde ») conservés dans le nom affiché.
      const m = ligne.match(/^\s*([A-Za-zÀ-ÿ' .-]{3,30}?)\s*:\s*([^—–]{3,80}?)\s+[—–]\s+(.+)$/);
      if (!m) continue;
      const ville = m[1].trim();
      if (/^r[èe]gle$/i.test(ville)) continue;
      roles.push({
        role: fiche.role,
        libelle: fiche.libelle,
        // « PARIS » ou « Paris » → « Paris » ; « NEW YORK » → « New York ».
        ville: ville.toLowerCase().replace(/(^|[\s-])\S/g, (c) => c.toUpperCase()),
        nom: m[2].trim(),
        description: m[3].trim(),
      });
    }
  }
  return roles;
}

export function rolesDeLaVille(roles: RoleCanon[], ville: string | undefined, types?: TypeRole[]): RoleCanon[] {
  if (!ville) return [];
  const v = normaliser(ville);
  return roles.filter((r) => normaliser(r.ville) === v && (!types || types.includes(r.role)));
}

/** Prénom d'usage (sans titre « Roi », « Warchief »…) pour retrouver le personnage dans un texte. */
export function prenomRole(role: RoleCanon): string {
  const mots = role.nom.split(/\s+/).filter((m) => !/^(roi|reine|imp[ée]ratrice|empereur|warchief|alpha|grande?|chamane|sultan[e]?|jarl|matriarche|reine-m[èe]re)$/i.test(m));
  return mots[0] ?? role.nom;
}
