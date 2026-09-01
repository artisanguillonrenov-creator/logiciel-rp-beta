import React from 'react';
import { StyleProp, StyleSheet, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle } from 'react-native';
import { couleurs, espacement, polices, stylePetitesCapitales } from '../theme/theme';

interface ChampProps extends TextInputProps {
  label?: string;
  multiligne?: boolean;
  conteneurStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

// Champ de saisie avec label petites capitales (décoratif ET fonctionnel,
// cohérent avec le ton "document ancien" de l'interface).
export default function Champ({ label, multiligne, style, conteneurStyle, labelStyle, ...rest }: ChampProps) {
  return (
    <View style={conteneurStyle}>
      {label ? <Text style={[styles.label, labelStyle]}>{label}</Text> : null}
      <TextInput
        style={[styles.champ, multiligne && styles.champMultiligne, style]}
        placeholderTextColor={couleurs.texteAtténué}
        multiline={multiligne}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...stylePetitesCapitales,
    color: couleurs.texteAtténué,
    fontSize: 12,
    marginBottom: espacement.xs,
  },
  champ: {
    backgroundColor: couleurs.fondChampSaisie,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    color: couleurs.texte,
    paddingHorizontal: espacement.sm,
    paddingVertical: espacement.sm,
    fontFamily: polices.corps,
    fontSize: 16,
  },
  champMultiligne: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
