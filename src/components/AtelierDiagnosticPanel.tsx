import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { getStoriesIndex, getStory } from '../storage/storage';
import { lireConfigurationAtelier } from '../concepteur/depotConfiguration';
import { creerRapportAuditAtelier, resumerDiagnosticAtelier, type ResumeDiagnosticAtelier } from '../concepteur/auditAtelier';
import { VERSION_APP } from '../version';
import { couleurs, espacement, polices } from '../theme/theme';
import Bouton from './Bouton';

const COMMIT_BUNDLE = process.env.EXPO_PUBLIC_GIT_SHA || 'non renseigné';
function messageErreur(e: unknown) { return e instanceof Error ? e.message : 'Diagnostic indisponible.'; }

export default function AtelierDiagnosticPanel({ mode }: { mode: 'metamoteurs' | 'diagnostics' | 'instantanes' }) {
  const [lecture, setLecture] = useState(false);
  const [exportation, setExportation] = useState(false);
  const [info, setInfo] = useState<ResumeDiagnosticAtelier | null>(null);
  const [nombreHistoires, setNombreHistoires] = useState(0);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');

  async function mesurer() {
    setLecture(true); setErreur(''); setMessage('');
    try {
      const histoires = await getStoriesIndex();
      setNombreHistoires(histoires.length);
      const recent = [...histoires].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      const story = recent ? await getStory(recent.id) : null;
      const resultat = resumerDiagnosticAtelier(story);
      setInfo(resultat);
      return { resultat, nombre: histoires.length };
    } catch (e) {
      setErreur(messageErreur(e));
      return null;
    } finally { setLecture(false); }
  }

  async function exporterAudit() {
    if (exportation) return;
    setExportation(true); setErreur(''); setMessage('');
    try {
      const mesures = await mesurer();
      if (!mesures) return;
      const configuration = await lireConfigurationAtelier();
      const audit = creerRapportAuditAtelier({
        configuration, version: VERSION_APP, commitBundle: COMMIT_BUNDLE,
        nombreHistoires: mesures.nombre, dernierTour: mesures.resultat,
      });
      const texte = JSON.stringify(audit, null, 2);
      if (await Sharing.isAvailableAsync() && FileSystem.documentDirectory) {
        const chemin = FileSystem.documentDirectory + 'Elyndor-Audit-' +
          new Date().toISOString().slice(0, 10) + '.json';
        await FileSystem.writeAsStringAsync(chemin, texte, { encoding: FileSystem.EncodingType.UTF8 });
        await Sharing.shareAsync(chemin, { mimeType: 'application/json', dialogTitle: 'Partager un audit Elyndor' });
        setMessage('Rapport technique préparé dans le partage Android.');
      } else {
        await Clipboard.setStringAsync(texte);
        setMessage('Rapport technique copié dans le presse-papier.');
      }
    } catch (e) { setErreur(messageErreur(e)); }
    finally { setExportation(false); }
  }

  return <View style={styles.bloc}>
    <Text style={styles.titre}>État réel du dernier tour enregistré</Text>
    <Text style={styles.aide}>
      Lecture à la demande de la dernière histoire modifiée. Les résultats proviennent des
      diagnostics sauvegardés, pas de la simple présence des fichiers dans GitHub.
    </Text>
    <Bouton titre="Analyser la dernière histoire" variante="secondaire"
      onPress={() => { void mesurer(); }} desactive={lecture || exportation} style={styles.bouton}/>
    {(lecture || exportation) && <ActivityIndicator color={couleurs.accent}/>}
    {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
    {message ? <Text style={styles.succes}>{message}</Text> : null}
    {info && <>
      <Text style={styles.aide}>Histoires enregistrées : {nombreHistoires}</Text>
      {info.disponible ? <>
        <Text style={styles.aide}>
          Dernier diagnostic : {info.date ? new Date(info.date).toLocaleString('fr-FR') : 'date inconnue'} ·
          {info.dureeMs ?? 0} ms · {info.appelsIA} appels IA · {info.tokensTotal} tokens mesurés
        </Text>
        {mode === 'metamoteurs' && info.moteurs.map((m) => <View key={m.id} style={styles.ligne}>
          <Text style={styles.nom}>{m.id} — {m.nom}</Text>
          <Text style={[styles.valeur, m.dernierTour !== 'mobilise' && styles.nonMesure]}>
            {m.dernierTour === 'mobilise' ? 'MOBILISÉ' :
              m.dernierTour === 'non_mobilise' ? 'NON MOBILISÉ' : 'NON MESURÉ'}
          </Text>
          <Text style={styles.aide}>{m.raison}</Text>
        </View>)}
        {mode !== 'metamoteurs' && info.etapes.map((e, i) => <View key={String(i)} style={styles.ligne}>
          <Text style={styles.nom}>{e.nom}</Text>
          <Text style={styles.aide}>{e.categorie} · {e.statut} · {e.dureeMs ?? '—'} ms</Text>
        </View>)}
      </> : <Text style={styles.aide}>
        Aucun diagnostic de tour exploitable dans la dernière histoire.
        Cela ne permet pas d'affirmer que les méta-moteurs ne fonctionnent pas.
      </Text>}
    </>}
    {mode === 'instantanes' && <>
      <Text style={styles.titre}>Audit technique partageable</Text>
      <Text style={styles.aide}>
        Exporte l'état des profils, la version JS, le nombre d'histoires,
        les étapes et les moteurs mobilisés au dernier tour. Aucun récit,
        titre d'histoire, nom de personnage ou secret n'est inclus.
      </Text>
      <Bouton titre="Exporter un audit technique JSON" onPress={() => { void exporterAudit(); }}
        desactive={lecture || exportation} style={styles.bouton}/>
    </>}
  </View>;
}

const styles = StyleSheet.create({
  bloc: { borderTopWidth: 1, borderTopColor: couleurs.bordureSubtile,
    marginTop: espacement.lg, paddingTop: espacement.md },
  titre: { color: couleurs.doreClair, fontSize: 19, fontFamily: polices.titre, marginBottom: espacement.sm },
  aide: { color: couleurs.texteAtténué, fontFamily: polices.corps, fontSize: 14,
    lineHeight: 20, marginBottom: espacement.sm },
  bouton: { marginVertical: espacement.sm },
  erreur: { color: couleurs.danger, fontSize: 14, marginVertical: espacement.sm },
  succes: { color: couleurs.succes, fontSize: 14, marginVertical: espacement.sm },
  ligne: { borderBottomWidth: 1, borderBottomColor: couleurs.bordureSubtile, paddingVertical: espacement.sm },
  nom: { color: couleurs.texte, fontFamily: polices.corpsMedium, fontSize: 15 },
  valeur: { color: couleurs.succes, fontFamily: polices.corpsMedium, fontSize: 12 },
  nonMesure: { color: couleurs.texteAtténué },
});
