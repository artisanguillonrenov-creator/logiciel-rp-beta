import type { ElyndorEntryChargee } from '../engine/loreLoader';
import { infererScopeLore, normaliserLore, type ScopeLore } from '../engine/loreScoring';

/** Les 102 fiches d'origine restent intactes ; seules les différences sont enregistrées. */
export const LORE_SCHEMA = 1 as const;
export interface FicheEditable {
  titre: string;
  contenu: string;
  category: string;
  priority: number;
  constant: boolean;
  scope: ScopeLore;
  primaryKeys: string[];
  secondaryKeys: string[];
  negativeKeys: string[];
  dossiers: string[];
  actif: boolean;
}
export interface RevisionLore {
  numero: number;
  date: number;
  motif: string;
  changements: Record<string, FicheEditable>;
  ajouts: Record<string, FicheEditable>;
  brouillons: Record<string, FicheEditable>;
}
export interface EtatLore {
  schema: typeof LORE_SCHEMA;
  numero: number;
  date: number;
  changements: Record<string, FicheEditable>;
  ajouts: Record<string, FicheEditable>;
  brouillons: Record<string, FicheEditable>;
  historique: RevisionLore[];
}
export interface FicheAffichee extends FicheEditable {
  id: string;
  protegee: boolean;
  origine: 'canon' | 'ajout';
  brouillon: boolean;
  modifiee: boolean;
}
const SCOPES: ScopeLore[] = ['GLOBAL', 'CONTINENT', 'REGION', 'CITY', 'FACTION', 'CHARACTER', 'SCENE'];
const estObjet = (x: unknown): x is Record<string, unknown> =>
  x !== null && typeof x === 'object' && !Array.isArray(x);
