import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { getStoriesIndex, getStory, updateStoryIf } from '../storage/storage';
import { histoiresDuMonde, monde } from '../mondes';
import type { StoryMeta, StoryState, EntreeLoreEmergent, ProfilMonde } from '../types';
import type { FicheEditable } from '../concepteur/lorebookModele';
import Bouton from './Bouton';
import { couleurs } from '../theme/theme';

const CHAMPS: Array<[keyof ProfilMonde, string]> = [
  ['localisation','Localisation'], ['origine','Origine'], ['apparence','Apparence'],
  ['architecture','Architecture'], ['dimensions','Dimensions'], ['acces','Accès'],
  ['activites','Activités'], ['occupants','Occupants'], ['materiaux','Matériaux'],
  ['proprietes','Propriétés'], ['fabrication','Fabrication'], ['rarete','Rareté'],
  ['organisation','Organisation'], ['hierarchie','Hiérarchie'], ['objectifs','Objectifs'],
  ['territoire','Territoire'], ['ressources','Ressources'], ['alliances','Alliances'],
  ['habitat','Habitat'], ['comportement','Comportement'], ['capacites','Capacités'],
  ['faiblesses','Faiblesses'], ['traditions','Traditions'], ['croyances','Croyances'],
  ['histoire','Historique'], ['referencesPnj','Identifiants PNJ liés'],
];
const CATEGORIES = ['lieu','objet','faction','evenement','creature','ressource','coutume'];
const erreur = (e: unknown) => e instanceof Error ? e.message : 'Erreur inconnue.';

