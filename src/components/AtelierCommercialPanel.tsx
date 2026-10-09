import React,{useEffect,useState} from 'react';
import {ActivityIndicator,StyleSheet,Text,TextInput,View} from 'react-native';
import Bouton from './Bouton';
import {couleurs,espacement,polices} from '../theme/theme';
import {calculerScenarioCommercial,SCENARIO_INITIAL,validerScenarioCommercial,type ScenarioCommercial}
  from '../concepteur/scenarioCommercial';
import {enregistrerScenarioCommercial,lireScenarioCommercial} from '../concepteur/scenarioCommercialStore';

const EUROS=(n:number)=>n.toLocaleString('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:2});
const erreurTexte=(e:unknown)=>e instanceof Error?e.message:'Configuration illisible';
const CHAMPS:ReadonlyArray<{cle:Exclude<keyof ScenarioCommercial,'schema'>;nom:string;detail:string}>=[
  {cle:'prixMensuel',nom:'Prix de l’abonnement (€)',detail:'Prix mensuel théorique, sans connexion au paiement.'},
  {cle:'abonnesPrevus',nom:'Abonnés envisagés',detail:'Hypothèse, pas le nombre réel d’abonnés.'},
  {cle:'infrastructureMensuelle',nom:'GPU et hébergement mensuels (€)',detail:'Saisis ton coût estimé d’infrastructure.'},
  {cle:'autresChargesMensuelles',nom:'Autres charges mensuelles (€)',detail:'Frais que tu souhaites intégrer toi-même.'},
  {cle:'fraisPaiementPourcent',nom:'Frais de paiement estimés (%)',detail:'Hypothèse personnalisée, pas un tarif constaté.'},
];
export default function AtelierCommercialPanel(){
  const [original,setOriginal]=useState<ScenarioCommercial|null>(null);
  const [form,setForm]=useState<ScenarioCommercial>({...SCENARIO_INITIAL});
  const [brouillons,setBrouillons]=useState<Record<string,string>>({});
  const [charge,setCharge]=useState(true);
  const [occupe,setOccupe]=useState(false);
  const [erreur,setErreur]=useState('');
  const [message,setMessage]=useState('');
  useEffect(()=>{
    let ouvert=true;
    lireScenarioCommercial().then(s=>{
      if(ouvert){setForm(s);setOriginal(s);}
    }).catch(e=>{if(ouvert)setErreur(erreurTexte(e));})
      .finally(()=>{if(ouvert)setCharge(false);});
    return()=>{ouvert=false;};
  },[]);
  function modifier(cle:Exclude<keyof ScenarioCommercial,'schema'>,value:string){
    setBrouillons(x=>({...x,[cle]:value}));
    const n=Number(value.replace(',','.'));
    if(value.trim()&&Number.isFinite(n))setForm(x=>({...x,[cle]:n}));
  }
  const pret = CHAMPS.every(c=>brouillons[c.cle]===undefined ||
    (brouillons[c.cle].trim()!=='' && Number.isFinite(Number(brouillons[c.cle].replace(',','.')))));
  const calcul=(()=>{try{return pret?calculerScenarioCommercial(form):null;}catch{return null;}})();
  async function sauver(){
    setOcuppe(true);setErreur('');setMessage('');
    try{
      if(!pret)throw Error('Termine les champs numériques avant de sauvegarder.');
      const v=validerScenarioCommercial(form);
      const resultat=await enregistrerScenarioCommercial(v);
      setForm(resultat);setOriginal(resultat);setBrouillons({});
      setMessage('Prévisions sauvegardées sur cette tablette.');
    }catch(e){setErreur(erreurTexte(e));}
    finally{setOcuppe(false);}
  }
  return <View>
    <Text style={styles.titre}>Prévision commerciale</Text>
    <Text style={styles.aide}>Outil local de simulation. Aucune transaction, compte client ou facturation n’est réalisée.</Text>
    {charge?<ActivityIndicator color={couleurs.accent}/>:<>
      {CHAMPS.map(c=><View key={c.cle} style={styles.champBloc}>
        <Text style={styles.label}>{c.nom}</Text>
        <Text style={styles.aide}>{c.detail}</Text>
        <TextInput accessibilityLabel={c.nom} editable={!occupe} keyboardType="decimal-pad"
          style={styles.champ} value={brouillons[c.cle]??String(form[c.cle])}
          onChangeText={v=>modifier(c.cle,v)} />
      </View>)}
      <Text style={styles.label}>Projection mensuelle</Text>
      {calcul ? <View style={styles.resultat}>
        <View style={styles.ligne}><Text style={styles.aide}>Recettes hypothétiques</Text><Text style={styles.valeur}>{EUROS(calcul.recettes)}</Text></View>
        <View style={styles.ligne}><Text style={styles.aide}>Frais de paiement estimés</Text><Text style={styles.valeur}>{EUROS(calcul.fraisPaiement)}</Text></View>
        <View style={styles.ligne}><Text style={styles.aide}>Charges totales saisies</Text><Text style={styles.valeur}>{EUROS(calcul.charges)}</Text></View>
        <View style={styles.ligne}><Text style={styles.aide}>Différence avant fiscalité</Text><Text style={styles.valeur}>{EUROS(calcul.difference)}</Text></View>
      </View>:<Text style={styles.aide}>Entre des montants valides pour obtenir une estimation.</Text>}
      <Text style={styles.aide}>N’inclut pas automatiquement la TVA, les impôts, les cotisations, les remboursements, les impayés ou les autres frais non renseignés. Ce n’est pas un calcul de bénéfice net.</Text>
      <Bouton titre="Enregistrer cette simulation" onPress={()=>void sauver()}
        desactive={occupe||!pret||!calcul||JSON.stringify(form)===JSON.stringify(original)} style={styles.bouton}/>
    </>}
    {occupe?<ActivityIndicator color={couleurs.accent}/>:null}
    {erreur?<Text style={styles.erreur}>{erreur}</Text>:null}
    {message?<Text style={styles.succes}>{message}</Text>:null}
    <Text style={styles.label}>Administration réelle des abonnements</Text>
    <Text style={styles.aide}>NON CONNECTÉE. Elle nécessitera un prestataire de paiement, une authentification administrateur, un serveur sécurisé et un suivi des droits des utilisateurs. Aucun bouton de facturation factice n’est proposé.</Text>
  </View>;
}
const styles=StyleSheet.create({
 titre:{color:couleurs.texte,fontFamily:polices.titre,fontSize:21,marginBottom:espacement.sm},
 aide:{color:couleurs.texteAtténué,fontFamily:polices.corps,fontSize:14,lineHeight:19},
 label:{color:couleurs.doreClair,fontFamily:polices.corpsMedium,fontSize:15,marginTop:espacement.md,marginBottom:4},
 champBloc:{marginVertical:3},
 champ:{borderColor:couleurs.bordureSubtile,borderWidth:1,borderRadius:10,
  backgroundColor:couleurs.fondChampSaisie,color:couleurs.texte,fontFamily:polices.corps,
  fontSize:16,padding:12,marginTop:6,minHeight:46},
 resultat:{padding:12,borderRadius:10,backgroundColor:couleurs.fondCarte,marginVertical:12,gap:8},
 ligne:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
 valeur:{color:couleurs.texte,fontFamily:polices.corpsMedium,fontSize:15},
 bouton:{marginVertical:8},erreur:{color:couleurs.danger,marginVertical:6},succes:{color:couleurs.succes,marginVertical:6},
});
