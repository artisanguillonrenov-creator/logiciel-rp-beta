/**
 * Les familles de faits réservées au moteur et au compilateur de scripts
 * (`Prax.TypeCheck.reservedFamilies`). Aucune règle, action ou désir ÉCRIT ne
 * peut les écrire ; les règles installées par la porte du compilateur en sont
 * exemptées par provenance (v53).
 */
export const TURN_PATH = 'turn';
export const CONTRADICTION_PATH = 'contradiction';
export const SCENE_PATIENCE_FAMILY = 'scenePatience';
export const CURRENT_SCENE_PATH = 'currentScene';
export const RESERVED_FAMILIES: readonly string[] = [TURN_PATH, CONTRADICTION_PATH, SCENE_PATIENCE_FAMILY, CURRENT_SCENE_PATH];

/** Le marqueur de patience de la jonction minutée `jname` de la scène `sid`. */
export function scenePatiencePath(sid: string, jname: string): string {
  return `${SCENE_PATIENCE_FAMILY}.${sid}.${jname}`;
}
