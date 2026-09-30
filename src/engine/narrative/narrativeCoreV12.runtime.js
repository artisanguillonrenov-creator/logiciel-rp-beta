/* Elyndor Narrative Core V12 — restored from the validated V13 clean build. */
(function(root){
  'use strict';
  const VERSION='12.0.0';
  const MARKER='<<<ELYNDOR_STATE_V12>>>';
  const END='<<<END_ELYNDOR_STATE_V12>>>';
  const MAX={ledger:5000,canon:4000,beliefs:5000,rumors:1000,reputation:800,debts:800,quarantine:500,audit:80,simulation:300};
  const STOP=new Set('avec dans pour mais plus comme tout elle elles leur leurs nous vous cette ceci cela sans sous alors encore entre apres avant vers dont tres bien fait faire etre avait sont sera ses son sur une des les que qui aux par pas dans du de la le un une au aux en et ou a à il ils on ce ces se sa son ses ne ni car puis donc'.split(/\s+/));
  const SYN={
    promesse:['promis','jure','juré','engagement','serment'],
    trahison:['trahi','betrayal','mensonge','trompe'],
    tuer:['tue','tué','mort','assassine','assassiné','meurtre'],
    peur:['craint','terreur','effraie','effrayé'],
    colere:['furieux','furieuse','haine','hostile','hostilite'],
    voyage:['part','quitte','arrive','rejoint','route','trajet'],
    secret:['cache','caché','ignore','sait','connait','connaît'],
    dette:['doit','redevable','faveur'],
    blessure:['blesse','blessé','plaie','sang','fracture']
  };
  function now(){return Date.now()}
  function id(prefix,state){state._seq=(Number(state._seq)||0)+1;return `${prefix}-${String(state._seq).padStart(6,'0')}`}
  function norm(v){return String(v??'').toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9'’ -]+/g,' ').replace(/\s+/g,' ').trim()}
  function tokens(v){const a=norm(v).split(' ').filter(x=>x.length>=3&&!STOP.has(x));const out=new Set(a);for(const x of a){for(const [k,vals] of Object.entries(SYN))if(x===k||vals.includes(x)){out.add(k);vals.forEach(v=>out.add(v))}}return out}
  function similarity(a,b){const A=tokens(a),B=tokens(b);if(!A.size||!B.size)return 0;let hit=0;for(const x of A)if(B.has(x))hit++;return hit/Math.sqrt(A.size*B.size)}
  function clamp(n,a,b){n=Number(n);return Number.isFinite(n)?Math.max(a,Math.min(b,n)):0}
  function text(v,n=320){v=String(v??'').replace(/\s+/g,' ').trim();return v.length<=n?v:v.slice(0,n-1).trimEnd()+'…'}
  function arr(v){return Array.isArray(v)?v:[]}
  function obj(v){return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}
  function unique(v){return [...new Set(arr(v).map(x=>String(x??'').trim()).filter(Boolean))]}
  function emptyState(){return{
    version:VERSION,_seq:0,createdAt:now(),updatedAt:now(),authoritative:true,
    clock:{day:0,minute:720,label:'Chronologie relative',lastAdvanceMinutes:0},
    ledger:[],canon:[],beliefs:[],rumors:[],reputation:[],debts:[],storylets:[],bdi:[],simulationQueue:[],quarantine:[],
    inspector:{lastContext:null,lastCommit:null,audit:[]},
    migration:{legacyImported:false,sourceVersion:null,at:null}
  }}
  function ensureCore(story){
    const s={...story};
    const c=obj(s.narrativeCore);
    const base=emptyState();
    s.narrativeCore={...base,...c,version:VERSION,clock:{...base.clock,...obj(c.clock)},inspector:{...base.inspector,...obj(c.inspector)},migration:{...base.migration,...obj(c.migration)}};
    for(const k of ['ledger','canon','beliefs','rumors','reputation','debts','storylets','bdi','simulationQueue','quarantine'])s.narrativeCore[k]=arr(c[k]);
    if(!s.narrativeCore.migration.legacyImported)importLegacy(s);
    trimState(s.narrativeCore);
    return s;
  }
  function importLegacy(story){
    const c=story.narrativeCore;
    c.migration={legacyImported:true,sourceVersion:story.version??null,at:now()};
    const legacyEvents=arr(story.memoireNarrative?.evenements).slice(-300);
    for(const le of legacyEvents){
      const eid=id('legacy',c);
      c.ledger.push({id:eid,type:'legacy_scene',summary:text(le.resultat||le.actionJoueur||'',420),actors:[],targets:[],location:le.lieu||'',witnesses:unique(le.participants),importance:.35,public:false,worldTime:clockText(c.clock),source:{kind:'legacy_memory',messageIndex:le.messageIndex},createdAt:Number(le.timestamp)||now()});
    }
    for(const f of arr(story.memoire?.faits).filter(x=>x&&x.texte).slice(-250)){
      c.canon.push({id:id('fact',c),subject:'legacy',predicate:'established_fact',value:text(f.texte,500),validFromEvent:null,validToEvent:null,sourceEvent:null,confidence:f.niveau==='canon'?1:.8,createdAt:now(),legacy:true});
    }
    for(const rel of arr(story.social?.relations)){
      if(!rel?.nom)continue;
      const name=String(rel.nom).trim();
      c.bdi.push({id:id('bdi',c),name,beliefs:[],desires:[],intentions:[],updatedAt:now(),legacy:true});
    }
    c.updatedAt=now();
  }
  function trimState(c){
    const pairs=[['ledger',MAX.ledger],['canon',MAX.canon],['beliefs',MAX.beliefs],['rumors',MAX.rumors],['reputation',MAX.reputation],['debts',MAX.debts],['quarantine',MAX.quarantine],['simulationQueue',MAX.simulation]];
    for(const [k,m] of pairs)if(c[k].length>m)c[k]=c[k].slice(-m);
    if(c.inspector.audit.length>MAX.audit)c.inspector.audit=c.inspector.audit.slice(-MAX.audit);
  }
  function clockText(c){const d=Math.max(0,Number(c.day)||0),m=Math.max(0,Number(c.minute)||0)%1440;return `J${d} ${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`}
  function advanceClock(core,mins){mins=Math.max(0,Math.round(Number(mins)||0));core.clock.lastAdvanceMinutes=mins;if(!mins)return;const total=(Number(core.clock.minute)||0)+mins;core.clock.day=(Number(core.clock.day)||0)+Math.floor(total/1440);core.clock.minute=total%1440}
  function inferTime(user,delta){if(Number(delta?.timeAdvanceMinutes)>0)return Math.min(525600,Number(delta.timeAdvanceMinutes));const n=norm(user);let m=n.match(/(\d+)\s*(minute|minutes|heure|heures|jour|jours|semaine|semaines|mois)/);if(m){const q=Number(m[1]),u=m[2];return q*(u.startsWith('minute')?1:u.startsWith('heure')?60:u.startsWith('jour')?1440:u.startsWith('semaine')?10080:43200)}if(/le lendemain|jour suivant/.test(n))return 1440;if(/quelques heures plus tard/.test(n))return 180;if(/plus tard/.test(n))return 30;return 0}
  function currentFact(core,subject,predicate){const S=norm(subject),P=norm(predicate);return [...core.canon].reverse().find(f=>!f.validToEvent&&norm(f.subject)===S&&norm(f.predicate)===P)||null}
  function validateDelta(story,delta,finalText,wasCorrected){
    const c=story.narrativeCore, d=obj(delta), q=[], clean={events:[],stateChanges:[],knowledgeTransfers:[],relationshipSignals:[],reputationSignals:[],commitments:[],narrativeDebts:[],npcStates:[],timeAdvanceMinutes:Number(d.timeAdvanceMinutes)||0,scene:obj(d.scene)};
    const finalN=norm(finalText);
    for(const ev of arr(d.events).slice(0,12)){
      if(!ev||!String(ev.summary||'').trim()){q.push({kind:'event',reason:'event_without_summary',candidate:ev});continue}
      const overlap=similarity(ev.summary,finalText);if(wasCorrected&&overlap<.12){q.push({kind:'event',reason:'post_repair_mismatch',candidate:ev});continue}
      clean.events.push({type:text(ev.type||'event',60),summary:text(ev.summary,500),actors:unique(ev.actors).slice(0,12),targets:unique(ev.targets).slice(0,12),location:text(ev.location||clean.scene.location||story.meta?.contexte?.lieu||'',120),witnesses:unique(ev.witnesses).slice(0,24),importance:clamp(ev.importance??.5,0,1),public:!!ev.public});
    }
    const seen=new Map;
    for(const sc of arr(d.stateChanges).slice(0,20)){
      if(!sc?.subject||!sc?.predicate||sc.to===undefined){q.push({kind:'state',reason:'incomplete_change',candidate:sc});continue}
      const conf=clamp(sc.confidence??.75,0,1);if(conf<.55){q.push({kind:'state',reason:'low_confidence',candidate:sc});continue}
      const key=norm(sc.subject)+'|'+norm(sc.predicate), val=JSON.stringify(sc.to);if(seen.has(key)&&seen.get(key)!==val){q.push({kind:'state',reason:'conflicting_delta',candidate:sc});continue}seen.set(key,val);
      const cur=currentFact(c,sc.subject,sc.predicate);if(sc.from!==undefined&&sc.from!==null&&cur&&norm(String(cur.value))!==norm(String(sc.from))){q.push({kind:'state',reason:'from_mismatch',candidate:sc,current:cur.value});continue}
      if(wasCorrected&&similarity(`${sc.subject} ${sc.predicate} ${String(sc.to)}`,finalText)<.03&&!finalN.includes(norm(sc.subject))){q.push({kind:'state',reason:'post_repair_unsupported',candidate:sc});continue}
      clean.stateChanges.push({subject:text(sc.subject,120),predicate:text(sc.predicate,100),from:sc.from,to:sc.to,confidence:conf});
    }
    for(const kt of arr(d.knowledgeTransfers).slice(0,24))if(kt?.knower&&kt?.fact)clean.knowledgeTransfers.push({knower:text(kt.knower,120),fact:text(kt.fact,500),source:text(kt.source||'scene',120),type:text(kt.type||'TOLD',32).toUpperCase(),confidence:clamp(kt.confidence??.8,0,1)});
    for(const rs of arr(d.relationshipSignals).slice(0,16))if(rs?.from&&rs?.to)clean.relationshipSignals.push({...rs,from:text(rs.from,100),to:text(rs.to,100),reason:text(rs.reason||'',300)});
    for(const rp of arr(d.reputationSignals).slice(0,16))if(rp?.subject&&rp?.faction)clean.reputationSignals.push({subject:text(rp.subject,100),faction:text(rp.faction,120),delta:clamp(rp.delta,-20,20),reason:text(rp.reason||'',300),knownByPublic:!!rp.knownByPublic});
    for(const cm of arr(d.commitments).slice(0,12))if(cm?.description)clean.commitments.push({type:text(cm.type||'commitment',60),party:text(cm.party||'',100),description:text(cm.description,420),status:text(cm.status||'open',30)});
    for(const nd of arr(d.narrativeDebts).slice(0,12))if(nd?.summary)clean.narrativeDebts.push({type:text(nd.type||'unresolved',60),source:text(nd.source||'',100),target:text(nd.target||'',100),summary:text(nd.summary,420),urgency:clamp(nd.urgency??.4,0,1)});
    for(const ns of arr(d.npcStates).slice(0,12))if(ns?.name)clean.npcStates.push({name:text(ns.name,120),beliefs:unique(ns.beliefs).slice(0,10).map(x=>text(x,320)),desires:unique(ns.desires).slice(0,8).map(x=>text(x,260)),intentions:unique(ns.intentions).slice(0,8).map(x=>text(x,260))});
    return{delta:clean,quarantine:q};
  }
  function heuristicDelta(story,user,assistant){
    const u=String(user?.content||user||''),a=String(assistant?.content||assistant||''),whole=`${u}\n${a}`, names=[];
    const re=/(?:^|\n)\s*([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ0-9'’ _-]{1,38})\s*:\s*[«"]/gm;let m;while((m=re.exec(a)))names.push(m[1].trim());
    const type=/\b(tu[eé]|assassin|mort)\b/i.test(whole)?'violence':/\b(promet|jure|serment)\b/i.test(whole)?'promise':/\b(quitte|part|arrive|rejoint)\b/i.test(whole)?'movement':'scene';
    return{events:[{type,summary:text(a,420),actors:unique([story.meta?.personnageNom,...names]),targets:[],location:story.meta?.contexte?.lieu||'',witnesses:unique(names),importance:type==='scene'?.3:.65,public:false}],stateChanges:[],knowledgeTransfers:[],relationshipSignals:[],reputationSignals:[],commitments:[],narrativeDebts:[],npcStates:names.map(name=>({name,beliefs:[],desires:[],intentions:[]})),timeAdvanceMinutes:inferTime(u,null),scene:{location:story.meta?.contexte?.lieu||'',changed:false}};
  }
  function commitTurn(story,opts){
    let s=ensureCore(story),c=s.narrativeCore;
    const user=opts?.userMessage||{},assistant=opts?.assistantMessage||{},raw=opts?.delta||heuristicDelta(s,user,assistant);
    const checked=validateDelta(s,raw,assistant.content||'',!!opts?.wasCorrected);const d=checked.delta;
    const mins=inferTime(user.content||'',d);advanceClock(c,mins);
    const committedEvents=[];
    for(const ev of d.events){const eid=id('evt',c),row={id:eid,...ev,worldTime:clockText(c.clock),source:{kind:'turn',userMessageId:user.id||null,assistantMessageId:assistant.id||null},createdAt:assistant.timestamp||now()};c.ledger.push(row);committedEvents.push(row);
      for(const who of unique([...ev.actors,...ev.targets,...ev.witnesses]))addBelief(c,who,ev.summary,ev.id||eid,ev.witnesses.includes(who)?'SEEN':'PARTICIPATED',1,eid);
      if(ev.importance>=.65&&ev.witnesses.length){c.rumors.push({id:id('rumor',c),originEvent:eid,claim:ev.summary,carriers:[...ev.witnesses],factions:[],distortion:0,status:ev.public?'public':'contained',createdAt:now(),updatedAt:now()})}
    }
    const sourceEvent=committedEvents.at(-1)?.id||null;
    for(const sc of d.stateChanges){const cur=currentFact(c,sc.subject,sc.predicate);if(cur)cur.validToEvent=sourceEvent||`turn:${assistant.id||now()}`;c.canon.push({id:id('fact',c),subject:sc.subject,predicate:sc.predicate,value:sc.to,validFromEvent:sourceEvent,validToEvent:null,sourceEvent,confidence:sc.confidence,createdAt:now()})}
    for(const kt of d.knowledgeTransfers)addBelief(c,kt.knower,kt.fact,kt.source,kt.type,kt.confidence,sourceEvent);
    applyRelationships(s,d.relationshipSignals,sourceEvent);
    applyReputation(c,d.reputationSignals,committedEvents,sourceEvent);
    for(const cm of d.commitments)c.debts.push({id:id('debt',c),kind:'commitment',type:cm.type,source:cm.party,target:s.meta?.personnageNom||'',summary:cm.description,urgency:.45,status:cm.status==='resolved'?'resolved':'open',createdEvent:sourceEvent,createdAt:now(),resolvedEvent:null});
    for(const nd of d.narrativeDebts)c.debts.push({id:id('debt',c),kind:'narrative',...nd,status:'open',createdEvent:sourceEvent,createdAt:now(),resolvedEvent:null});
    updateBDI(c,d.npcStates,sourceEvent);
    if(checked.quarantine.length)for(const q of checked.quarantine)c.quarantine.push({id:id('q',c),...q,sourceTurn:assistant.id||null,createdAt:now()});
    propagateRumors(s,mins,!!d.scene?.changed);
    evaluateStorylets(s);
    scheduleOffscreen(s,mins);
    c.updatedAt=now();
    c.inspector.lastCommit={at:now(),eventIds:committedEvents.map(e=>e.id),stateChanges:d.stateChanges.length,knowledgeTransfers:d.knowledgeTransfers.length,quarantined:checked.quarantine.length,clock:clockText(c.clock)};
    c.inspector.audit.push({kind:'commit',...c.inspector.lastCommit});trimState(c);return s;
  }
  function addBelief(c,knower,fact,source,type,confidence,eventId){if(!knower||!fact)return;const K=norm(knower),F=norm(fact);const existing=[...c.beliefs].reverse().find(b=>norm(b.knower)===K&&norm(b.fact)===F&&b.status!=='superseded');if(existing){existing.confidence=Math.max(existing.confidence||0,confidence||0);existing.updatedAt=now();return}c.beliefs.push({id:id('belief',c),knower:text(knower,120),fact:text(fact,500),source:text(source||'',160),type:text(type||'TOLD',32),confidence:clamp(confidence??.8,0,1),acquiredEvent:eventId||null,status:'active',createdAt:now(),updatedAt:now()})}
  function applyRelationships(story,signals,eventId){const c=story.narrativeCore;for(const s of signals){const key=norm(s.from)+'|'+norm(s.to);let row=c.reputation.find(r=>r.scope==='personal'&&r.key===key);if(!row){row={id:id('rel',c),scope:'personal',key,subject:s.from,target:s.to,trust:0,respect:0,fear:0,affection:0,hostility:0,updatedAt:now()};c.reputation.push(row)}for(const k of ['trust','respect','fear','affection','hostility'])row[k]=clamp((row[k]||0)+clamp(s[k]||0,-10,10),-100,100);row.reason=s.reason||row.reason;row.sourceEvent=eventId;row.updatedAt=now()}}
  function applyReputation(c,signals,events,eventId){const isPublic=events.some(e=>e.public);for(const s of signals){const known=!!s.knownByPublic||isPublic||c.rumors.some(r=>r.status==='public'&&similarity(r.claim,s.reason||s.subject)>.08);if(!known){c.quarantine.push({id:id('q',c),kind:'reputation',reason:'knowledge_gate_blocked',candidate:s,sourceTurn:eventId,createdAt:now()});continue}const key=norm(s.subject)+'|'+norm(s.faction);let row=c.reputation.find(r=>r.scope==='faction'&&r.key===key);if(!row){row={id:id('rep',c),scope:'faction',key,subject:s.subject,faction:s.faction,score:0,updatedAt:now()};c.reputation.push(row)}row.score=clamp((row.score||0)+s.delta,-100,100);row.reason=s.reason;row.sourceEvent=eventId;row.updatedAt=now()}}
  function updateBDI(c,states,eventId){for(const s of states){let row=c.bdi.find(x=>norm(x.name)===norm(s.name));if(!row){row={id:id('bdi',c),name:s.name,beliefs:[],desires:[],intentions:[],updatedAt:now()};c.bdi.push(row)}row.beliefs=unique([...row.beliefs,...s.beliefs]).slice(-20);row.desires=unique([...row.desires,...s.desires]).slice(-12);row.intentions=unique([...row.intentions,...s.intentions]).slice(-12);row.sourceEvent=eventId;row.updatedAt=now()}}
  function propagateRumors(story,mins,sceneChanged){if(!(mins>=60||sceneChanged))return;const c=story.narrativeCore, rels=arr(story.social?.relations);for(const r of c.rumors.filter(x=>x.status!=='dead').slice(-40)){const factions=new Set(r.factions||[]);for(const carrier of r.carriers||[]){const rel=rels.find(x=>norm(x.nom)===norm(carrier));if(rel?.faction)factions.add(String(rel.faction))}r.factions=[...factions];if(r.factions.length){r.distortion=clamp((r.distortion||0)+.08,0,.6);r.status=r.factions.length>=2?'spreading':'faction';r.updatedAt=now();for(const f of r.factions)addBelief(c,`Faction:${f}`,r.claim,`rumor:${r.id}`,'RUMOR',Math.max(.45,1-r.distortion),r.originEvent)}}}
  function evaluateStorylets(story){const c=story.narrativeCore, out=[];const open=c.debts.filter(d=>d.status==='open');for(const d of open.slice(-80)){const age=countEventsSince(c,d.createdEvent);if(d.urgency>=.7||age>=14)out.push({id:`debt:${d.id}`,type:'narrative_debt_due',priority:Math.round(60+d.urgency*35+Math.min(10,age/4)),text:`Conséquence potentielle liée à « ${text(d.summary,220)} ». Ne la force que si elle découle naturellement de la scène.`})}
    for(const r of c.reputation.filter(x=>x.scope==='faction'&&Math.abs(x.score||0)>=20).slice(-20))out.push({id:`rep:${r.id}`,type:'reputation_consequence',priority:70+Math.min(20,Math.abs(r.score)/4),text:`La réputation de ${r.subject} auprès de ${r.faction} (${r.score>0?'positive':'négative'}) peut influencer une interaction pertinente.`});
    for(const r of c.rumors.filter(x=>x.status==='spreading'||x.status==='public').slice(-12))out.push({id:`rumor:${r.id}`,type:'rumor_surface',priority:68,text:`Une rumeur circule : « ${text(r.claim,220)} ». Elle n'est pas forcément vraie et doit rester distinguée du canon.`});
    c.storylets=out.sort((a,b)=>b.priority-a.priority).slice(0,30)}
  function countEventsSince(c,idv){if(!idv)return c.ledger.length;const i=c.ledger.findIndex(e=>e.id===idv);return i<0?c.ledger.length:c.ledger.length-1-i}
  function scheduleOffscreen(story,mins){if(mins<360)return;const c=story.narrativeCore;for(const n of c.bdi.filter(x=>x.intentions?.length).slice(-12)){c.simulationQueue.push({id:id('sim',c),type:'offscreen_intention_due',npc:n.name,intention:n.intentions.at(-1),dueAt:clockText(c.clock),status:'candidate',createdAt:now()})}}
  function rankEvents(story,query){const c=story.narrativeCore,names=extractNames(story,query),len=c.ledger.length;return c.ledger.map((e,i)=>{let score=similarity(`${e.summary} ${e.location} ${(e.actors||[]).join(' ')} ${(e.targets||[]).join(' ')}`,query)*55;for(const n of names)if(norm(JSON.stringify(e)).includes(norm(n)))score+=18;score+=Math.max(0,12-(len-i)/40);score+=(e.importance||0)*15;if(e.location&&norm(query).includes(norm(e.location)))score+=12;return{e,score}}).filter(x=>x.score>8).sort((a,b)=>b.score-a.score).slice(0,6)}
  function extractNames(story,q){const known=new Set;for(const b of story.narrativeCore.bdi)known.add(b.name);for(const r of arr(story.social?.relations))if(r?.nom)known.add(r.nom);for(const l of arr(story.loreEmergent))if(l?.categorie==='pnj'&&l?.titre)known.add(l.titre);const nq=norm(q);return [...known].filter(n=>nq.includes(norm(n))).slice(0,6)}
  function formatWorld(story){const c=story.narrativeCore,current=c.canon.filter(f=>!f.validToEvent).slice(-18);const lines=[`Horloge du monde: ${clockText(c.clock)}.`];for(const f of current)if(f.subject!=='legacy')lines.push(`${f.subject} — ${f.predicate}: ${String(f.value)}`);return lines.join('\n')}
  function formatSocial(story,query){const c=story.narrativeCore,names=extractNames(story,query),lines=[];for(const n of names){const b=c.bdi.find(x=>norm(x.name)===norm(n));if(b){if(b.beliefs.length)lines.push(`${n} croit/sait: ${b.beliefs.slice(-3).join(' | ')}`);if(b.intentions.length)lines.push(`${n} intention actuelle: ${b.intentions.at(-1)}`)}const bel=c.beliefs.filter(x=>norm(x.knower)===norm(n)&&x.status==='active').slice(-4);for(const x of bel)lines.push(`${n} [${x.type}] ${x.fact}`)}for(const r of c.reputation.filter(x=>x.scope==='faction').slice(-8))if(!names.length||names.some(n=>norm(n)===norm(r.subject)))lines.push(`Réputation: ${r.subject} / ${r.faction}: ${r.score}`);return lines.join('\n')}
  function buildContext(story,userText){story=ensureCore(story);const c=story.narrativeCore,q=String(userText||''),ranked=rankEvents(story,q),current=c.canon.filter(f=>!f.validToEvent&&f.subject!=='legacy').slice(-20),debts=c.debts.filter(d=>d.status==='open').slice(-6),ops=c.storylets.slice(0,5),sim=c.simulationQueue.filter(x=>x.status==='candidate').slice(-4),names=extractNames(story,q),beliefs=c.beliefs.filter(b=>names.some(n=>norm(n)===norm(b.knower))).slice(-8);
    const lines=[`[ELYNDOR V12 — CANON STRUCTURÉ AUTORITAIRE]`,`Temps: ${clockText(c.clock)}.`,'Le canon structuré ci-dessous prime sur les souvenirs résumés et sur toute supposition. Si une information manque, considère-la comme inconnue au lieu de l’inventer.'];
    if(current.length){lines.push('État canonique actuel:');for(const f of current.slice(-12))lines.push(`- ${f.subject}.${f.predicate} = ${String(f.value)}`)}
    if(ranked.length){lines.push('Événements pertinents:');for(const x of ranked)lines.push(`- ${x.e.worldTime||''} ${x.e.summary}`)}
    if(beliefs.length){lines.push('Connaissances individuelles (ne pas les partager aux autres PNJ sans transmission):');for(const b of beliefs)lines.push(`- ${b.knower} [${b.type}] ${b.fact}`)}
    if(debts.length){lines.push('Conséquences ouvertes:');for(const d of debts)lines.push(`- ${d.summary}`)}
    if(ops.length){lines.push('Opportunités narratives non obligatoires:');for(const o of ops)lines.push(`- ${o.text}`)}
    if(sim.length){lines.push('Activités hors écran arrivées à échéance (candidates, pas des faits acquis):');for(const x of sim)lines.push(`- ${x.npc}: ${x.intention}`)}
    const directive=`[STATE DELTA V12 — MACHINE, OBLIGATOIRE]\nApres la narration, ajoute ${MARKER}, puis un JSON compact, puis ${END}. Ce bloc sera masque. Seulement les faits etablis par la scene; omets les champs/listes vides; n'invente rien pour remplir. Cles: events[{type,summary,actors,targets,location,witnesses,importance(0..1),public}], stateChanges[{subject,predicate,from,to,confidence}], knowledgeTransfers[{knower,fact,source,type,confidence}], relationshipSignals[{from,to,trust,respect,fear,affection,hostility,reason}], reputationSignals[{subject,faction,delta,reason,knownByPublic}], commitments[{type,party,description,status}], narrativeDebts[{type,source,target,summary,urgency}], npcStates[{name,beliefs,desires,intentions}], timeAdvanceMinutes, scene{location,changed}. JSON strict uniquement apres le marqueur.`;
    const result={text:lines.join('\n'),directive,worldText:formatWorld(story),socialText:formatSocial(story,q),rankedIds:ranked.map(x=>x.e.id),counts:{ledger:c.ledger.length,canon:c.canon.length,beliefs:c.beliefs.length,debts:c.debts.filter(x=>x.status==='open').length,quarantine:c.quarantine.length}};
    c.inspector.lastContext={at:now(),query:text(q,300),rankedEvents:result.rankedIds,counts:result.counts,clock:clockText(c.clock),chars:result.text.length+directive.length};c.inspector.audit.push({kind:'context',...c.inspector.lastContext});trimState(c);return result;
  }
  function extractStateEnvelope(raw){raw=String(raw??'');const i=raw.lastIndexOf(MARKER);if(i<0)return{text:raw.trim(),delta:null,found:false};const j=raw.indexOf(END,i+MARKER.length);const body=(j>=0?raw.slice(i+MARKER.length,j):raw.slice(i+MARKER.length)).trim();const visible=raw.slice(0,i).trim();try{return{text:visible||raw.trim(),delta:JSON.parse(body),found:true}}catch{return{text:visible||raw.trim(),delta:null,found:false,error:'invalid_json'}}}
  function debugContext(story,userText){const s=ensureCore(story),c=s.narrativeCore,last=c.inspector.lastContext||{};return[
    `[V12] Ledger ${c.ledger.length} · canon ${c.canon.filter(x=>!x.validToEvent).length}/${c.canon.length} · croyances ${c.beliefs.length} · rumeurs ${c.rumors.length}`,
    `[V12] Dettes ouvertes ${c.debts.filter(x=>x.status==='open').length} · quarantaine ${c.quarantine.length} · horloge ${clockText(c.clock)}`,
    last.rankedEvents?.length?`[V12] Events injectés: ${last.rankedEvents.join(', ')}`:'[V12] Aucun événement structuré récupéré pour ce tour.'
  ]}
  function reconcileLegacy(story){const s=ensureCore(story);evaluateStorylets(s);s.narrativeCore.updatedAt=now();return s}
  function selfTest(){
    let story={version:12,meta:{id:'test',personnageNom:'William',contexte:{lieu:'Paris',dateChronique:'',objectifs:''}},messages:[],memoire:{faits:[],resume:'',dernierMessageIndexMaj:0},memoireNarrative:{evenements:[]},social:{relations:[{nom:'Sylvana',faction:'Compagnons'}],engagements:[]},loreEmergent:[],monde:{}};story=ensureCore(story);
    const u={id:'u1',content:'Je donne mon épée à Sylvana.',timestamp:1},a={id:'a1',content:'Sylvana reçoit l’épée et la garde.',timestamp:2};const d={events:[{type:'transfer',summary:'William donne son épée à Sylvana.',actors:['William'],targets:['Sylvana'],location:'Paris',witnesses:['Sylvana'],importance:.7,public:false}],stateChanges:[{subject:'Épée de William',predicate:'owner',from:null,to:'Sylvana',confidence:1}],knowledgeTransfers:[],relationshipSignals:[],reputationSignals:[],commitments:[],narrativeDebts:[],npcStates:[{name:'Sylvana',beliefs:['William lui a donné son épée'],desires:[],intentions:[]}],timeAdvanceMinutes:0,scene:{location:'Paris',changed:false}};story=commitTurn(story,{userMessage:u,assistantMessage:a,delta:d});
    const f=currentFact(story.narrativeCore,'Épée de William','owner');const c=buildContext(story,'Où est mon épée ?');const ok=f?.value==='Sylvana'&&story.narrativeCore.ledger.length>=1&&c.text.includes('Sylvana');return{ok,version:VERSION,ledger:story.narrativeCore.ledger.length,canon:story.narrativeCore.canon.length,beliefs:story.narrativeCore.beliefs.length,contextChars:c.text.length}
  }
  root.ElyndorNarrativeCoreV12={VERSION,MARKER,END,createEmptyState:emptyState,ensureStory:ensureCore,buildContext,extractStateEnvelope,commitTurn,debugContext,reconcileLegacy,selfTest};
})(globalThis);
