import AsyncStorage from '@react-native-async-storage/async-storage';
import { creerFileSerie } from '../storage/serialQueue';
import {
  analyserInstantaneAtelier,
  creerConfigurationAtelier,
  modifierEtatAtelier,
  restaurerRevisionAtelier,
  validerConfigurationAtelier,
  type ConfigurationAtelier,
  type EtatAtelier,
} from './configuration';

const CLE = '@elyndor/concepteur/configuration-v1';
const executer = creerFileSerie();
let cache: ConfigurationAtelier | null = null;

async function lireDepuisDisque(): Promise<ConfigurationAtelier> {
  if (cache) return cache;
  const texte = await AsyncStorage.getItem(CLE);
  // Ne jamais écraser automatiquement une configuration corrompue :
  // l'utilisateur doit pouvoir la récupérer pour diagnostic.
  const valeur = texte ? validerConfigurationAtelier(JSON.parse(texte)) : creerConfigurationAtelier();
  cache = valeur;
  return valeur;
}

/** Lecture persistante ; aucun accès aux clés, histoires ou identifiants privés. */
export function lireConfigurationAtelier(): Promise<ConfigurationAtelier> {
  return executer(async () => lireDepuisDisque());
}

/** Transaction sérialisée et persistée avant mise en cache. */
export function enregistrerEtatAtelier(etat: EtatAtelier, motif: string): Promise<ConfigurationAtelier> {
  return executer(async () => {
    const ancien = await lireDepuisDisque();
    const prochain = modifierEtatAtelier(ancien, etat, motif);
    if (prochain !== ancien) {
      await AsyncStorage.setItem(CLE, JSON.stringify(prochain));
      cache = prochain;
    }
    return prochain;
  });
}

export function restaurerConfigurationAtelier(numero: number): Promise<ConfigurationAtelier> {
  return executer(async () => {
    const ancien = await lireDepuisDisque();
    const prochain = restaurerRevisionAtelier(ancien, numero);
    if (prochain !== ancien) {
      await AsyncStorage.setItem(CLE, JSON.stringify(prochain));
      cache = prochain;
    }
    return prochain;
  });
}

export function importerConfigurationAtelier(texte: string): Promise<ConfigurationAtelier> {
  const etat = analyserInstantaneAtelier(texte);
  return enregistrerEtatAtelier(etat, 'Import instantané');
}

/** Tests uniquement : ne supprime rien du stockage réel. */
export function reinitialiserCacheAtelierPourTests() { cache = null; }
