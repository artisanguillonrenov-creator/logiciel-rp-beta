import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';
import { analyserMessage } from '../engine/messageFormatter';
import { couleurs } from '../theme/theme';

// Rend un message avec l'action/narration (*entre astérisques*) en italique
// et le dialogue ("entre guillemets") distingué — même analyseur que
// l'export PDF/EPUB, pour que le rendu à l'écran et le document restent
// cohérents.
export default function TexteMessageFormate({ texte, style }: { texte: string; style?: StyleProp<TextStyle> }) {
  const segments = analyserMessage(texte);
  return (
    <Text style={style}>
      {segments.map((seg, i) => (
        <Text key={i} style={seg.type === 'action' ? styles.action : seg.type === 'dialogue' ? styles.dialogue : undefined}>
          {seg.contenu}
        </Text>
      ))}
    </Text>
  );
}

const styles = StyleSheet.create({
  action: {
    fontStyle: 'italic',
    color: couleurs.texteAtténué,
  },
  dialogue: {
    color: couleurs.dore,
  },
});
