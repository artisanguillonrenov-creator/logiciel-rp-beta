import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { StoryMeta } from '../types';
import { getStoriesIndex } from '../storage/storage';
import { couleurs, espacement, rayon } from '../theme/theme';

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
      <Text style={styles.titre}>Bêta RP</Text>
      <Text style={styles.sousTitre}>Le logiciel porte les règles et la mémoire. Le modèle ne fournit que le langage.</Text>

      <Pressable style={styles.boutonPrincipal} onPress={() => navigation.navigate('Creation')}>
        <Text style={styles.texteBoutonPrincipal}>Nouvelle histoire</Text>
      </Pressable>

      <Pressable style={styles.boutonSecondaire} onPress={() => navigation.navigate('Reglages')}>
        <Text style={styles.texteBoutonSecondaire}>Réglages</Text>
      </Pressable>

      {histoires.length > 0 && (
        <>
          <Text style={styles.sectionTitre}>Continuer</Text>
          <FlatList
            data={histoires}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: espacement.sm }}
            renderItem={({ item }) => (
              <Pressable
                style={styles.carteHistoire}
                onPress={() => navigation.navigate('Conversation', { storyId: item.id })}
              >
                <Text style={styles.nomPersonnage}>{item.personnageNom}</Text>
                <Text style={styles.descriptionPersonnage} numberOfLines={2}>
                  {item.pointDeDepart}
                </Text>
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
  titre: {
    color: couleurs.texte,
    fontSize: 32,
    fontWeight: '700',
  },
  sousTitre: {
    color: couleurs.texteAtténué,
    fontSize: 14,
    marginTop: espacement.xs,
    marginBottom: espacement.lg,
  },
  boutonPrincipal: {
    backgroundColor: couleurs.accent,
    borderRadius: rayon.md,
    paddingVertical: espacement.md,
    alignItems: 'center',
    marginBottom: espacement.sm,
  },
  texteBoutonPrincipal: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  boutonSecondaire: {
    borderRadius: rayon.md,
    paddingVertical: espacement.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: couleurs.bordure,
    marginBottom: espacement.lg,
  },
  texteBoutonSecondaire: {
    color: couleurs.texte,
    fontSize: 16,
  },
  sectionTitre: {
    color: couleurs.texteAtténué,
    fontSize: 13,
    textTransform: 'uppercase',
    marginBottom: espacement.sm,
  },
  carteHistoire: {
    backgroundColor: couleurs.fondCarte,
    borderRadius: rayon.md,
    padding: espacement.md,
    borderWidth: 1,
    borderColor: couleurs.bordure,
  },
  nomPersonnage: {
    color: couleurs.texte,
    fontSize: 16,
    fontWeight: '600',
  },
  descriptionPersonnage: {
    color: couleurs.texteAtténué,
    fontSize: 13,
    marginTop: 2,
  },
});
