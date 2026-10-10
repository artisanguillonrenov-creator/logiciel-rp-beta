import test from 'node:test';
import assert from 'node:assert/strict';
import { JournalBrouillon } from '../src/lab/journalBrouillon';
import { collisionDesChemins, empreinteTexte, examinerManifeste, nomSourceAutorise, octetsUtf8, verifierOriginalZip } from '../src/lab/archivePolicy';
import { nouvelAtelier, fichiersActuels, modifierFichier } from '../src/lab/workspaceCore';

test('sauvegarde ancienne ne masque pas une frappe nouvelle',()=>{
  const journal=new JournalBrouillon();
  journal.ouvrir('src/a.ts','A');
  journal.saisir('B');const ancien=journal.instantane()!;
  journal.saisir('C');
  assert.equal(journal.acquitter(ancien),false);
  assert.equal(journal.estSale(),true);
  const dernier=journal.instantane()!;
  assert.equal(dernier.texte,'C');
  assert.equal(journal.acquitter(dernier),true);
  journal.ouvrir('src/b.ts','X');
  assert.equal(journal.fichier(),'src/b.ts');
});
test('navigation bloquee si brouillon non enregistre',()=>{
  const journal=new JournalBrouillon();journal.ouvrir('src/a.ts','A');journal.saisir('B');
  assert.throws(()=>journal.ouvrir('src/b.ts','X'));
  assert.equal(journal.fichier(),'src/a.ts');
});
test('patch import conserve les fichiers absents du zip',()=>{
  const base={'package.json':'{}','src/a.ts':'A','src/b.ts':'B'};
  let atelier=nouvelAtelier('sha');
  atelier=modifierFichier(atelier,base,'package.json','{"name":"patch"}');
  atelier=modifierFichier(atelier,base,'src/a.ts','A2');
  assert.deepEqual(fichiersActuels(base,atelier),{
    'package.json':'{"name":"patch"}','src/a.ts':'A2','src/b.ts':'B'
  });
});
test('chemins malveillants et collisions de noms refuses',()=>{
  for(const p of ['../test.ts','/test.ts','abc/../../test.ts','src\\fichier.ts','C:/a.ts'])assert.throws(()=>verifierOriginalZip(p));
  assert.throws(()=>collisionDesChemins(['sources/A.ts','sources/a.ts']));
  assert.equal(nomSourceAutorise('src/engine/test.ts'),true);
  assert.equal(nomSourceAutorise('src/.env.production'),false);
});
test('empreintes reproductibles UTF8',()=>{
  assert.equal(octetsUtf8('é😀'),6);
  assert.notEqual(empreinteTexte('A'),empreinteTexte('B'));
});
test('manifeste verifie reference et inventaire',()=>{
  const fichiers={'package.json':'{}'};
  const val={format:'elyndor-lab-sources-texte',schema:2,mode:'patch',reference:'sha',
    fichiers:{'package.json':{octets:2,empreinte:empreinteTexte('{}')}},
    chantier:'Test',changements:{},versions:[]};
  assert.equal(examinerManifeste(val,fichiers,'sha').reference,'sha');
  assert.throws(()=>examinerManifeste({...val,reference:'autre'},fichiers,'sha'));
  assert.throws(()=>examinerManifeste({...val,fichiers:{'package.json':{octets:3,empreinte:'faux'}}},fichiers,'sha'));
  assert.throws(()=>examinerManifeste({...val,fichiers:{}},fichiers,'sha'));
});
