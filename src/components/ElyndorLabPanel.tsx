import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { couleurs, espacement, polices, rayon } from '../theme/theme';
import Bouton from './Bouton';
import { lireDepotSourcesLab, type DepotSourcesLab } from '../lab/depotSources';
import {
  type AtelierLocal, type ControleLab, cheminValide, confirmerVersionStable, enregistrerVersion,
  fichiersActuels, modifierFichier, nouvelAtelier, precontrolerFichier, restaurerVersion,
  supprimerFichier, changementNatif,
} from '../lab/workspaceCore';
import { enregistrerAtelierLocal, lireAtelierLocal } from '../lab/workspaceStore';
import { exporterSourcesLab, importerArchiveLab } from '../lab/archives';
import { comparerArbres, comparerTexte, type ResumeImport } from '../lab/diff';

type Vue = 'fichiers' | 'editeur' | 'tests' | 'maj' | 'versions' | 'secours' | 'archives';
const ONGLETS: Array<{id:Vue;nom:string}> = [
  {id:'fichiers',nom:'Fichiers'}, {id:'editeur',nom:'Éditeur'}, {id:'tests',nom:'Tests'},
  {id:'maj',nom:'Mise à jour'}, {id:'versions',nom:'Versions'}, {id:'secours',nom:'Secours'}, {id:'archives',nom:'ZIP'}
];
const maxApercu = 50;
const erreurMessage = (cause:unknown) => cause instanceof Error ? cause.message : 'Opération impossible.';

