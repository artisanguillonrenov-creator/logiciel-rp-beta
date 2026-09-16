import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
 * Le moteur et les outils de ConversationScreen restent inchangés. Cette
 * couche ne s'occupe que de la composition visuelle : chrome narratif,
 * largeur de lecture bornée sur tablette et cadre cinématique discret.
 */
export default function ConversationScreenStudio(props: Props) {
  const { route, navigation } = props;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [story, setStory] = useState<StoryState | null>(null);

  const tablette = width >= 720;

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
    return [date, ambiance].filter(Boolean).join(' · ') || story.meta.personnageNom;
  }, [story]);

  const lieu = story?.meta.contexte.lieu?.trim() || 'ELYNDOR';

  return (
    <View style={styles.ecran}>
      <View style={[styles.entete, { paddingTop: Math.max(insets.top, 8) }]}>
        <View style={[styles.enteteInterieur, tablette && styles.enteteInterieurTablette]}>
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
            <Text style={styles.surtitre}>ELYNDOR</Text>
            <Text style={styles.lieu} numberOfLines={1}>{lieu}</Text>
            {!!sousTitre && <Text style={styles.sousTitre} numberOfLines={1}>{sousTitre}</Text>}
          </View>

          <View style={styles.marqueRecit} accessibilityElementsHidden>
            <Text style={styles.rune}>◇</Text>
            <Text style={styles.mode}>RÉCIT</Text>
          </View>
        </View>
      </View>

      <View style={styles.filet} />

      <View style={styles.zoneLecture}>
        {tablette && <View pointerEvents="none" style={styles.railGauche} />}
        <View style={[styles.cadreLecture, tablette && styles.cadreLectureTablette]}>
          <ConversationScreen {...props} />
          <View pointerEvents="none" style={styles.lueurBasse} />
        </View>
        {tablette && <View pointerEvents="none" style={styles.railDroit} />}
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
    minHeight: 68,
    paddingBottom: 8,
    paddingHorizontal: espacement.sm,
    backgroundColor: 'rgba(3, 8, 14, 0.985)',
  },
  enteteInterieur: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  enteteInterieurTablette: {
    maxWidth: 980,
    alignSelf: 'center',
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
  surtitre: {
    ...stylePetitesCapitales,
    color: couleurs.doreSombre,
    fontSize: 8,
    marginBottom: 1,
  },
  lieu: {
    color: couleurs.doreClair,
    fontFamily: polices.titre,
    fontSize: 19,
    lineHeight: 21,
  },
  sousTitre: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
  },
  marqueRecit: {
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
    opacity: 0.58,
  },
  zoneLecture: {
    flex: 1,
    backgroundColor: couleurs.fondProfond,
    alignItems: 'center',
  },
  cadreLecture: {
    flex: 1,
    width: '100%',
    backgroundColor: couleurs.fond,
    overflow: 'hidden',
  },
  cadreLectureTablette: {
    maxWidth: 980,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(216, 179, 107, 0.14)',
  },
  railGauche: {
    position: 'absolute',
    left: 18,
    top: 34,
    bottom: 34,
    width: 1,
    backgroundColor: 'rgba(216, 179, 107, 0.10)',
  },
  railDroit: {
    position: 'absolute',
    right: 18,
    top: 34,
    bottom: 34,
    width: 1,
    backgroundColor: 'rgba(216, 179, 107, 0.10)',
  },
  lueurBasse: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    backgroundColor: 'rgba(216, 179, 107, 0.28)',
  },
});
