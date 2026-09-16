import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { StoryState } from '../types';
import { getStory } from '../storage/storage';
import ConversationScreen from './ConversationScreen';
import { couleurs, espacement, polices, stylePetitesCapitales } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Conversation'>;

/**
 * Coquille lecteur V2.
 *
 * Le header natif reste visible afin que ConversationScreen puisse y monter
 * ses commandes fonctionnelles (recherche, export, concepteur, branche).
 * Cette couche conserve uniquement l'identité de scène et le cadre de
 * lecture cinématique.
 */
export default function ConversationScreenStudio(props: Props) {
  const { route } = props;
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
      <View style={styles.enteteScene}>
        <View style={[styles.enteteInterieur, tablette && styles.enteteInterieurTablette]}>
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
  enteteScene: {
    minHeight: 54,
    paddingVertical: 7,
    paddingHorizontal: espacement.md,
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
  identiteScene: {
    flex: 1,
    minWidth: 0,
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
    fontSize: 18,
    lineHeight: 20,
  },
  sousTitre: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 1,
  },
  marqueRecit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: espacement.sm,
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