const copie = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
function liste(x: unknown, champ: string, limite = 32): string[] {
  if (!Array.isArray(x) || x.length > limite || x.some(v => typeof v !== 'string' || v.length > 120)) {
    throw new Error('Liste invalide : ' + champ);
  }
  return [...new Set(x.map((v: string) => v.trim()).filter(Boolean))];
}
function texte(x: unknown, champ: string, maximum: number): string {
  if (typeof x !== 'string' || x.trim().length === 0 || x.length > maximum) {
    throw new Error(champ + ' requis (maximum ' + maximum + ' caractères).');
  }
  return x.trim();
}
export function validerFiche(x: unknown): FicheEditable {
  if (!estObjet(x)) throw new Error('Fiche invalide.');
  if (!Number.isInteger(x.priority) || Number(x.priority) < 0 || Number(x.priority) > 100) {
    throw new Error('Priorité : entier de 0 à 100.');
  }
  if (typeof x.constant !== 'boolean' || typeof x.actif !== 'boolean' || !SCOPES.includes(x.scope as ScopeLore)) {
    throw new Error('Activation ou portée invalide.');
  }
  return {
    titre: texte(x.titre, 'Titre', 150),
    contenu: texte(x.contenu, 'Contenu', 30000),
    category: texte(x.category, 'Catégorie', 60),
    priority: Number(x.priority),
    constant: x.constant,
    scope: x.scope as ScopeLore,
    primaryKeys: liste(x.primaryKeys, 'principaux'),
    secondaryKeys: liste(x.secondaryKeys, 'secondaires'),
    negativeKeys: liste(x.negativeKeys, 'exclusions'),
    dossiers: liste(x.dossiers, 'dossiers', 12).map(s => s.replace(/\\/g, '/').replace(/\/+/g, '/')),
    actif: x.actif,
  };
}
export function creerEtatLore(): EtatLore {
  return { schema: LORE_SCHEMA, numero: 1, date: Date.now(), changements: {}, ajouts: {}, brouillons: {}, historique: [] };
}
function lireFiches(raw: unknown, maximum: number): Record<string, FicheEditable> {
  if (!estObjet(raw) || Object.keys(raw).length > maximum) throw new Error('Trop de fiches ou données incorrectes.');
  const v: Record<string, FicheEditable> = {};
  for (const [id, data] of Object.entries(raw)) {
    if (!/^(elyndor-\d{1,6}|atelier-[a-z0-9-]{8,75})$/.test(id) || id === '__proto__') {
      throw new Error('Identifiant de fiche invalide.');
    }
    Object.defineProperty(v, id, { value: validerFiche(data), enumerable: true, writable: true, configurable: true });
  }
  return v;
}
export function validerEtatLore(raw: unknown): EtatLore {
  if (!estObjet(raw) || raw.schema !== LORE_SCHEMA || !Number.isSafeInteger(raw.numero) || Number(raw.numero) < 1) {
    throw new Error('Version de Lorebook incompatible. Aucun changement appliqué.');
  }
  const changements = lireFiches(raw.changements, 300);
  const ajouts = lireFiches(raw.ajouts, 250);
  const brouillons = lireFiches(raw.brouillons, 350);
  if (Object.keys(ajouts).some(id => !id.startsWith('atelier-'))) throw new Error('Ajout de fiche incorrect.');
  const historique: RevisionLore[] = [];
  if (Array.isArray(raw.historique)) {
    for (const h of raw.historique.slice(-8)) {
      if (!estObjet(h) || !Number.isSafeInteger(h.numero) || typeof h.date !== 'number' ||
          typeof h.motif !== 'string' || h.motif.length > 120) continue;
      try {
        historique.push({ numero: Number(h.numero), date: h.date, motif: h.motif,
          changements: lireFiches(h.changements, 300), ajouts: lireFiches(h.ajouts, 250),
          brouillons: lireFiches(h.brouillons, 350) });
      } catch { /* anciennes révisions invalides ignorées, courant conservé */ }
    }
  }
  return { schema: LORE_SCHEMA, numero: Number(raw.numero),
    date: typeof raw.date === 'number' ? raw.date : Date.now(),
    changements, ajouts, brouillons, historique };
}
export function modifierEtatLore(actuel: EtatLore, changement: Pick<EtatLore, 'changements' | 'ajouts' | 'brouillons'>, motif: string): EtatLore {
  const resultat = validerEtatLore({ ...actuel, ...changement, historique: [] });
  if (JSON.stringify([actuel.changements, actuel.ajouts, actuel.brouillons]) ===
      JSON.stringify([resultat.changements, resultat.ajouts, resultat.brouillons])) return actuel;
  const precedent: RevisionLore = { numero: actuel.numero, date: actuel.date, motif: motif.slice(0, 120),
    changements: copie(actuel.changements), ajouts: copie(actuel.ajouts), brouillons: copie(actuel.brouillons) };
  return { ...resultat, numero: actuel.numero + 1, date: Date.now(),
    historique: [...actuel.historique, precedent].slice(-8) };
}
export function restaurerRevisionLore(actuel: EtatLore, numero: number): EtatLore {
  const revision = actuel.historique.find(r => r.numero === numero);
  if (!revision) throw new Error('Révision introuvable.');
  return modifierEtatLore(actuel, revision, 'Restauration révision ' + numero);
}
export function ficheOrigine(e: ElyndorEntryChargee): FicheEditable {
  return validerFiche({
    titre: e.titre.replace(/^\[[^\]]+\]\s*/, ''),
    category: e.category ?? 'MONDE',
    contenu: e.contenu,
    priority: e.priority,
    constant: e.constant,
    scope: e.scope ?? infererScopeLore(e.category),
    primaryKeys: e.primaryKeys ?? [], secondaryKeys: e.secondaryKeys ?? [],
    negativeKeys: e.negativeKeys ?? [],
    dossiers: [], actif: true,
  });
}
export function ficheProtegee(f: FicheEditable, id: string): boolean {
  const cat = normaliserLore(f.category);
  return id.startsWith('elyndor-') && (f.constant ||
    ['royaume', 'recurrent', 'profil', 'profil racial', 'physique'].some(s => cat.includes(s)) ||
    /^(presentation d elyndor|parametres d elyndor)/.test(normaliserLore(f.titre)));
}
export function listerFichesLore(entrees: ElyndorEntryChargee[], etat: EtatLore, avecBrouillons = true): FicheAffichee[] {
  const result: FicheAffichee[] = [];
  const ids = new Set<string>();
  for (const e of entrees) {
    ids.add(e.id);
    const originale = ficheOrigine(e);
    const fiche = etat.changements[e.id] ?? originale;
    const brouillon = avecBrouillons ? etat.brouillons[e.id] : undefined;
    result.push({ ...fiche, id: e.id, protegee: ficheProtegee(originale, e.id),
      origine: 'canon', brouillon: !!brouillon, modifiee: !!etat.changements[e.id] });
  }
  for (const [id, fiche] of Object.entries(etat.ajouts)) {
    ids.add(id);
    result.push({ ...fiche, id, protegee: false, origine: 'ajout',
      brouillon: !!etat.brouillons[id], modifiee: true });
  }
  if (avecBrouillons) {
    for (const [id, fiche] of Object.entries(etat.brouillons)) {
      if (ids.has(id)) continue;
      result.push({ ...fiche, id, protegee: false, origine: 'ajout', brouillon: true, modifiee: true });
    }
  }
  return result;
}
export function enregistrerFicheLore(etat: EtatLore, base: ElyndorEntryChargee[], id: string, valeur: FicheEditable, brouillonForce = false): EtatLore {
  const fiche = validerFiche(valeur);
  const originale = base.find(e => e.id === id);
  if (!originale && !id.startsWith('atelier-')) throw new Error('Cette fiche canonique est introuvable.');
  const protege = originale ? ficheProtegee(ficheOrigine(originale), id) : false;
  const changements = { ...etat.changements }, ajouts = { ...etat.ajouts }, brouillons = { ...etat.brouillons };
  if (protege || brouillonForce || (!originale && !ajouts[id])) {
    brouillons[id] = fiche;
  } else if (originale) {
    changements[id] = fiche; delete brouillons[id];
  } else {
    ajouts[id] = fiche; delete brouillons[id];
  }
  return modifierEtatLore(etat, { changements, ajouts, brouillons }, 'Édition ' + id);
}
export function publierBrouillonLore(etat: EtatLore, id: string): EtatLore {
  const valeur = etat.brouillons[id];
  if (!valeur) throw new Error('Aucun brouillon à publier.');
  const changements = { ...etat.changements }, ajouts = { ...etat.ajouts }, brouillons = { ...etat.brouillons };
  if (id.startsWith('atelier-')) ajouts[id] = valeur;
  else changements[id] = valeur;
  delete brouillons[id];
  return modifierEtatLore(etat, { changements, ajouts, brouillons }, 'Publication ' + id);
}
export function abandonnerBrouillonLore(etat: EtatLore, id: string): EtatLore {
  const brouillons = { ...etat.brouillons };
  delete brouillons[id];
  return modifierEtatLore(etat, { changements: etat.changements, ajouts: etat.ajouts, brouillons }, 'Abandon ' + id);
}
export function supprimerAjoutLore(etat: EtatLore, id: string): EtatLore {
  if (!id.startsWith('atelier-')) throw new Error('Le canon original ne peut pas être supprimé.');
  const ajouts = { ...etat.ajouts }, brouillons = { ...etat.brouillons };
  delete ajouts[id]; delete brouillons[id];
  return modifierEtatLore(etat, { changements: etat.changements, ajouts, brouillons }, 'Suppression ' + id);
}
export function appliquerLorePublie(entrees: ElyndorEntryChargee[], etat: EtatLore): ElyndorEntryChargee[] {
  return listerFichesLore(entrees, etat, false).filter(f => f.actif).map(f => ({
    id: f.id, titre: '[' + f.category + '] ' + f.titre, contenu: f.contenu,
    category: f.category, scope: f.scope, constant: f.constant, priority: f.priority,
    motsClesPrimaires: f.primaryKeys, motsClesSecondaires: f.secondaryKeys,
    motsClesNegatifs: f.negativeKeys, primaryKeys: f.primaryKeys,
    secondaryKeys: f.secondaryKeys, negativeKeys: f.negativeKeys,
  }));
}
export function signalerDoublonsLore(cible: FicheEditable, fiches: FicheAffichee[], id?: string): string[] {
  const nom = normaliserLore(cible.titre);
  return fiches.filter(f => f.id !== id && normaliserLore(f.titre) === nom)
    .map(f => f.titre + ' (' + f.category + ')');
}
export function creerExportLore(etat: EtatLore): string {
  return JSON.stringify({ format: 'elyndor-lorebook-atelier', schema: LORE_SCHEMA,
    exporteLe: new Date().toISOString(), etat: { ...etat, historique: [] } }, null, 2);
}
export function analyserImportLore(texteJson: string): EtatLore {
  if (texteJson.length > 1_500_000) throw new Error('Import trop volumineux.');
  let brut: unknown;
  try { brut = JSON.parse(texteJson); } catch { throw new Error('JSON invalide.'); }
  if (!estObjet(brut) || brut.format !== 'elyndor-lorebook-atelier' || brut.schema !== LORE_SCHEMA)
    throw new Error('Export de Lorebook incompatible.');
  return validerEtatLore(brut.etat);
}
