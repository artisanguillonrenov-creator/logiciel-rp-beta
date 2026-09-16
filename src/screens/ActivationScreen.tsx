import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { getSettings, saveSettings } from '../storage/storage';
import { couleurs, espacement, polices, stylePetitesCapitales } from '../theme/theme';
import { VERSION_APP } from '../version';
import Bouton from '../components/Bouton';
import FondAtmospherique from '../components/FondAtmospherique';
import Panneau from '../components/Panneau';
import Separateur from '../components/Separateur';

type Props = NativeStackScreenProps<RootStackParamList, 'Activation'>;

const IMAGE_ACTIVATION = require('../../assets/scenes/accueil.png');

// Écran d'activation de la bêta. Il conserve exactement la même persistance :
// seule la présentation est alignée sur la direction artistique Elyndor V2.
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
        <View style={styles.marque}>
          <Text style={styles.surtitre}>ENTREZ DANS LE MONDE</Text>
          <Text style={styles.titre}>ELYNDOR</Text>
          <Text style={styles.sousTitre}>Vos décisions laissent des traces.</Text>
          <Text style={styles.version}>Version {VERSION_APP} · Bêta</Text>
        </View>

        <Panneau style={styles.carte}>
          <Text style={styles.titreCarte}>Avant de commencer</Text>
          <Text style={styles.introduction}>
            Elyndor construit un récit persistant autour de vos décisions. Cette version est encore en bêta :
            voici les trois points à connaître avant d’entrer dans le monde.
          </Text>

          <Separateur style={styles.separateur} />

          <View style={styles.point}>
            <Text style={styles.numero}>I</Text>
            <View style={styles.pointTexte}>
              <Text style={styles.pointTitre}>Votre narrateur</Text>
              <Text style={styles.paragraphe}>
                L’application utilise le fournisseur IA que vous configurez dans Réglages. Les messages sont
                envoyés au modèle choisi afin de produire la narration.
              </Text>
            </View>
          </View>

          <View style={styles.point}>
            <Text style={styles.numero}>II</Text>
            <View style={styles.pointTexte}>
              <Text style={styles.pointTitre}>Votre profil de contenu</Text>
              <Text style={styles.paragraphe}>
                Vous pourrez choisir Grand public ou Adulte. Le code du mode Adulte est un garde-fou local ; il
                ne constitue pas une vérification d’âge.
              </Text>
            </View>
          </View>

          <View style={styles.point}>
            <Text style={styles.numero}>III</Text>
            <View style={styles.pointTexte}>
              <Text style={styles.pointTitre}>Vos histoires restent à vous</Text>
              <Text style={styles.paragraphe}>
                Histoires, personnages et réglages sont enregistrés localement sur l’appareil selon le mode de
                stockage disponible.
              </Text>
            </View>
          </View>

          <Bouton
            titre={enregistrement ? 'Ouverture…' : 'Entrer dans Elyndor'}
            onPress={accepter}
            desactive={enregistrement}
            style={styles.bouton}
          />
        </Panneau>
      </ScrollView>
    </FondAtmospherique>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: espacement.lg,
    paddingVertical: espacement.xxl,
    justifyContent: 'center',
  },
  marque: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    alignItems: 'center',
    marginBottom: espacement.lg,
  },
  surtitre: {
    ...stylePetitesCapitales,
    color: couleurs.dore,
    fontSize: 10,
    letterSpacing: 2.6,
    marginBottom: espacement.xs,
  },
  titre: {
    color: couleurs.doreClair,
    fontFamily: polices.display,
    fontSize: 40,
    letterSpacing: 4,
    textAlign: 'center',
  },
  sousTitre: {
    color: couleurs.texte,
    fontFamily: polices.titre,
    fontSize: 19,
    textAlign: 'center',
    marginTop: espacement.xs,
  },
  version: {
    ...stylePetitesCapitales,
    color: couleurs.texteFaible,
    fontSize: 10,
    textAlign: 'center',
    marginTop: espacement.sm,
  },
  carte: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    padding: espacement.lg,
    backgroundColor: couleurs.fondCarteDense,
    borderColor: couleurs.bordureDoree,
  },
  titreCarte: {
    color: couleurs.doreClair,
    fontFamily: polices.titre,
    fontSize: 24,
  },
  introduction: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 15,
    lineHeight: 22,
    marginTop: espacement.xs,
  },
  separateur: {
    marginVertical: espacement.md,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: espacement.md,
  },
  numero: {
    color: couleurs.dore,
    fontFamily: polices.displaySemiGras,
    fontSize: 14,
    width: 36,
    paddingTop: 2,
  },
  pointTexte: {
    flex: 1,
  },
  pointTitre: {
    color: couleurs.texte,
    fontFamily: polices.titre,
    fontSize: 18,
    marginBottom: 2,
  },
  paragraphe: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 15,
    lineHeight: 21,
  },
  bouton: {
    marginTop: espacement.md,
  },
});
