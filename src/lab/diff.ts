// Comparaison lisible sur tablette : préfixe/suffixe communs,
 // sans prétendre fournir un diff Git sur les déplacements de blocs.
export interface BlocChangement { titre:string; ancien:string; nouveau:string; ligneAncien:number; ligneNouveau:number; }
export function comparerTexte(avant:string,apres:string):BlocChangement[] {
  if(avant===apres)return [];
  const l1=avant.split('\n'),l2=apres.split('\n');
  let prefixe=0;
  while(prefixe<l1.length && prefixe<l2.length && l1[prefixe]===l2[prefixe])prefixe++;
  let suffixe=0;
  while(suffixe<l1.length-prefixe && suffixe<l2.length-prefixe && l1[l1.length-1-suffixe]===l2[l2.length-1-suffixe])suffixe++;
  const bloc1=l1.slice(prefixe,l1.length-suffixe);
  const bloc2=l2.slice(prefixe,l2.length-suffixe);
  return [{titre:'Différences dans la zone modifiée',ancien:bloc1.join('\n'),
    nouveau:bloc2.join('\n'),ligneAncien:prefixe+1,ligneNouveau:prefixe+1}];
}
export interface ResumeImport { ajoutes:string[]; modifies:string[]; supprimes:string[]; }
export function comparerArbres(avant:Record<string,string>,apres:Record<string,string>):ResumeImport{
  const a=Object.keys(avant),b=Object.keys(apres);
  return {ajoutes:b.filter(p=>!Object.prototype.hasOwnProperty.call(avant,p)).sort(),
  supprimes:a.filter(p=>!Object.prototype.hasOwnProperty.call(apres,p)).sort(),
  modifies:b.filter(p=>Object.prototype.hasOwnProperty.call(avant,p)&&avant[p]!==apres[p]).sort()};
}
