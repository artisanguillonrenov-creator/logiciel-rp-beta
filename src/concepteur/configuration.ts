import { reglagesNarrateurDefaut, validerReglagesNarrateur, type ReglagesNarrateur } from './reglagesNarrateur';

/**
 * Contrat V1 de l'atelier concepteur. Ce fichier est pur (ni React, ni Android).
 * Le joueur standard reste sur les valeurs de production historiques.
 */
export const SCHEMA_ATELIER = 1 as const;
export type ProfilAtelier = 'production' | 'test' | 'benchmark';
export const PROFILS_ATELIER: ProfilAtelier[] = ['production', 'test', 'benchmark'];

export interface ParametresAtelier {
  budgetLorePassages: number;
  maxSouvenirs: number;
  temperatureDelta: number;
  margeTokensEtat: number;
  narrateur: ReglagesNarrateur;
}
export interface EtatAtelier {
  profilActif: ProfilAtelier;
  profils: Record<ProfilAtelier, ParametresAtelier>;
}
export interface RevisionAtelier {
  numero: number;
  date: number;
  motif: string;
  etat: EtatAtelier;
}
export interface ConfigurationAtelier extends EtatAtelier {
  schema: typeof SCHEMA_ATELIER;
  numero: number;
  date: number;
  historique: RevisionAtelier[];
}
export interface InstantaneAtelier {
  format: 'elyndor-atelier-configuration';
  schema: typeof SCHEMA_ATELIER;
  versionApplication: string;
  commitBundle: string;
  exporteLe: string;
  configuration: EtatAtelier;
}
export const PARAMETRES_DEFAUT: Readonly<ParametresAtelier> = Object.freeze({
  budgetLorePassages: 2500,
  maxSouvenirs: 3,
  temperatureDelta: 0,
  margeTokensEtat: 350,
  narrateur: reglagesNarrateurDefaut(),
});
export type CleParametreSimple = Exclude<keyof ParametresAtelier, 'narrateur'>;
export const LIMITES_ATELIER: Readonly<Record<CleParametreSimple, { min: number; max: number; pas: number }>> = Object.freeze({
  budgetLorePassages: { min: 1000, max: 5000, pas: 250 },
  maxSouvenirs: { min: 1, max: 8, pas: 1 },
  temperatureDelta: { min: -0.3, max: 0.3, pas: 0.05 },
  margeTokensEtat: { min: 250, max: 1000, pas: 50 },
});

