import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { getSettings, saveSettings } from '../storage/storage';
import { viderCacheEmbeddings } from '../storage/embeddingsStore';
import { couleurs, espacement, polices } from '../theme/theme';
import Bouton from '../components/Bouton';
import FondAtmospherique from '../components/FondAtmospherique';
import Panneau from '../components/Panneau';
import Separateur from '../components/Separateur';

type Props = NativeStackScreenProps<RootStackParamList, 'ReglagesConcepteur'>;

const IMAGE_CONCEPTEUR = require('../../assets/scenes/accueil.png');

// Réglages concepteur (Ajouts_A_Integrer.md #6) : accès direct pendant la
// phase de test actuelle, sans code ni protection — inutile tant que le
// concepteur est seul à tester. Un mécanisme de déverrouillage (même
// esprit que le code du profil Adulte) viendra plus tard, une fois sorti de
// cette phase ; ce n'est volontairement pas construit ici.
export default function DesignerSettingsScreen({ navigation }: Props) {
  const [modeConcepteur, setModeConcepteur] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [messageCache, setMessageCache] = useState('');

  useEffect(() => {
    getSettings().then((settings) => {
      setModeConcepteur(!!settings.modeConcepteur);
      setChargement(false);
    });
  }, []);

  async function basculerModeConcepteur() {
    const nouvelleValeur = !modeConcepteur;
    setModeConcepteur(nouvelleValeur);
    const settingsActuelles = await getSettings();
    await saveSettings({ ...settingsActuelles, modeConcepteur: nouvelleValeur });
  }

  async function viderCache() {
    await viderCacheEmbeddings();
    setMessageCache('Cache d’embeddings vidé — recalcul complet au prochain tour.');
    setTimeout(() => setMessageCache(''), 4000);
  }

  if (chargement) return null;

  return (
    <FondAtmospherique style={{ flex: 1 }} densiteEtoiles="discrete" imageFond={IMAGE_CONCEPTEUR}>
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: espacement.xl }}>
      <Text style={styles.titre}>Réglages concepteur</Text>
      <Separateur />

      <Text style={styles.aide}>
        Accès direct pour l'instant, sans code ni protection — pertinent tant que tu es seul à tester
        l'application. Un déverrouillage par code sera ajouté plus tard, une fois sorti de cette phase.
      </Text>

      <Panneau style={styles.bloc}>
        <Text style={styles.titreBloc}>Mode concepteur</Text>
        <Text style={styles.texteBloc}>
          Une fois activé, chaque histoire ouverte gagne un accès (icône 🛠 dans son en-tête) à l'état brut du
          moteur — mémoire, directeur narratif, monde, relations —, au prompt système exact envoyé au modèle, à
          une mise à jour forcée immédiate des pipelines périodiques, et à un modèle/une température spécifiques
          à cette histoire.
        </Text>
        <Bouton
          titre={modeConcepteur ? 'Désactiver le mode concepteur' : 'Activer le mode concepteur'}
          variante={modeConcepteur ? 'principal' : 'secondaire'}
          onPress={basculerModeConcepteur}
          style={{ marginTop: espacement.md }}
        />
      </Panneau>

      <Panneau style={styles.bloc}>
        <Text style={styles.titreBloc}>Cache d'embeddings</Text>
        <Text style={styles.texteBloc}>
          Vide le cache local de vecteurs de lore (utilisé pour la sélection sémantique). Utile après un
          changement massif de contenu qu'on veut voir pris en compte tout de suite plutôt que d'attendre
          l'invalidation entrée par entrée.
        </Text>
        <Bouton titre="Vider le cache d'embeddings" variante="secondaire" onPress={viderCache} style={{ marginTop: espacement.md }} />
        {messageCache ? <Text style={styles.statut}>{messageCache}</Text> : null}
      </Panneau>

      <Bouton titre="Retour" variante="secondaire" onPress={() => navigation.goBack()} style={{ marginTop: espacement.lg }} />
    </ScrollView>
    </FondAtmospherique>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: espacement.lg,
    paddingTop: espacement.xl,
  },
  titre: {
    color: couleurs.dore,
    fontFamily: polices.display,
    fontSize: 24,
    letterSpacing: 1,
  },
  aide: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: espacement.md,
  },
  bloc: {
    marginBottom: espacement.md,
  },
  titreBloc: {
    color: couleurs.texte,
    fontFamily: polices.titre,
    fontSize: 18,
    marginBottom: espacement.xs,
  },
  texteBloc: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 15,
    lineHeight: 21,
  },
  statut: {
    color: couleurs.accentClair,
    fontFamily: polices.corps,
    fontSize: 14,
    marginTop: espacement.sm,
  },
});
