import React from 'react';
import { Pressable, PressableProps, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';
import { couleurs, espacement, interfaceV2, ombresLueur, ombresOr, polices, rayon } from '../theme/theme';

interface BoutonProps extends Omit<PressableProps, 'style'> {
  titre: string;
  variante?: 'principal' | 'secondaire' | 'arcane';
  desactive?: boolean;
  style?: StyleProp<ViewStyle>;
  texteStyle?: StyleProp<TextStyle>;
}

// V2 : l'action principale appartient au monde et utilise l'or ; le bleu
// arcane est réservé aux fonctions IA/magie/focus. Les trois variantes
// partagent une cible tactile de 48dp minimum.
export default function Bouton({ titre, variante = 'principal', desactive, style, texteStyle, ...rest }: BoutonProps) {
  const principal = variante === 'principal';
  const arcane = variante === 'arcane';
  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        principal ? styles.principal : arcane ? styles.arcane : styles.secondaire,
        pressed && !desactive && styles.presse,
        desactive && styles.desactive,
        style,
      ]}
      disabled={desactive}
      accessibilityRole="button"
      {...rest}
    >
      <Text
        style={[
          styles.texte,
          principal ? styles.textePrincipal : arcane ? styles.texteArcane : styles.texteSecondaire,
          texteStyle,
        ]}
      >
        {titre}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: interfaceV2.cibleTactileMin,
    borderWidth: 1,
    borderRadius: rayon.sm,
    paddingVertical: espacement.sm + 3,
    paddingHorizontal: espacement.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  principal: {
    backgroundColor: 'rgba(216, 179, 107, 0.18)',
    borderColor: couleurs.dore,
    ...ombresOr,
  },
  arcane: {
    backgroundColor: 'rgba(78, 174, 248, 0.10)',
    borderColor: couleurs.accent,
    ...ombresLueur,
  },
  secondaire: {
    backgroundColor: 'rgba(4, 12, 22, 0.58)',
    borderColor: couleurs.bordure,
  },
  presse: {
    opacity: 0.78,
    transform: [{ scale: 0.992 }],
  },
  desactive: {
    opacity: 0.38,
  },
  texte: {
    fontFamily: polices.corpsMedium,
    fontSize: 15,
    textTransform: 'uppercase',
    letterSpacing: 1.35,
  },
  textePrincipal: {
    color: couleurs.doreClair,
  },
  texteArcane: {
    color: couleurs.accentClair,
  },
  texteSecondaire: {
    color: couleurs.texte,
  },
});
