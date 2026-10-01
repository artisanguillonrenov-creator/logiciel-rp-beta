import React, { useState } from 'react';
import { StyleProp, StyleSheet, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle } from 'react-native';
import { couleurs, espacement, polices, rayon, stylePetitesCapitales } from '../theme/theme';

interface ChampProps extends TextInputProps {
  label?: string;
  multiligne?: boolean;
  conteneurStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

// Champ V2 : surface très sombre, liseré discret puis bleu arcane au focus.
// Les champs narratifs sans label (saisie RP, édition de message) reçoivent
// une variante plus compacte et plus éditoriale, avec un focus doré.
export default function Champ({ label, multiligne, style, conteneurStyle, labelStyle, onFocus, onBlur, ...rest }: ChampProps) {
  const [focus, setFocus] = useState(false);
  const narratif = !!multiligne && !label;

  return (
    <View style={conteneurStyle}>
      {label ? <Text style={[styles.label, focus && styles.labelFocus, labelStyle]}>{label}</Text> : null}
      <TextInput
        style={[
          styles.champ,
          multiligne && styles.champMultiligne,
          narratif && styles.champNarratif,
          focus && (narratif ? styles.champNarratifFocus : styles.champFocus),
          style,
        ]}
        placeholderTextColor={couleurs.texteFaible}
        multiline={multiligne}
        onFocus={(e) => { setFocus(true); onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); onBlur?.(e); }}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...stylePetitesCapitales,
    color: couleurs.texteAtténué,
    fontSize: 11,
    marginBottom: espacement.xs + 2,
  },
  labelFocus: {
    color: couleurs.doreClair,
  },
  champ: {
    minHeight: 48,
    backgroundColor: couleurs.fondChampSaisie,
    borderWidth: 1,
    borderColor: 'rgba(146, 177, 235, 0.30)',
    borderRadius: rayon.sm,
    color: couleurs.texte,
    paddingHorizontal: espacement.md,
    paddingVertical: espacement.sm + 2,
    fontFamily: polices.corps,
    fontSize: 16,
  },
  // Grimoire V13.2 : le focus s'allume à l'or, comme une enluminure.
  champFocus: {
    borderColor: 'rgba(242, 211, 140, 0.78)',
    backgroundColor: 'rgba(3, 10, 24, 0.99)',
    shadowColor: couleurs.dore,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 9,
  },
  champMultiligne: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  champNarratif: {
    minHeight: 52,
    backgroundColor: 'rgba(3, 9, 22, 0.96)',
    borderColor: 'rgba(216, 177, 95, 0.40)',
    borderRadius: 22,
    paddingLeft: 18,
    paddingHorizontal: espacement.md,
    paddingVertical: espacement.sm + 1,
    fontSize: 17,
    lineHeight: 22,
  },
  champNarratifFocus: {
    borderColor: 'rgba(242, 211, 140, 0.78)',
    backgroundColor: 'rgba(3, 10, 24, 0.99)',
  },
});
