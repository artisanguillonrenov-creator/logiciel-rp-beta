/**
 * Références visuelles OPTIONNELLES des fiches du lorebook (personnages,
 * races, villes, lieux, bâtiments, objets). Ce n'est pas un second lorebook :
 * les fiches ne sont pas modifiées, seul un lien fiche → image est enregistré
 * ici, à part. Les images elles-mêmes vivent dans un magasin de fichiers
 * séparé (storage/assetsVisuelsStore) : jamais de base64 dans ces liens, ni
 * dans les fiches, ni dans le contexte du narrateur.
 */
export const SCHEMA_ASSETS_LORE = 1 as const;

export type RoleAssetLore = 'identite' | 'race' | 'decor' | 'architecture' | 'objet';
export const ROLES_ASSET_LORE: readonly RoleAssetLore[] = ['identite', 'race', 'decor', 'architecture', 'objet'];
export const LIBELLES_ROLE_ASSET: Record<RoleAssetLore, string> = {
  identite: 'Identité (visage, allure)',
  race: 'Race',
  decor: 'Décor / lieu',
  architecture: 'Architecture',
  objet: 'Objet',
};

export interface LienAssetLore {
  /** Identifiant du fichier dans le magasin d'assets (jamais une image). */
  assetId: string;
  role: RoleAssetLore;
  libelle: string;
  /** Variante ou état (« de nuit », « en ruine »…). */
  variante?: string;
  ajouteLe: number;
}

export interface EtatAssetsLore {
  schema: typeof SCHEMA_ASSETS_LORE;
  /** Liens par identifiant de fiche (ids du lorebook inchangés). */
  liens: Record<string, LienAssetLore[]>;
}

export const MAX_ASSETS_PAR_FICHE = 8;
const FORME_ASSET = /^asset-[a-z0-9-]{6,60}$/;

export function etatAssetsLoreVide(): EtatAssetsLore {
  return { schema: SCHEMA_ASSETS_LORE, liens: {} };
}

const estObjet = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

export function validerLienAsset(x: unknown): LienAssetLore {
  if (!estObjet(x) || typeof x.assetId !== 'string' || !FORME_ASSET.test(x.assetId)) {
    throw new Error('Référence visuelle invalide : identifiant d’asset attendu (aucune image intégrée).');
  }
  if (!ROLES_ASSET_LORE.includes(x.role as RoleAssetLore)) throw new Error('Rôle de référence visuelle inconnu.');
  if (typeof x.libelle !== 'string' || x.libelle.length > 120) throw new Error('Libellé de référence visuelle invalide.');
  if (x.variante !== undefined && (typeof x.variante !== 'string' || x.variante.length > 80)) throw new Error('Variante invalide.');
  return {
    assetId: x.assetId,
    role: x.role as RoleAssetLore,
    libelle: x.libelle.trim(),
    ...(typeof x.variante === 'string' && x.variante.trim() ? { variante: x.variante.trim() } : {}),
    ajouteLe: typeof x.ajouteLe === 'number' && Number.isFinite(x.ajouteLe) ? x.ajouteLe : 0,
  };
}

export function validerEtatAssetsLore(x: unknown): EtatAssetsLore {
  if (!estObjet(x) || x.schema !== SCHEMA_ASSETS_LORE || !estObjet(x.liens)) throw new Error('Références visuelles du lorebook illisibles.');
  const liens: Record<string, LienAssetLore[]> = {};
  for (const [ficheId, valeurs] of Object.entries(x.liens)) {
    if (!Array.isArray(valeurs) || valeurs.length > MAX_ASSETS_PAR_FICHE || ficheId.length > 160) {
      throw new Error('Références visuelles du lorebook hors limites.');
    }
    liens[ficheId] = valeurs.map(validerLienAsset);
  }
  return { schema: SCHEMA_ASSETS_LORE, liens };
}

export function ajouterLienAsset(etat: EtatAssetsLore, ficheId: string, lien: LienAssetLore): EtatAssetsLore {
  const valide = validerLienAsset(lien);
  const actuels = etat.liens[ficheId] ?? [];
  if (actuels.some((l) => l.assetId === valide.assetId)) return etat;
  if (actuels.length >= MAX_ASSETS_PAR_FICHE) throw new Error(`Au plus ${MAX_ASSETS_PAR_FICHE} références par fiche.`);
  return { ...etat, liens: { ...etat.liens, [ficheId]: [...actuels, valide] } };
}

export function retirerLienAsset(etat: EtatAssetsLore, ficheId: string, assetId: string): EtatAssetsLore {
  const restants = (etat.liens[ficheId] ?? []).filter((l) => l.assetId !== assetId);
  const liens = { ...etat.liens };
  if (restants.length) liens[ficheId] = restants;
  else delete liens[ficheId];
  return { ...etat, liens };
}

export function modifierRoleAsset(etat: EtatAssetsLore, ficheId: string, assetId: string, role: RoleAssetLore): EtatAssetsLore {
  return {
    ...etat,
    liens: { ...etat.liens, [ficheId]: (etat.liens[ficheId] ?? []).map((l) => (l.assetId === assetId ? { ...l, role } : l)) },
  };
}

/** Un asset encore lié à une fiche ? (avant de supprimer son fichier). */
export function assetUtilise(etat: EtatAssetsLore, assetId: string): boolean {
  return Object.values(etat.liens).some((liste) => liste.some((l) => l.assetId === assetId));
}

export function nouvelIdentifiantAsset(): string {
  return `asset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
