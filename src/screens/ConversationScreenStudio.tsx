import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/types';
import type { StoryState } from '../types';
import { getStory } from '../storage/storage';
import ConversationScreen from './ConversationScreen';
import { couleurs, espacement, interfaceV2, polices, stylePetitesCapitales } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Conversation'>;

/**
 * Coquille lecteur V2.
 *
 * Le moteur et tous les outils de ConversationScreen restent inchangés.
 * Cette couche remplace uniquement le chrome natif par un bandeau narratif
 * compact proche de la maquette : lieu dominant, période/ambiance secondaire,
 * retour discret et séparation dorée.
 */
export default function ConversationScreenStudio(props: Props) {
  const { route, navigation } = props;
  const insets = useSafeAreaInsets();
  const [story, setStory] = useState<StoryState | null>(null);

  useEffect(() => {
    let actif = true;
    getStory(route.params.storyId)
      .then((s) => {
        if (actif) setStory(s);
      })
      .catch(() => {
        // ConversationScreen conserve son propre traitement d'erreur.
      });
    return () => {
      actif = false;
    };
  }, [route.params.storyId]);

  const sousTitre = useMemo(() => {
    if (!story) return '';
    const date = story.meta.contexte.dateChronique?.trim();
    const ambiance = story.meta.contexte.ambiance?.trim();
    return date || ambiance || story.meta.personnageNom;
  }, [story]);

  const lieu = story?.meta.contexte.lieu?.trim() || 'ELYNDOR';

  return (
    <View style={styles.ecran}>
      <View style={[styles.entete, { paddingTop: Math.max(insets.top, 8) }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.boutonIcone, pressed && styles.presse]}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          hitSlop={8}
        >
          <Text style={styles.iconeRetour}>‹</Text>
        </Pressable>

        <View style={styles.identiteScene}>
          <Text style={styles.lieu} numberOfLines={1}>{lieu}</Text>
          {!!sousTitre && <Text style={styles.sousTitre} numberOfLines={1}>{sousTitre}</Text>}
        </View>

        <View style={styles.marqueLecteur}>
          <Text style={styles.rune}>✦</Text>
          <Text style={styles.mode}>LECTEUR</Text>
        </View>
      </View>

      <View style={styles.filet} />

      <View style={styles.contenu}>
        <ConversationScreen {...props} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: {
    flex: 1,
    backgroundColor: couleurs.fondProfond,
  },
  entete: {
    minHeight: 64,
    paddingBottom: 9,
    paddingHorizontal: espacement.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(4, 10, 18, 0.97)',
  },
  boutonIcone: {
    minWidth: interfaceV2.cibleTactileMin,
    minHeight: interfaceV2.cibleTactileMin,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presse: {
    opacity: 0.62,
  },
  iconeRetour: {
    color: couleurs.doreClair,
    fontFamily: polices.corps,
    fontSize: 34,
    lineHeight: 38,
  },
  identiteScene: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 4,
  },
  lieu: {
    color: couleurs.texte,
    fontFamily: polices.titre,
    fontSize: 17,
    lineHeight: 20,
  },
  sousTitre: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 1,
  },
  marqueLecteur: {
    minHeight: interfaceV2.cibleTactileMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  rune: {
    color: couleurs.dore,
    fontSize: 13,
  },
  mode: {
    ...stylePetitesCapitales,
    color: couleurs.texteFaible,
    fontSize: 9,
  },
  filet: {
    height: 1,
    backgroundColor: couleurs.bordureDoree,
    opacity: 0.55,
  },
  contenu: {
    flex: 1,
    backgroundColor: couleurs.fond,
  },
});
