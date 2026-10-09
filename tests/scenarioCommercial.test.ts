import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIO_INITIAL, validerScenarioCommercial, calculerScenarioCommercial } from '../src/concepteur/scenarioCommercial';
test('scénario commercial : calcul hors taxes avec coûts saisis explicitement',()=>{
  const s={...SCENARIO_INITIAL,abonnesPrevus:100,prixMensuel:25,
    infrastructureMensuelle:400,autresChargesMensuelles:100,fraisPaiementPourcent:2};
  const r=calculerScenarioCommercial(s);
  assert.equal(r.recettes,2500);assert.equal(r.fraisPaiement,50);
  assert.equal(r.charges,550);assert.equal(r.difference,1950);
});
test('scénario commercial : les abonnés et montants invalides sont refusés',()=>{
  assert.throws(()=>validerScenarioCommercial({...SCENARIO_INITIAL,abonnesPrevus:1.5}));
  assert.throws(()=>validerScenarioCommercial({...SCENARIO_INITIAL,prixMensuel:-1}));
});
