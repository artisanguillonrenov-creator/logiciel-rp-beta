import React, { useCallback, useState } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { StoryMeta } from '../types';
import { getStoriesIndex } from '../storage/storage';
import { couleurs, espacement, ombresLueur, polices, stylePetitesCapitales } from '../theme/theme';
import Separateur from '../components/Separateur';
import FondAtmospherique from '../components/FondAtmospherique';
import { VERSION_APP } from '../version';

type Props = NativeStackScreenProps<RootStackParamList, 'Demarrage'>;

// Élément de menu principal ("NOUVEAU") : mis en avant par un encadré à
// glow, flanqué de losanges — repère visuel de l'action par défaut, comme
// dans un menu de jeu.
function ElementMenuPrincipal({ titre, onPress }: { titre: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.menuPrincipal}>
      <View style={styles.rangeeMenuPrincipal}>
        <View style={styles.ligneMenuPrincipal} />
        <Text style={styles.losangeMenuPrincipal}>◆</Text>
        <Text style={styles.texteMenuPrincipal}>{titre}</Text>
        <Text style={styles.losangeMenuPrincipal}>◆</Text>
        <View style={styles.ligneMenuPrincipal} />
      </View>
    </Pressable>
  );
}

function ElementMenu({ titre, onPress, desactive }: { titre: string; onPress: () => void; desactive?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={desactive} style={styles.elementMenu}>
      <Text style={[styles.texteElementMenu, desactive && styles.texteElementMenuDesactive]}>{titre}</Text>
    </Pressable>
  );
}

export default function StartScreen({ navigation }: Props) {
  const [histoires, setHistoires] = useState<StoryMeta[]>([]);
  const [messageQuitter, setMessageQuitter] = useState('');

  useFocusEffect(
    useCallback(() => {
      let actif = true;
      getStoriesIndex().then((liste) => {
        if (actif) setHistoires([...liste].sort((a, b) => b.updatedAt - a.updatedAt));
      });
      return () => {
        actif = false;
      };
    }, []),
  );

  const derniereHistoire = histoires[0];

  function continuer() {
    if (!derniereHistoire) return;
    navigation.navigate('Conversation', { storyId: derniereHistoire.id });
  }

  function quitter() {
    if (Platform.OS === 'android') {
      BackHandler.exitApp();
      return;
    }
    setMessageQuitter(
      Platform.OS === 'web' ? 'Ferme cet onglet pour quitter Elyndor.' : 'Ferme l’application depuis le multitâche pour quitter.',
    );
  }

  return (
    <FondAtmospherique style={styles.container}>
      <View style={styles.entete}>
        <Text style={styles.titre}>ELYNDOR</Text>
        <Text style={styles.sousTitre}>Narrative Roleplay Engine</Text>
        <Separateur style={styles.separateur} />
      </View>

      <View style={styles.menu}>
        <ElementMenuPrincipal titre="Nouveau" onPress={() => navigation.navigate('Creation')} />
        <Text style={styles.puceMenu}>◇</Text>
        <ElementMenu titre="Continuer" onPress={continuer} desactive={!derniereHistoire} />
        <Text style={styles.puceMenu}>◇</Text>
        <ElementMenu titre="Charger conversation" onPress={() => navigation.navigate('ChargerConversation')} />
        <Text style={styles.puceMenu}>◇</Text>
        <ElementMenu titre="Paramètres" onPress={() => navigation.navigate('Reglages')} />
        <Text style={styles.puceMenu}>◇</Text>
        <ElementMenu titre="Quitter" onPress={quitter} />
        {messageQuitter ? <Text style={styles.messageQuitter}>{messageQuitter}</Text> : null}
      </View>

      <Text style={styles.version}>Version {VERSION_APP}</Text>
    </FondAtmospherique>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: espacement.lg,
    paddingTop: espacement.xl * 2,
  },
  entete: {
    alignItems: 'center',
    marginBottom: espacement.xl,
  },
  titre: {
    color: couleurs.dore,
    fontFamily: polices.display,
    fontSize: 40,
    letterSpacing: 3,
  },
  sousTitre: {
    ...stylePetitesCapitales,
    color: couleurs.texteAtténué,
    fontSize: 12,
    marginTop: espacement.xs,
  },
  separateur: {
    width: 160,
    marginTop: espacement.md,
  },
  menu: {
    alignItems: 'center',
  },
  menuPrincipal: {
    alignSelf: 'stretch',
  },
  rangeeMenuPrincipal: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: couleurs.accent,
    backgroundColor: 'rgba(90, 172, 255, 0.10)',
    paddingVertical: espacement.sm + 2,
    paddingHorizontal: espacement.md,
    ...ombresLueur,
  },
  ligneMenuPrincipal: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(90, 172, 255, 0.45)',
  },
  losangeMenuPrincipal: {
    color: couleurs.accentClair,
    fontSize: 10,
    marginHorizontal: espacement.sm,
  },
  texteMenuPrincipal: {
    color: couleurs.texte,
    fontFamily: polices.corpsMedium,
    fontSize: 20,
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  puceMenu: {
    color: couleurs.bordure,
    fontSize: 10,
    marginVertical: espacement.sm,
  },
  elementMenu: {
    paddingVertical: espacement.xs,
  },
  texteElementMenu: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corpsMedium,
    fontSize: 17,
    textTransform: 'uppercase',
    letterSpacing: 2,
    textAlign: 'center',
  },
  texteElementMenuDesactive: {
    opacity: 0.4,
  },
  messageQuitter: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 13,
    marginTop: espacement.md,
    textAlign: 'center',
  },
  version: {
    position: 'absolute',
    right: espacement.lg,
    bottom: espacement.lg,
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 12,
    opacity: 0.7,
  },
});
