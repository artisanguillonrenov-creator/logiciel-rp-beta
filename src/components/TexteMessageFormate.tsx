import React from 'react';
import { Image, Pressable, StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';
import { analyserMessage, type SegmentMessage } from '../engine/messageFormatter';
import { indexerLocuteurs } from '../engine/speakerIndex';
import { couleurs, polices } from '../theme/theme';
import type { EntreeLoreEmergent } from '../types';

export interface AvatarPnjPourTexte {
  pnj: EntreeLoreEmergent;
  avatarUri: string;
}

function capitaliser(nom: string): string {
  return nom.toLocaleLowerCase('fr').replace(/(^|[- ])\p{L}/gu, (lettre) => lettre.toLocaleUpperCase('fr'));
}

// Les mentions dans la prose ne sont pas des prises de parole. Un seul
// portrait par réplique nommée ; le texte partagé avec l'export reste intact.
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

  return <View>
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
            {uri && <Image source={{ uri }} style={styles.avatar} />}
            <Text style={[style, styles.nomLocuteur]}>{capitaliser(segment.locuteur ?? '')}</Text>
          </Pressable>
          <Text style={[style, styles.dialogue]}>« {segment.contenu} »</Text>
        </View>;
      }
      if (bloc.every((seg) => !seg.contenu.trim())) return null;
      return <Text key={i} style={style}>
        {bloc.map((seg, j) => <Text key={j} style={seg.type === 'action' ? styles.action : seg.type === 'dialogue' ? styles.dialogue : undefined}>{seg.contenu}</Text>)}
      </Text>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  action: { fontStyle: 'italic', color: couleurs.texteAtténué },
  dialogue: { color: couleurs.dore },
  replique: { marginVertical: 6 },
  locuteur: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4, minHeight: 32 },
  nomLocuteur: { flexShrink: 1, fontFamily: polices.corpsMedium, color: couleurs.accentClair },
  avatar: { width: 32, height: 32, borderRadius: 16 },
});
