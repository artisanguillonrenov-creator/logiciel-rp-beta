/** Planification commerciale HORS LIGNE. Aucun achat, client ou paiement réel. */
export interface ScenarioCommercial {
  schema: 1;
  prixMensuel: number;
  abonnesPrevus: number;
  infrastructureMensuelle: number;
  autresChargesMensuelles: number;
  fraisPaiementPourcent: number;
}
export const SCENARIO_INITIAL: Readonly<ScenarioCommercial> = Object.freeze({
  schema:1,prixMensuel:25,abonnesPrevus:0,infrastructureMensuelle:0,
  autresChargesMensuelles:0,fraisPaiementPourcent:0,
});
const valide = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v>=min && v<=max;
export function validerScenarioCommercial(raw: unknown): ScenarioCommercial {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Scénario commercial invalide.');
  const s=raw as Partial<ScenarioCommercial>;
  if (s.schema!==1 || !valide(s.prixMensuel,1,500) ||
      !valide(s.abonnesPrevus,0,100000) || !Number.isInteger(s.abonnesPrevus) ||
      !valide(s.infrastructureMensuelle,0,1_000_000) ||
      !valide(s.autresChargesMensuelles,0,1_000_000) ||
      !valide(s.fraisPaiementPourcent,0,15)) {
    throw Error('Montants ou abonnés invalides : contrôle les bornes.');
  }
  return {
    schema:1,prixMensuel:Number(s.prixMensuel!.toFixed(2)),abonnesPrevus:s.abonnesPrevus!,
    infrastructureMensuelle:Number(s.infrastructureMensuelle!.toFixed(2)),
    autresChargesMensuelles:Number(s.autresChargesMensuelles!.toFixed(2)),
    fraisPaiementPourcent:Number(s.fraisPaiementPourcent!.toFixed(2)),
  };
}
export function calculerScenarioCommercial(v: ScenarioCommercial) {
  const s=validerScenarioCommercial(v);
  const recettes=s.prixMensuel*s.abonnesPrevus;
  const fraisPaiement=recettes*s.fraisPaiementPourcent/100;
  const charges=SOMME(s.infrastructureMensuelle,s.autresChargesMensuelles,fraisPaiement);
  return { recettes, fraisPaiement, charges, difference:recettes-charges };
}
function SOMME(...xs:number[]):number {return xs.reduce((a,b)=>a+b,0);}
