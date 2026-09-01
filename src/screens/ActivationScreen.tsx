import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { getSettings, saveSettings } from '../storage/storage';
import { couleurs, espacement, polices, rayon } from '../theme/theme';
import { VERSION_APP } from '../version';

type Props = NativeStackScreenProps<RootStackParamList, 'Activation'>;

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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.titre}>Bêta RP</Text>
      <Text style={styles.version}>Version {VERSION_APP}</Text>

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

      <Pressable style={styles.bouton} onPress={accepter} disabled={enregistrement}>
        <Text style={styles.texteBouton}>{enregistrement ? '…' : "J'ai compris, commencer"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: couleurs.fond,
    padding: espacement.lg,
    paddingTop: espacement.xl * 2,
    justifyContent: 'center',
  },
  titre: {
    color: couleurs.texte,
    fontFamily: polices.titre,
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
  },
  version: {
    color: couleurs.texteAtténué,
    fontSize: 13,
    textAlign: 'center',
    marginTop: espacement.xs,
    marginBottom: espacement.lg,
  },
  paragraphe: {
    color: couleurs.texte,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: espacement.md,
  },
  bouton: {
    backgroundColor: couleurs.accent,
    borderRadius: rayon.md,
    paddingVertical: espacement.md,
    alignItems: 'center',
    marginTop: espacement.lg,
  },
  texteBouton: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
