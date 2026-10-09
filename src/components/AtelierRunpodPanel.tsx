import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import Bouton from './Bouton';
import { couleurs, espacement, polices, rayon } from '../theme/theme';
import {
  ELYNDOR_CLOUD_MODELE, ELYNDOR_CLOUD_MODELE_EMBEDDINGS,
  assurerPodElyndorCloud, definirPodElyndorCloud, originePodElyndorCloud,
  podElyndorCloud, rafraichirPodElyndorCloud, revenirAuPodPublieElyndorCloud,
} from '../engine/elyndorCloud';
import { ELYNDOR_CLOUD_MODELE_IMAGE } from '../engine/elyndorCloudImages';
import {
  lirePodConcepteur, enregistrerPodConcepteur, effacerPodConcepteur, validerIdentifiantPod,
} from '../concepteur/podStore';
import { diagnostiquerPod, type DiagnosticPod } from '../concepteur/diagnosticPod';

const ORIGINES = { integre: 'Pod de secours intégré', publie: 'Configuration publiée', concepteur: 'Pod privé de cet appareil' };
const NOM_SERVICE = { narration: 'Narration', images: 'Images', embeddings: 'Embeddings' };

export default function AtelierRunpodPanel() {
  const [chargement, setChargement] = useState(true);
  const [occupe, setOccupe] = useState(false);
  const [podActif, setPodActif] = useState('');
  const [origine, setOrigine] = useState<'integre' | 'publie' | 'concepteur'>('integre');
  const [saisie, setSaisie] = useState('');
  const [personnalise, setPersonnalise] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<DiagnosticPod | null>(null);
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');

  function actualiserVue() {
    setPodActif(podElyndorCloud());
    setOrigine(originePodElyndorCloud());
  }

  useEffect(() => {
    let monte = true;
    (async () => {
      try {
        await assurerPodElyndorCloud();
        const sauvegarde = await lirePodConcepteur();
        if (!monte) return;
        setPersonnalise(sauvegarde);
        setSaisie(sauvegarde ?? podElyndorCloud());
        actualiserVue();
      } catch (e) {
        if (monte) setErreur(e instanceof Error ? e.message : 'Configuration RunPod illisible.');
      } finally { if (monte) setChargement(false); }
    })();
    return () => { monte = false; };
  }, []);

  async function tester() {
    setOccupe(true); setErreur(''); setMessage(''); setDiagnostic(null);
    try {
      const id = validerIdentifiantPod(saisie);
      const rapport = await diagnostiquerPod(id);
      setDiagnostic(rapport);
      setMessage("Test effectué sans génération de texte ni d'image.");
    } catch (e) { setErreur(e instanceof Error ? e.message : 'Test impossible.'); }
    finally { setOccupe(false); }
  }

  function confirmerActivation() {
    let id: string;
    try { id = validerIdentifiantPod(saisie); }
    catch (e) { setErreur(e instanceof Error ? e.message : 'Identifiant invalide.'); return; }
    Alert.alert(
      'Utiliser ce pod pour Elyndor ?',
      'Pod : ' + id + '\n\nCette modification ne touche que la tablette. Les nouvelles requêtes de narration, images et embeddings viseront ce pod. S’il est arrêté ou mal configuré, ces fonctions peuvent échouer.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Activer ce pod', onPress: () => { void activer(id); } },
      ],
    );
  }

  async function activer(id: string) {
    setOccupe(true); setErreur(''); setMessage('');
    try {
      const sauvegarde = await enregistrerPodConcepteur(id);
      definirPodElyndorCloud(sauvegarde, 'concepteur');
      setPersonnalise(sauvegarde);
      actualiserVue();
      setMessage('Pod enregistré sur cette tablette. La connexion reste à vérifier si tu ne l’as pas testée.');
    } catch (e) { setErreur(e instanceof Error ? e.message : 'Impossible de sauvegarder le pod.'); }
    finally { setOccupe(false); }
  }

  function confirmerRetour() {
    Alert.alert(
      'Revenir au pod publié ?',
      'La configuration locale sera effacée. Elyndor utilisera le pod défini dans la configuration publiée (ou le pod de secours).',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Revenir au pod publié', onPress: () => { void revenirAuPodPublie(); } },
      ],
    );
  }

  async function revenirAuPodPublie() {
    setOccupe(true); setErreur(''); setMessage(''); setDiagnostic(null);
    try {
      await effacerPodConcepteur();
      await revenirAuPodPublieElyndorCloud();
      setPersonnalise(null);
      setSaisie(podElyndorCloud());
      actualiserVue();
      setMessage('Pod local effacé. Configuration publique ou secours rétabli.');
    } catch (e) { setErreur(e instanceof Error ? e.message : 'Retour au pod publié impossible.'); }
    finally { setOccupe(false); }
  }

  async function recharger() {
    setOccupe(true); setErreur(''); setMessage('');
    try {
      await rafraichirPodElyndorCloud();
      actualiserVue();
      setMessage(personnalise ? 'Pod local prioritaire conservé.' : 'Configuration du pod rechargée.');
    } catch (e) { setErreur(e instanceof Error ? e.message : 'Actualisation impossible.'); }
    finally { setOccupe(false); }
  }

  return <View>
    <Text style={styles.titre}>Connexion Elyndor Cloud</Text>
    <Text style={styles.note}>Le joueur conserve la connexion Elyndor Cloud. Ici, tu peux changer uniquement son pod RunPod sur cette tablette, sans modifier GitHub ni exposer de clé API.</Text>
    {chargement ? <ActivityIndicator color={couleurs.accent}/> : <>
      <Text style={styles.label}>Pod actuellement ciblé</Text>
      <Text selectable style={styles.code}>{podActif || '—'}</Text>
      <Text style={styles.note}>Origine : {ORIGINES[origine]}</Text>
      <Text style={styles.note}>Narration attendue : {ELYNDOR_CLOUD_MODELE}</Text>
      <Text style={styles.note}>Image attendue : {ELYNDOR_CLOUD_MODELE_IMAGE ?? 'désactivée'} · Embeddings : {ELYNDOR_CLOUD_MODELE_EMBEDDINGS ?? 'désactivés'}</Text>

      <Text style={styles.label}>ID du nouveau pod RunPod</Text>
      <TextInput
        style={styles.champ}
        value={saisie}
        onChangeText={setSaisie}
        placeholder="Identifiant RunPod uniquement"
        placeholderTextColor={couleurs.texteFaible}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!occupe}
        selectTextOnFocus
      />
      <Text style={styles.note}>Entre seulement l’identifiant (exemple : ab12cd34ef56), pas une adresse complète. Ports fixes : 8000 narration, 7860 images/embeddings.</Text>
      <Bouton titre="Tester la connexion de ce pod" variante="secondaire"
        desactive={occupe} onPress={() => void tester()} style={styles.bouton}/>
      <Bouton titre="Enregistrer et utiliser ce pod" desactive={occupe}
        onPress={confirmerActivation} style={styles.bouton}/>
      <Bouton titre="Relire la configuration RunPod" variante="secondaire"
        desactive={occupe} onPress={() => void recharger()} style={styles.bouton}/>
      {personnalise ? <Bouton titre="Revenir au pod publié" variante="secondaire"
        desactive={occupe} onPress={confirmerRetour} style={styles.bouton}/> : null}
    </>}
    {occupe ? <ActivityIndicator color={couleurs.accent}/> : null}
    {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
    {message ? <Text style={styles.succes}>{message}</Text> : null}
    {diagnostic ? <View style={styles.resultats}>
      <Text style={styles.titre}>Test du pod {diagnostic.id}</Text>
      {diagnostic.services.map((ligne) => <View key={ligne.service} style={styles.ligne}>
        <Text style={styles.label}>{NOM_SERVICE[ligne.service]}</Text>
        <Text style={ligne.statut === 'pret' ? styles.succes : styles.erreur}>
          {ligne.statut === 'pret' ? 'Répond' : 'Indisponible'} · {ligne.dureeMs} ms
        </Text>
        <Text style={styles.note}>{ligne.details}</Text>
      </View>)}
    </View> : null}
    <Text style={styles.avertissement}>
      Un test de connexion peut réveiller un service et entraîner une facturation GPU. Il ne démarre, n’arrête ou ne migre pas les pods dans RunPod. Le remplacement du modèle exécuté par un pod nécessite encore une administration serveur sécurisée.
    </Text>
  </View>;
}

