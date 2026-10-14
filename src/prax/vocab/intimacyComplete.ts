/**
 * Prax — approfondissement NATIF de la vie affective et de l'intimité adulte.
 * (c) Prax-Elyndor contributors, MIT — code original.
 *
 * Cinq socles : actes/accords, catalogue des situations, physiologie fictive,
 * psychologie/société, narration factuelle. Tout état persistant est un fait
 * du State Prax existant. Aucune base, boucle ou IA secondaire.
 *
 * Les descriptions ici sont volontairement non graphiques.
 */
import { State } from '../core/engine';
import { Condition, matches, neq, not_ } from '../core/query';
import { draw } from '../core/rng';
import { Action, Outcome, Practice, Want, action, del, insert, practice, want } from '../core/types';
import { adjustScore, coreFns } from './coreModel';
import {
 INTIMATE_SCOPES, installNativeAdultPractices, invalidateAgreements,
 placeAdult, setAdultRestriction,
 type IntimateScope,
} from './intimacy';

const path=(...parts:string[]):string=>['praxAdult',...parts].join('.');
const valid=(x:string):void=>{
 if(!/^[A-Za-z_][A-Za-z_0-9-]{0,80}$/.test(x))throw new Error('Identifiant Prax incorrect');
};
const pair=(a:string,b:string):readonly [string,string]=>a<b?[a,b]:[b,a];
const offer=(a:string,b:string,s:string)=>path('offer',a,b,s);
const agree=(a:string,b:string,s:string)=>path('agree',a,b,s);
const active=(a:string,b:string,s:string)=>path('active',a,b,s);
const history=(a:string,b:string,s:string)=>path('history',a,b,s);
const refusal=(a:string,b:string,s:string)=>path('refusal',a,b,s);
const boundary=(a:string,s:string)=>path('person',a,'forbid',s);
const loc=(a:string)=>path('person',a,'at')+'!Place';
const adult=(a:string)=>path('person',a,'adult');

/** Un acte est une catégorie de simulation, pas un paragraphe prédéfini. */
export const ADULT_ACTION_CATALOGUE = [
 {id:'holding_hands',label:'se tenir la main',type:'affection'},
 {id:'slow_dance',label:'une danse intime',type:'affection'},
 {id:'forehead_kiss',label:'un baiser sur le front',type:'affection'},
 {id:'cheek_kiss',label:'un baiser sur la joue',type:'affection'},
 {id:'long_kiss',label:'un long baiser',type:'affection'},
 {id:'cuddle',label:'se blottir ensemble',type:'affection'},
 {id:'shared_bed',label:'partager un lit',type:'affection'},
 {id:'comfort',label:'réconforter intimement',type:'care'},
 {id:'aftercare',label:'prendre soin après une intimité',type:'care'},
 {id:'massage',label:'un massage',type:'sensual'},
 {id:'sensual_touch',label:'des contacts sensuels',type:'sensual'},
 {id:'sensual_kissing',label:'des baisers sensuels',type:'sensual'},
 {id:'mutual_exploration',label:'une exploration intime réciproque',type:'sensual'},
 {id:'mutual_manual',label:'une stimulation manuelle réciproque',type:'sexual'},
 {id:'protected_oral',label:'un rapport oral protégé',type:'sexual'},
 {id:'protected_vaginal',label:'un rapport vaginal protégé',type:'sexual'},
 {id:'protected_anal',label:'un rapport anal protégé',type:'sexual'},
 {id:'intimate_roleplay',label:'un jeu de rôle intime',type:'sexual'},
 {id:'mutual_intimacy',label:'une intimité réciproque',type:'sexual'},
 {id:'intimate_accessory',label:'une intimité avec accessoires',type:'sexual'},
 {id:'solo_private',label:'une intimité individuelle en présence de l’autre',type:'sexual'},
 {id:'private_retreat',label:'se retirer dans un lieu intime',type:'intimacy'},
 {id:'intimacy_reassurance',label:'se rassurer mutuellement',type:'care'},
 {id:'rest_together',label:'se reposer ensemble',type:'care'},
 {id:'discuss_protection',label:'discuter de protection',type:'discussion'},
 {id:'discuss_fertility',label:'discuter de fertilité',type:'discussion'},
 {id:'discuss_boundaries',label:'clarifier les limites intimes',type:'discussion'},
 {id:'discuss_preferences',label:'partager des préférences intimes',type:'discussion'},
 {id:'discuss_exclusivity',label:'discuter de fidélité',type:'discussion'},
 {id:'discuss_privacy',label:'discuter de confidentialité',type:'discussion'},
] as const;
export type ExtendedScope=(typeof ADULT_ACTION_CATALOGUE)[number]['id'];
export type AnyScope=IntimateScope|ExtendedScope;
export const ALL_ADULT_SCOPES:readonly AnyScope[]=[
 ...INTIMATE_SCOPES.map(s=>s.id),...ADULT_ACTION_CATALOGUE.map(s=>s.id),
];
export const ALL_ADULT_LABELS:Readonly<Record<string,string>>=
 Object.fromEntries([...INTIMATE_SCOPES,...ADULT_ACTION_CATALOGUE].map(x=>[x.id,x.label]));

