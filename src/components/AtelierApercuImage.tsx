import React,{useState} from 'react';
import {ActivityIndicator,Image,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {getSettings} from '../storage/storage';
import {genererImageSelonReglages} from '../engine/fournisseursImages';
import type {FormatImage,RequeteImage} from '../engine/elyndorCloudImages';
import {couleurs,espacement,polices} from '../theme/theme';
import Bouton from './Bouton';

export default function AtelierApercuImage(){
  const [prompt,setPrompt]=useState('');
  const [negatif,setNegatif]=useState('');
  const [format,setFormat]=useState<FormatImage>('16:9');
  const [total,setTotal]=useState(1);
  const [accord,setAccord]=useState(false);
  const [attente,setAttente]=useState(false);
  const [images,setImages]=useState<string[]>([]);
  const [message,setMessage]=useState('');
  const [dernier,setDernier]=useState('');
  async function essayer(){
    setAttente(true);setMessage('');setImages([]);
    try{
      const cfg=await getSettings();
      const generateur=genererImageSelonReglages(cfg);
      if(!prompt.trim())throw Error('Entre un prompt avant de générer.');
      if(!accord)throw Error('Confirme chaque série d’essais avant de la lancer.');
      setDernier(JSON.stringify({
        fournisseur:cfg.fournisseurImages,modele:cfg.modeleImages,
        prompt:prompt.trim(),negatif:negatif.trim(),format,
        nombre:total,
      },null,2));
      const req:RequeteImage={
        prompt:prompt.trim(),promptCourt:prompt.trim(),negatif:negatif.trim(),
        references:[],format,
      };
      for(let i=0;i<total;i++){
        const image=await generateur(req);
        setImages(v=>[...v,image]);
      }
      setMessage('Aperçu prêt. Il reste séparé de toutes tes histoires.');
    }catch(e){setMessage(e instanceof Error?e.message:String(e));}
    finally{setAttente(false);setAccord(false);}
  }
  return <View style={st.bloc}>
    <Text style={st.titre}>Laboratoire d’aperçu image</Text>
    <Text style={st.aide}>Tests indépendants du récit. Les modèles d’image OpenRouter peuvent être payants.</Text>
    <Text style={st.label}>Prompt libre</Text>
    <TextInput style={[st.champ,{minHeight:116}]} value={prompt} onChangeText={setPrompt} multiline
      maxLength={3000} textAlignVertical="top" placeholder="Décris la scène ou le portrait…" placeholderTextColor={couleurs.texteFaible}/>
    <Text style={st.label}>Prompt négatif</Text>
    <TextInput style={[st.champ,{minHeight:60}]} value={negatif} onChangeText={setNegatif} multiline
      maxLength={1000} textAlignVertical="top" placeholder="Éléments à éviter" placeholderTextColor={couleurs.texteFaible}/>
    <Text style={st.label}>Format</Text>
    <View style={st.row}>{(['16:9','3:4'] as const).map(x=><Pressable key={x}
      style={[st.choix,format===x&&st.actif]} onPress={()=>setFormat(x)}>
      <Text style={st.nom}>{x}</Text>
    </Pressable>)}</View>
    <Text style={st.label}>Variantes</Text>
    <View style={st.row}>{[1,2,4].map(x=><Pressable key={x}
      style={[st.choix,total===x&&st.actif]} onPress={()=>setTotal(x)}>
      <Text style={st.nom}>{x} image{x>1?'s':''}</Text>
    </Pressable>)}</View>
    <Pressable style={[st.choix,accord&&st.actif]} onPress={()=>setAccord(v=>!v)}
      accessibilityRole="checkbox" accessibilityState={{checked:accord}}>
      <Text style={st.nom}>{accord?'☑':'☐'} Je confirme ce test ({total} génération{total>1?'s':''}).</Text>
      <Text style={st.aide}>Cette confirmation n’est pas une estimation du prix. Vérifie les tarifs du fournisseur.</Text>
    </Pressable>
    <Bouton titre={attente?'Génération en cours…':'Générer l’aperçu'} desactive={attente||!accord||!prompt.trim()}
      onPress={()=>void essayer()}/>
    {attente?<ActivityIndicator color={couleurs.accent}/>:null}
    {images.map((uri,i)=><Image key={i} source={{uri}} resizeMode="contain"
      style={{width:'100%',height:format==='16:9'?230:310,marginTop:8}}/>)}
    {message?<Text style={st.aide}>{message}</Text>:null}
    {dernier?<View>
      <Text style={st.label}>Dernière requête préparée</Text>
      <Text selectable style={st.aide}>{dernier}</Text>
    </View>:null}
  </View>;
}
const st=StyleSheet.create({
 bloc:{gap:8,marginVertical:12},
 titre:{fontFamily:polices.titre,fontSize:20,color:couleurs.texte},
 aide:{fontFamily:polices.corps,fontSize:13,lineHeight:19,color:couleurs.texteAtténué},
 label:{fontFamily:polices.corpsMedium,fontSize:15,color:couleurs.doreClair,marginTop:8},
 champ:{padding:12,borderColor:couleurs.bordureSubtile,borderWidth:1,borderRadius:8,
   color:couleurs.texte,backgroundColor:couleurs.fondChampSaisie},
 row:{flexDirection:'row',gap:7,flexWrap:'wrap'},
 choix:{padding:10,borderWidth:1,borderColor:couleurs.bordureSubtile,borderRadius:8,gap:4},
 actif:{borderColor:couleurs.dore,backgroundColor:couleurs.fondCarte},
 nom:{color:couleurs.texte,fontFamily:polices.corpsMedium},
});
