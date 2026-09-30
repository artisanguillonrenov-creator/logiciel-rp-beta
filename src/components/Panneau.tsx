import React, { useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { degrades, espacement, ombreProfonde, rayon } from '../theme/theme';
import { CoinsFiligranes } from './Ornements';

interface PanneauProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  // 'or' : cadre plus lumineux pour l'élément mis en avant d'un écran.
  variante?: 'standard' | 'or';
  // Coins filigranés ; à couper sur les très petits panneaux.
  ornements?: boolean;
}

// Panneau « grimoire nocturne » : verre bleu nuit, fin cadre or doublé d'un
// liseré intérieur et coins filigranés — l'illustration reste perceptible
// derrière, la lecture reste prioritaire.
// Les coins filigranés encombreraient un cartouche d'une ligne : ils
// n'apparaissent qu'à partir de 64 px de haut, en petit jusqu'à 110 px.
const HAUTEUR_MIN_COINS = 64;
const HAUTEUR_GRANDS_COINS = 110;

export default function Panneau({ children, style, variante = 'standard', ornements = true }: PanneauProps) {
  const [hauteur, setHauteur] = useState(0);
  const mesurer = (e: LayoutChangeEvent) => setHauteur(e.nativeEvent.layout.height);
  return (
    <View style={[styles.panneau, variante === 'or' && styles.panneauOr, style]} onLayout={ornements ? mesurer : undefined}>
      <LinearGradient colors={degrades.panneau.couleurs} style={styles.fond} pointerEvents="none" />
      <View style={[styles.cadreInterieur, variante === 'or' && styles.cadreInterieurOr]} pointerEvents="none" />
      {children}
      {ornements && hauteur >= HAUTEUR_MIN_COINS && (
        <CoinsFiligranes taille={hauteur >= HAUTEUR_GRANDS_COINS ? 22 : 16} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panneau: {
    borderWidth: 1,
    borderColor: 'rgba(216, 177, 95, 0.46)',
    borderRadius: rayon.md,
    padding: espacement.md,
    ...ombreProfonde,
  },
  panneauOr: {
    borderColor: 'rgba(243, 217, 151, 0.72)',
    shadowColor: '#D6AE63',
    shadowOpacity: 0.2,
  },
  fond: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: rayon.md - 1,
  },
  cadreInterieur: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    bottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(216, 177, 95, 0.08)',
    borderRadius: rayon.md - 4,
  },
  cadreInterieurOr: {
    borderColor: 'rgba(216, 177, 95, 0.12)',
  },
});