const eligible:readonly Condition[]=[
 matches(adult('Actor')),matches(adult('Other')),neq('Actor','Other'),
 matches(loc('Actor')),matches(loc('Other')),
 not_(path('person','Actor','incapacitated')),not_(path('person','Other','incapacitated')),
 not_(path('person','Actor','captive')),not_(path('person','Other','captive')),
 not_(path('duress','Actor','Other')),not_(path('duress','Other','Actor')),
];
const accepted=(a:string,b:string,s:string)=>[matches(agree(a,b,s)),matches(agree(b,a,s))];

/** Socle II : mêmes garanties que les 9 portées initiales, pour chaque acte nouveau. */
function scopeActions(scope:ExtendedScope,label:string):Action[]{
 const mine=agree('Actor','Other',scope),theirs=agree('Other','Actor',scope);
 const myOffer=offer('Actor','Other',scope),theirOffer=offer('Other','Actor',scope);
 const mineActive=active('Actor','Other',scope),theirActive=active('Other','Actor',scope);
 const bounds=[not_(boundary('Actor',scope)),not_(boundary('Other',scope))];
 return [
  action('[Actor]: proposer '+label+' à [Other]',
   [...eligible,...bounds,not_(myOffer),not_(mine),not_(refusal('Other','Actor',scope))],
   [insert(myOffer),insert(mine)]),
  action('[Actor]: accepter '+label+' proposé par [Other]',
   [...eligible,...bounds,matches(theirOffer),not_(mine)],
   [insert(mine),del(theirOffer)]),
  action('[Actor]: refuser '+label+' proposé par [Other]',
   [matches(theirOffer),neq('Actor','Other')],
   [del(theirOffer),del(mine),del(theirs),insert(refusal('Actor','Other',scope))]),
  action('[Actor]: commencer '+label+' avec [Other]',
   [...eligible,...bounds,...accepted('Actor','Other',scope),not_(mineActive),not_(theirActive)],
   [insert(mineActive),insert(theirActive)]),
  action('[Actor]: terminer '+label+' avec [Other]',
   [matches(mineActive),neq('Actor','Other')],
   [del(mineActive),del(theirActive),del(mine),del(theirs),del(myOffer),del(theirOffer),
    insert(history('Actor','Other',scope)),insert(history('Other','Actor',scope))]),
  action('[Actor]: retirer son accord pour '+label+' avec [Other]',
   [matches(mine),neq('Actor','Other')],
   [del(mine),del(theirs),del(myOffer),del(theirOffer),del(mineActive),del(theirActive),
    insert(path('withdrawal','Actor','Other',scope))]),
 ];
}

