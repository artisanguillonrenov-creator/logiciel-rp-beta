import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { getStoriesIndex, getStory, updateStoryIf } from '../storage/storage';
import type { StoryMeta, StoryState, ProfilPnj } from '../types';
import type { FicheEditable } from '../concepteur/lorebookModele';
import { consoliderRegistrePnj, rechercherPnjLexical } from '../engine/registrePnj';
import Bouton from './Bouton';
import { couleurs } from '../theme/theme';

const CHAMPS: Array<[keyof ProfilPnj, string]> = [
  ['race', 'Race'], ['ageApparent', 'Âge apparent'], ['apparence', 'Apparence de référence'],
  ['personnalite', 'Personnalité'], ['profession', 'Profession'], ['particularites', 'Particularités'],
  ['origine', 'Origine'],
  ['genre', 'Genre'],
  ['taille', 'Taille'],
  ['silhouette', 'Silhouette'],
  ['visage', 'Visage'],
  ['yeux', 'Yeux'],
  ['cheveux', 'Cheveux'],
  ['peau', 'Peau'],
  ['signesDistinctifs', 'Signes distinctifs'],
  ['biographie', 'Biographie'],
  ['competences', 'Compétences'],
  ['relationsInitiales', 'Relations initiales'],
  ['orientation', 'Orientation et attirances'],
  ['gouts', 'Goûts personnels'],
  ['desirs', 'Désirs et envies'],
  ['habitudes', 'Habitudes'],
  ['preferencesIntimes', 'Préférences intimes'],
  ['pratiquesPreferees', 'Pratiques préférées'],
  ['positionsPreferees', 'Positions préférées'],
  ['limites', 'Limites et consentement'],
];
const messageErreur = (e: unknown) => e instanceof Error ? e.message : 'Erreur de sauvegarde.';
interface PromotionPnj { sourceId: string; avatarSource?: { storyId: string; pnjId: string }; fiche: Partial<FicheEditable> }

