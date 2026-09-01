import React from 'react';
import { Pressable, PressableProps, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from 'react-native';
import { couleurs, espacement, ombresLueur, polices } from '../theme/theme';

interface BoutonProps extends Omit<PressableProps, 'style'> {
  titre: string;
  variante?: 'principal' | 'secondaire';
  desactive?: boolean;
  style?: StyleProp<ViewStyle>;
  texteStyle?: StyleProp<TextStyle>;
}

// Boutons à bordure et glow (pas de remplissage plein) — cohérent avec des
// panneaux transparents plutôt qu'une carte SaaS pleine couleur.
export default function Bouton({ titre, variante = 'principal', desactive, style, texteStyle, ...rest }: BoutonProps) {
  const principal = variante === 'principal';
  return (
    <Pressable
      style={[styles.base, principal ? styles.principal : styles.secondaire, desactive && styles.desactive, style]}
      disabled={desactive}
      {...rest}
    >
      <Text style={[styles.texte, principal ? styles.textePrincipal : styles.texteSecondaire, texteStyle]}>{titre}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    paddingVertical: espacement.sm + 4,
    paddingHorizontal: espacement.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  principal: {
    backgroundColor: 'rgba(90, 172, 255, 0.10)',
    borderColor: couleurs.accent,
    ...ombresLueur,
  },
  secondaire: {
    backgroundColor: 'transparent',
    borderColor: couleurs.bordure,
  },
  desactive: {
    opacity: 0.45,
  },
  texte: {
    fontFamily: polices.corpsMedium,
    fontSize: 15,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  textePrincipal: {
    color: couleurs.accentClair,
  },
  texteSecondaire: {
    color: couleurs.texteAtténué,
  },
});
