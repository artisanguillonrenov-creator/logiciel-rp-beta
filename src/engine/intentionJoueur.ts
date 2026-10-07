import { prenomRole, type RoleCanon, type TypeRole } from './rolesCanon';

/**
 * Repérage local (sans appel au modèle) de ce que fait le joueur : un
 * déplacement, le lieu visé, les rôles et PNJ fixés par le lore qu'il
 * concerne. Sert à guider la recherche du lore et à remplir la fiche de
 * scène avant que le narrateur n'écrive.
 */
export interface LieuConnu {
  type: string;
  libelle: string;
  roles: TypeRole[];
  /** Fragments de titres des fiches de lore à consulter en priorité. */
  fiches: string[];
}

interface DefinitionLieu extends LieuConnu {
  motif: RegExp;
}

// Ordre important : le premier motif reconnu l'emporte. Les lieux précis
// passent avant la simple « guilde » (celle des aventuriers), qui n'est
// reconnue qu'au singulier : la requête d'ouverture cite « factions/guildes »
// et envoyait la maîtresse de guilde au Marché aux Esclaves.
const LIEUX: DefinitionLieu[] = [
  { type: 'guilde_marchands', libelle: 'Guilde des Marchands', motif: /guilde des marchands/i, roles: [], fiches: ['Guilde des Marchands'] },
  { type: 'ordre_mages', libelle: 'Ordre des Mages', motif: /ordre des mages|tour des mages/i, roles: [], fiches: ['Ordre des Mages'] },
  { type: 'guilde_ombres', libelle: 'Guilde des Ombres', motif: /guilde des ombres/i, roles: [], fiches: ['Guilde des Ombres'] },
  { type: 'marche_esclaves', libelle: 'Marché aux Esclaves', motif: /march[ée]s? aux esclaves/i, roles: [], fiches: ['Marchés aux Esclaves'] },
  { type: 'porte_astra', libelle: 'Porte Astra', motif: /porte astra|passeuse/i, roles: ['passeuse'], fiches: ['Portes Astra', 'Passeuses Astra'] },
  { type: 'palais', libelle: 'palais royal', motif: /\b(palais|ch[âa]teau royal|salle du tr[ôo]ne|cour royale)\b/i, roles: ['souverain'], fiches: ['Souverains'] },
  { type: 'taverne', libelle: 'taverne', motif: /\b(taverne|auberge|cabaret|estaminet)\b/i, roles: ['taverniere'], fiches: ['Tavernières'] },
  { type: 'forge', libelle: 'forge', motif: /\b(forge|forgeronn?e?|armurier|armurerie)\b/i, roles: ['forgeronne'], fiches: ['Forgeronnes'] },
  {
    type: 'guilde_aventuriers',
    libelle: 'comptoir de la Guilde des Aventuriers',
    motif: /\bguilde\b(?!s)|tableau des missions|comptoir des aventuriers/i,
    roles: ['maitresse_guilde', 'receptionniste'],
    fiches: ['Guilde des Aventuriers', 'Maîtresses de Guilde', 'Réceptionnistes'],
  },
];

// Rôles cités sans le lieu (« je demande à voir la maîtresse de guilde »).
const MOTIFS_ROLES: { role: TypeRole; motif: RegExp }[] = [
  { role: 'maitresse_guilde', motif: /ma[iî]tre(sse)? de (la )?guilde|cheffe? de (la )?guilde/i },
  { role: 'receptionniste', motif: /r[ée]ceptionniste|accueil de la guilde/i },
  { role: 'taverniere', motif: /taverni[èe]re?|aubergiste/i },
  { role: 'forgeronne', motif: /forgeronn?e?/i },
  { role: 'passeuse', motif: /passeuse|passeur/i },
  { role: 'souverain', motif: /\b(roi|reine|souverain\w*|imp[ée]ratrice|empereur|sultan\w*)\b/i },
];

const VERBES_DEPLACEMENT = /\b(all(ons|er|ez|ais)|vais|vas|va|pars|partons|partir|rends|rendons|rendre|entre|entrons|entrer|retourne|retournons|retourner|dirige|dirigeons|diriger|rejoin\w*|direction|filons|rentre|rentrons|pousse la porte|m[èe]ne[- ]moi|emm[èe]ne[- ]moi|conduis[- ]moi)\b/i;

export interface IntentionJoueur {
  deplacement: boolean;
  lieu?: LieuConnu;
  roles: TypeRole[];
  /** PNJ fixés par le lore cités par leur nom dans le message. */
  pnjCites: RoleCanon[];
  /** Fragments de titres des fiches de lore liées à l'intention. */
  fiches: string[];
}

export function analyserIntention(message: string, rolesCanon: RoleCanon[]): IntentionJoueur {
  const texte = message ?? '';
  const definition = LIEUX.find((l) => l.motif.test(texte));
  const lieu = definition ? { type: definition.type, libelle: definition.libelle, roles: definition.roles, fiches: definition.fiches } : undefined;
  const roles = new Set<TypeRole>(lieu?.roles ?? []);
  for (const { role, motif } of MOTIFS_ROLES) if (motif.test(texte)) roles.add(role);
  const pnjCites = rolesCanon.filter((r) => new RegExp(`\\b${prenomRole(r).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(texte));
  const fiches = new Set<string>(lieu?.fiches ?? []);
  return {
    deplacement: !!lieu && VERBES_DEPLACEMENT.test(texte),
    lieu,
    roles: [...roles],
    pnjCites,
    fiches: [...fiches],
  };
}

/** Résumé lisible de l'intention pour la fiche de scène. */
export function decrireIntention(intention: IntentionJoueur): string | undefined {
  if (intention.lieu) return `${intention.deplacement ? 'se rendre' : 'agir'} : ${intention.lieu.libelle}`;
  if (intention.pnjCites.length) return `s'adresser à ${intention.pnjCites.map((p) => p.nom).join(', ')}`;
  return undefined;
}