/** Socle IV : la demande sociale est distincte de la réponse. */
export const SOCIAL_APPROACHES=[
 {id:'flirt',label:'flirter',effect:'warmth',delta:2},
 {id:'compliment',label:'complimenter',effect:'respect',delta:2},
 {id:'confide',label:'se confier',effect:'trust',delta:3},
 {id:'ask_date',label:'inviter à un rendez-vous',effect:'warmth',delta:3},
 {id:'discuss_feelings',label:'parler de ses sentiments',effect:'trust',delta:3},
 {id:'discuss_health',label:'parler de santé intime',effect:'trust',delta:3},
 {id:'request_exclusivity',label:'proposer l’exclusivité',effect:'trust',delta:2},
 {id:'offer_apology',label:'présenter des excuses',effect:'respect',delta:2},
 {id:'share_secret',label:'confier un secret',effect:'trust',delta:3},
 {id:'reassure',label:'rassurer',effect:'warmth',delta:2},
 {id:'discuss_family',label:'parler de projet familial',effect:'trust',delta:2},
 {id:'ask_preferences',label:'demander ses préférences',effect:'respect',delta:2},
 {id:'ask_boundaries',label:'demander ses limites',effect:'respect',delta:3},
 {id:'discuss_culture',label:'discuter des normes culturelles',effect:'respect',delta:2},
 {id:'propose_reconciliation',label:'proposer de se réconcilier',effect:'warmth',delta:2},
 {id:'request_privacy',label:'demander de la discrétion',effect:'trust',delta:2},
 {id:'discuss_protection',label:'proposer une discussion sur la protection',effect:'respect',delta:2},
 {id:'ask_commitment',label:'proposer un engagement',effect:'trust',delta:2},
 {id:'discuss_breakup',label:'discuter de la séparation',effect:'respect',delta:1},
 {id:'discuss_parenthood',label:'parler de parentalité',effect:'trust',delta:2},
] as const;
export type SocialApproach=(typeof SOCIAL_APPROACHES)[number]['id'];
function socialActions():Action[]{
 return SOCIAL_APPROACHES.flatMap(({id,label,effect,delta})=>{
  const offered=path('socialOffer','Actor','Other',id);
  const incoming=path('socialOffer','Other','Actor',id);
  return [
   action('[Actor]: '+label+' avec [Other]',
    [...eligible,not_(offered)],
    [insert(offered),insert(path('socialHistory','Actor','Other',id,'asked'))]),
   action('[Actor]: répondre favorablement à '+label+' de [Other]',
    [...eligible,matches(incoming)],
    [del(incoming),insert(path('socialHistory','Other','Actor',id,'accepted')),
     adjustScore('Actor','Other',effect,delta,'social_'+id)]),
   action('[Actor]: décliner '+label+' de [Other]',
    [matches(incoming),neq('Actor','Other')],
    [del(incoming),insert(path('socialHistory','Other','Actor',id,'declined'))]),
  ];
 });
}
function socialPractice():Practice{
 return practice('praxAdultSocial',{
  name:'Vie sociale et affective',
  roles:['World'], actions:socialActions(),
 });
}
function advancedPractice():Practice{
 return practice('praxAdultExpanded',{
  name:'Actions intimes supplémentaires',
  roles:['World'],
  actions:ADULT_ACTION_CATALOGUE.flatMap(x=>scopeActions(x.id,x.label)),
 });
}

/** Socles I-IV sont des pratiques et faits du State natif, pas une extension autonome. */
export function installCompleteAdultWorld(st:State):void{
 installNativeAdultPractices(st);
 // Respecter les fonctions Prax déjà installées (bar, cité, etc.).
 const installed=new Set(st.defs.fns.map(f=>f.name));
 const missing=coreFns().filter(f=>!installed.has(f.name));
 if(missing.length)st.defineFunctions(missing);
 for(const pr of [advancedPractice(),socialPractice()]){
  if(!st.defs.practices.has(pr.id))st.definePractice(pr);
  const instance='practice.'+pr.id+'.world';
  if(!st.dbHas(instance))st.performOutcome(insert(instance));
 }
}

