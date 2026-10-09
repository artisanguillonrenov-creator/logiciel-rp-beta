import { creerFileSerie } from '../storage/serialQueue';
import { SCENARIO_INITIAL, validerScenarioCommercial, type ScenarioCommercial } from './scenarioCommercial';
const CLE = '@elyndor/concepteur/commercial-scenario-v1';
const queue=creerFileSerie();
let cache: ScenarioCommercial | null=null;
function stockage(){
  return require('@react-native-async-storage/async-storage').default as typeof import('@react-native-async-storage/async-storage').default;
}
export function lireScenarioCommercial():Promise<ScenarioCommercial>{
  return queue(async()=>{
    if(cache)return cache;
    const brut=await stockage().getItem(CLE);
    cache=brut?validerScenarioCommercial(JSON.parse(brut)):{...SCENARIO_INITIAL};
    return cache;
  });
}
export function enregistrerScenarioCommercial(input:ScenarioCommercial):Promise<ScenarioCommercial>{
  const valide=validerScenarioCommercial(input);
  return queue(async()=>{
    await stockage().setItem(CLE,JSON.stringify(valide));
    cache=valide;
    return valide;
  });
}
export function reinitialiserCacheCommercialPourTests(){cache=null;}
