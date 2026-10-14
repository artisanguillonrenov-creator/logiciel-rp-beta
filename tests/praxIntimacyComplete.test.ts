import assert from 'node:assert/strict';
import {test} from 'node:test';
import {State} from '../src/prax/core/engine';
import {character} from '../src/prax/core/types';
import {verifyAdult,placeAdult} from '../src/prax/vocab/intimacy';
import {
 ALL_ADULT_SCOPES, ADULT_ACTION_CATALOGUE,SOCIAL_APPROACHES,
 installCompleteAdultWorld,setAdultBoundary,setAdultPreference,
 setCanonicalFertility,recordMutualProtection,resolveFictionalConception,
 setCanonicalPregnancyStage,setRomanticInterest,setLocalePrivacy,
 recordActualWitness,renderValidatedAdultEvent,classifyFrenchAdultIntent,
 invalidateAllAdultAgreements,placeAdultComplete,setAdultRestrictionComplete,setAdultDuress,
 adultNarrativeWants,
} from '../src/prax/vocab/intimacyComplete';
function world():State{
 const st=new State();installCompleteAdultWorld(st);
 st.setCharacters([character('alice'),character('bob'),character('carol')]);
 verifyAdult(st,'alice',28);verifyAdult(st,'bob',30);
 placeAdult(st,'alice','inn');placeAdult(st,'bob','inn');
 return st;
}
function run(st:State,who:string,label:string):void{
 const hits=st.possibleActions(who).filter(a=>a.label===who+': '+label);
 assert.equal(hits.length,1,label+' missing: '+hits.map(x=>x.label).join(','));
 st.performAction(hits[0]);
}
test('installation idempotente et catégories compatibles Prax',()=>{
 const st=world();installCompleteAdultWorld(st);
 assert.equal(ADULT_ACTION_CATALOGUE.length,30);
 assert.equal(ALL_ADULT_SCOPES.length,39);
 assert.equal(SOCIAL_APPROACHES.length,20);
 assert.ok(st.defs.practices.has('praxAdultExpanded'));
 assert.ok(st.defs.practices.has('praxAdultSocial'));
});
test('accord réciproque pour une nouvelle catégorie',()=>{
 const st=world();
 run(st,'alice','proposer une danse intime à bob');
 assert.ok(!st.possibleActions('alice').some(x=>x.label.includes('commencer une danse intime avec bob')));
 run(st,'bob','accepter une danse intime proposé par alice');
 run(st,'alice','commencer une danse intime avec bob');
 assert.ok(st.dbHas('praxAdult.active.alice.bob.slow_dance'));
 run(st,'bob','terminer une danse intime avec alice');
 assert.ok(st.dbHas('praxAdult.history.alice.bob.slow_dance'));
});
test('refus, limites et retrait protègent les deux personnages',()=>{
 const st=world();
 run(st,'alice','proposer une danse intime à bob');
 run(st,'bob','refuser une danse intime proposé par alice');
 assert.ok(!st.possibleActions('alice').some(x=>x.label.includes('commencer une danse intime')));
 setAdultBoundary(st,'bob','protected_anal',true);
 assert.ok(!st.possibleActions('alice').some(x=>x.label.includes('proposer un rapport anal protégé')));
 const st2=world();run(st2,'alice','proposer une danse intime à bob');
 run(st2,'bob','accepter une danse intime proposé par alice');
 setAdultBoundary(st2,'bob','slow_dance',true);
 assert.ok(!st2.dbHas('praxAdult.agree.alice.bob.slow_dance'));
});
test('psychologie et acceptation sociale sont autonomes',()=>{
 const st=world();
 setAdultPreference(st,'alice','kiss','like');
 setRomanticInterest(st,'alice','bob',true);
 run(st,'alice','flirter avec bob');
 assert.ok(st.dbHas('praxAdult.socialOffer.alice.bob.flirt'));
 assert.ok(!st.dbHas('praxAdult.socialHistory.alice.bob.flirt.accepted'));
 run(st,'bob','répondre favorablement à flirter de alice');
 assert.ok(st.dbHas('praxAdult.socialHistory.alice.bob.flirt.accepted'));
});
test('témoignage uniquement après un fait réel',()=>{
 const st=world();assert.throws(()=>recordActualWitness(st,'carol','alice','bob','cuddle'));
 run(st,'alice','proposer se blottir ensemble à bob');
 run(st,'bob','accepter se blottir ensemble proposé par alice');
 run(st,'alice','commencer se blottir ensemble avec bob');
 run(st,'bob','terminer se blottir ensemble avec alice');
 recordActualWitness(st,'carol','alice','bob','cuddle');
 assert.ok(st.dbHas('praxAdult.witnessed.carol.alice.bob.cuddle'));
});
test('système reproductif fictif : conditions et tirage unique',()=>{
 const st=world();
 setCanonicalFertility(st,'alice','canGestate',true);
 setCanonicalFertility(st,'bob','canContribute',true);
 setCanonicalFertility(st,'alice','fertile',true);
 setCanonicalFertility(st,'bob','fertile',true);
 assert.equal(resolveFictionalConception(st,'alice','bob','meeting1'),'ineligible');
 run(st,'alice','proposer un rapport vaginal à bob');
 run(st,'bob','accepter un rapport vaginal proposé par alice');
 run(st,'alice','commencer un rapport vaginal avec bob');
 run(st,'alice','terminer un rapport vaginal avec bob');
 recordMutualProtection(st,'alice','bob','barrier');
 st.seedDie(1234);
 const result=resolveFictionalConception(st,'alice','bob','meeting1');
 assert.ok(result==='processed'||result==='possiblePregnancy');
 assert.equal(resolveFictionalConception(st,'alice','bob','meeting1'),'processed');
 assert.throws(()=>setCanonicalPregnancyStage(st,'carol','middle'));
});
test('narration soumise aux faits et classification sans action',()=>{
 const st=world();
 assert.throws(()=>renderValidatedAdultEvent(st,{actor:'alice',other:'bob',scope:'oral',phase:'begin'}));
 run(st,'alice','proposer un rapport oral à bob');
 assert.match(renderValidatedAdultEvent(st,{actor:'alice',other:'bob',scope:'oral',phase:'propose'}),/propose/);
 assert.equal(classifyFrenchAdultIntent('je veux proposer un rapport oral')?.scope,'oral');
 assert.ok(!st.dbHas('praxAdult.active.alice.bob.oral'));
});
test('invalidation transversale, confidentialité sans rumeur automatique',()=>{
 const st=world();
 run(st,'alice','proposer une danse intime à bob');
 setLocalePrivacy(st,'inn',true);
 invalidateAllAdultAgreements(st,'alice');
 assert.ok(!st.dbHas('praxAdult.agree.alice.bob.slow_dance'));
 assert.ok(!st.dbHas('praxAdult.witnessed.carol.alice.bob.slow_dance'));
});
test('une personne dont la majorité est inconnue ne peut participer',()=>{
 const st=world();placeAdult(st,'carol','inn');
 assert.equal(st.possibleActions('alice').some(x=>x.label.includes(' à carol')),false);
});