export default function AtelierMondePanel({ promouvoir }: { promouvoir: (p: { sourceId: string; fiche: Partial<FicheEditable> }) => void }) {
  const [histoires, setHistoires] = useState<StoryMeta[]>([]);
  const [histoireId, setHistoireId] = useState('');
  const [story, setStory] = useState<StoryState | null>(null);
  const [ficheId, setFicheId] = useState('');
  const [titre, setTitre] = useState('');
  const [contenu, setContenu] = useState('');
  const [profil, setProfil] = useState<ProfilMonde>({});
  const [recherche, setRecherche] = useState('');
  const [message, setMessage] = useState('');
  const [charge, setCharge] = useState(false);
  useEffect(() => {
    let active = true;
    // Histoires du monde actif seulement : la promotion vise le lorebook de ce monde.
    getStoriesIndex().then(index => histoiresDuMonde(index, monde.actifId())).then(items => { if (active) { setHistoires(items); setHistoireId(items[0]?.id ?? ''); } }).catch(e => { if (active) setMessage(erreur(e)); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    setStory(null); setFicheId(''); setMessage('');
    if (histoireId) getStory(histoireId).then(s => { if (active) setStory(s); }).catch(e => { if (active) setMessage(erreur(e)); });
    return () => { active = false; };
  }, [histoireId]);
  const fiches = useMemo(() => (story?.loreEmergent ?? []).filter(e => e.categorie !== 'pnj' && CATEGORIES.includes(e.categorie)), [story]);
  const visibles = useMemo(() => fiches.filter(f => !recherche.trim() || (f.titre + ' ' + f.contenu + ' ' + Object.values(f.profilMonde ?? {}).join(' ')).toLocaleLowerCase('fr').includes(recherche.trim().toLocaleLowerCase('fr'))), [fiches,recherche]);
  const fiche = fiches.find(f => f.id === ficheId);
  useEffect(() => {
    setTitre(fiche?.titre ?? ''); setContenu(fiche?.contenu ?? ''); setProfil(fiche?.profilMonde ?? {});
  }, [fiche?.id, JSON.stringify(fiche?.profilMonde), fiche?.titre, fiche?.contenu]);
  async function sauvegarder() {
    if (!story || !fiche || charge) return;
    setCharge(true); setMessage('');
    try {
      const miseAJour = await updateStoryIf(story.meta.id,
        s => s.loreEmergent.some(e => e.id === fiche.id),
        s => ({ ...s, loreEmergent: s.loreEmergent.map(e => e.id === fiche.id
          ? { ...e, titre: titre.trim() || e.titre, contenu: contenu.trim(), profilMonde: profil }
          : e) }));
      if (!miseAJour) throw new Error('La fiche a changé. Recharge cette histoire.');
      setStory(miseAJour); setMessage('Fiche du monde enregistrée dans cette histoire.');
    } catch(e) { setMessage(erreur(e)); }
    finally { setCharge(false); }
  }
  function promotion() {
    if (!story || !fiche) return;
    const texte = [contenu, ...CHAMPS.filter(([k]) => profil[k]?.trim()).map(([k, label]) => label + ' : ' + profil[k])].filter(Boolean).join('\n');
    promouvoir({ sourceId: story.meta.id + ':' + fiche.id, fiche: {
      titre: titre.trim() || fiche.titre, contenu: texte || 'À compléter.',
      category: 'MONDE', scope: 'GLOBAL', priority: 40, constant: false, actif: true,
      primaryKeys: [titre.trim() || fiche.titre], secondaryKeys: [], negativeKeys: [],
      dossiers: ['Monde émergent/' + fiche.categorie + '/À valider'],
    } });
  }
  return <View style={styles.conteneur}>
    <Text style={styles.titre}>Lore émergent — monde propre à chaque histoire</Text>
    <Text style={styles.info}>Les fiches restent locales à l'histoire. Leur transfert vers le lorebook général nécessite une validation manuelle.</Text>
    {histoires.map(h => <Bouton key={h.id} titre={(h.id === histoireId ? '● ' : '○ ') + (h.titre || h.personnageNom)} variante={h.id === histoireId ? 'principal' : 'secondaire'} onPress={() => setHistoireId(h.id)}/>)}
    {story ? <>
      <Text style={styles.titre}>Fiches découvertes ({fiches.length})</Text>
      <TextInput style={styles.champ} placeholder="Rechercher un lieu, objet, faction…" placeholderTextColor={couleurs.texteAtténué} value={recherche} onChangeText={setRecherche}/>
      {visibles.map(f => <Bouton key={f.id} titre={(f.id === ficheId ? '● ' : '○ ') + '[' + f.categorie + '] ' + f.titre} variante={f.id === ficheId ? 'principal' : 'secondaire'} onPress={() => setFicheId(f.id)}/>)}
      {fiche ? <View style={styles.fiche}>
        <Text style={styles.info}>Statut : {fiche.statut} · ID : {fiche.id}</Text>
        <Text style={styles.label}>Nom</Text>
        <TextInput style={styles.champ} value={titre} onChangeText={setTitre}/>
        <Text style={styles.label}>Faits établis dans l'histoire</Text>
        <TextInput style={styles.champ} multiline value={contenu} onChangeText={setContenu}/>
        {CHAMPS.map(([key,label]) => <View key={key}>
          <Text style={styles.label}>{label}</Text>
          <TextInput style={styles.champ} multiline value={profil[key] ?? ''} onChangeText={v => setProfil(p => ({ ...p, [key]: v }))}/>
        </View>)}
        <Bouton titre="Enregistrer dans cette histoire" onPress={() => void sauvegarder()} desactive={charge}/>
        <Bouton titre="Proposer au lorebook général" onPress={promotion} desactive={charge}/>
        <Text style={styles.info}>Le transfert ouvre un brouillon dans le lorebook général. Les modifications non enregistrées dans l'histoire ne sont pas sauvegardées automatiquement.</Text>
      </View> : null}
    </> : <Text style={styles.info}>Sélectionne une histoire.</Text>}
    {charge ? <ActivityIndicator/> : null}
    {message ? <Text style={styles.info}>{message}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  conteneur: { gap: 8 }, titre: { fontSize: 18, fontWeight: '700', color: couleurs.texte, marginTop: 12 },
  info: { color: couleurs.texte, lineHeight: 21 }, label: { color: couleurs.doreClair, marginTop: 10 },
  champ: { color: couleurs.texte, borderColor: couleurs.bordureSubtile, borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 46 },
  fiche: { gap: 7, paddingTop: 10 },
});
