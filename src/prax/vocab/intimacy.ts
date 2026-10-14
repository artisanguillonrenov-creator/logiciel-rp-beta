/**
 * Prax — règles NATIVES de relations adultes.
 * Code original MIT, sans dépendance extérieure ou mémoire parallèle.
 * Catégories techniques non graphiques; le planificateur Prax décide.
 */
import { State } from '../core/engine';
import { Condition, matches, neq, not_ } from '../core/query';
import { Action, Practice, action, del, insert, practice } from '../core/types';

export const INTIMATE_SCOPES = [
 {id:'embrace', label:'une étreinte', kind:'affection'},
 {id:'kiss', label:'un baiser', kind:'affection'},
 {id:'caress', label:'des caresses', kind:'affection'},
 {id:'private', label:'une intimité privée', kind:'intimacy'},
 {id:'manual', label:'une stimulation manuelle', kind:'sexual'},
 {id:'oral', label:'un rapport oral', kind:'sexual'},
 {id:'vaginal', label:'un rapport vaginal', kind:'sexual'},
 {id:'anal', label:'un rapport anal', kind:'sexual'},
 {id:'accessory', label:'une interaction avec accessoire', kind:'sexual'},
] as const;
export type IntimateScope = (typeof INTIMATE_SCOPES)[number]['id'];
const p=(...s:string[])=>['praxAdult',...s].join('.');
const offer=(a:string,b:string,s:string)=>p('offer',a,b,s);
const agree=(a:string,b:string,s:string)=>p('agree',a,b,s);
const active=(a:string,b:string,s:string)=>p('active',a,b,s);
const record=(a:string,b:string,s:string)=>p('history',a,b,s);
const deny=(a:string,b:string,s:string)=>p('refusal',a,b,s);
/**
 * Conditions d'éligibilité de deux personnes [Actor] et [Other] pour une portée.
 * Par défaut, les faits `praxAdult.person.*` du module ; un monde qui tient déjà
 * le lieu, l'âge et les statuts (le narrateur Prax) fournit les siennes, pour
 * qu'il n'existe qu'une seule source de vérité.
 */
export type PhaseAdulte='proposer'|'accepter'|'commencer';
export type EligibiliteAdulte=(scope:string,phase:PhaseAdulte)=>Condition[];
const eligible=[
 matches(p('person','Actor','adult')),matches(p('person','Other','adult')),
 neq('Actor','Other'),
 matches(p('person','Actor','at')+'!Place'),matches(p('person','Other','at')+'!Place'),
 not_(p('person','Actor','incapacitated')),not_(p('person','Other','incapacitated')),
 not_(p('person','Actor','captive')),not_(p('person','Other','captive')),
 not_(p('duress','Actor','Other')),not_(p('duress','Other','Actor')),
];
export const eligibiliteParDefaut:EligibiliteAdulte=()=>eligible;
function nativeActions(scope: IntimateScope, label:string, elig:EligibiliteAdulte=eligibiliteParDefaut):Action[]{
 const a=agree('Actor','Other',scope),b=agree('Other','Actor',scope);
 const o=offer('Actor','Other',scope),otherOffer=offer('Other','Actor',scope);
 const running=active('Actor','Other',scope),reverse=active('Other','Actor',scope);
 const bounds=[not_(p('person','Actor','forbid',scope)),not_(p('person','Other','forbid',scope))];
 return [
  action('[Actor]: proposer '+label+' à [Other]',
   [...elig(scope,'proposer'),...bounds,not_(o),not_(a),not_(deny('Other','Actor',scope))],
   [insert(o),insert(a)]),
  action('[Actor]: accepter '+label+' proposé par [Other]',
   [matches(otherOffer),...elig(scope,'accepter'),...bounds,not_(a)],
   [insert(a),del(otherOffer)]),
  action('[Actor]: refuser '+label+' proposé par [Other]',
   [matches(otherOffer),neq('Actor','Other')],
   [del(otherOffer),del(a),del(b),insert(deny('Actor','Other',scope))]),
  action('[Actor]: commencer '+label+' avec [Other]',
   [...elig(scope,'commencer'),...bounds,matches(a),matches(b),not_(running),not_(reverse)],
   [insert(running),insert(reverse)]),
  action('[Actor]: terminer '+label+' avec [Other]',
   [matches(running),neq('Actor','Other')],
   [del(running),del(reverse),del(a),del(b),del(o),del(otherOffer),
    insert(record('Actor','Other',scope)),insert(record('Other','Actor',scope))]),
  action('[Actor]: retirer son accord pour '+label+' avec [Other]',
   [matches(a),neq('Actor','Other')],
   [del(a),del(b),del(o),del(otherOffer),del(running),del(reverse),
    insert(p('withdrawal','Actor','Other',scope))]),
 ];
}
export function nativeAdultPractices(elig:EligibiliteAdulte=eligibiliteParDefaut):Practice[]{
 return [practice('praxAdultInteractions',{
  name:'Interactions adultes autonomes',
  roles:['World'],
  actions:INTIMATE_SCOPES.flatMap(s=>nativeActions(s.id,s.label,elig))
 })];
}
export function installNativeAdultPractices(st:State,elig:EligibiliteAdulte=eligibiliteParDefaut):void{
 if(!st.defs.practices.has('praxAdultInteractions'))st.definePractices(nativeAdultPractices(elig));
 if(!st.dbHas('practice.praxAdultInteractions.world'))st.performOutcome(insert('practice.praxAdultInteractions.world'));
}
function validateName(id:string):void{
 if(!/^[A-Za-z_][A-Za-z_0-9-]{0,80}$/.test(id))throw new Error('Identifiant Prax incorrect');
}
/** Age fourni exclusivement par les données canoniques, jamais par un texte libre. */
export function verifyAdult(st:State,id:string,age:number):void{
 validateName(id);
 if(!Number.isSafeInteger(age)||age<18)throw new Error('Majorité non établie');
 st.performOutcome(insert(p('person',id,'age')+'!'+String(age)));
 st.performOutcome(insert(p('person',id,'adult')));
}
/** Invalide les accords de deux personnes après déménagement ou perte de capacité. */
export function invalidateAgreements(st:State,id:string):void{
 validateName(id);
 for(const other of st.dbChildKeys(p('person'))){
  if(id===other)continue;
  for(const {id:scope} of INTIMATE_SCOPES){
   for(const [a,b] of [[id,other],[other,id]]){
    st.performOutcome(del(agree(a,b,scope)));
    st.performOutcome(del(offer(a,b,scope)));
    st.performOutcome(del(active(a,b,scope)));
   }
  }
 }
}
export function placeAdult(st:State,id:string,where:string):void{
 validateName(id);validateName(where);
 invalidateAgreements(st,id);
 st.performOutcome(insert(p('person',id,'at')+'!'+where));
}
export function setAdultRestriction(st:State,id:string,restriction:'incapacitated'|'captive',yes:boolean):void{
 validateName(id);
 st.performOutcome(yes?insert(p('person',id,restriction)):del(p('person',id,restriction)));
 if(yes)invalidateAgreements(st,id);
}
/** Libellé non graphique d'une action calculée : ne déclare jamais sa réussite. */
export function adultEventLabel(scope:IntimateScope,verb:'proposer'|'accepter'|'refuser'|'commencer'|'terminer'):string{
 const found=INTIMATE_SCOPES.find(s=>s.id===scope);
 if(!found)throw new Error('Catégorie inconnue');
 return verb+' '+found.label;
}