test('retrait : la narration exige un événement, pas une absence d’accord',()=>{
 const st=world();
 assert.throws(()=>renderValidatedAdultEvent(st,{actor:'alice',other:'bob',scope:'kiss',phase:'withdraw'}));
 run(st,'alice','proposer un baiser à bob');
 run(st,'alice','retirer son accord pour un baiser avec bob');
 assert.match(renderValidatedAdultEvent(st,{actor:'alice',other:'bob',scope:'kiss',phase:'withdraw'}),/met fin/);
});
test('les transitions complètes invalident aussi les pratiques supplémentaires',()=>{
 const st=world();
 run(st,'alice','proposer une danse intime à bob');
 placeAdultComplete(st,'alice','courtyard');
 assert.ok(!st.dbHas('praxAdult.agree.alice.bob.slow_dance'));
 placeAdultComplete(st,'alice','inn');
 run(st,'alice','proposer se blottir ensemble à bob');
 setAdultRestrictionComplete(st,'bob','incapacitated',true);
 assert.ok(!st.dbHas('praxAdult.agree.alice.bob.cuddle'));
});
test('contrainte ajoutée suspend les accords et les motivations sont natives',()=>{
 const st=world();
 run(st,'alice','proposer une danse intime à bob');
 setAdultDuress(st,'alice','bob',true);
 assert.ok(!st.dbHas('praxAdult.agree.alice.bob.slow_dance'));
 assert.ok(!st.possibleActions('alice').some(x=>x.label.includes('proposer une danse intime à bob')));
 const wants=adultNarrativeWants('bob','alice',['kiss','cuddle'],5);
 assert.equal(wants.length,2);
 assert.throws(()=>adultNarrativeWants('bob','alice',['kiss'],-1));
});