export default function AtelierPnjPanel({ promouvoir }: { promouvoir: (p: PromotionPnj) => void }) {
  const [histoires, setHistoires] = useState<StoryMeta[]>([]);
  const [histoireId, setHistoireId] = useState('');
  const [story, setStory] = useState<StoryState | null>(null);
  const [pnjId, setPnjId] = useState('');
  const [edition, setEdition] = useState<ProfilPnj>({});
  const [recherche, setRecherche] = useState('');
  const [message, setMessage] = useState('');
  const [charge, setCharge] = useState(false);
  useEffect(() => {
    let active = true;
    getStoriesIndex().then(items => { if (active) { setHistoires(items); setHistoireId(items[0]?.id ?? ''); } })
      .catch(e => { if (active) setMessage(messageErreur(e)); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    setStory(null); setPnjId(''); setMessage('');
    if (histoireId) getStory(histoireId).then(s => { if (active) setStory(s); })
      .catch(e => { if (active) setMessage(messageErreur(e)); });
    return () => { active = false; };
  }, [histoireId]);
  const registre = useMemo(() => story ? consoliderRegistrePnj(story) : null, [story]);
  const fiche = registre?.fiches.find(f => f.id === pnjId);
  const source = story?.loreEmergent.find(e => e.id === fiche?.entreeId);
  useEffect(() => { setEdition(source?.profilPnj ?? {}); }, [source?.id, JSON.stringify(source?.profilPnj)]);
  const resultat = useMemo(() => story && registre && recherche.trim()
    ? rechercherPnjLexical({ ...story, pnjLorebook: registre }, recherche) : [], [story, registre, recherche]);
  async function sauvegarder() {
    if (!story || !source || charge) return;
    setCharge(true); setMessage('');
    try {
      const actualisee = await updateStoryIf(story.meta.id,
        s => s.loreEmergent.some(e => e.id === source.id),
        s => ({ ...s, loreEmergent: s.loreEmergent.map(e => e.id === source.id ? { ...e, profilPnj: edition } : e) }));
      if (!actualisee) throw new Error('Le PNJ a changé entre-temps. Recharge son histoire.');
      setStory(actualisee);setMessage('Identité de référence enregistrée dans cette histoire.');
    } catch(e) { setMessage(messageErreur(e)); }
    finally { setCharge(false); }
  }
  function promotion() {
    if (!fiche || !source || !story) return;
    const profil = { ...(source.profilPnj ?? {}), ...edition };
    const contenu = [
      source.contenu,
      ...CHAMPS.filter(([key]) => profil[key]).map(([key, label]) => label + ' : ' + profil[key]),
    ].filter(Boolean).join('\n');
    promouvoir({
      sourceId: story.meta.id + ':' + fiche.id,
      avatarSource: { storyId: story.meta.id, pnjId: source.id },
      fiche: {
        titre: fiche.nom, contenu: contenu || 'Personnage à compléter.', category: 'PERSONNAGE',
        priority: 35, scope: 'CHARACTER', constant: false, actif: true,
        primaryKeys: [fiche.nom], secondaryKeys: fiche.alias.filter(a => !a.startsWith('emergent-')),
        negativeKeys: [], dossiers: ['Personnages/À valider'],
      },
    });
  }
  return <View style={styles.conteneur}>
    <Text style={styles.titre}>Lorebook PNJ — propre à chaque histoire</Text>
    <Text style={styles.info}>Les fiches, évolutions et souvenirs disparaissent avec leur histoire. Seule une publication manuelle crée une fiche dans le lorebook général.</Text>
    {!histoires.length ? <Text style={styles.info}>Aucune histoire enregistrée.</Text> : null}
    {histoires.map(h => <Bouton key={h.id} titre={(h.id === histoireId ? '● ' : '○ ') + (h.titre || h.personnageNom)}
      variante={h.id === histoireId ? 'principal' : 'secondaire'} onPress={() => setHistoireId(h.id)} style={styles.bouton}/>)}
    {story ? <>
      <Text style={styles.titre}>PNJ inventés et récurrents ({registre?.fiches.length ?? 0})</Text>
      {registre?.fiches.map(p => <Bouton key={p.id} titre={(pnjId === p.id ? '● ' : '○ ') + p.nom}
        variante={pnjId === p.id ? 'principal' : 'secondaire'} onPress={() => setPnjId(p.id)} style={styles.bouton}/>)}
      {fiche && source ? <View style={styles.fiche}>
        <Text style={styles.titre}>{fiche.nom}</Text>
        <Text style={styles.info}>Fiche {source.statut} · ID {fiche.id} · {fiche.souvenirs.length} souvenirs directs établis</Text>
        <Text style={styles.info}>{source.contenu}</Text>
        {CHAMPS.map(([key, label]) => <View key={key}>
          <Text style={styles.label}>{label}</Text>
          <TextInput style={styles.champ} value={edition[key] ?? ''} multiline={key === 'personnalite' || key === 'apparence' || key === 'particularites'}
            onChangeText={v => setEdition(o => ({ ...o, [key]: v }))} />
        </View>)}
        <Bouton titre="Enregistrer les modifications du PNJ" onPress={() => void sauvegarder()} desactive={charge}/>
        <Text style={styles.label}>Souvenirs personnels et journal d'évolution</Text>
        {fiche.souvenirs.length ? fiche.souvenirs.slice(-30).map(s =>
          <Text key={s.evenementId} style={styles.info}>• {s.resume}</Text>)
          : <Text style={styles.info}>Aucun souvenir direct confirmé pour le moment.</Text>}
        <Bouton titre="Ajouter au lorebook d'Elyndor" onPress={promotion} desactive={charge}/>
        <Text style={styles.info}>Ouvre directement l'éditeur de fiche générale avec les champs préremplis ; rien n'est publié sans validation.</Text>
      </View> : null}
      <Text style={styles.titre}>Diagnostic du troisième moteur lexical</Text>
      <TextInput style={styles.champ} placeholder="Rechercher un PNJ par nom ou alias"
        placeholderTextColor={couleurs.texteAtténué} value={recherche} onChangeText={setRecherche}/>
      {resultat.length ? resultat.map(r => <Text key={r.fiche.id} style={styles.info}>{r.fiche.nom} : {r.souvenirsRetenus.length} souvenir(s) retrouvés.\n{r.texte}</Text>)
        : <Text style={styles.info}>Aucun PNJ sélectionné par cette requête.</Text>}
    </> : null}
    {charge ? <ActivityIndicator/> : null}
    {message ? <Text style={styles.info}>{message}</Text> : null}
  </View>;
}
const styles=StyleSheet.create({
  conteneur:{gap:8}, titre:{fontSize:18,fontWeight:'700',color:couleurs.texte,marginTop:12},
  info:{color:couleurs.texte,lineHeight:21},label:{color:couleurs.doreClair,marginTop:10},
  champ:{color:couleurs.texte,borderColor:couleurs.bordureSubtile,borderWidth:1,borderRadius:8,padding:12,minHeight:46},
  fiche:{gap:7,paddingTop:10},bouton:{marginVertical:2},
});
