import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getSettings } from '../storage/storage';
import { genererImageSelonReglages } from '../engine/fournisseursImages';
import type { FormatImage } from '../engine/elyndorCloudImages';
import type { ProfilCadrage } from '../engine/visualBible';
import {
  preparerRequeteApercuImage,
} from '../engine/requetesVisuelles';
import {
  validerReglagesVisuels,
  type ReglagesVisuels,
} from '../concepteur/reglagesVisuels';
import { couleurs, polices } from '../theme/theme';
import Bouton from './Bouton';

const PROFILS_SCENE: ReadonlyArray<{ id: ProfilCadrage; titre: string }> = [
  { id: 'groupe', titre: 'Groupe' },
  { id: 'dialogue', titre: 'Dialogue' },
  { id: 'combat', titre: 'Combat' },
  { id: 'tension', titre: 'Tension' },
  { id: 'decouverte', titre: 'Découverte' },
  { id: 'interieur', titre: 'Intérieur' },
  { id: 'paysage', titre: 'Paysage' },
];

interface Props {
  /** Valeurs directement éditées dans le panneau, pas uniquement sauvegardées. */
  reglagesVisuels: ReglagesVisuels;
}

export default function AtelierApercuImage({ reglagesVisuels }: Props) {
  const [prompt, setPrompt] = useState('');
  const [negatif, setNegatif] = useState('');
  const [format, setFormat] = useState<FormatImage>('16:9');
  const [profilScene, setProfilScene] = useState<ProfilCadrage>('groupe');
  const [total, setTotal] = useState(1);
  const [accord, setAccord] = useState(false);
  const [attente, setAttente] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [dernier, setDernier] = useState('');

  async function essayer() {
    setAttente(true);
    setMessage('');
    setImages([]);
    try {
      if (!prompt.trim()) throw Error('Entre un prompt avant de générer.');
      if (!accord) throw Error('Confirme chaque série d’essais avant de la lancer.');
      // Instantané pris au clic : les changements non enregistrés sont
      // appliqués, sans activer ces préférences pour les histoires.
      const visuel = validerReglagesVisuels(reglagesVisuels);
      const cfg = await getSettings();
      const generateur = genererImageSelonReglages(cfg);
      const requete = preparerRequeteApercuImage({
        prompt,
        negatif,
        format,
        profilScene,
        reglages: visuel,
        profilContenu: cfg.profilContenu,
      });
      setDernier(JSON.stringify({
        fournisseur: cfg.fournisseurImages,
        modele: cfg.fournisseurImages === 'runpod' ? 'Modèle image du pod' : cfg.modeleImages,
        nombre: total,
        profilScene: format === '16:9' ? profilScene : null,
        configuration: visuel,
        requete,
      }, null, 2));
      for (let i = 0; i < total; i++) {
        const image = await generateur(requete);
        setImages((v) => [...v, image]);
      }
      setMessage('Aperçu prêt avec les réglages affichés au moment du lancement, même non enregistrés.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setAttente(false);
      setAccord(false);
    }
  }

  return <View style={st.bloc}>
    <Text style={st.titre}>Laboratoire d’aperçu image</Text>
    <Text style={st.aide}>Les réglages affichés au-dessus sont utilisés immédiatement pour cet aperçu, même sans enregistrement. Le test ne modifie pas tes histoires.</Text>
    <Text style={st.aide}>Prompt libre : il ne dispose pas du récit, des portraits joueur/PNJ ni du narrateur. Leurs références et les consignes du narrateur sont utilisées dans les histoires, pas dans cet aperçu isolé.</Text>
    <Text style={st.label}>Prompt libre (anglais conseillé pour SDXL)</Text>
    <TextInput style={[st.champ, { minHeight: 116 }]} value={prompt} onChangeText={setPrompt} multiline
      maxLength={3000} textAlignVertical="top" placeholder="Décris l’action, les personnages, le lieu…" placeholderTextColor={couleurs.texteFaible}/>
    <Text style={st.label}>Exclusions supplémentaires de cet essai</Text>
    <TextInput style={[st.champ, { minHeight: 60 }]} value={negatif} onChangeText={setNegatif} multiline
      maxLength={1000} textAlignVertical="top" placeholder="Éléments à éviter" placeholderTextColor={couleurs.texteFaible}/>
    <Text style={st.label}>Format</Text>
    <View style={st.row}>{(['16:9', '3:4'] as const).map((x) => <Pressable key={x}
      style={[st.choix, format === x && st.actif]} disabled={attente} onPress={() => setFormat(x)}>
      <Text style={st.nom}>{x === '16:9' ? '16:9 · Scène' : '3:4 · Portrait'}</Text>
    </Press>)}</View>
    {format === '16:9' ? <>
      <Text style={st.label}>Type de scène simulée</Text>
      <View style={st.row}>{PROFILS_SCENE.map((x) => <Pressable key={x.id}
        style={[st.choix, profilScene === x.id && st.actif]} disabled={attente}
        onPress={() => setProfilScene(x.id)}>
        <Text style={st.nom}>{x.titre}</Text>
      </Pressable>)}</View>
    </> : null}
    <Text style={st.label}>Variantes</Text>
    <View style={st.row}>{[1, 2, 4].map((x) => <Pressable key={x}
      style={[st.choix, total === x && st.actif]} disabled={attente} onPress={() => setTotal(x)}>
      <Text style={st.nom}>{x} image{x > 1 ? 's' : ''}</Text>
    </Pressable>)}</View>
    <Pressable style={[st.choix, accord && st.actif]} disabled={attente} onPress={() => setAccord((v) => !v)}
      accessibilityRole="checkbox" accessibilityState={{ checked: accord }}>
      <Text style={st.nom}>{accord ? '☑' : '☐'} Je confirme ce test ({total} génération{total > 1 ? 's' : ''}).</Text>
      <Text style={st.aide}>Chaque essai consomme potentiellement du temps GPU ou des crédits. Avec une seed fixe, les variantes peuvent être identiques.</Text>
    </Pressable>
    <Bouton titre={attente ? 'Génération en cours…' : 'Générer l’aperçu'} desactive={attente || !accord || !prompt.trim()}
      onPress={() => void essayer()}/>
    {attente ? <ActivityIndicator color={couleurs.accent}/> : null}
    {images.map((uri, i) => <Image key={i} source={{ uri }} resizeMode="contain"
      style={{ width: '100%', height: format === '16:9' ? 230 : 310, marginTop: 8 }}/>)}
    {message ? <Text style={st.aide}>{message}</Text> : null}
    {dernier ? <View>
      <Text style={st.label}>Dernière requête préparée (paramètres réellement transmis)</Text>
      <Text selectable style={st.aide}>{dernier}</Text>
    </View> : null}
  </View>;
}

const st = StyleSheet.create({
  bloc: { gap: 8, marginVertical: 12 },
  titre: { fontFamily: polices.titre, fontSize: 20, color: couleurs.texte },
  aide: { fontFamily: polices.corps, fontSize: 13, lineHeight: 19, color: couleurs.texteAtténué },
  label: { fontFamily: polices.corpsMedium, fontSize: 15, color: couleurs.doreClair, marginTop: 8 },
  champ: { padding: 12, borderColor: couleurs.bordureSubtile, borderWidth: 1, borderRadius: 8,
    color: couleurs.texte, backgroundColor: couleurs.fondChampSaisie },
  row: { flexDirection: 'row', gap: 7, flexWrap: 'wrap' },
  choix: { padding: 10, borderWidth: 1, borderColor: couleurs.bordureSubtile, borderRadius: 8, gap: 4 },
  actif: { borderColor: couleurs.dore, backgroundColor: couleurs.fondCarte },
  nom: { color: couleurs.texte, fontFamily: polices.corpsMedium },
});
