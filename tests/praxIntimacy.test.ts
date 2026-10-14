import assert from 'node:assert/strict';
import { test } from 'node:test';
import { State } from '../src/prax/core/engine';
import { character } from '../src/prax/core/types';
import {installNativeAdultPractices,verifyAdult,placeAdult,setAdultRestriction,INTIMATE_SCOPES} from '../src/prax/vocab/intimacy';

function world():State{
 const st=new State();
 installNativeAdultPractices(st);
 st.setCharacters([character('alice'),character('bob'),character('carol')]);
 verifyAdult(st,'alice',28);verifyAdult(st,'bob',30);
 placeAdult(st,'alice','inn');placeAdult(st,'bob','inn');
 return st;
}
function go(st:State,actor:string,part:string):void{
 const actions=st.possibleActions(actor).filter(x=>x.label.includes(part));
 assert.equal(actions.length,1,'action non disponible : '+part);
 st.performAction(actions[0]);
}
test('répertoire natif utilisable',()=>{
 const st=world();
 assert.equal(INTIMATE_SCOPES.length,9);
 assert.ok(st.possibleActions('alice').some(x=>x.label.includes('proposer un rapport oral à bob')));
});
test('une offre ne vaut pas accord du destinataire',()=>{
 const st=world();go(st,'alice','proposer un baiser à bob');
 assert.ok(st.dbHas('praxAdult.agree.alice.bob.kiss'));
 assert.ok(!st.dbHas('praxAdult.agree.bob.alice.kiss'));
 assert.ok(!st.possibleActions('alice').some(x=>x.label.includes('commencer un baiser avec bob')));
});
test('deux accords puis action et fin',()=>{
 const st=world();go(st,'alice','proposer un baiser à bob');
 go(st,'bob','accepter un baiser proposé par alice');
 go(st,'alice','commencer un baiser avec bob');
 assert.ok(st.dbHas('praxAdult.active.alice.bob.kiss'));
 go(st,'bob','terminer un baiser avec alice');
 assert.ok(!st.dbHas('praxAdult.active.alice.bob.kiss'));
 assert.ok(st.dbHas('praxAdult.history.alice.bob.kiss'));
});
test('refus et retrait bloquent une action',()=>{
 const st=world();go(st,'alice','proposer un rapport oral à bob');
 go(st,'bob','refuser un rapport oral proposé par alice');
 assert.ok(!st.possibleActions('alice').some(x=>x.label.includes('commencer un rapport oral avec bob')));
 const st2=world();go(st2,'alice','proposer un baiser à bob');
 go(st2,'bob','accepter un baiser proposé par alice');
 go(st2,'bob','retirer son accord pour un baiser avec alice');
 assert.ok(!st2.dbHas('praxAdult.agree.alice.bob.kiss'));
});
test('majorité, captivité et lieu bloquent',()=>{
 const st=world();assert.throws(()=>verifyAdult(st,'carol',17));
 setAdultRestriction(st,'bob','captive',true);
 assert.ok(!st.possibleActions('alice').some(x=>x.label.includes('proposer un rapport vaginal à bob')));
 const st2=world();go(st2,'alice','proposer un baiser à bob');
 placeAdult(st2,'alice','market');
 assert.ok(!st2.dbHas('praxAdult.agree.alice.bob.kiss'));
});
