import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { couleurs, espacement } from '../theme/theme';

interface PanneauProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

// Panneau semi-transparent à liseré fin, coins droits (direction
// artistique "grimoire illuminé") — la profondeur vient de la
// transparence sur le fond, jamais d'un box-shadow gris générique.
export default function Panneau({ children, style }: PanneauProps) {
  return <View style={[styles.panneau, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  panneau: {
    backgroundColor: couleurs.fondCarte,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    padding: espacement.md,
  },
});