/** Annulation de tous les accords d'une personne, y compris les 9 actions de base. */
export function invalidateAllAdultAgreements(st:State,person:string):void{
 valid(person);
 invalidateAgreements(st,person);
 for(const other of st.dbChildKeys(path('person'))){
  if(other===person)continue;
  for(const {id} of ADULT_ACTION_CATALOGUE)
   for(const [a,b] of [[person,other],[other,person]]){
    st.performOutcome(del(agree(a,b,id)));
    st.performOutcome(del(offer(a,b,id)));
    st.performOutcome(del(active(a,b,id)));
   }
 }
}

/**
 * Entrées d'état de confiance : ces variantes remplacent les utilitaires
 * d'origine lors de l'installation complète, pour invalider TOUTES les portées.
 */
export function placeAdultComplete(st:State,who:string,where:string):void{
 placeAdult(st,who,where);
 invalidateAllAdultAgreements(st,who);
}
export function setAdultRestrictionComplete(
 st:State,who:string,restriction:'incapacitated'|'captive',enabled:boolean,
):void{
 setAdultRestriction(st,who,restriction,enabled);
 if(enabled)invalidateAllAdultAgreements(st,who);
}
/** Une situation coercitive ne peut valoir consentement. */
export function setAdultDuress(
 st:State,a:string,b:string,enabled:boolean,
):void{
 valid(a);valid(b);if(a===b)throw new Error('Participants identiques');
 const k=path('duress',a,b);
 st.performOutcome(enabled?insert(k):del(k));
 if(enabled){invalidateAllAdultAgreements(st,a);invalidateAllAdultAgreements(st,b);}
}
/**
 * À inclure parmi les wants du Character du PNJ AVANT setCharacters.
 * Prax planifie alors avec ses propres utilités (pas de contrôle du narrateur).
 */
export function adultNarrativeWants(
 who:string,other:string,scopes:readonly AnyScope[],utility:number,
):Want[]{
 valid(who);valid(other);
 if(who===other||!Number.isFinite(utility)||utility<=0)throw new Error('Motivation invalide');
 for(const scope of scopes)if(!ALL_ADULT_SCOPES.includes(scope))throw new Error('Portée inconnue');
 return scopes.map(scope=>want([matches(history(who,other,scope))],utility));
}

/** Un choix unilatéral canonique, jamais imposé par le narrateur. */
export function setAdultPreference(
 st:State,who:string,scope:AnyScope,preference:'like'|'dislike'|'neutral',
):void{
 valid(who);if(!ALL_ADULT_SCOPES.includes(scope))throw new Error('Portée inconnue');
 st.performOutcome(insert(path('mind',who,'preference',scope)+'!'+preference));
}
export function setAdultBoundary(st:State,who:string,scope:AnyScope,forbidden:boolean):void{
 valid(who);if(!ALL_ADULT_SCOPES.includes(scope))throw new Error('Portée inconnue');
 st.performOutcome(forbidden?insert(boundary(who,scope)):del(boundary(who,scope)));
 if(forbidden)invalidateAllAdultAgreements(st,who);
}
export function setAdultOrientation(
 st:State,who:string,orientation:'heterosexual'|'homosexual'|'bisexual'|'pansexual'|'asexual'|'other'|'unspecified',
):void{
 valid(who);st.performOutcome(insert(path('mind',who,'orientation')+'!'+orientation));
}
/** Traits de persona, pas accord implicite. */
export function setRomanticInterest(st:State,who:string,other:string,interested:boolean):void{
 valid(who);valid(other);if(who===other)throw new Error('Même personnage');
 const k=path('mind',who,'romanticInterest',other);
 st.performOutcome(interested?insert(k):del(k));
}
/** Une interdiction légale ou sociale dépend du contexte défini par le lore. */
export function setLocalePrivacy(st:State,where:string,isPrivate:boolean):void{
 valid(where);const k=path('locales',where,'private');
 st.performOutcome(isPrivate?insert(k):del(k));
}
/** Les événements privés ne deviennent pas automatiquement des rumeurs. */
export function recordActualWitness(
 st:State,witness:string,actor:string,target:string,scope:AnyScope,
):void{
 for(const x of [witness,actor,target])valid(x);
 if(!ALL_ADULT_SCOPES.includes(scope))throw new Error('Portée inconnue');
 if(witness===actor||witness===target)throw new Error('Témoin non indépendant');
 if(!st.dbHas(history(actor,target,scope)))throw new Error('Événement non réalisé');
 st.performOutcome(insert(path('witnessed',witness,actor,target,scope)));
}

