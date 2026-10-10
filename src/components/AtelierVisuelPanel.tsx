import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MODULES_BASE } from '../engine/visualBible';
import {
  appliquerPresetVisuel, REGLAGES_VISUELS_INITIAUX, validerReglagesVisuels, NOMS_MODULES_IMAGES,
  type ReglagesVisuels, type PresetVisuel, type CadrageIllustration, type PrioriteIllustration,
} from '../concepteur/reglagesVisuels';
import { enregistrerReglagesVisuels, lireReglagesVisuels } from '../concepteur/reglagesVisuelsStore';
import { couleurs, espacement, polices } from '../theme/theme';
import Bouton from './Bouton';
import AtelierApercuImage from './AtelierApercuImage';

const PRESETS: Array<{ id: PresetVisuel; titre: string; detail: string }> = [
  { id: 'elyndor', titre: 'Elyndor original', detail: 'Style actuellement utilisé, sans modification.' },
  { id: 'equilibre', titre: 'Équilibré', detail: 'Accent cinématographique moins intense.' },
  { id: 'nerveux', titre: 'Nerveux', detail: 'Style cinématographique plus appuyé.' },
];
const CADRAGES: Array<{ id: CadrageIllustration; titre: string; detail: string }> = [
  { id: 'automatique', titre: 'Automatique selon le récit', detail: 'Conserve le cadrage choisi par le directeur artistique.' },
  { id: 'moyen', titre: 'Plan moyen', detail: 'Personnages et interactions avec un décor identifiable.' },
  { id: 'large', titre: 'Plan large — recommandé', detail: 'Scène entière et personnages intégrés à leur environnement.' },
  { id: 'ensemble', titre: 'Très grand plan d’ensemble', detail: 'Décor monumental, personnages plus petits dans l’image.' },
];
const PRIORITES: Array<{ id: PrioriteIllustration; titre: string; detail: string }> = [
  { id: 'equilibree', titre: 'Équilibrée', detail: 'Même importance aux personnages et au décor.' },
  { id: 'decor', titre: 'Décor et mise en scène', detail: 'Architecture, espace, lumière et profondeur en priorité.' },
  { id: 'action', titre: 'Action et interactions', detail: 'Gestes, affrontements et actions du récit avec leur environnement.' },
];
const erreurTexte = (e: unknown) => e instanceof Error ? e.message : 'Enregistrement impossible.';
export default function AtelierVisuelPanel() {
  const [edite, setEdite] = useState<ReglagesVisuels>({...REGLAGES_VISUELS_INITIAUX});
  const [initial, setInitial] = useState<ReglagesVisuels | null>(null);
  const [charge, setCharge] = useState(true);
  const [operation, setOperation] = useState(false);
  const [message, setMessage] = useState('');
  const [nomModule, setNomModule] = useState('');
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
      setMessage('Réglages actifs pour les prochaines images générées sur cet appareil. Les scènes et les portraits conservent leurs paramètres distincts.');
    } catch(e) {setErreur(erreurTexte(e));}
    finally {setOperation(false);}
  }
  const changer = (patch: Partial<ReglagesVisuels>)=>setEdite(v=>({...v,...patch}));
  const numerique = (titre:string, cle:'pasScene'|'pasPortrait'|'guidanceScene'|'guidancePortrait'|'graineScene'|'grainePortrait'|'poidsReferenceRacePortrait')=>
    <View key={cle} style={styles.poids}>
      <Text style={[styles.aide,{flex:1}]}>{titre}</Text>
      <TextInput style={[styles.champ,{minHeight:42,width:95,textAlign:'center'}]}
        keyboardType="numeric" value={edite[cle]===null?'':String(edite[cle])}
        placeholder="Défaut" placeholderTextColor={couleurs.texteFaible}
        onChangeText={t=>changer({[cle]:t.trim()===''?null:(Number.isFinite(Number(t.replace(',','.')))?Number(t.replace(',','.')):null)} as Partial<ReglagesVisuels>)}/>
    </View>;
  const texteLibre = (titre:string,cle:'positifScene'|'negatifScene'|'positifPortrait'|'negatifPortrait')=>
    <View key={cle}>
      <Text style={styles.label}>{titre}</Text>
      <TextInput value={edite[cle]} onChangeText={t=>changer({[cle]:t} as Partial<ReglagesVisuels>)}
        multiline maxLength={500} textAlignVertical="top" style={styles.champ}
        placeholderTextColor={couleurs.texteFaible} placeholder="Instructions supplémentaires (facultatif)"/>
    </View>;
  const tailles = (titre:string,cle:'tailleScene'|'taillePortrait',options:readonly string[])=>
    <View key={cle}>
      <Text style={styles.label}>{titre}</Text>
      {options.map(t=><Pressable key={t} style={[styles.choix,edite[cle]===t&&styles.actif]}
        onPress={()=>changer({[cle]:t} as Partial<ReglagesVisuels>)}>
        <Text style={styles.nom}>{edite[cle]===t?'● ':'○ '}{t}</Text>
      </Pressable>)}
    </View>;
  const modifierModule=(mode:'modulesScene'|'modulesPortrait',nom:string,poids:number)=>{
    changer({[mode]:{...edite[mode],[nom]:Math.max(0,Math.min(1.5,Number(poids.toFixed(2))))}} as Partial<ReglagesVisuels>);
  };
  const moduleBloc=(mode:'modulesScene'|'modulesPortrait',titre:string)=>
    <View>
      <Text style={styles.label}>{titre}</Text>
      <Text style={styles.aide}>Les modules absents du serveur seront ignorés. Valeurs de 0 à 1,5 ; les autres réglages restent disponibles.</Text>
      {[...new Set([...NOMS_MODULES_IMAGES,...Object.keys(edite[mode])])].map(nom=>{
        const valeur=edite[mode][nom] ?? appliquerPresetVisuel(MODULES_BASE,edite)[nom] ?? 0;
        return <View key={nom} style={styles.poids}>
          <Text style={[styles.aide,{flex:1}]}>{nom}</Text>
          <Bouton titre="−" variante="secondaire" onPress={()=>modifierModule(mode,nom,valeur-0.1)}/>
          <Text style={styles.nom}>{valeur.toFixed(2)}</Text>
          <Bouton titre="+" variante="secondaire" onPress={()=>modifierModule(mode,nom,valeur+0.1)}/>
        </View>;
      })}
      <TextInput style={styles.champ} value={nomModule} onChangeText={setNomModule}
        placeholder="Nom d’un LoRA installé" autoCapitalize="none" placeholderTextColor={couleurs.texteFaible}/>
      <Bouton titre="Ajouter un module" variante="secondaire" onPress={()=>{
        const nom=nomModule.trim();
        if(/^[a-z0-9_-]{1,40}$/i.test(nom)){modifierModule(mode,nom,0.5);setNomModule('');}
      }}/>
    </View>;
  return <View>
    <Text style={styles.titre}>Direction artistique et génération</Text>
    <Text style={styles.aide}>Ces paramètres ajustent le style et la composition des prochaines images. Aucun changement de modèle ni d'image déjà enregistrée. Les cadrages ci-dessous concernent uniquement les scènes 16:9, pas les portraits des personnages.</Text>
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
      <Text style={styles.label}>Cadrage des illustrations de scène</Text>
      <Text style={styles.aide}>Choisis la distance de caméra pour les scènes 16:9. Le réglage « Automatique » laisse la main au directeur artistique.</Text>
      {CADRAGES.map(x=><Pressable key={x.id} disabled={operation} accessibilityRole="radio"
        accessibilityState={{checked: edite.cadrageIllustration===x.id}}
        onPress={()=>setEdite(v=>({...v,cadrageIllustration:x.id}))}
        style={[styles.choix,edite.cadrageIllustration===x.id&&styles.actif]}>
        <Text style={styles.nom}>{x.titre}</Text>
        <Text style={styles.aide}>{x.detail}</Text>
      </Pressable>)}
      <Text style={styles.label}>Priorité de composition</Text>
      {PRIORITES.map(x=><Pressable key={x.id} disabled={operation} accessibilityRole="radio"
        accessibilityState={{checked: edite.prioriteIllustration===x.id}}
        onPress={()=>setEdite(v=>({...v,prioriteIllustration:x.id}))}
        style={[styles.choix,edite.prioriteIllustration===x.id&&styles.actif]}>
        <Text style={styles.nom}>{x.titre}</Text>
        <Text style={styles.aide}>{x.detail}</Text>
      </Pressable>)}
      <Text style={styles.label}>Éviter les portraits dans les scènes</Text>
      <Pressable disabled={operation} accessibilityRole="switch"
        accessibilityState={{checked: edite.eviterPortraitScene}}
        onPress={()=>setEdite(v=>({...v,eviterPortraitScene:!v.eviterPortraitScene}))}
        style={[styles.choix,edite.eviterPortraitScene&&styles.actif]}>
        <Text style={styles.nom}>{edite.eviterPortraitScene?'Activé — scènes en priorité':'Désactivé — gros plans autorisés'}</Text>
        <Text style={styles.aide}>Évite les cadrages tête/buste et les fonds de studio pour les illustrations. Ne change pas les avatars.</Text>
      </Pressable>
      <Text style={styles.label}>Références de portraits pour les scènes</Text>
      <Pressable disabled={operation} accessibilityRole="switch"
        accessibilityState={{checked: edite.referencesPersonnagesScene}}
        onPress={()=>setEdite(v=>({...v,referencesPersonnagesScene:!v.referencesPersonnagesScene}))}
        style={[styles.choix,edite.referencesPersonnagesScene&&styles.actif]}>
        <Text style={styles.nom}>{edite.referencesPersonnagesScene?'Activées':'Désactivées — recommandé pour les plans larges'}</Text>
        <Text style={styles.aide}>Si activées, les portraits peuvent aider à conserver les visages, mais risquent de favoriser des plans serrés selon le modèle. Les scènes précédentes restent utilisables comme références de décor.</Text>
      </Pressable>
      <Text style={styles.label}>Exclusions visuelles supplémentaires</Text>
      <TextInput value={edite.negatifAdditionnel} onChangeText={v=>setEdite(x=>({...x,negatifAdditionnel:v}))}
        style={styles.champ} multiline maxLength={350} textAlignVertical="top"
        placeholder="Ex : arrière-plan flou, reflets excessifs" placeholderTextColor={couleurs.texteFaible}/>
      <Text style={styles.aide}>S’ajoutent aux exclusions techniques et aux protections du profil Grand public ; elles ne les remplacent jamais.</Text>
      <Text style={styles.label}>Poids qui seront envoyés au générateur</Text>
      {Object.entries(modules).map(([nom,poids])=><View key={nom} style={styles.poids}>
        <Text style={styles.aide}>{nom}</Text><Text style={styles.nom}>{poids.toFixed(2)}</Text>
      </View>)}
      <Text style={styles.label}>Références de scènes précédentes</Text>
      <Pressable style={[styles.choix,edite.referencesScenePrecedente&&styles.actif]}
        accessibilityRole="switch" accessibilityState={{checked:edite.referencesScenePrecedente}}
        onPress={()=>changer({referencesScenePrecedente:!edite.referencesScenePrecedente})}>
        <Text style={styles.nom}>{edite.referencesScenePrecedente?'● Activées':'○ Désactivées'}</Text>
      </Pressable>
      <Text style={styles.label}>Technique — illustrations 16:9</Text>
      {tailles('Résolution de scène','tailleScene',['1024x576','1344x768','1536x864'])}
      {numerique('Étapes (1–80)','pasScene')}
      {numerique('Guidance / CFG (0,1–20)','guidanceScene')}
      {numerique('Seed fixe (vide = aléatoire)','graineScene')}
      {texteLibre('Prompt positif permanent — scènes','positifScene')}
      {texteLibre('Prompt négatif permanent — scènes','negatifScene')}
      {moduleBloc('modulesScene','LoRA des scènes')}
      <Text style={styles.label}>Technique — portraits 3:4</Text>
      {tailles('Résolution des portraits','taillePortrait',['768x1024','896x1152','960x1280'])}
      {numerique('Étapes portraits (1–80)','pasPortrait')}
      {numerique('Guidance portraits (0,1–20)','guidancePortrait')}
      {numerique('Seed portraits','grainePortrait')}
      {numerique('Poids de référence raciale (0–1,5)','poidsReferenceRacePortrait')}
      {texteLibre('Prompt positif permanent — portraits','positifPortrait')}
      {texteLibre('Prompt négatif permanent — portraits','negatifPortrait')}
      {moduleBloc('modulesPortrait','LoRA des portraits')}
      <Text style={styles.aide}>Les paramètres techniques non pris en charge par le fournisseur sélectionné ne seront pas envoyés.</Text>
      <Bouton titre="Enregistrer les préréglages visuels" desactive={operation||!changements}
        onPress={()=>void sauvegarder(edite)} style={styles.bouton}/>
      <Bouton titre="Restaurer les valeurs d’origine" variante="secondaire" desactive={operation}
        onPress={()=>Alert.alert('Restaurer le style original ?',
          'Seules les préférences d’illustration seront modifiées. Les images existantes seront conservées.',[
            {text:'Annuler',style:'cancel'},
            {text:'Restaurer',onPress:()=>{void sauvegarder({...REGLAGES_VISUELS_INITIAUX});}},
          ])} style={styles.bouton}/>
    </>}
    <AtelierApercuImage/>
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
