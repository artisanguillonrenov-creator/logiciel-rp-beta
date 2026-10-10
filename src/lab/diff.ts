// Diff texte multi-blocs pour l'éditeur tactile.
// Un algorithme LCS borné évite de saturer la mémoire sur de très gros fichiers.
export interface BlocChangement {
  titre:string;ancien:string;nouveau:string;ligneAncien:number;ligneNouveau:number;
}
export function comparerTexte(avant:string,apres:string):BlocChangement[]{
  if(avant===apres)return [];
  const a=avant.split('\n'),b=apres.split('\n');
  const n=a.length,m=b.length;
  // Dégradation contrôlée pour les grands fichiers, sans tableau quadratique.
  if((n+1)*(m+1)>750000){
    let prefixe=0;
    while(prefixe<n && prefixe<m && a[prefixe]===b[prefixe])prefixe++;
    let suffixe=0;
    while(suffixe<n-prefixe && suffixe<m-prefixe && a[n-1-suffixe]===b[m-1-suffixe])suffixe++;
    return [{titre:'Changement étendu (aperçu limité)',ancien:a.slice(prefixe,n-suffixe).join('\n'),
      nouveau:b.slice(prefixe,m-suffixe).join('\n'),ligneAncien:prefixe+1,ligneNouveau:prefixe+1}];
  }
  const largeur=m+1;
  const lcs=new Uint32Array((n+1)*(m+1));
  for(let i=n-1;i>=0;i--){
    for(let j=m-1;j>=0;j--){
      lcs[i*largeur+j]=a[i]===b[j]?1+lcs[(i+1)*largeur+j+1]:
        Math.max(lcs[(i+1)*largeur+j],lcs[i*largeur+j+1]);
    }
  }
  const blocs:BlocChangement[]=[];
  let i=0,j=0,ancien:string[]=[],nouveau:string[]=[],debutA=1,debutB=1;
  const vider=()=>{
    if(!ancien.length&&!nouveau.length)return;
    blocs.push({titre:'Bloc modifié',ancien:ancien.join('\n'),nouveau:nouveau.join('\n'),
      ligneAncien:debutA,ligneNouveau:debutB});
    ancien=[];nouveau=[];
  };
  while(i<n || j<m){
    if(i<n && j<m && a[i]===b[j]){vider();i++;j++;continue;}
    if(!ancien.length&&!nouveau.length){debutA=i+1;debutB=j+1;}
    if(i<n && (j>=m || lcs[(i+1)*largeur+j]>=lcs[i*largeur+j+1])){
      ancien.push(a[i]);i++;
    }else if(j<m){nouveau.push(b[j]);j++;}
  }
  vider();
  return blocs;
}
export interface ResumeImport {ajoutes:string[];modifies:string[];supprimes:string[];}
export function comparerArbres(avant:Record<string,string>,apres:Record<string,string>):ResumeImport{
  const a=Object.keys(avant),b=Object.keys(apres);
  return {
    ajoutes:b.filter(p=>!Object.prototype.hasOwnProperty.call(avant,p)).sort(),
    supprimes:a.filter(p=>!Object.prototype.hasOwnProperty.call(apres,p)).sort(),
    modifies:b.filter(p=>Object.prototype.hasOwnProperty.call(avant,p)&&avant[p]!==apres[p]).sort()
  };
}
