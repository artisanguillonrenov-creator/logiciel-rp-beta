import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { couleurs, espacement, rayon } from '../theme/theme';

interface PanneauProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

// Panneau V2 : verre très sombre, liseré froid fin et léger relief interne.
// L'illustration derrière reste perceptible mais la lecture reste prioritaire.
export default function Panneau({ children, style }: PanneauProps) {
  return <View style={[styles.panneau, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  panneau: {
    backgroundColor: couleurs.fondCarte,
    borderWidth: 1,
    borderColor: couleurs.bordureSubtile,
    borderRadius: rayon.sm,
    padding: espacement.md,
  },
});
