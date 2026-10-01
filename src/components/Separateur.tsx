import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { espacement } from '../theme/theme';
import { EtoileOrnement } from './Ornements';

interface SeparateurProps {
  style?: StyleProp<ViewStyle>;
}

// Motif ornemental récurrent : deux filets d'or qui s'estompent vers
// l'extérieur autour d'une étoile à huit branches (grimoire V13.2).
export default function Separateur({ style }: SeparateurProps) {
  return (
    <View style={[styles.rangee, style]}>
      <LinearGradient
        colors={['rgba(216, 177, 95, 0)', 'rgba(216, 177, 95, 0.62)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.ligne}
      />
      <EtoileOrnement taille={16} style={styles.etoile} />
      <LinearGradient
        colors={['rgba(216, 177, 95, 0.62)', 'rgba(216, 177, 95, 0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.ligne}
      />
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
  },
  etoile: {
    marginHorizontal: espacement.sm,
  },
});
