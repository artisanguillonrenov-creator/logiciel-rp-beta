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
// Le label reste lisible sans prendre le dessus sur le contenu narratif.
export default function Champ({ label, multiligne, style, conteneurStyle, labelStyle, onFocus, onBlur, ...rest }: ChampProps) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={conteneurStyle}>
      {label ? <Text style={[styles.label, focus && styles.labelFocus, labelStyle]}>{label}</Text> : null}
      <TextInput
        style={[styles.champ, focus && styles.champFocus, multiligne && styles.champMultiligne, style]}
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
    color: couleurs.accentClair,
  },
  champ: {
    minHeight: 48,
    backgroundColor: couleurs.fondChampSaisie,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    borderRadius: rayon.sm,
    color: couleurs.texte,
    paddingHorizontal: espacement.md,
    paddingVertical: espacement.sm + 2,
    fontFamily: polices.corps,
    fontSize: 16,
  },
  champFocus: {
    borderColor: couleurs.accent,
    backgroundColor: 'rgba(5, 18, 31, 0.88)',
  },
  champMultiligne: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
});
