import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { getSettings, saveSettings } from '../storage/storage';
import { couleurs, espacement, polices, stylePetitesCapitales } from '../theme/theme';
import { VERSION_APP } from '../version';
import Bouton from '../components/Bouton';
import FondAtmospherique from '../components/FondAtmospherique';
import Separateur from '../components/Separateur';

type Props = NativeStackScreenProps<RootStackParamList, 'Activation'>;

const IMAGE_ACTIVATION = require('../../assets/scenes/accueil.png');

// Écran d'activation (distribution "esprit", brief Phase 2) : accepter les
// conditions de la bêta une fois par appareil avant d'entrer dans l'app.
// Ce n'est pas une clé de licence vérifiée côté serveur — juste la marche à
// suivre d'une activation, honnête sur ce qu'elle est.
export default function ActivationScreen({ navigation }: Props) {
  const [enregistrement, setEnregistrement] = useState(false);

  async function accepter() {
    if (enregistrement) return;
    setEnregistrement(true);
    const settingsActuelles = await getSettings();
    await saveSettings({ ...settingsActuelles, betaAcceptee: true });
    navigation.replace('Demarrage');
  }

  return (
    <FondAtmospherique style={{ flex: 1 }} imageFond={IMAGE_ACTIVATION}>
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.titre}>ELYNDOR</Text>
      <Text style={styles.sousTitre}>Narrative Roleplay Engine</Text>
      <Text style={styles.version}>Version {VERSION_APP}</Text>
      <Separateur style={styles.separateur} />

      <Text style={styles.paragraphe}>
        Cette application est une bêta gratuite. Elle utilise ta propre clé API OpenRouter (configurée dans
        Réglages) : les messages échangés sont envoyés au modèle que tu choisis, sous ta responsabilité.
      </Text>
      <Text style={styles.paragraphe}>
        Un profil de contenu (Grand public / Adulte) te sera demandé avant de commencer une histoire. Le passage
        en Adulte est protégé par un code que tu choisis toi-même — un garde-fou local, pas une vérification
        d'âge réelle.
      </Text>
      <Text style={styles.paragraphe}>
        Tes histoires, réglages et personnages restent stockés uniquement sur cet appareil.
      </Text>

      <Bouton titre="J'ai compris, commencer" onPress={accepter} desactive={enregistrement} style={styles.bouton} />
    </ScrollView>
    </FondAtmospherique>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: espacement.lg,
    paddingTop: espacement.xl * 2,
    justifyContent: 'center',
  },
  titre: {
    color: couleurs.dore,
    fontFamily: polices.display,
    fontSize: 36,
    letterSpacing: 3,
    textAlign: 'center',
  },
  sousTitre: {
    ...stylePetitesCapitales,
    color: couleurs.texteAtténué,
    fontSize: 12,
    textAlign: 'center',
    marginTop: espacement.xs,
  },
  version: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 13,
    textAlign: 'center',
    marginTop: espacement.xs,
  },
  separateur: {
    width: 160,
    alignSelf: 'center',
    marginTop: espacement.md,
    marginBottom: espacement.lg,
  },
  paragraphe: {
    color: couleurs.texte,
    fontFamily: polices.corps,
    fontSize: 16,
    lineHeight: 23,
    marginBottom: espacement.md,
  },
  bouton: {
    marginTop: espacement.lg,
  },
});
