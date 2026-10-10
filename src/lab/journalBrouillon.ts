// Gestion explicite des révisions : une écriture ancienne ne peut jamais
// déclarer un brouillon récent "enregistré".
export interface BrouillonRevision {
  chemin:string;
  texte:string;
  revision:number;
}
export class JournalBrouillon {
  private sequence=0;
  private dernierEnregistrement=0;
  private brouillon:BrouillonRevision|null=null;
  ouvrir(chemin:string,texte:string):void {
    if(this.estSale())throw new Error('Brouillon non sauvegardé : changement de fichier bloqué.');
    this.sequence++;
    this.dernierEnregistrement=this.sequence;
    this.brouillon={chemin,texte,revision:this.sequence};
  }
  saisir(texte:string):BrouillonRevision{
    if(!this.brouillon)throw new Error('Aucun fichier ouvert.');
    this.sequence++;
    this.brouillon={...this.brouillon,texte,revision:this.sequence};
    return {...this.brouillon};
  }
  instantane():BrouillonRevision|null{
    return this.estSale() && this.brouillon?{...this.brouillon}:null;
  }
  acquitter(ecrit:BrouillonRevision):boolean{
    if(!this.brouillon || this.brouillon.chemin!==ecrit.chemin)return false;
    this.dernierEnregistrement=Math.max(this.dernierEnregistrement,ecrit.revision);
    return !this.estSale();
  }
  estSale():boolean{return !!this.brouillon && this.brouillon.revision>this.dernierEnregistrement;}
  fichier():string{return this.brouillon?.chemin??'';}
  reinitialiser():void{this.brouillon=null;this.dernierEnregistrement=this.sequence;}
}