/** Socle III : physiologie fictive issue de données du canon, pas du genre. */
export type FertilityRole='canGestate'|'canContribute'|'fertile';
export function setCanonicalFertility(
 st:State,who:string,role:FertilityRole,enabled:boolean,
):void{
 valid(who);
 if(!st.dbHas(path('person',who,'adult')))throw new Error('Adulte non vérifié');
 const k=path('biology',who,role);
 st.performOutcome(enabled?insert(k):del(k));
}
/** Protection connue du monde : une négociation n'y équivaut pas. */
export function recordMutualProtection(
 st:State,a:string,b:string,protection:'none'|'barrier'|'other',
):void{
 valid(a);valid(b);if(a===b)throw new Error('Participants identiques');
 const [x,y]=pair(a,b);
 st.performOutcome(insert(path('protection',x,y)+'!'+protection));
}
export type ReproductiveResult='ineligible'|'processed'|'possiblePregnancy';
/**
 * Tirage fictif conditionnel, une fois par événement canonique unique.
 * Aucun taux réel de santé; aucun lien automatique entre genre et fertilité.
 */
export function resolveFictionalConception(
 st:State,gestator:string,contributor:string,encounterId:string,
):ReproductiveResult{
 for(const x of [gestator,contributor,encounterId])valid(x);
 if(gestator===contributor)throw new Error('Participants identiques');
 const completed=st.dbHas(history(gestator,contributor,'vaginal'))
  ||st.dbHas(history(contributor,gestator,'vaginal'));
 const key=path('reproduction','encounter',encounterId);
 if(st.dbHas(key))return 'processed';
 if(!completed
  ||!st.dbHas(path('biology',gestator,'canGestate'))
  ||!st.dbHas(path('biology',contributor,'canContribute'))
  ||!st.dbHas(path('biology',gestator,'fertile'))
  ||!st.dbHas(path('biology',contributor,'fertile'))
  ||st.dbHas(path('biology',gestator,'pregnant')))return 'ineligible';
 if(st.rt.rngSeed===null)throw new Error('Le dé Prax doit être initialisé');
 const [a,b]=pair(gestator,contributor);
 const prot=(['none','barrier','other'] as const).find(x=>st.dbHas(path('protection',a,b)+'!'+x));
 if(prot===undefined)throw new Error('Statut de protection inconnu');
 st.performOutcome(insert(key));
 // Probabilités purement fictionnelles, à calibrer par les règles du monde.
 const chances=prot==='none'?20:prot==='barrier'?200:100;
 for(const outcome of draw(1,chances,[],[insert(path('biology',gestator,'pregnant'))]))
  st.performOutcome(outcome);
 return st.dbHas(path('biology',gestator,'pregnant'))?'possiblePregnancy':'processed';
}
/** Le calendrier Elyndor définit la durée de grossesse, pas les tours Prax. */
export function setCanonicalPregnancyStage(
 st:State,who:string,stage:'early'|'middle'|'late'|'ended',
):void{
 valid(who);
 const key=path('biology',who,'pregnancyStage');
 if(stage==='ended'){
  if(!st.dbHas(path('biology',who,'pregnant')))throw new Error('Aucune grossesse à terminer');
  st.performOutcome(del(path('biology',who,'pregnant')));
  st.performOutcome(insert(key+'!ended'));
  return;
 }
 if(!st.dbHas(path('biology',who,'pregnant')))
  throw new Error('Grossesse non établie');
 st.performOutcome(insert(key+'!'+stage));
}

