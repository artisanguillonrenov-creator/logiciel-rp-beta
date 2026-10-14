/**
 * La description de scène que Prax manipule, tirée de la partie en cours :
 * la ville, les lieux connus, les PNJ (présents ou croisés) avec leur rôle et
 * leurs connaissances. Les personnages officiels du lore (maîtresse de guilde,
 * réceptionniste, tavernière, forgeronne, passeuse, souverain) sont repris
 * avec leur nom canonique ; un lieu sans personnage officiel reçoit une petite
 * distribution générique.
 */
import type { StoryState } from '../../types';
import { CAPITALES, ROLES_CANON } from '../canonElyndor';
import { detecterCapitale, lireEtatScene } from '../etatScene';
import { analyserIntention, type LieuConnu } from '../intentionJoueur';
import { RACES_ELYNDOR } from '../../data/races';
import { prenomRole, rolesDeLaVille, type RoleCanon } from '../rolesCanon';
import { RolePnj, sujetsConnus } from './sujets';
import { DescriptionScene, ID_JOUEUR, LIEU_AILLEURS, LieuDescription, PnjDescription } from './types';

const VILLE_PAR_DEFAUT = 'Paris';

export function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Identifiant Prax d'un nom : minuscules ASCII, chiffres, jamais vide ni réservé. */
export function slug(nom: string): string {
  const s = normaliser(nom).replace(/[^a-z0-9]+/g, '');
  const base = s.length === 0 ? 'pnj' : /^[0-9]/.test(s) ? `p${s}` : s;
  return base === ID_JOUEUR || base === LIEU_AILLEURS ? `${base}2` : base;
}

function idUnique(base: string, pris: ReadonlySet<string>): string {
  if (!pris.has(base)) return base;
  for (let i = 2; ; i++) if (!pris.has(`${base}${i}`)) return `${base}${i}`;
}

const FACTION_DES_ROLES: Partial<Record<RolePnj, string>> = {
  maitresse_guilde: 'guilde_aventuriers',
  receptionniste: 'guilde_aventuriers',
};

/** Distribution générique d'un lieu sans personnage officiel. */
const GENERIQUES: Record<string, Array<{ nom: string; role: RolePnj; libelle?: string; faction?: string }>> = {
  guilde_marchands: [
    { nom: 'Maître Osman', role: 'marchand', libelle: 'maître de comptoir de la Guilde des Marchands', faction: 'guilde_marchands' },
    { nom: 'Lise', role: 'marchand', libelle: 'greffière du comptoir', faction: 'guilde_marchands' },
  ],
  ordre_mages: [
    { nom: 'Maîtresse Ysolde', role: 'mage', libelle: 'examinatrice de l’Ordre des Mages', faction: 'ordre_mages' },
    { nom: 'Corwin', role: 'mage', libelle: 'apprenti de l’Ordre', faction: 'ordre_mages' },
  ],
  guilde_ombres: [
    { nom: 'Silas', role: 'ombre', libelle: 'receleur de la Guilde des Ombres', faction: 'guilde_ombres' },
    { nom: 'Nyx', role: 'ombre', libelle: 'guetteuse de la Guilde des Ombres', faction: 'guilde_ombres' },
  ],
  marche_esclaves: [
    { nom: 'Gaspard Morvan', role: 'marchand', libelle: 'commissaire-priseur du marché' },
    { nom: 'Brune', role: 'garde', libelle: 'garde du marché' },
  ],
  rues: [
    { nom: 'Mathis', role: 'habitant' },
    { nom: 'Aubert', role: 'garde', libelle: 'garde de la ville' },
  ],
};

function libelleRoleCanon(r: RoleCanon): string {
  const l = r.libelle.charAt(0).toLowerCase() + r.libelle.slice(1);
  return /^[aeiouyhé]/i.test(l) ? `l’${l}` : `la ${l}`;
}

function lieuDepuisTexte(...textes: Array<string | undefined>): LieuConnu | undefined {
  for (const t of textes) {
    if (!t) continue;
    const l = analyserIntention(t, ROLES_CANON).lieu;
    if (l) return l;
  }
  return undefined;
}

/** Nom de lieu avec son article (« la taverne », « le comptoir de la Guilde… »). */
const NOM_PAR_TYPE: Record<string, string> = {
  taverne: 'la taverne',
  forge: 'la forge',
  palais: 'le palais royal',
  guilde_aventuriers: 'le comptoir de la Guilde des Aventuriers',
  porte_astra: 'la Porte Astra',
  guilde_marchands: 'le comptoir de la Guilde des Marchands',
  ordre_mages: 'la tour de l’Ordre des Mages',
  guilde_ombres: 'le repaire de la Guilde des Ombres',
  marche_esclaves: 'le Marché aux Esclaves',
};

export function nomDeLieu(lieu: LieuConnu | undefined, nom: string): string {
  return (lieu && NOM_PAR_TYPE[lieu.type]) ?? nom;
}

export function idLieu(lieu: LieuConnu | undefined, nom: string): string {
  return lieu ? slug(lieu.type) : slug(nom);
}