function objet(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function copierParametres(v: ParametresAtelier): ParametresAtelier {
  return { ...v, narrateur: validerReglagesNarrateur(v.narrateur) };
}
function copierEtat(v: EtatAtelier): EtatAtelier {
  return { profilActif: v.profilActif, profils: {
    production: copierParametres(v.profils.production),
    test: copierParametres(v.profils.test),
    benchmark: copierParametres(v.profils.benchmark),
  } };
}
export function creerConfigurationAtelier(date = Date.now()): ConfigurationAtelier {
  return { schema: SCHEMA_ATELIER, numero: 1, date, historique: [], profilActif: 'production',
    profils: {
      production: copierParametres(PARAMETRES_DEFAUT),
      test: copierParametres(PARAMETRES_DEFAUT),
      benchmark: copierParametres(PARAMETRES_DEFAUT),
    },
  };
}
function lireParametres(v: unknown): ParametresAtelier {
  if (!objet(v)) throw new Error('Paramètres de profil invalides.');
  const p = {} as ParametresAtelier;
  for (const nom of Object.keys(LIMITES_ATELIER) as CleParametreSimple[]) {
    const valeur = v[nom], limites = LIMITES_ATELIER[nom];
    if (typeof valeur !== 'number' || !Number.isFinite(valeur) ||
        valeur < limites.min || valeur > limites.max ||
        (nom !== 'temperatureDelta' && !Number.isInteger(valeur))) {
      throw new Error('Valeur incompatible : ' + nom);
    }
    p[nom] = valeur;
  }
  // Migration transparente des instantanés V1 créés avant l'atelier narrateur.
  p.narrateur = v.narrateur === undefined ? reglagesNarrateurDefaut() : validerReglagesNarrateur(v.narrateur);
  return p;
}
export function validerEtatAtelier(raw: unknown): EtatAtelier {
  if (!objet(raw) || !PROFILS_ATELIER.includes(raw.profilActif as ProfilAtelier) || !objet(raw.profils)) {
    throw new Error('Configuration atelier incompatible.');
  }
  return { profilActif: raw.profilActif as ProfilAtelier, profils: {
    production: lireParametres(raw.profils.production),
    test: lireParametres(raw.profils.test),
    benchmark: lireParametres(raw.profils.benchmark),
  } };
}
export function validerConfigurationAtelier(raw: unknown): ConfigurationAtelier {
  if (!objet(raw) || raw.schema !== SCHEMA_ATELIER || !Number.isSafeInteger(raw.numero) ||
      (raw.numero as number) < 1 || typeof raw.date !== 'number') {
    throw new Error('Version de configuration inconnue. Aucune donnée modifiée.');
  }
  const etat = validerEtatAtelier(raw);
  // L'historique importé n'est pas nécessaire pour restaurer un instantané ;
  // seules les révisions valides sont retenues, avec des bornes strictes.
  const historique: RevisionAtelier[] = [];
  if (Array.isArray(raw.historique)) {
    for (const h of raw.historique.slice(-20)) {
      if (!objet(h) || !Number.isSafeInteger(h.numero) || typeof h.date !== 'number' ||
          typeof h.motif !== 'string' || h.motif.length > 100) continue;
      try { historique.push({ numero: h.numero as number, date: h.date, motif: h.motif,
        etat: validerEtatAtelier(h.etat) }); } catch { /* révision incompatible ignorée */ }
    }
  }
  return { ...etat, schema: SCHEMA_ATELIER, numero: raw.numero as number,
    date: raw.date, historique };
}
export function modifierEtatAtelier(
  actuel: ConfigurationAtelier, etat: EtatAtelier, motif: string, date = Date.now(),
): ConfigurationAtelier {
  const valide = validerEtatAtelier(etat);
  if (JSON.stringify(copierEtat(actuel)) === JSON.stringify(valide)) return actuel;
  const revision: RevisionAtelier = { numero: actuel.numero, date: actuel.date,
    motif: motif.slice(0, 100), etat: copierEtat(actuel) };
  return { ...valide, schema: SCHEMA_ATELIER, numero: actuel.numero + 1, date,
    historique: [...actuel.historique, revision].slice(-20) };
}
export function restaurerRevisionAtelier(
  actuel: ConfigurationAtelier, numero: number, date = Date.now(),
): ConfigurationAtelier {
  const cible = actuel.historique.find((x) => x.numero === numero);
  if (!cible) throw new Error('Révision introuvable.');
  return modifierEtatAtelier(actuel, cible.etat, 'Restauration révision ' + numero, date);
}
export function creerInstantaneAtelier(
  config: ConfigurationAtelier, versionApplication: string, commitBundle: string,
  date = new Date(),
): InstantaneAtelier {
  return { format: 'elyndor-atelier-configuration', schema: SCHEMA_ATELIER,
    versionApplication, commitBundle, exporteLe: date.toISOString(),
    configuration: copierEtat(config) };
}
export function analyserInstantaneAtelier(texte: string): EtatAtelier {
  if (texte.length > 65536) throw new Error('Instantané trop volumineux.');
  let objetImporte: unknown;
  try { objetImporte = JSON.parse(texte); } catch { throw new Error('Le fichier ne contient pas de JSON valide.'); }
  if (!objet(objetImporte) || objetImporte.format !== 'elyndor-atelier-configuration' ||
      objetImporte.schema !== SCHEMA_ATELIER) {
    throw new Error("Ce n'est pas un instantané de configuration Elyndor compatible.");
  }
  return validerEtatAtelier(objetImporte.configuration);
}