const styles = StyleSheet.create({
  titre: { color: couleurs.texte, fontFamily: polices.titre, fontSize: 21, marginVertical: espacement.sm },
  label: { color: couleurs.doreClair, fontFamily: polices.corpsMedium, fontSize: 15, marginTop: espacement.sm },
  note: { color: couleurs.texteAtténué, fontFamily: polices.corps, fontSize: 14, lineHeight: 20, marginVertical: 3 },
  code: { color: couleurs.texte, fontFamily: polices.corpsMedium, fontSize: 17, marginVertical: 3 },
  champ: { color: couleurs.texte, backgroundColor: couleurs.fondChampSaisie, borderColor: couleurs.bordureDoree,
    borderRadius: rayon.sm, borderWidth: 1, padding: espacement.md, minHeight: 52, marginTop: espacement.sm },
  bouton: { marginVertical: 6 },
  erreur: { color: couleurs.danger, fontFamily: polices.corpsMedium, fontSize: 14, marginVertical: 4 },
  succes: { color: couleurs.succes, fontFamily: polices.corpsMedium, fontSize: 14, marginVertical: 4 },
  resultats: { marginVertical: espacement.md, borderTopWidth: 1, borderTopColor: couleurs.bordureSubtile },
  ligne: { paddingVertical: espacement.sm, borderBottomWidth: 1, borderBottomColor: couleurs.bordureSubtile },
  avertissement: { marginTop: espacement.lg, color: couleurs.texteAtténué, fontFamily: polices.corps,
    fontSize: 13, lineHeight: 19 },
});
