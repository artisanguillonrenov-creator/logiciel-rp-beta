import test from 'node:test';
import assert from 'node:assert/strict';
import { dossiersNavigationLore } from '../src/concepteur/navigationLore';
import { validerFiche } from '../src/concepteur/lorebookModele';
const fiche = (titre: string, category: string, dossiers: string[] = []) => validerFiche({
  titre,category,contenu:'Contenu canonique',priority:50,constant:false,scope:'GLOBAL',
  primaryKeys:[],secondaryKeys:[],negativeKeys:[],dossiers,actif:true,
});
test('navigation : un royaume à Paris a un classement thématique et géographique sans duplication',()=>{
  const chemins=dossiersNavigationLore(fiche('Paris — Royaume Humain','ROYAUME'));
  assert.ok(chemins.includes('Monde/Europe/France/Paris'));
  assert.ok(chemins.includes('Royaumes et factions'));
  assert.ok(chemins.includes('Catégories/ROYAUME'));
});
test('navigation : les 14 capitales mentionnées dans un contenu générique ne provoquent aucun déplacement',()=>{
  const v=fiche('Présentation d’Elyndor','MONDE');
  assert.ok(dossiersNavigationLore(v).includes('Monde et géographie'));
  assert.ok(!dossiersNavigationLore(v).some(x=>x.endsWith('/Paris')));
});
test('navigation : catégories Risu et dossiers personnels apparaissent ensemble',()=>{
  const chemins=dossiersNavigationLore(fiche('Guilde de Paris','GUILDE',['Favoris/En cours']));
  assert.ok(chemins.includes('Organisations/Guildes'));
  assert.ok(chemins.includes('Favoris/En cours'));
  assert.ok(chemins.includes('Monde/Europe/France/Paris'));
});
