import type { ElyndorEntryChargee } from './loreLoader';
import type { EtatAssetsLore, RoleAssetLore } from '../concepteur/assetsLore';
import type { ContratVisuel } from './contratVisuel';
import type { RoleReference, TypeReferenceCandidate } from './moteurVisuel';
import { contientExpression } from './texteRecherche';

/**
 * Choix (pur) des images du lorebook pertinentes pour un contrat : lieu
 * ACTUEL, personnages visibles et leur race. Le chargement des fichiers se
 * fait ailleurs ; un asset manquant devient une référence écartée et
 * expliquée, jamais une erreur bloquante.
 */
export interface CandidatLore {
  id: string;
  assetId: string;
  type: TypeReferenceCandidate;
  role: RoleReference;
  libelle: string;
  entite?: string;
  lieu?: string;
}

const ROLE_LORE: Record<RoleAssetLore, RoleReference> = {
  identite: 'identite', race: 'race', decor: 'decor', architecture: 'decor', objet: 'decor',
};

function reperes(fiche: ElyndorEntryChargee): string[] {
  return [fiche.titre, ...(fiche.primaryKeys ?? [])].filter(Boolean);
}

function ficheCiteDans(fiche: ElyndorEntryChargee, textes: readonly string[]): boolean {
  return textes.some((t) => reperes(fiche).some((r) => r.length > 2 && contientExpression(t, r)));
}

export function candidatsLorePourContrat(
  contrat: ContratVisuel,
  pool: readonly ElyndorEntryChargee[],
  etat: EtatAssetsLore,
  racesVisibles: ReadonlyMap<string, string> = new Map(),
): CandidatLore[] {
  const sortie: CandidatLore[] = [];
  for (const fiche of pool) {
    const liens = etat.liens[fiche.id];
    if (!liens?.length) continue;
    for (const lien of liens) {
      const role = ROLE_LORE[lien.role];
      const base = { id: `lore:${lien.assetId}`, assetId: lien.assetId, type: 'lieu' as const, libelle: `${fiche.titre} — ${lien.libelle || lien.role}${lien.variante ? ` (${lien.variante})` : ''}` };
      if (role === 'decor') {
        if (ficheCiteDans(fiche, contrat.lieu)) sortie.push({ ...base, role, lieu: contrat.lieu.find((l) => reperes(fiche).some((r) => contientExpression(l, r))) ?? fiche.titre });
        continue;
      }
      if (role === 'identite') {
        const p = contrat.personnages.find((x) => reperes(fiche).some((r) => contientExpression(x.nom, r) || contientExpression(r, x.nom)));
        if (p) sortie.push({ ...base, type: 'manuelle', role, entite: p.cle });
        continue;
      }
      for (const [cle, nomRace] of racesVisibles) {
        if (reperes(fiche).some((r) => contientExpression(r, nomRace) || contientExpression(nomRace, r))) {
          sortie.push({ ...base, id: `${base.id}:${cle}`, type: 'race', role, entite: cle });
        }
      }
    }
  }
  return sortie;
}
