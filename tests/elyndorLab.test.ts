import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cheminValide, nouvelAtelier, modifierFichier, fichiersActuels, enregistrerVersion,
  restaurerVersion, confirmerVersionStable, precontrolerFichier, supprimerFichier, verifierAtelier, changementNatif
} from '../src/lab/workspaceCore';

test('refus des chemins dangereux et des secrets',()=>{
  assert.equal(cheminValide('src/engine/images.ts'),true);
  for (const p of ['../secret.ts','/data/test.ts','src/../secret.ts','node_modules/x.ts','.env','src/.env.production','a\\b.ts','src/lab/sourceSnapshot.generated.ts']) {
    assert.equal(cheminValide(p),false,p);
  }
});
test('édition sans toucher à la source puis restauration globale',()=>{
  const base={'src/a.ts':'initial','src/b.ts':'conserver'};
  let lab=nouvelAtelier('sha');
  lab=modifierFichier(lab,base,'src/a.ts','modifié');
  lab=modifierFichier(lab,base,'src/nouveau.ts','nouveau');
  lab=enregistrerVersion(lab,'modification A');
  const versionA=lab.versionActive!;
  lab=supprimerFichier(lab,base,'src/b.ts');
  lab=modifierFichier(lab,base,'src/a.ts','cassé');
  lab=restaurerVersion(lab,versionA);
  assert.deepEqual(fichiersActuels(base,lab),{'src/a.ts':'modifié','src/b.ts':'conserver','src/nouveau.ts':'nouveau'});
  assert.equal(base['src/a.ts'],'initial');
  assert.equal(lab.versions.length,2);
  lab=confirmerVersionStable(lab,versionA);
  assert.equal(lab.versions[0].etat,'stable');
  assert.equal(verifierAtelier(lab),true);
});
test('les contrôles locaux ne prétendent pas compiler les sources',()=>{
  assert.equal(precontrolerFichier('test.json','{}')[0].statut,'valide');
  assert.equal(precontrolerFichier('test.json','{')[0].statut,'erreur');
  assert.equal(precontrolerFichier('src/test.ts','<<<<<<< HEAD\nx')[0].statut,'erreur');
  assert.ok(precontrolerFichier('src/test.ts','export const x=2').some(x=>x.titre==='Compilation non exécutée'));
  assert.equal(changementNatif('modules/elyndor-objectbox/foo.kt'),true);
  assert.equal(changementNatif('src/engine/images.ts'),false);
});

import { comparerArbres, comparerTexte } from '../src/lab/diff';

test('comparateur de fichiers et de contenu',()=>{
  const d=comparerTexte('a\nancien\nz','a\nnouveau\nz');
  assert.equal(d.length,1);
  assert.equal(d[0].ancien,'ancien');
  assert.equal(d[0].nouveau,'nouveau');
  const r=comparerArbres({a:'1',b:'2'},{a:'3',c:'4'});
  assert.deepEqual(r,{ajoutes:['c'],supprimes:['b'],modifies:['a']});
});
