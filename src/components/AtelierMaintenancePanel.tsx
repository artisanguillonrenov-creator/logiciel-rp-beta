import React,{useState} from 'react';
import {ActivityIndicator,Alert,Linking,StyleSheet,Text,View} from 'react-native';
import Bouton from './Bouton';
import {couleurs,espacement,polices} from '../theme/theme';
import {VERSION_APP} from '../version';
import {useUpdateCheck} from '../automation/useUpdateCheck';
import {viderCacheEmbeddings} from '../storage/embeddingsStore';
import {retryFailedAutomationJobs} from '../automation/kernel';
import AtelierDiagnosticPanel from './AtelierDiagnosticPanel';
const COMMIT_BUNDLE=process.env.EXPO_PUBLIC_GIT_SHA||'non renseigné';
const erreurTexte=(e:unknown)=>e instanceof Error?e.message:'Opération impossible.';
function destinationFiable(lien:string):boolean {
  return /^https:\/\/(?:github\.com|(?:[a-z0-9-]+\.)?github\.io|expo\.dev)\//i.test(lien);
}
export default function AtelierMaintenancePanel(){
  const verification=useUpdateCheck();
  const maj=verification.snapshot?.info??null;
  const [occupe,setOccupe]=useState(false);
  const [erreur,setErreur]=useState('');
  const [message,setMessage]=useState('');
  async function visiter(){
    if(!maj?.url||!destinationFiable(maj.url)){setErreur('Lien non autorisé : aucune ouverture.');return;}
    try{await Linking.openURL(maj.url);}catch(e){setErreur(erreurTexte(e));}
  }
  async function vider(){
    setOccupe(true);setErreur('');setMessage('');
    try{await viderCacheEmbeddings();setMessage('Cache d’embeddings effacé. Les vecteurs seront recalculés si nécessaire.');}
    catch(e){setErreur(erreurTexte(e));}finally{setOccupe(false);}
  }
  async function relancer(){
    setOccupe(true);setErreur('');setMessage('');
    try{const n=await retryFailedAutomationJobs();
      setMessage(n+' routine(s) en erreur reprogrammée(s).');}
    catch(e){setErreur(erreurTexte(e));}finally{setOccupe(false);}
  }
  return <View>
    <Text style={styles.titre}>Versions et maintenance</Text>
    <Text style={styles.aide}>Version installée : {VERSION_APP}</Text>
    <Text style={styles.aide}>Révision JavaScript : {COMMIT_BUNDLE.slice(0,12)}</Text>
    <Text style={styles.aide}>Les vérifications et réparations se font à la demande. Aucune suppression d’histoire ni installation automatique d’APK.</Text>
    <Text style={styles.label}>Mises à jour</Text>
    <Bouton titre={verification.enCours?'Vérification…':'Vérifier maintenant'} variante="secondaire"
      onPress={()=>void verification.verifierMaintenant()} desactive={occupe||verification.enCours} style={styles.bouton}/>
    {verification.erreur?<Text style={styles.erreur}>{verification.erreur}</Text>:null}
    {maj && verification.snapshot && <View style={styles.resultats}>
      <Text style={styles.aide}>Dernière vérification : {new Date(verification.snapshot.checkedAt).toLocaleString()}</Text>
      <Text style={styles.aide}>Version annoncée : {maj.derniereVersion} · {maj.disponible?'Plus récente':'Pas plus récente'}</Text>
      {maj.notes?<Text style={styles.aide}>{maj.notes}</Text>:null}
      {maj.disponible && maj.url && destinationFiable(maj.url)
        ?<Bouton titre="Ouvrir la page de mise à jour" onPress={()=>void visiter()} style={styles.bouton}/>:null}
      <Text style={styles.aide}>Le catalogue peut être en retard sur les builds GitHub. Vérifie également la page de compilation de ton APK.</Text>
    </View>}
    <Text style={styles.label}>Entretien sécurisé</Text>
    <Bouton titre="Reprogrammer les routines en erreur" variante="secondaire"
      onPress={()=>void relancer()} desactive={occupe} style={styles.bouton}/>
    <Bouton titre="Vider les embeddings en cache" variante="secondaire"
      onPress={()=>Alert.alert('Vider les embeddings ?',
        'Le cache vectoriel local sera vidé puis reconstruit à la demande. Les histoires seront conservées.',
        [{text:'Annuler',style:'cancel'}, {text:'Vider le cache',style:'destructive',onPress:()=>{void vider();}}])}
      desactive={occupe} style={styles.bouton}/>
    {occupe?<ActivityIndicator color={couleurs.accent}/>:null}
    {erreur?<Text style={styles.erreur}>{erreur}</Text>:null}
    {message?<Text style={styles.succes}>{message}</Text>:null}
    <Text style={styles.label}>Audit de la dernière histoire</Text>
    <AtelierDiagnosticPanel mode="diagnostics"/>
    <Text style={styles.aide}>Pour les PNG et journaux supprimables individuellement, utilise le module Stockage. Le nettoyage des bases et les mises à jour serveur exigent des procédures séparées et sécurisées.</Text>
  </View>;
}
const styles=StyleSheet.create({
 titre:{color:couleurs.texte,fontFamily:polices.titre,fontSize:21,marginBottom:espacement.sm},
 label:{color:couleurs.doreClair,fontFamily:polices.corpsMedium,fontSize:16,marginTop:espacement.lg,marginBottom:6},
 aide:{color:couleurs.texteAtténué,fontFamily:polices.corps,fontSize:14,lineHeight:20,marginVertical:3},
 bouton:{marginVertical:7},
 resultats:{padding:12,borderRadius:10,borderColor:couleurs.bordureSubtile,borderWidth:1},
 erreur:{color:couleurs.danger,marginVertical:6},succes:{color:couleurs.succes,marginVertical:6},
});