/** Ajoute un lieu (et ses occupants officiels ou génériques) à la description. */
export function ajouterLieu(desc: DescriptionScene, lieu: LieuConnu | undefined, nom: string): { desc: DescriptionScene; lieuId: string } {
  const lieuId = idLieu(lieu, nom);
  if (desc.lieux.some((l) => l.id === lieuId)) return { desc, lieuId };
  const lieux: LieuDescription[] = [...desc.lieux, { id: lieuId, nom: nomDeLieu(lieu, nom), type: lieu?.type }];
  const pnj = [...desc.pnj];
  const pris = new Set(pnj.map((p) => p.id));
  const officiels = lieu ? rolesDeLaVille(ROLES_CANON, desc.ville, lieu.roles).filter((r) => r.role !== 'souverain' || lieu.type === 'palais') : [];
  for (const r of officiels) {
    if (pnj.some((p) => normaliser(p.nom) === normaliser(r.nom))) continue;
    const id = idUnique(slug(prenomRole(r)), pris);
    pris.add(id);
    pnj.push({ id, nom: r.nom, role: r.role, libelleRole: libelleRoleCanon(r), lieu: lieuId, faction: FACTION_DES_ROLES[r.role], sujets: sujetsConnus(r.role, desc.ville) });
  }
  if (officiels.length === 0) {
    for (const g of GENERIQUES[lieu?.type ?? 'rues'] ?? GENERIQUES.rues) {
      if (pnj.some((p) => normaliser(p.nom) === normaliser(g.nom))) continue;
      const id = idUnique(slug(g.nom), pris);
      pris.add(id);
      pnj.push({ id, nom: g.nom, role: g.role, libelleRole: g.libelle, lieu: lieuId, faction: g.faction, sujets: sujetsConnus(g.role, desc.ville) });
    }
  }
  return { desc: { ...desc, lieux, pnj }, lieuId };
}

/** Rôle d'un PNJ cité par son nom : celui du lore s'il est un personnage officiel de la ville. */
function roleCanonDe(nom: string, ville: string): RoleCanon | undefined {
  const n = normaliser(nom);
  return rolesDeLaVille(ROLES_CANON, ville).find((r) => n.includes(normaliser(prenomRole(r))) || normaliser(r.nom) === n);
}

function ajouterPnjConnu(desc: DescriptionScene, nom: string, lieuId: string, faction?: string): DescriptionScene {
  const propre = nom.replace(/\s+/g, ' ').trim();
  if (!propre || normaliser(propre) === normaliser(desc.joueurNom)) return desc;
  const existant = desc.pnj.find((p) => normaliser(p.nom) === normaliser(propre));
  if (existant) return desc;
  const canon = roleCanonDe(propre, desc.ville);
  const role: RolePnj = canon?.role ?? 'habitant';
  const pris = new Set(desc.pnj.map((p) => p.id));
  const id = idUnique(slug(canon ? prenomRole(canon) : propre.split(' ')[0]), pris);
  const p: PnjDescription = {
    id,
    nom: canon?.nom ?? propre,
    role,
    libelleRole: canon ? libelleRoleCanon(canon) : undefined,
    lieu: lieuId,
    faction: faction ?? FACTION_DES_ROLES[role],
    sujets: sujetsConnus(role, desc.ville),
  };
  return { ...desc, pnj: [...desc.pnj, p] };
}

export interface ResultatDescription {
  desc: DescriptionScene;
  /** Lieu actuel du joueur (identifiant). */
  lieuJoueur: string;
}

/**
 * Description de la scène pour la partie : celle du tour précédent si Prax a
 * déjà joué, complétée de ce que l'application a appris depuis (présents,
 * relations) ; sinon tirée du lieu et du point de départ de l'histoire.
 */
export function construireDescription(story: StoryState, precedente?: DescriptionScene, lieuJoueurPrecedent?: string): ResultatDescription {
  const scene = lireEtatScene(story, CAPITALES);
  // À défaut de ville citée, la capitale de la race du personnage (« Asie de l'Est — Tokyo »).
  const villeDeRace = detecterCapitale(RACES_ELYNDOR.find((r) => r.id === story.meta.raceOrigineId)?.sousTitre, CAPITALES);
  const ville =
    precedente?.ville ??
    scene.ville ??
    detecterCapitale(`${story.meta.contexte.lieu} ${story.meta.pointDeDepart}`, CAPITALES) ??
    villeDeRace ??
    VILLE_PAR_DEFAUT;
  let desc: DescriptionScene = precedente ?? { version: 1, ville, joueurNom: story.meta.personnageNom, lieux: [], pnj: [] };
  let lieuJoueur = lieuJoueurPrecedent;
  if (lieuJoueur === undefined) {
    const nomLieu = scene.lieu || story.meta.contexte.lieu || '';
    const connu = lieuDepuisTexte(nomLieu, story.meta.pointDeDepart, story.meta.contexte.objectifs);
    const r = ajouterLieu(desc, connu, connu?.libelle ?? (nomLieu || `les rues de ${ville}`));
    desc = r.desc;
    lieuJoueur = r.lieuId;
  }
  // Ce que l'application a relevé depuis : personnages présents, relations connues.
  for (const nom of scene.presents) desc = ajouterPnjConnu(desc, nom, lieuJoueur);
  for (const r of story.social.relations) desc = ajouterPnjConnu(desc, r.nom, LIEU_AILLEURS, r.faction);
  return { desc, lieuJoueur };
}

/** Lieu visé par un message du joueur (déplacement explicite vers un lieu reconnu). */
export function destinationDuMessage(message: string): LieuConnu | undefined {
  const intention = analyserIntention(message, ROLES_CANON);
  return intention.deplacement ? intention.lieu : undefined;
}
