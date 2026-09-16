import React from 'react';
import { Image, Pressable, StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';
import { analyserMessage, type SegmentMessage } from '../engine/messageFormatter';
import { indexerLocuteurs } from '../engine/speakerIndex';
import { couleurs, espacement, polices, rayon } from '../theme/theme';
import type { EntreeLoreEmergent } from '../types';

export interface AvatarPnjPourTexte {
  pnj: EntreeLoreEmergent;
  avatarUri: string;
}

function capitaliser(nom: string): string {
  return nom.toLocaleLowerCase('fr').replace(/(^|[- ])\p{L}/gu, (lettre) => lettre.toLocaleUpperCase('fr'));
}

// V2 lecteur : la prose est traitée comme un texte de roman. Les prises de
// parole identifiées deviennent de petits blocs de personnage éditoriaux,
// jamais des bulles de messagerie.
export default function TexteMessageFormate({
  texte, style, avatarsPnj = [], pnjConnus, onPressAvatar,
}: {
  texte: string;
  style?: StyleProp<TextStyle>;
  avatarsPnj?: AvatarPnjPourTexte[];
  pnjConnus?: EntreeLoreEmergent[];
  onPressAvatar?: (pnj: EntreeLoreEmergent) => void;
}) {
  const index = indexerLocuteurs(pnjConnus ?? avatarsPnj.map((a) => a.pnj));
  const portraits = new Map(avatarsPnj.map((a) => [a.pnj.id, a.avatarUri]));
  const blocs: SegmentMessage[][] = [];
  for (const segment of analyserMessage(texte)) {
    const precedent = blocs[blocs.length - 1];
    if (segment.type === 'repliquePersonnage' || !precedent || precedent[0].type === 'repliquePersonnage') {
      blocs.push([segment]);
    } else {
      precedent.push(segment);
    }
  }

  return <View style={styles.conteneur}>
    {blocs.map((bloc, i) => {
      const segment = bloc[0];
      if (segment.type === 'repliquePersonnage') {
        const pnj = index.get((segment.locuteur ?? '').toLocaleLowerCase('fr'));
        const uri = pnj ? portraits.get(pnj.id) : undefined;
        return <View key={i} style={styles.replique}>
          <Pressable
            style={styles.locuteur}
            disabled={!uri || !pnj || !onPressAvatar}
            onPress={() => { if (pnj) onPressAvatar?.(pnj); }}
            accessibilityRole="button"
            accessibilityLabel={`Portrait de ${segment.locuteur}`}
          >
            {uri ? <Image source={{ uri }} style={styles.avatar} /> : <View style={styles.avatarVide}><Text style={styles.avatarRune}>✦</Text></View>}
            <View style={styles.colonneDialogue}>
              <Text style={[style, styles.nomLocuteur]}>{capitaliser(segment.locuteur ?? '')}</Text>
              <Text style={[style, styles.dialogue]}>« {segment.contenu} »</Text>
            </View>
          </Pressable>
        </View>;
      }
      if (bloc.every((seg) => !seg.contenu.trim())) return null;
      return <Text key={i} style={[style, styles.prose]}>
        {bloc.map((seg, j) => <Text key={j} style={seg.type === 'action' ? styles.action : seg.type === 'dialogue' ? styles.dialogueInline : undefined}>{seg.contenu}</Text>)}
      </Text>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  conteneur: {
    width: '100%',
  },
  prose: {
    lineHeight: 25,
    marginBottom: 8,
  },
  action: {
    fontStyle: 'italic',
    color: couleurs.texteAtténué,
  },
  dialogueInline: {
    color: couleurs.doreClair,
  },
  replique: {
    marginVertical: 10,
    paddingVertical: 8,
    paddingLeft: espacement.sm,
    borderLeftWidth: 1,
    borderLeftColor: couleurs.bordureDoree,
    backgroundColor: 'rgba(4, 12, 22, 0.24)',
  },
  locuteur: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    minHeight: 48,
  },
  colonneDialogue: {
    flex: 1,
    paddingTop: 1,
    paddingRight: espacement.xs,
  },
  nomLocuteur: {
    flexShrink: 1,
    fontFamily: polices.corpsMedium,
    color: couleurs.dore,
    textTransform: 'uppercase',
    letterSpacing: 1.15,
    fontSize: 11,
    marginBottom: 3,
  },
  dialogue: {
    color: couleurs.texte,
    lineHeight: 23,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: rayon.sm,
    borderWidth: 1,
    borderColor: couleurs.bordureDoree,
  },
  avatarVide: {
    width: 44,
    height: 44,
    borderRadius: rayon.sm,
    borderWidth: 1,
    borderColor: couleurs.bordureDoree,
    backgroundColor: couleurs.fondChampSaisie,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRune: {
    color: couleurs.dore,
    fontSize: 12,
  },
});
