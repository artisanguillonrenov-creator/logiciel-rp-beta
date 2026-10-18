import assert from 'node:assert/strict';
import test from 'node:test';
import type { StoryState, EntreeLoreEmergent } from '../src/types';
import { consoliderRegistrePnj, rechercherPnjLexical } from '../src/engine/registrePnj';
import { fusionnerDoublonsLore } from '../src/engine/loreEmergentDoublons';

const entree = (id: string, titre: string): EntreeLoreEmergent =>
  ({ id, categorie: 'pnj', titre, contenu: 'Marchande de Paris.', statut: 'permanent', premiereMention: 1, dernierAcces: 2 });
function histoire(): StoryState {
  return {
    meta: { id: 'histoire-1', personnageNom: 'William', contexte: { lieu: 'Paris' } },
    loreEmergent: [entree('p1','Éléonore'), entree('p2','Marcus')],
    messages: [
      { id:'m1',role:'user',content:'Je parle à Éléonore.',timestamp:1 },
      { id:'m2',role:'assistant',content:'ÉLÉONORE : « Merci de m’avoir sauvé ! »',timestamp:2 },
      { id:'m3',role:'user',content:'Je parle de Marcus à Éléonore.',timestamp:3 },
      { id:'m4',role:'assistant',content:'ÉLÉONORE : « Je connais son nom. »',timestamp:4 },
    ],
    social: { relations: [], engagements: [] },
  } as unknown as StoryState;
}
test('registre séparé pour chaque histoire, mêmes identifiants durables',()=>{
  const a=histoire();const r=consoliderRegistrePnj(a);
  assert.equal(r.fiches.length,2);
  assert.equal(r.fiches[0].id,'p1');
  assert.equal(r.fiches[0].souvenirs.length,2);
  assert.equal(r.fiches[1].souvenirs.length,0);
  const autre={...a,meta:{...a.meta,id:'histoire-2'},loreEmergent:[entree('p3','Sylvana')],pnjLorebook:undefined};
  assert.deepEqual(consoliderRegistrePnj(autre).fiches.map(f=>f.nom),['Sylvana']);
});
test('recherche lexicale PNJ retrouve la fiche sans attribuer ses souvenirs aux absents',()=>{
  const a=histoire();a.pnjLorebook=consoliderRegistrePnj(a);
  const resultats=rechercherPnjLexical(a,'Éléonore, te souviens-tu du sauvetage ?');
  assert.equal(resultats.length,1);
  assert.equal(resultats[0].fiche.nom,'Éléonore');
  assert.ok(resultats[0].souvenirsRetenus.length>0);
});
test('supprimer ou régénérer un message invalide ses souvenirs',()=>{
  const a=histoire();a.pnjLorebook=consoliderRegistrePnj(a);
  a.messages=a.messages.slice(2);
  const r=consoliderRegistrePnj(a);
  assert.equal(r.fiches[0].souvenirs.length,1);
});
test('un nom ambigu ne sélectionne pas arbitrairement un homonyme',()=>{
  const a=histoire();a.pnjLorebook={version:1,fiches:[
    {id:'a',entreeId:'a',nom:'Alex',alias:[],origine:'invente',souvenirs:[]},
    {id:'b',entreeId:'b',nom:'Alex',alias:[],origine:'invente',souvenirs:[]}
  ]};
  assert.equal(rechercherPnjLexical(a,'Alex est là').length,0);
});


test('régénérer une réplique avec le même ID recalcule le souvenir sans conserver le texte annulé',()=>{
  const a=histoire();
  a.pnjLorebook=consoliderRegistrePnj(a);
  assert.match(a.pnjLorebook.fiches[0].souvenirs[0].resume,/sauvé/);
  a.messages[1]={...a.messages[1],content:'ÉLÉONORE : « Je ne te dois rien. »'};
  const r=consoliderRegistrePnj(a);
  assert.equal(r.fiches[0].souvenirs.length,2);
  assert.ok(r.fiches[0].souvenirs.every(s=>!s.resume.includes('sauvé')));
  assert.ok(r.fiches[0].souvenirs.some(s=>s.resume.includes('rien')));
});
test('une réplique remplacée par celle d’un autre PNJ ne transmet pas le souvenir original',()=>{
  const a=histoire();
  a.pnjLorebook=consoliderRegistrePnj(a);
  a.messages[1]={...a.messages[1],content:'MARCUS : « Je te reconnais. »'};
  const r=consoliderRegistrePnj(a);
  assert.equal(r.fiches[0].souvenirs.length,1);
  assert.equal(r.fiches[1].souvenirs.length,1);
  assert.ok(r.fiches[1].souvenirs[0].resume.includes('reconnais'));
});

test('des PNJ de même nom conservent leurs IDs même sans patronyme',()=>{
  const resultat=fusionnerDoublonsLore([entree('p-a','Marcus'), entree('p-b','Marcus')]);
  assert.deepEqual(resultat.map(e=>e.id),['p-a','p-b']);
});
test('les patronymes permettent la recherche précise mais le prénom partagé reste ambigu',()=>{
  const a=histoire();
  a.loreEmergent=[entree('m-valen','Marcus Valen'),entree('m-draven','Marcus Draven')];
  a.messages=[
    {id:'x1',role:'user',content:'Je parle à Marcus Valen.',timestamp:1},
    {id:'x2',role:'assistant',content:'MARCUS VALEN : « Je livre les marchandises. »',timestamp:2},
    {id:'x3',role:'user',content:'Je parle avec Marcus.',timestamp:3},
    {id:'x4',role:'assistant',content:'MARCUS : « On se connaît. »',timestamp:4},
  ];
  a.pnjLorebook=consoliderRegistrePnj(a);
  assert.deepEqual(a.pnjLorebook.fiches.map(f=>f.alias),[['Marcus'],['Marcus']]);
  assert.equal(a.pnjLorebook.fiches[0].souvenirs.length,1);
  assert.equal(a.pnjLorebook.fiches[1].souvenirs.length,0);
  assert.equal(rechercherPnjLexical(a,'Marcus apparaît').length,0);
  const exact=rechercherPnjLexical(a,'Marcus Valen apparaît');
  assert.equal(exact.length,1);
  assert.equal(exact[0].fiche.id,'m-valen');
});
test('un prénom unique reste un alias lexical utilisable',()=>{
  const a=histoire();
  a.loreEmergent=[entree('m-valen','Marcus Valen')];
  a.messages=[
    {id:'x1',role:'user',content:'Je parle à Marcus.',timestamp:1},
    {id:'x2',role:'assistant',content:'MARCUS : « Bonjour. »',timestamp:2},
  ];
  a.pnjLorebook=consoliderRegistrePnj(a);
  assert.equal(a.pnjLorebook.fiches[0].souvenirs.length,1);
  assert.equal(rechercherPnjLexical(a,'Marcus est là').length,1);
});