/** Socle V : une narration basée UNIQUEMENT sur l'état validé par Prax. */
export type EventPhase='propose'|'accept'|'refuse'|'begin'|'end'|'withdraw';
export interface AdultNarratedEvent {
 actor:string; other:string; scope:AnyScope; phase:EventPhase;
 tone?:'neutral'|'tender'|'solemn';
}
/**
 * Cette fonction ne confirme jamais une scène si Prax ne l'a pas confirmée.
 * Le dialogue libre est laissé au narrateur principal.
 */
export function renderValidatedAdultEvent(st:State,e:AdultNarratedEvent):string{
 const {actor,other,scope,phase}=e;
 for(const x of [actor,other])valid(x);
 if(!ALL_ADULT_SCOPES.includes(scope))throw new Error('Action absente du catalogue');
 let proven=false;
 switch(phase){
  case 'propose':proven=st.dbHas(offer(actor,other,scope));break;
  case 'accept':proven=st.dbHas(agree(actor,other,scope));break;
  case 'refuse':proven=st.dbHas(refusal(actor,other,scope));break;
  case 'begin':proven=st.dbHas(active(actor,other,scope));break;
  case 'end':proven=st.dbHas(history(actor,other,scope));break;
  case 'withdraw':proven=st.dbHas(path('withdrawal',actor,other,scope));break;
 }
 if(!proven)throw new Error('Événement non établi par Prax');
 const label=ALL_ADULT_LABELS[scope];
 const v={
  propose:'propose '+label+' à',
  accept:'accepte '+label+' avec',
  refuse:'refuse '+label+' avec',
  begin:'commence '+label+' avec',
  end:'termine '+label+' avec',
  withdraw:'met fin à son accord concernant '+label+' avec',
 }[phase];
 const base=actor+' '+v+' '+other+'.';
 if(phase==='refuse'||phase==='withdraw')return base+' La décision est respectée.';
 return e.tone==='tender'?base+' Un instant personnel, dont le détail leur appartient.':base;
}

/** Ébauche locale : détecte l'intention, jamais une autorisation d'agir. */
export function classifyFrenchAdultIntent(text:string):
 {scope:AnyScope; phase:EventPhase; confidence:number}|null{
 const normalized=text.toLocaleLowerCase('fr').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
 const terms:readonly [string,AnyScope][]=[
  ['baiser','kiss'],['embrasser','kiss'],['calin','embrace'],
  ['caresser','caress'],['massage','massage'],['rapport oral','oral'],
  ['rapport vaginal','vaginal'],['rapport anal','anal'],
  ['contraception','discuss_protection'],['protection','discuss_protection'],
  ['preferences','discuss_preferences'],['limites','discuss_boundaries'],
  ['intimite','private'],['se tenir la main','holding_hands'],
  ['danse','slow_dance'],
 ];
 const found=terms.find(([word])=>normalized.includes(word));
 if(!found)return null;
 const phase:EventPhase=/refuse|non merci|decline/.test(normalized)?'refuse':
 /arrete|stop|retire/.test(normalized)?'withdraw':
 /accepte|oui/.test(normalized)?'accept':
 /termine|fini/.test(normalized)?'end':
 /commence|debute/.test(normalized)?'begin':'propose';
 return {scope:found[1],phase,confidence:0.65};
}