export default function ElyndorLabPanel() {
  const [atelier,setAtelier] = useState<AtelierLocal|null>(null);
  const [depot,setDepot] = useState<DepotSourcesLab|null>(null);
  const [vue,setVue] = useState<Vue>('fichiers');
  const [dossier,setDossier] = useState('');
  const [selection,setSelection] = useState('');
  const [code,setCode] = useState('');
  const [affichageEditeur,setAffichageEditeur] = useState<'code'|'diff'>('code');
  const [editionModifiee,setEditionModifiee] = useState(false);
  const [recherche,setRecherche] = useState('');
  const [nomVersion,setNomVersion] = useState('Expérience');
  const [nomFichierCree,setNomFichierCree] = useState('nouveau-module.ts');
  const [versionSelectionnee,setVersionSelectionnee] = useState('');
  const [controles,setControles] = useState<ControleLab[]|null>(null);
  const [message,setMessage] = useState('');
  const [erreur,setErreur] = useState('');
  const [occupe,setOccupe] = useState(false);
  const [importPret,setImportPret] = useState<{atelier:AtelierLocal;nombre:number;complet:boolean;details:ResumeImport}|null>(null);

  useEffect(()=>{
    let actif=true;
    Promise.all([lireAtelierLocal(),lireDepotSourcesLab()]).then(([a,base])=>{if(actif){setAtelier(a);setDepot(base);setVersionSelectionnee(a.versions[a.versions.length-1]?.id ?? '');}})
      .catch((e)=>{if(actif)setErreur(erreurMessage(e));});
    return ()=>{actif=false;};
  },[]);

  const sources=depot?.sources??{};
  const fichiers = useMemo(()=>atelier && depot ? fichiersActuels(depot.sources,atelier):{},[atelier,depot]);
  const noms = useMemo(()=>Object.keys(fichiers).sort(),[fichiers]);
  const differenceEditeur = useMemo(()=>comparerTexte(selection?sources[selection]??'':'',code),[selection,sources,code]);
  const dossierContenu = useMemo(()=>{
    const sousDossiers = new Set<string>();
    const presents:string[]=[];
    const base=dossier ? dossier+'/' : '';
    for(const chemin of noms) {
      if(!chemin.startsWith(base))continue;
      const restant=chemin.slice(base.length);
      if(restant.includes('/'))sousDossiers.add(restant.split('/')[0]);
      else if(!recherche.trim() || chemin.toLowerCase().includes(recherche.toLowerCase()))presents.push(chemin);
    }
    return {dossiers:[...sousDossiers].sort(),fichiers:presents.slice(0,maxApercu),total:presents.length};
  },[dossier,noms,recherche]);

  function messageOk(s:string){setMessage(s);setErreur('');}
  function signaler(e:unknown){setErreur(erreurMessage(e));setMessage('');}
  async function appliquer(maj:AtelierLocal,texte:string){
    setOccupe(true);
    try { await enregistrerAtelierLocal(maj);setAtelier(maj);messageOk(texte); }
    catch(e){signaler(e);throw e;}
    finally{setOccupe(false);}
  }
  async function sauvegarderBrouillon() {
    if(!atelier || !selection || !editionModifiee) return atelier;
    const suivant=modifierFichier(atelier,sources,selection,code);
    await appliquer(suivant,'Brouillon enregistré dans la copie locale.');
    setEditionModifiee(false);
    return suivant;
  }
  // Autosauvegarde d'un vrai brouillon même si la nouvelle version n'est pas activée.
  useEffect(()=>{
    if(!atelier || !selection || !editionModifiee || occupe)return;
    const t=setTimeout(()=>{void sauvegarderBrouillon().catch(()=>undefined);},1200);
    return ()=>clearTimeout(t);
  },[atelier,selection,editionModifiee,code,occupe]);

  async function ouvrirFichier(chemin:string){
    try {
      if(editionModifiee)await sauvegarderBrouillon();
      setSelection(chemin);setCode(fichiers[chemin] ?? '');setAffichageEditeur('code');
      setEditionModifiee(false);setControles(null);setVue('editeur');setErreur('');setMessage('');
    }catch(e){signaler(e);}
  }
  async function creerFichier(){
    if(!atelier)return;
    const chemin=(dossier?dossier+'/':'')+nomFichierCree.trim();
    if(!cheminValide(chemin)){setErreur('Nom ou emplacement de fichier non autorisé.');return;}
    if(Object.prototype.hasOwnProperty.call(fichiers,chemin)){setErreur('Ce fichier existe déjà.');return;}
    try{
      const courant=editionModifiee ? (await sauvegarderBrouillon() ?? atelier) : atelier;
      const suivant=modifierFichier(courant,sources,chemin,'');
      await appliquer(suivant,'Fichier local créé : '+chemin);
      setSelection(chemin);setCode('');setAffichageEditeur('code');setEditionModifiee(false);setControles(null);setVue('editeur');
    }catch(e){signaler(e);}
  }
  function demanderSuppression(){
    if(!atelier || !selection)return;
    Alert.alert('Supprimer ce fichier de la copie locale ?',selection,[
      {text:'Annuler',style:'cancel'},
      {text:'Supprimer',style:'destructive',onPress:()=>{
        const suivant=supprimerFichier(atelier,sources,selection);
        void appliquer(suivant,'Fichier supprimé de la copie locale.').then(()=>{
          setSelection('');setCode('');setEditionModifiee(false);setVue('fichiers');
        }).catch(()=>undefined);
      }},
    ]);
  }
  function tester(){
    if(!selection){setErreur('Ouvre un fichier depuis l’explorateur.');return;}
    setControles(precontrolerFichier(selection,code));
    setVue('tests');setMessage('Contrôles préliminaires terminés : aucune compilation ni exécution du code.');
  }
  async function creerInstantane(){
    if(!atelier)return;
    try{
      const avant=await sauvegarderBrouillon() ?? atelier;
      const nouveau=enregistrerVersion(avant,nomVersion);
      await appliquer(nouveau,'Instantané du code local enregistré.');
      setVersionSelectionnee(nouveau.versionActive??'');
    }catch(e){signaler(e);}
  }
  function demanderRestauration(){
    if(!atelier || !versionSelectionnee)return;
    Alert.alert('Restaurer cette copie source ?', 'La version actuelle sera sauvegardée avant restauration. Cette opération ne change pas le code exécuté dans l’APK.',[
      {text:'Annuler',style:'cancel'},
      {text:'Restaurer',onPress:()=>{
        try{
          const suivant=restaurerVersion(atelier,versionSelectionnee);
          void appliquer(suivant,'Sources restaurées. Le code de l’application installée n’a pas changé.').then(()=>{
            if(selection){setCode(fichiersActuels(sources,suivant)[selection]??'');setEditionModifiee(false);}
            setVersionSelectionnee(suivant.versionActive??'');
          }).catch(()=>undefined);
        }catch(e){signaler(e);}
      }}
    ]);
  }
  async function partagerZip(){
    if(!atelier)return;
    setOccupe(true);setErreur('');setMessage('Création et vérification de l’archive en cours…');
    try{
      const a=editionModifiee ? modifierFichier(atelier,sources,selection,code) : atelier;
      if(editionModifiee){await enregistrerAtelierLocal(a);setAtelier(a);setEditionModifiee(false);}
      if(!depot)throw new Error('Sources locales non disponibles.');
      const resultat=await exporterSourcesLab(a,depot);
      messageOk(resultat.total+' fichiers sources texte ajoutés à l’archive ZIP.');
    }catch(e){signaler(e);}finally{setOccupe(false);}
  }
  async function choisirZip(){
    if(!atelier)return;
    setOccupe(true);setErreur('');setImportPret(null);
    try{
      const courant=editionModifiee ? (await sauvegarderBrouillon() ?? atelier) : atelier;
      if(!depot)throw new Error('Sources locales non disponibles.');
      const resultat=await importerArchiveLab(courant,depot);
      const details=comparerArbres(fichiersActuels(sources,courant),fichiersActuels(sources,resultat.atelier));
      setImportPret({...resultat,details});
      messageOk(resultat.nombre+' fichiers analysés. Aucun changement appliqué : confirme l’importation ci-dessous.');
    }catch(e){signaler(e);}finally{setOccupe(false);}
  }
  async function confirmerImport(){
    if(!atelier || !importPret)return;
    try{
      const avecSecours=enregistrerVersion(atelier,'Sauvegarde avant import ZIP');
      const suivant:AtelierLocal={
        ...importPret.atelier,versions:avecSecours.versions,
        versionActive:null,chantier:'Import ZIP — à vérifier',
      };
      await appliquer(suivant,'Archive importée dans la copie locale. Version précédente conservée.');
      setSelection('');setCode('');setEditionModifiee(false);setImportPret(null);setVue('fichiers');
    }catch(e){signaler(e);}
  }

  if(!atelier || !depot) return <View style={styles.section}>
    <ActivityIndicator color={couleurs.dore}/>
    <Text style={styles.aide}>{erreur || 'Ouverture de la copie locale…'}</Text>
    {erreur ? <Bouton titre="Réessayer" onPress={()=>{setErreur('');void Promise.all([lireAtelierLocal(),lireDepotSourcesLab()]).then(([a,b])=>{setAtelier(a);setDepot(b);}).catch(signaler);}}/>:null}
  </View>;
  return <View style={styles.section}>
    <Text style={styles.surtitre}>ELYNDOR LAB · COPIE LOCALE</Text>
    <Text style={styles.titre}>Atelier de code source</Text>
    <Text style={styles.aide}>
      Explorateur inspiré de GitHub. Les modifications restent dans un espace local isolé :
      elles ne touchent ni GitHub, ni le code déjà installé, ni les histoires.
    </Text>
    <View style={styles.bandeau}>
      <Text style={styles.label}>Référence source : {depot.reference.slice(0,12)}</Text>
      <Text style={styles.aide}>{noms.length} fichiers texte · {depot.binaires.length} actifs binaires référencés</Text>
      {noms.length===0 ? <Text style={styles.danger}>
        Instantané absent de cette compilation. Importe une archive de sources pour commencer.
      </Text>:null}
    </View>
    <View style={styles.onglets}>
      {ONGLETS.map((onglet)=><Pressable key={onglet.id} accessibilityRole="button"
        onPress={()=>{setVue(onglet.id);setErreur('');setMessage('');}}
        style={[styles.pastille,vue===onglet.id&&styles.pastilleActive]}>
        <Text style={[styles.textePastille,vue===onglet.id&&styles.textePastilleActive]}>{onglet.nom}</Text>
      </Pressable>)}
    </View>
    {erreur ? <Text style={styles.danger}>{erreur}</Text> : null}
    {message ? <Text style={styles.succes}>{message}</Text> : null}
    {occupe ? <ActivityIndicator color={couleurs.dore}/> : null}

    {vue==='fichiers' ? <View style={styles.corps}>
      <Text style={styles.titreSection}>Explorateur du dépôt</Text>
      <Text style={styles.chemin}>logiciel-rp-beta / {dossier||'racine'}</Text>
      <View style={styles.actions}>
        <Bouton titre="Racine" variante="secondaire" onPress={()=>setDossier('')} style={styles.petita}/>
        {dossier ? <Bouton titre="← Dossier parent" variante="secondaire" onPress={()=>setDossier(dossier.includes('/')?dossier.slice(0,dossier.lastIndexOf('/')):'')} style={styles.petita}/>:null}
      </View>
      <TextInput style={styles.champ} placeholder="Rechercher un fichier dans ce dossier" placeholderTextColor={couleurs.texteFaible}
        value={recherche} onChangeText={setRecherche} autoCapitalize="none"/>
      {dossierContenu.dossiers.map((nom)=><Pressable key={nom} style={styles.ligne} onPress={()=>{setDossier((dossier?dossier+'/':'')+nom);setRecherche('');}}>
        <Text style={styles.fichierDossier}>▸  {nom}/</Text>
      </Pressable>)}
      {dossierContenu.fichiers.map((chemin)=><Pressable key={chemin} style={styles.ligne} onPress={()=>{void ouvrirFichier(chemin);}}>
        <Text style={styles.fichier}>⌁  {chemin.split('/').pop()}</Text>
      </Pressable>)}
      {dossierContenu.total>maxApercu?<Text style={styles.aide}>{dossierContenu.total-maxApercu} fichiers supplémentaires : affine la recherche.</Text>:null}
      <Text style={styles.label}>Créer un fichier dans {dossier||'la racine'}</Text>
      <TextInput style={styles.champ} value={nomFichierCree} onChangeText={setNomFichierCree}
        autoCapitalize="none" autoCorrect={false} placeholder="nom.ts" placeholderTextColor={couleurs.texteFaible}/>
      <Bouton titre="Créer ce fichier" onPress={()=>{void creerFichier();}} desactive={occupe}/>
    </View> : null}

    {vue==='editeur' ? <View style={styles.corps}>
      <Text style={styles.titreSection}>Éditeur / terminal</Text>
      {selection ? <>
        <Text style={styles.chemin}>{selection}</Text>
        <Text style={styles.aide}>{editionModifiee?'Modifications non encore enregistrées.':'Copie locale consultable et modifiable.'}</Text>
        <View style={styles.bandeau}>
          <Text style={styles.label}>{code.split('\n').length} lignes · {code.length} caractères</Text>
        </View>
        <View style={styles.actions}>
          <Pressable style={[styles.pastille,affichageEditeur==='code'&&styles.pastilleActive]} onPress={()=>setAffichageEditeur('code')}>
            <Text style={styles.textePastille}>Code</Text>
          </Pressable>
          <Pressable style={[styles.pastille,affichageEditeur==='diff'&&styles.pastilleActive]} onPress={()=>setAffichageEditeur('diff')}>
            <Text style={styles.textePastille}>Différences</Text>
          </Pressable>
        </View>
        {affichageEditeur==='code' ? <TextInput style={styles.editeur} value={code} onChangeText={(t)=>{setCode(t);setEditionModifiee(true);setControles(null);}}
          multiline autoCorrect={false} autoCapitalize="none" textAlignVertical="top" scrollEnabled
          placeholder="Colle ton code ici…" placeholderTextColor={couleurs.texteFaible}/> :
          <View style={styles.bandeau}>
            <Text style={styles.label}>Différences par rapport au fichier source d'origine</Text>
            {differenceEditeur.length===0?<Text style={styles.aide}>Aucune différence détectée.</Text>:differenceEditeur.map((diff,i)=><View key={String(i)} style={styles.controle}>
              <Text style={styles.danger}>− Original à partir de L{diff.ligneAncien}</Text>
              <Text selectable style={styles.codePrevisualisation}>{diff.ancien.slice(0,5000)||'(aucune ligne)'}</Text>
              <Text style={styles.succes}>+ Modifié à partir de L{diff.ligneNouveau}</Text>
              <Text selectable style={styles.codePrevisualisation}>{diff.nouveau.slice(0,5000)||'(aucune ligne)'}</Text>
              {diff.ancien.length>5000||diff.nouveau.length>5000?<Text style={styles.aide}>Aperçu limité à 5 000 caractères par bloc. Le fichier enregistré reste complet.</Text>:null}
            </View>)}
          </View>}
        <View style={styles.actions}>
          <Bouton titre="Coller" variante="secondaire" onPress={()=>{void Clipboard.getStringAsync().then((texte)=>{setCode(texte);setEditionModifiee(true);}).catch(signaler);}} style={styles.petita}/>
          <Bouton titre="Copier" variante="secondaire" onPress={()=>{void Clipboard.setStringAsync(code);}} style={styles.petita}/>
        </View>
        <Bouton titre={editionModifiee?'Enregistrer le brouillon':'Brouillon enregistré'} variante="secondaire"
          desactive={!editionModifiee||occupe} onPress={()=>{void sauvegarderBrouillon().catch(signaler);}}/>
        <Bouton titre="Vérifier ce fichier" onPress={tester} desactive={occupe}/>
        <Bouton titre="Supprimer ce fichier de la copie" variante="danger" onPress={demanderSuppression} desactive={occupe}/>
        <Text style={styles.aide}>Éditeur tactile et presse-papiers. Ce terminal n'exécute pas de commandes système arbitraires.</Text>
      </> : <>
        <Text style={styles.aide}>Sélectionne un fichier dans l'explorateur.</Text>
        <Bouton titre="Choisir un fichier" onPress={()=>setVue('fichiers')}/>
      </>}
    </View> : null}

    {vue==='tests' ? <View style={styles.corps}>
      <Text style={styles.titreSection}>Contrôles et diagnostic</Text>
      <Text style={styles.aide}>Fichier : {selection||'aucun'}</Text>
      <Bouton titre="Lancer les contrôles locaux" desactive={!selection||occupe} onPress={tester}/>
      {controles?.map((c,i)=><View key={String(i)} style={styles.controle}>
        <Text style={[styles.label,c.statut==='erreur'?styles.danger:c.statut==='valide'?styles.succes:null]}>
          {c.statut==='valide'?'✓ ':c.statut==='erreur'?'✕ ':'! '}{c.titre}
        </Text>
        <Text style={styles.aide}>{c.detail}</Text>
      </View>)}
      {selection&&changementNatif(selection)?<Text style={styles.danger}>Fichier de configuration ou code natif : reconstruction Android requise.</Text>:null}
      <Text style={styles.aide}>Un pré-contrôle réussi n'est pas un test vert de compilation. Tant que la chaîne locale Expo/Metro n'est pas démontrée, aucune activation de nouveau code n'est autorisée.</Text>
      <Bouton titre="Voir les possibilités de mise à jour" variante="secondaire" onPress={()=>setVue('maj')}/>
    </View> : null}

    {vue==='maj' ? <View style={styles.corps}>
      <Text style={styles.titreSection}>Mise à jour expérimentale</Text>
      <Text style={styles.danger}>Activation locale du nouveau bundle indisponible dans cette version.</Text>
      <Text style={styles.aide}>Tu peux modifier, sauvegarder, comparer et exporter les fichiers. Une compilation Expo/Metro puis un chargeur sûr seraient nécessaires pour exécuter le TypeScript modifié dans l'application Android.</Text>
      {selection&&changementNatif(selection)?<Text style={styles.aide}>Cette modification exige aussi un nouvel APK : {selection}</Text>:null}
      <Bouton titre="Mettre à jour (non disponible)" desactive onPress={()=>undefined}/>
      <Bouton titre="Enregistrer une version des sources" variante="secondaire" onPress={()=>setVue('versions')}/>
      <Bouton titre="Exporter vers GPT / Claude" variante="secondaire" onPress={()=>setVue('archives')}/>
    </View> : null}

    {vue==='versions' ? <View style={styles.corps}>
      <Text style={styles.titreSection}>Historique des sources</Text>
      <Text style={styles.aide}>Chaque instantané conserve les fichiers créés, modifiés ou supprimés. La restauration ne modifie pas la version Android installée.</Text>
      <TextInput style={styles.champ} value={nomVersion} onChangeText={setNomVersion} placeholder="Nom de l'expérience" placeholderTextColor={couleurs.texteFaible}/>
      <Bouton titre="Créer un instantané" desactive={occupe} onPress={()=>{void creerInstantane();}}/>
      {atelier.versions.slice().reverse().map(v=><Pressable key={v.id} style={[styles.ligne,versionSelectionnee===v.id&&styles.ligneActive]} onPress={()=>setVersionSelectionnee(v.id)}>
        <Text style={styles.fichier}>{versionSelectionnee===v.id?'◉ ':'○ '}{v.nom}</Text>
        <Text style={styles.aide}>{v.date.slice(0,16).replace('T',' ')} · {v.etat} · {Object.keys(v.changements).length} différences</Text>
      </Pressable>)}
      <Bouton titre="Restaurer la version sélectionnée" variante="secondaire"
        desactive={!versionSelectionnee||occupe} onPress={demanderRestauration}/>
      <Text style={styles.aide}>La déclaration « stable » restera désactivée tant qu'une nouvelle version exécutable n'aura pas réellement été testée.</Text>
    </View> : null}

    {vue==='secours' ? <View style={styles.corps}>
      <Text style={styles.titreSection}>Récupération des sources locales</Text>
      <Text style={styles.aide}>Si une modification du laboratoire se passe mal, reviens sur une version sauvegardée. Une copie de secours du registre local est aussi maintenue pendant les écritures.</Text>
      <Text style={styles.label}>Version de retour</Text>
      {atelier.versions.length===0?<Text style={styles.aide}>Crée d'abord un instantané depuis « Versions ».</Text>:null}
      {atelier.versions.slice().reverse().map(v=><Pressable key={v.id} style={[styles.ligne,versionSelectionnee===v.id&&styles.ligneActive]} onPress={()=>setVersionSelectionnee(v.id)}>
        <Text style={styles.fichier}>{versionSelectionnee===v.id?'◉ ':'○ '}{v.nom}</Text>
      </Pressable>)}
      <Bouton titre="Retour à la version précédente" variante="secondaire" desactive={!versionSelectionnee||occupe} onPress={demanderRestauration}/>
      <Text style={styles.danger}>Ce secours protège la copie source. Il ne constitue pas encore un écran de récupération automatique après un crash du code natif ou du bundle React Native.</Text>
    </View> : null}

    {vue==='archives' ? <View style={styles.corps}>
      <Text style={styles.titreSection}>Import / export du code source</Text>
      <Text style={styles.aide}>Le ZIP exporte les sources texte éditables et les modifications du laboratoire, même non activées. Les actifs binaires sont seulement répertoriés : ils ne sont pas inclus dans cette première version.</Text>
      <Bouton titre="Exporter les sources texte (ZIP)" onPress={()=>{void partagerZip();}} desactive={occupe}/>
      <Bouton titre="Importer une archive ZIP" variante="secondaire" onPress={()=>{void choisirZip();}} desactive={occupe}/>
      {importPret ? <View style={styles.bandeau}>
        <Text style={styles.label}>Import en attente de confirmation</Text>
        <Text style={styles.aide}>{importPret.nombre} fichiers · {importPret.complet?'Archive de sources complète':'Correctif partiel'}.</Text>
        <Text style={styles.label}>Ajouts : {importPret.details.ajoutes.length} · Modifications : {importPret.details.modifies.length} · Suppressions : {importPret.details.supprimes.length}</Text>
        {[...importPret.details.ajoutes.slice(0,3).map(p=>' + '+p),...importPret.details.modifies.slice(0,3).map(p=>' ~ '+p),...importPret.details.supprimes.slice(0,3).map(p=>' − '+p)].map((p,i)=><Text key={String(i)} style={styles.aide}>{p}</Text>)}
        <Text style={styles.aide}>Un instantané des sources actuelles sera créé avant l'import.</Text>
        <Bouton titre="Confirmer l'import dans la copie locale" onPress={()=>{void confirmerImport();}} desactive={occupe}/>
        <Bouton titre="Annuler l'import" variante="secondaire" onPress={()=>setImportPret(null)}/>
      </View>:null}
      <Text style={styles.aide}>Aucune clé API, histoire ni base de données personnelle n'est exportée. Pour transmettre tous les actifs médias du dépôt, une archive complète externe reste nécessaire.</Text>
    </View> : null}
  </View>;
}
const styles=StyleSheet.create({
  section:{gap:espacement.md,paddingVertical:espacement.md},
  corps:{gap:espacement.md,marginTop:espacement.sm},
  titre:{color:couleurs.texte,fontSize:24,fontFamily:polices.display},
  titreSection:{color:couleurs.doreClair,fontSize:19,fontFamily:polices.titre},
  surtitre:{color:couleurs.dore,fontSize:11,fontFamily:polices.texteSemiGras,letterSpacing:1.5},
  label:{color:couleurs.texte,fontSize:13,fontFamily:polices.texteSemiGras},
  aide:{color:couleurs.texteSecondaire,fontSize:13,fontFamily:polices.texte,lineHeight:19},
  danger:{color:couleurs.danger,fontSize:13,fontFamily:polices.texte,lineHeight:19},
  succes:{color:couleurs.succes,fontSize:13,fontFamily:polices.texte},
  bandeau:{backgroundColor:couleurs.fondCarteDense,borderWidth:1,borderColor:couleurs.bordureSubtile,borderRadius:rayon.md,padding:espacement.md,gap:espacement.sm},
  onglets:{flexDirection:'row',flexWrap:'wrap',gap:espacement.sm},
  pastille:{paddingHorizontal:13,paddingVertical:12,borderRadius:rayon.sm,backgroundColor:couleurs.fondCarte,borderColor:couleurs.bordureSubtile,borderWidth:1,minHeight:44,justifyContent:'center'},
  pastilleActive:{borderColor:couleurs.dore,backgroundColor:couleurs.fondCarteDense},
  textePastille:{color:couleurs.texteSecondaire,fontSize:13,fontFamily:polices.texteSemiGras},
  textePastilleActive:{color:couleurs.doreClair},
  chemin:{color:couleurs.doreClair,fontSize:13,fontFamily:polices.texteSemiGras},
  actions:{flexDirection:'row',flexWrap:'wrap',gap:espacement.sm},
  petita:{flexGrow:1},
  champ:{borderWidth:1,borderColor:couleurs.bordure,backgroundColor:couleurs.fondChampSaisie,borderRadius:rayon.sm,color:couleurs.texte,padding:espacement.md,fontSize:15,minHeight:50},
  editeur:{backgroundColor:'#070E1B',borderColor:couleurs.bordure,borderWidth:1,borderRadius:rayon.sm,color:'#DFE7F4',fontSize:13,minHeight:260,maxHeight:540,padding:espacement.md,fontFamily:'monospace'},
  ligne:{padding:espacement.md,borderColor:couleurs.bordureSubtile,borderBottomWidth:1,backgroundColor:couleurs.fondCarte},
  ligneActive:{borderColor:couleurs.dore,borderWidth:1},
  fichier:{color:couleurs.texte,fontFamily:polices.texteSemiGras,fontSize:14},
  fichierDossier:{color:couleurs.doreClair,fontFamily:polices.texteSemiGras,fontSize:14},
  controle:{backgroundColor:couleurs.fondCarte,borderRadius:rayon.sm,padding:espacement.md,gap:4},
  codePrevisualisation:{fontFamily:'monospace',fontSize:12,color:couleurs.texte,backgroundColor:'#070E1B',padding:8,borderRadius:rayon.sm}
});
