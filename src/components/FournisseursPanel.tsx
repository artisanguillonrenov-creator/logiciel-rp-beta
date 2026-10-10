import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {getSettings,saveSettings} from '../storage/storage';
import type {AppSettings} from '../types';
import { ELYNDOR_CLOUD_REGLAGE_URL } from '../engine/elyndorCloud';
import {listerModeles,listerModelesGPT,MODELES_GPT_SUGGERES} from '../engine/elyndorCloudClient';
import {listerModelesImagesOpenRouter} from '../engine/fournisseursImages';
import {couleurs,espacement,polices} from '../theme/theme';
import Bouton from './Bouton';

type ModeTexte='openrouter'|'openai'|'runpod'|'serveur';
type ModeImages='desactive'|'runpod'|'openrouter';
const LABELS:Record<ModeTexte,string>={
  openrouter:'OpenRouter',openai:'OpenAI / GPT',runpod:'RunPod Elyndor',serveur:'Autre API compatible',
};
const MODES_IMAGES:Record<ModeImages,string>={
  desactive:'Désactivées (0 appel GPU)',runpod:'RunPod Elyndor',openrouter:'OpenRouter (potentiellement payant)',
};
function modeDuTexte(v:AppSettings):ModeTexte{
  if(v.moteurInference==='openai'||v.fournisseurNarration==='openai')return 'openai';
  if(v.moteurInference==='openrouter')return 'openrouter';
  if(v.serveurLocalUrl===ELYNDOR_CLOUD_REGLAGE_URL)return 'runpod';
  return 'serveur';
}
export default function FournisseursPanel(){
  const [cfg,setCfg]=useState<AppSettings|null>(null);
  const [mode,setMode]=useState<ModeTexte>('openrouter');
  const [selection,setSelection]=useState<ModeImages>('desactive');
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState('');
  const [voirCle,setVoirCle]=useState(false);
  const [catalogue,setCatalogue]=useState<Array<{id:string;nom:string}>>([]);
  const [modelesGPT,setModelesGPT]=useState<Array<{id:string;nom:string}>>([]);
  const [catalogueImage,setCatalogueImage]=useState<Array<{id:string;nom:string}>>([]);
  useEffect(()=>{
    getSettings().then(s=>{
      setCfg(s);setMode(modeDuTexte(s));setSelection(s.fournisseurImages||'desactive');
    }).catch(e=>setMsg('Lecture des fournisseurs impossible : '+String(e)));
  },[]);
  const set=(patch:Partial<AppSettings>)=>setCfg(v=>v?{...v,...patch}:v);
  const chargerCatalogue=async(type:'texte'|'image')=>{
    setBusy(true);setMsg('');
    try{
      const all=type==='texte'?await listerModeles():await listerModelesImagesOpenRouter();
      if(type==='texte')setCatalogue(all);
      else setCatalogueImage(all);
      setMsg(all.length+' modèles trouvés ; sélectionne celui que tu veux utiliser.');
    }catch(e){setMsg('Catalogue indisponible : '+(e instanceof Error?e.message:String(e)));}
    finally{setBusy(false);}
  };
  const chargerGPT=async()=>{
    if(!cfg?.openAiApiKey?.trim()){setMsg('Entre ta clé API OpenAI pour afficher les modèles disponibles.');return;}
    setBusy(true);setMsg('');
    try{
      const modeles=await listerModelesGPT(cfg.openAiApiKey);
      setModelesGPT(modeles);
      setMsg(modeles.length+' modèles GPT détectés sur l’API OpenAI. La disponibilité réelle dépend de ton compte.');
    }catch(e){setMsg('Connexion OpenAI : '+(e instanceof Error?e.message:String(e)));}
    finally{setBusy(false);}
  };
  const enregistrer=async()=>{
    if(!cfg)return;
    setBusy(true);setMsg('');
    try{
      const v:AppSettings={
        ...cfg,
        moteurInference:mode==='openai'?'openai':mode==='openrouter'?'openrouter':'serveur',
        fournisseurNarration:mode,
        serveurLocalUrl:mode==='runpod'?ELYNDOR_CLOUD_REGLAGE_URL:cfg.serveurLocalUrl,
        serveurLocalModele:mode==='runpod'?'cydonia-24b-elyndor':cfg.serveurLocalModele,
        fournisseurImages:selection,
        fournisseurEmbeddings:cfg.fournisseurEmbeddings==='runpod'?'runpod':'desactive',
      };
      if(mode==='openai' && !v.openAiApiKey?.trim()){
        throw new Error('Entre une clé API OpenAI pour activer GPT.');
      }
      if(mode==='openai' && !v.openAiModel?.trim()){
        throw new Error('Choisis un modèle GPT.');
      }
      if(mode==='openrouter' && !v.openRouterApiKey?.trim()){
        throw new Error('Entre ta clé API OpenRouter pour utiliser ses modèles.');
      }
      if(mode==='serveur' && (!v.serveurLocalUrl?.startsWith('https://') || !v.serveurLocalModele?.trim())){
        throw new Error('L’API personnalisée exige une adresse HTTPS et un identifiant de modèle.');
      }
      if(selection==='openrouter' && !v.modeleImages?.trim()){
        throw new Error('Choisis un modèle image OpenRouter ou désactive les images.');
      }
      await saveSettings(v);
      setCfg(await getSettings());
      setMsg('Fournisseurs enregistrés. Aucun appel GPU ni génération image lancé.');
    }catch(e){setMsg(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  };
  if(!cfg)return <Text style={st.text}>{msg||'Chargement des fournisseurs…'}</Text>;
  return <View style={st.panel}>
    <Text style={st.title}>Fournisseurs IA</Text>
    <Text style={st.text}>Choisis indépendamment le narrateur, les images et la recherche. Les paramètres incompatibles ne seront pas envoyés au nouveau fournisseur.</Text>
    <Text style={st.label}>Narrateur et directeur artistique</Text>
    {(Object.keys(LABELS) as ModeTexte[]).map(x=><Pressable key={x} style={[st.option,mode===x&&st.selected]}
      accessibilityRole="radio" accessibilityState={{checked:mode===x}} onPress={()=>setMode(x)}>
      <Text style={st.name}>{mode===x?'● ':'○ '}{LABELS[x]}</Text>
    </Pressable>)}
    {mode==='openrouter'?<>
      <Text style={st.label}>Clé API OpenRouter</Text>
      <TextInput style={st.input} value={cfg.openRouterApiKey||''}
        secureTextEntry={!voirCle} autoCapitalize="none" autoCorrect={false}
        placeholder="sk-or-…" placeholderTextColor={couleurs.texteFaible}
        onChangeText={t=>set({openRouterApiKey:t.trim()})}/>
      <Pressable accessibilityRole="button" onPress={()=>setVoirCle(x=>!x)}>
        <Text style={st.text}>{voirCle?'Masquer la clé':'Afficher la clé'}</Text>
      </Pressable>
      <Text style={st.label}>Modèle texte OpenRouter</Text>
      <TextInput style={st.input} value={cfg.model||''} autoCapitalize="none"
        onChangeText={t=>set({model:t.trim()})}/>
      <Bouton titre="Voir les modèles gratuits" variante="secondaire" desactive={busy}
        onPress={()=>void chargerCatalogue('texte')}/>
      {catalogue.slice(0,25).map(item=><Pressable key={item.id} style={st.option} onPress={()=>set({model:item.id})}>
        <Text style={st.text}>{cfg.model===item.id?'✓ ':''}{item.nom}</Text>
      </Pressable>)}
    </>:null}
    {mode==='openai'?<>
      <Text style={st.text}>GPT utilise directement l’API OpenAI. L’abonnement ChatGPT ne donne pas de crédits API : chaque requête peut être facturée.</Text>
      <Text style={st.label}>Clé API OpenAI</Text>
      <TextInput style={st.input} value={cfg.openAiApiKey||''}
        secureTextEntry={!voirCle} autoCapitalize="none" autoCorrect={false}
        placeholder="sk-…" placeholderTextColor={couleurs.texteFaible}
        onChangeText={t=>set({openAiApiKey:t.trim()})}/>
      <Pressable accessibilityRole="button" onPress={()=>setVoirCle(x=>!x)}>
        <Text style={st.text}>{voirCle?'Masquer la clé':'Afficher la clé'}</Text>
      </Pressable>
      <Text style={st.label}>Modèle GPT choisi</Text>
      <TextInput style={st.input} value={cfg.openAiModel||'gpt-4.1-mini'}
        autoCapitalize="none" autoCorrect={false}
        onChangeText={t=>set({openAiModel:t.trim()})}/>
      <Text style={st.text}>Sélection rapide (modèles à vérifier selon ton accès API) :</Text>
      {MODELES_GPT_SUGGERES.map(id=><Pressable key={id} style={[st.option,cfg.openAiModel===id&&st.selected]}
        accessibilityRole="radio" accessibilityState={{checked:cfg.openAiModel===id}}
        onPress={()=>set({openAiModel:id})}>
        <Text style={st.text}>{cfg.openAiModel===id?'● ':'○ '}{id}</Text>
      </Pressable>)}
      <Bouton titre="Rechercher mes modèles GPT" variante="secondaire" desactive={busy}
        onPress={()=>void chargerGPT()}/>
      {modelesGPT.slice(0,60).map(item=><Pressable key={item.id} style={[st.option,cfg.openAiModel===item.id&&st.selected]}
        accessibilityRole="radio" accessibilityState={{checked:cfg.openAiModel===item.id}}
        onPress={()=>set({openAiModel:item.id})}>
        <Text style={st.text}>{cfg.openAiModel===item.id?'● ':'○ '}{item.nom}</Text>
      </Pressable>)}
      <Text style={st.text}>Ta clé est conservée dans le coffre sécurisé Android. Les images et les embeddings gardent leurs fournisseurs indépendants.</Text>
    </>:null}
    {mode==='serveur'?<>
      <Text style={st.label}>Adresse API compatible /v1</Text>
      <TextInput style={st.input} value={cfg.serveurLocalUrl||''}
        autoCapitalize="none" onChangeText={t=>set({serveurLocalUrl:t.trim()})}/>
      <Text style={st.label}>Modèle</Text>
      <TextInput style={st.input} value={cfg.serveurLocalModele||''}
        autoCapitalize="none" onChangeText={t=>set({serveurLocalModele:t.trim()})}/>
    </>:null}
    <Text style={st.label}>Fournisseur de génération d’images</Text>
    {(Object.keys(MODES_IMAGES) as ModeImages[]).map(x=><Pressable key={x}
      style={[st.option,selection===x&&st.selected]} accessibilityRole="radio"
      accessibilityState={{checked:selection===x}} onPress={()=>setSelection(x)}>
      <Text style={st.name}>{selection===x?'● ':'○ '}{MODES_IMAGES[x]}</Text>
    </Pressable>)}
    {selection==='openrouter'?<>
      <Text style={st.label}>Modèle image OpenRouter</Text>
      <TextInput style={st.input} value={cfg.modeleImages||''}
        autoCapitalize="none" onChangeText={t=>set({modeleImages:t.trim()})}/>
      <Bouton titre="Lister les modèles d’image" variante="secondaire" desactive={busy}
        onPress={()=>void chargerCatalogue('image')}/>
      {catalogueImage.slice(0,25).map(item=><Pressable key={item.id} style={st.option} onPress={()=>set({modeleImages:item.id})}>
        <Text style={st.text}>{cfg.modeleImages===item.id?'✓ ':''}{item.nom}</Text>
      </Pressable>)}
      <Pressable style={[st.option,cfg.autoriserImagesPayantes&&st.selected]}
        accessibilityRole="switch" accessibilityState={{checked:cfg.autoriserImagesPayantes===true}}
        onPress={()=>set({autoriserImagesPayantes:!cfg.autoriserImagesPayantes})}>
        <Text style={st.name}>{cfg.autoriserImagesPayantes?'☑':'☐'} Autoriser les générations d’images payantes</Text>
        <Text style={st.text}>Désactivé par défaut. Peut entraîner des frais sur OpenRouter.</Text>
      </Pressable>
    </>:null}
    <Text style={st.label}>Recherche sémantique</Text>
    <Pressable style={st.option} accessibilityRole="switch"
      accessibilityState={{checked:cfg.fournisseurEmbeddings==='runpod'}}
      onPress={()=>set({fournisseurEmbeddings:cfg.fournisseurEmbeddings==='runpod'?'desactive':'runpod'})}>
      <Text style={st.name}>{cfg.fournisseurEmbeddings==='runpod'?'☑':'☐'} Embeddings RunPod</Text>
      <Text style={st.text}>Si désactivés, Elyndor utilise la recherche lexicale sans appel GPU.</Text>
    </Pressable>
    <Bouton titre={busy?'En cours…':'Enregistrer les fournisseurs'} desactive={busy} onPress={()=>void enregistrer()}/>
    {busy?<ActivityIndicator color={couleurs.accent}/>:null}
    {msg?<Text style={st.text}>{msg}</Text>:null}
  </View>;
}
const st=StyleSheet.create({
 panel:{marginVertical:8,gap:8},title:{fontFamily:polices.titre,color:couleurs.texte,fontSize:21},
 text:{fontFamily:polices.corps,color:couleurs.texteAtténué,fontSize:13,lineHeight:19},
 name:{fontFamily:polices.corpsMedium,color:couleurs.texte,fontSize:15},
 label:{fontFamily:polices.corpsMedium,color:couleurs.doreClair,fontSize:15,marginTop:11},
 input:{borderWidth:1,borderColor:couleurs.bordureSubtile,borderRadius:8,padding:10,color:couleurs.texte,backgroundColor:couleurs.fondChampSaisie},
 option:{borderWidth:1,borderColor:couleurs.bordureSubtile,borderRadius:8,padding:10,gap:3},
 selected:{borderColor:couleurs.dore,backgroundColor:couleurs.fondCarte},
});
