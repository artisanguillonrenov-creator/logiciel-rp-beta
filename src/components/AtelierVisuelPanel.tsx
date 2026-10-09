import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MODULES_BASE } from '../engine/visualBible';
import {
  appliquerPresetVisuel, REGLAGES_VISUELS_INITIAUX, validerReglagesVisuels,
  type ReglagesVisuels, type PresetVisuel,
} from '../concepteur/reglagesVisuels';
import { enregistrerReglagesVisuels, lireReglagesVisuels } from '../concepteur/reglagesVisuelsStore';
import { couleurs, espacement, polices } from '../theme/theme';
import Bouton from './Bouton';

const PRESETS: Array<{ id: PresetVisuel; titre: string; detail: string }> = [
  { id: 'elyndor', titre: 'Elyndor original', detail: 'Style actuellement utilisé, sans modification.' },
  { id: 'equilibre', titre: 'Équilibré', detail: 'Accent cinématographique moins intense.' },
  { id: 'nerveux', titre: 'Nerveux', detail: 'Style cinématographique plus appuyé.' },
];
const erreurTexte = (e: unknown) => e instanceof Error ? e.message : 'Enregistrement impossible.';
export default function AtelierVisuelPanel() {
  const [edite, setEdite] = useState<ReglagesVisuels>({...REGLAGES_VISUELS_INITIAUX});
  const [initial, setInitial] = useState<ReglagesVisuels | null>(null);
  const [charge, setCharge] = useState(true);
  const [operation, setOperation] = useState(false);
  const [message, setMessage] = useState('');
  const [erreur, setErreur] = useState('');
  useEffect(()=>{
    let actif=true;
    lireReglagesVisuels().then(v=>{
      if(actif){setEdite(v);setInitial(v);}
    }).catch(e=>{if(actif)setErreur(erreurTexte(e));})
      .finally(()=>{if(actif)setCharge(false);});
    return ()=>{actif=false;};
  },[]);
  const changements = initial && JSON.stringify(initial)!==JSON.stringify(edite);
  const modules = useMemo(()=>appliquerPresetVisuel(MODULES_BASE,edite),[edite]);
  async function sauvegarder(valeur: ReglagesVisuels) {
    setOperation(true);setMessage('');setErreur('');
    try {
      const valide=validerReglagesVisuels(valeur);
      const config=await enregistrerReglagesVisuels(valide);
      setEdite(config);setInitial(config);
      setMessage('Réglages actifs pour les prochaines images et portraits générés sur cet appareil.');
    } catch(e) {setErreur(erreurTexte(e));}
    finally {setOperation(false);}
  }
  return <View>
    <Text style={styles.titre}>Direction artistique et génération</Text>
    <Text style={styles.aide}>Ces paramètres modifient les poids des modules envoyés au générateur d’images déjà connecté. Ils ne changent ni son modèle, ni les scènes déjà enregistrées.</Text>
    {charge ? <ActivityIndicator color={couleurs.accent}/> : <>
      <Text style={styles.label}>Préréglage cinématographique</Text>
      {PRESETS.map(x=><Pressable key={x.id} disabled={operation} accessibilityRole="radio"
        accessibilityState={{checked: edite.preset===x.id}}
        onPress={()=>setEdite(v=>({...v,preset:x.id}))}
        style={[styles.choix,edite.preset===x.id&&styles.actif]}>
        <Text style={styles.nom}>{x.titre}</Text>
        <Text style={styles.aide}>{x.detail}</Text>
      </Pressable>)}
      <Text style={styles.label}>Intensité stylistique</Text>
      <View style={styles.ligne}>
        <Bouton titre="−" variante="secondaire" desactive={operation||edite.intensite<=0.7}
          onPress={()=>setEdite(v=>({...v,intensite:Math.max(0.7,Number((v.intensite-0.1).toFixed(2)))}))}/>
        <Text style={styles.nom}>{edite.intensite.toFixed(1)} ×</Text>
        <Bouton titre="+" variante="secondaire" desactive={operation||edite.intensite>=1.3}
          onPress={()=>setEdite(v=>({...v,intensite:Math.min(1.3,Number((v.intensite+0.1).toFixed(2)))}))}/>
      </View>
      <Text style={styles.label}>Exclusions visuelles supplémentaires</Text>
      <TextInput value={edite.negatifAdditionnel} onChangeText={v=>setEdite(x=>({...x,negatifAdditionnel:v}))}
        style={styles.champ} multiline maxLength={350} textAlignVertical="top"
        placeholder="Ex : arrière-plan flou, reflets excessifs" placeholderTextColor={couleurs.texteFaible}/>
      <Text style={styles.aide}>S’ajoutent aux exclusions techniques et aux protections du profil Grand public ; elles ne les remplacent jamais.</Text>
      <Text style={styles.label}>Poids qui seront envoyés au générateur</Text>
      {Object.entries(modules).map(([nom,poids])=><View key={nom} style={styles.poids}>
        <Text style={styles.aide}>{nom}</Text><Text style={styles.nom}>{poids.toFixed(2)}</Text>
      </View>)}
      <Bouton titre="Enregistrer les préréglages visuels" desactive={operation||!changements}
        onPress={()=>void sauvegarder(edite)} style={styles.bouton}/>
      <Bouton titre="Restaurer les valeurs d’origine" variante="secondaire" desactive={operation}
        onPress={()=>Alert.alert('Restaurer le style original ?',
          'Seules les préférences d’illustration seront modifiées. Les images existantes seront conservées.',[
            {text:'Annuler',style:'cancel'},
            {text:'Restaurer',onPress:()=>{void sauvegarder({...REGLAGES_VISUELS_INITIAUX});}},
          ])} style={styles.bouton}/>
    </>}
    {operation?<ActivityIndicator color={couleurs.accent}/>:null}
    {message?<Text style={styles.succes}>{message}</Text>:null}
    {erreur?<Text style={styles.erreur}>{erreur}</Text>:null}
    <Text style={styles.aide}>Aucun rendu d’essai ne sera lancé automatiquement : chaque génération peut consommer du temps GPU. La réussite dépend des modules réellement installés sur le pod.</Text>
  </View>;
}
const styles=StyleSheet.create({
 titre:{color:couleurs.texte,fontFamily:polices.titre,fontSize:21,marginBottom:espacement.sm},
 label:{color:couleurs.doreClair,fontFamily:polices.corpsMedium,fontSize:15,marginTop:espacement.md,marginBottom:6},
 aide:{color:couleurs.texteAtténué,fontFamily:polices.corps,fontSize:14,lineHeight:20},
 nom:{color:couleurs.texte,fontFamily:polices.corpsMedium,fontSize:16},
 choix:{borderWidth:1,borderColor:couleurs.bordureSubtile,borderRadius:10,padding:12,marginVertical:4,gap:4},
 actif:{borderColor:couleurs.dore,backgroundColor:couleurs.fondCarte},
 ligne:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,marginVertical:6},
 champ:{minHeight:90,padding:12,borderWidth:1,borderColor:couleurs.bordureSubtile,borderRadius:10,color:couleurs.texte,backgroundColor:couleurs.fondChampSaisie},
 poids:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',borderBottomWidth:1,borderBottomColor:couleurs.bordureSubtile,paddingVertical:6},
 bouton:{marginVertical:8},
 succes:{color:couleurs.succes,marginVertical:6},erreur:{color:couleurs.danger,marginVertical:6},
});
