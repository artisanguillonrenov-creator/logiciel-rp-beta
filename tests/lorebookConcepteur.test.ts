import test from 'node:test';
import assert from 'node:assert/strict';
import type { ElyndorEntryChargee } from '../src/engine/loreLoader';
import {
  creerEtatLore, ficheOrigine, enregistrerFicheLore, listerFichesLore,
  appliquerLorePublie, publierBrouillonLore, abandonnerBrouillonLore,
  restaurerRevisionLore, supprimerAjoutLore, creerExportLore, analyserImportLore,
  signalerDoublonsLore, cleLoreAtelier, idFicheLoreValide, validerEtatLore, ficheProtegee,
} from '../src/concepteur/lorebookModele';

const base: ElyndorEntryChargee[] = [
  {id:'elyndor-0',titre:'[MONDE] Présentation',contenu:'Géographie du monde.',
    category:'MONDE',constant:true,priority:5,scope:'GLOBAL',
    primaryKeys:['monde'],secondaryKeys:[],negativeKeys:[],motsClesNegatifs:[]},
  {id:'elyndor-14',titre:'[MONDE] Magie',contenu:'Ancienne magie.',
    category:'MONDE',constant:false,priority:60,scope:'GLOBAL',
    primaryKeys:['magie'],secondaryKeys:[],negativeKeys:[],motsClesNegatifs:[]},
];

test('une fiche canonique protégée devient un brouillon et ne change pas le narrateur avant publication', () => {
  const etat = creerEtatLore();
  const fiche = {...ficheOrigine(base[0]), contenu:'Nouvelle description officielle.'};
  const prochain = enregistrerFicheLore(etat, base, base[0].id, fiche);
  assert.equal(prochain.brouillons['elyndor-0'].contenu, fiche.contenu);
  assert.equal(appliquerLorePublie(base, prochain)[0].contenu, base[0].contenu);
  const publie = publierBrouillonLore(prochain, 'elyndor-0');
  assert.equal(appliquerLorePublie(base, publie)[0].contenu, fiche.contenu);
  assert.equal(base[0].contenu, 'Géographie du monde.');
  assert.equal(publie.historique.length, 2);
});
test('une fiche ordinaire devient active après écriture, et peut être désactivée sans effacer son original', () => {
  const actuel = creerEtatLore();
  const fiche = {...ficheOrigine(base[1]), contenu:'Magie modifiée.', actif:false};
  const next = enregistrerFicheLore(actuel, base, 'elyndor-14', fiche);
  assert.equal(next.brouillons['elyndor-14'], undefined);
  assert.deepEqual(appliquerLorePublie(base, next).map(x => x.id), ['elyndor-0']);
  assert.equal(base[1].contenu, 'Ancienne magie.');
  const restaure = restaurerRevisionLore(next, 1);
  assert.equal(appliquerLorePublie(base, restaure).length, 2);
});
test('une création est d’abord proposée puis publiée manuellement', () => {
  const id='atelier-abcdefgh';
  const fiche={...ficheOrigine(base[1]), titre:'Nouvelle guilde', contenu:'Une guilde récente.',
    category:'GUILDE', dossiers:['Europe/France/Paris', 'Guildes']};
  const brouillon=enregistrerFicheLore(creerEtatLore(),base,id,fiche);
  assert.equal(appliquerLorePublie(base,brouillon).length, 2);
  assert.equal(listerFichesLore(base,brouillon).find(x=>x.id===id)?.brouillon,true);
  const publie=publierBrouillonLore(brouillon,id);
  assert.equal(appliquerLorePublie(base,publie).length, 3);
  const supprime=supprimerAjoutLore(publie,id);
  assert.equal(appliquerLorePublie(base,supprime).length,2);
});
test('validation d’import et recherche des titres homonymes', () => {
  const etat=creerEtatLore();
  const fiche={...ficheOrigine(base[1]),titre:'Magie'};
  assert.equal(signalerDoublonsLore(fiche,listerFichesLore(base,etat),'atelier-abcdefgh').length,1);
  assert.equal(analyserImportLore(creerExportLore(etat)).schema,1);
  assert.throws(()=>analyserImportLore('{"format":"incorrect"}'));
  assert.throws(()=>enregistrerFicheLore(etat,base,'elyndor-999999',fiche));
  assert.throws(()=>enregistrerFicheLore(etat,base,'atelier-abcd1234',{...fiche,priority:200}));
});
test('un brouillon abandonné ne change pas le canon publié',()=>{
  const fiche={...ficheOrigine(base[0]),contenu:'Brouillon écarté.'};
  const draft=enregistrerFicheLore(creerEtatLore(),base,'elyndor-0',fiche);
  const next=abandonnerBrouillonLore(draft,'elyndor-0');
  assert.equal(Object.keys(next.brouillons).length,0);
  assert.equal(appliquerLorePublie(base,next)[0].contenu,base[0].contenu);
});

test('multi-mondes : la clé de stockage d’Elyndor est inchangée, chaque autre monde a la sienne', () => {
  assert.equal(cleLoreAtelier('elyndor'), '@elyndor/concepteur/lorebook-v1');
  assert.equal(cleLoreAtelier('monde-test'), '@elyndor/concepteur/lorebook-v1/monde-test');
});

test('multi-mondes : identifiants <mondeId>-<n> et atelier-… acceptés, ceux d’un autre monde refusés', () => {
  assert.ok(idFicheLoreValide('elyndor-12', 'elyndor'));
  assert.ok(idFicheLoreValide('atelier-abcdefgh', 'elyndor'));
  assert.ok(idFicheLoreValide('monde-test-3', 'monde-test'));
  assert.equal(idFicheLoreValide('elyndor-12', 'monde-test'), false);
  assert.equal(idFicheLoreValide('atelier-3', 'atelier'), false);
  const fiche = ficheOrigine(base[1]);
  const etatElyndor = { ...creerEtatLore(), changements: { 'elyndor-14': fiche } };
  assert.doesNotThrow(() => validerEtatLore(etatElyndor, 'elyndor'));
  assert.throws(() => validerEtatLore(etatElyndor, 'monde-test'), /Identifiant de fiche invalide/);
  // Un export d'Elyndor ne s'importe pas dans un autre monde.
  assert.throws(() => analyserImportLore(creerExportLore(etatElyndor), 'monde-test'));
  assert.doesNotThrow(() => analyserImportLore(creerExportLore(etatElyndor), 'elyndor'));
});

test('multi-mondes : le socle historique 0-13 ne protège que les fiches d’Elyndor', () => {
  const ordinaire = { ...ficheOrigine(base[1]), constant: false, category: 'MONDE', titre: 'Magie' };
  assert.equal(ficheProtegee(ordinaire, 'elyndor-3'), true);
  assert.equal(ficheProtegee(ordinaire, 'monde-test-3'), false);
  assert.equal(ficheProtegee({ ...ordinaire, constant: true }, 'monde-test-3'), true);
  assert.equal(ficheProtegee(ordinaire, 'elyndor-14'), false);
});
