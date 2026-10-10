import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { appliquerPatchSources, empreinteTexte, examinerManifeste, octetsUtf8 } from '../src/lab/archivePolicy';
import { fichiersActuels, nouvelAtelier } from '../src/lab/workspaceCore';

test('aller-retour ZIP avec package.json : pas de suppression hors archive',async()=>{
  const reference='sha-integration';
  const contenu='{"name":"patch"}';
  const manifeste={
    format:'elyndor-lab-sources-texte',schema:2,mode:'patch',reference,
    fichiers:{'package.json':{octets:octetsUtf8(contenu),empreinte:empreinteTexte(contenu)}},
    chantier:'Integration',changements:{},versions:[]
  };
  const zip=new JSZip();
  zip.file('sources/package.json',contenu);
  zip.file('ELYNDOR-LAB-MANIFEST.json',JSON.stringify(manifeste));
  const archive=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
  const ouvert=await JSZip.loadAsync(archive);
  const fichiers={'package.json':await ouvert.file('sources/package.json')!.async('string')};
  const lu=JSON.parse(await ouvert.file('ELYNDOR-LAB-MANIFEST.json')!.async('string'));
  assert.equal(examinerManifeste(lu,fichiers,reference).reference,reference);
  const base={'package.json':'{}','src/a.ts':'A','src/b.ts':'B'};
  const suivant=appliquerPatchSources(nouvelAtelier(reference),base,fichiers);
  assert.deepEqual(fichiersActuels(base,suivant),{'package.json':contenu,'src/a.ts':'A','src/b.ts':'B'});
});
test('ZIP altéré : manifeste invalide avant tout changement',async()=>{
  const zip=new JSZip();
  zip.file('sources/src/a.ts','nouveau');
  zip.file('ELYNDOR-LAB-MANIFEST.json',JSON.stringify({
    format:'elyndor-lab-sources-texte',schema:2,mode:'patch',reference:'sha',
    fichiers:{'src/a.ts':{octets:7,empreinte:'0000000000000000'}},
    chantier:'Essai',changements:{},versions:[]
  }));
  const archive=await zip.generateAsync({type:'uint8array'});
  const ouvert=await JSZip.loadAsync(archive);
  const actuel={'src/a.ts':'ancien','src/b.ts':'intact'};
  const atelier=nouvelAtelier('sha');
  const lu=JSON.parse(await ouvert.file('ELYNDOR-LAB-MANIFEST.json')!.async('string'));
  assert.throws(()=>examinerManifeste(lu,{'src/a.ts':'nouveau'},'sha'));
  assert.deepEqual(fichiersActuels(actuel,atelier),actuel);
});
