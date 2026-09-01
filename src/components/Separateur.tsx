import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { couleurs, espacement } from '../theme/theme';

interface SeparateurProps {
  style?: StyleProp<ViewStyle>;
}

// Motif ornemental récurrent (losange central + traits fins) — remplace un
// séparateur plat entre titre/sous-titre ou en bas d'écran entre boutons.
export default function Separateur({ style }: SeparateurProps) {
  return (
    <View style={[styles.rangee, style]}>
      <View style={styles.ligne} />
      <Text style={styles.losange}>◆</Text>
      <View style={styles.ligne} />
    </View>
  );
}

const styles = StyleSheet.create({
  rangee: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: espacement.md,
  },
  ligne: {
    flex: 1,
    height: 1,
    backgroundColor: couleurs.bordure,
  },
  losange: {
    color: couleurs.dore,
    fontSize: 10,
    marginHorizontal: espacement.sm,
  },
});
