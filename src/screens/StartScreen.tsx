import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { StoryMeta } from '../types';
import { getStoriesIndex } from '../storage/storage';
import { couleurs, espacement, polices, stylePetitesCapitales } from '../theme/theme';
import Bouton from '../components/Bouton';
import Panneau from '../components/Panneau';
import Separateur from '../components/Separateur';

type Props = NativeStackScreenProps<RootStackParamList, 'Demarrage'>;

export default function StartScreen({ navigation }: Props) {
  const [histoires, setHistoires] = useState<StoryMeta[]>([]);

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

  return (
    <View style={styles.container}>
      <View style={styles.entete}>
        <Text style={styles.titre}>ELYNDOR</Text>
        <Text style={styles.sousTitre}>Narrative Roleplay Engine</Text>
        <Separateur style={styles.separateur} />
      </View>

      <Bouton titre="Nouvelle histoire" onPress={() => navigation.navigate('Creation')} style={styles.bouton} />
      <Bouton
        titre="Réglages"
        variante="secondaire"
        onPress={() => navigation.navigate('Reglages')}
        style={[styles.bouton, { marginBottom: espacement.lg }]}
      />

      {histoires.length > 0 && (
        <>
          <Text style={styles.sectionTitre}>Continuer</Text>
          <FlatList
            data={histoires}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: espacement.sm }}
            renderItem={({ item }) => (
              <Pressable onPress={() => navigation.navigate('Conversation', { storyId: item.id })}>
                <Panneau>
                  <Text style={styles.nomPersonnage}>
                    {item.brancheDeId ? '🌿 ' : ''}
                    {item.personnageNom}
                  </Text>
                  <Text style={styles.descriptionPersonnage} numberOfLines={2}>
                    {item.pointDeDepart}
                  </Text>
                </Panneau>
              </Pressable>
            )}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: couleurs.fond,
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
  bouton: {
    marginBottom: espacement.sm,
  },
  sectionTitre: {
    ...stylePetitesCapitales,
    color: couleurs.texteAtténué,
    fontSize: 12,
    marginBottom: espacement.sm,
  },
  nomPersonnage: {
    color: couleurs.texte,
    fontFamily: polices.titre,
    fontSize: 18,
  },
  descriptionPersonnage: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 14,
    marginTop: 2,
  },
});
