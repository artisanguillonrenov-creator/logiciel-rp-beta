import assert from 'node:assert/strict';
import test from 'node:test';
import type { StoryState, EntreeLoreEmergent } from '../src/types';
import { consoliderRegistrePnj, rechercherPnjLexical } from '../src/engine/registrePnj';

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
