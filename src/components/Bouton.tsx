import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, PressableProps, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { couleurs, degrades, espacement, interfaceV2, ombreProfonde, ombresOr, polices, rayon } from '../theme/theme';
import { Embout, Icone, type NomIcone } from './Ornements';

interface BoutonProps extends Omit<PressableProps, 'style'> {
  titre: string;
  variante?: 'principal' | 'secondaire' | 'arcane' | 'danger';
  desactive?: boolean;
  // Pictogramme affiché à gauche, seulement si le bouton est assez large.
  icone?: NomIcone;
  style?: StyleProp<ViewStyle>;
  texteStyle?: StyleProp<TextStyle>;
}

// Règle V13.2 : un ornement n'apparaît que s'il reste de la place de chaque
// côté du libellé centré — embouts s'il reste 64 px au total, pictogramme
// sur les boutons larges s'il en reste 120.
const MARGE_EMBOUTS = 64;
const LARGEUR_ICONE = 260;
const MARGE_ICONE = 120;

// Thème « grimoire nocturne » : l'action principale est un lingot d'or
// ciselé, les autres des plaques bleu nuit liserées d'or. « arcane » garde
// son sens (fonctions IA/magie) avec un libellé doré plutôt que bleu.
export default function Bouton({ titre, variante = 'principal', desactive, icone, style, texteStyle, onLayout, ...rest }: BoutonProps) {
  const [largeur, setLargeur] = useState(0);
  const [largeurTexte, setLargeurTexte] = useState(0);
  const principal = variante === 'principal';
  const danger = variante === 'danger';
  const place = largeurTexte > 0 ? largeur - largeurTexte : 0;
  const embouts = !danger && place >= MARGE_EMBOUTS;
  const avecIcone = !!icone && largeur >= LARGEUR_ICONE && place >= MARGE_ICONE;

  function mesurer(e: LayoutChangeEvent) {
    setLargeur(e.nativeEvent.layout.width);
    onLayout?.(e);
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        principal ? styles.principal : danger ? styles.danger : styles.nuit,
        pressed && !desactive && styles.presse,
        desactive && styles.desactive,
        style,
      ]}
      disabled={desactive}
      accessibilityRole="button"
      onLayout={mesurer}
      {...rest}
    >
      {principal ? (
        <>
          <LinearGradient colors={degrades.or.couleurs} locations={degrades.or.positions} style={styles.fond} />
          <LinearGradient
            colors={degrades.reflet.couleurs}
            locations={degrades.reflet.positions}
            start={{ x: 0, y: 0.2 }}
            end={{ x: 1, y: 0.8 }}
            style={styles.fond}
          />
        </>
      ) : (
        <LinearGradient colors={danger ? degrades.danger.couleurs : degrades.nuit.couleurs} style={styles.fond} />
      )}
      {!principal && <View style={[styles.cadreInterieur, danger && styles.cadreInterieurDanger]} pointerEvents="none" />}
      {embouts && (
        <>
          <Embout cote="gauche" encre={principal} style={styles.emboutGauche} />
          <Embout cote="droite" encre={principal} style={styles.emboutDroit} />
        </>
      )}
      {avecIcone && icone && (
        <Icone nom={icone} couleur={principal ? couleurs.encre : couleurs.doreClair} style={styles.icone} />
      )}
      <Text
        onLayout={(e) => setLargeurTexte(e.nativeEvent.layout.width)}
        style={[
          styles.texte,
          principal ? styles.textePrincipal : danger ? styles.texteDanger : variante === 'arcane' ? styles.texteArcane : styles.texteSecondaire,
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
    borderColor: '#F8E4A9',
    ...ombresOr,
  },
  nuit: {
    borderColor: 'rgba(216, 177, 95, 0.55)',
    ...ombreProfonde,
    shadowOpacity: 0.34,
    shadowRadius: 11,
  },
  danger: {
    borderColor: 'rgba(255, 140, 150, 0.55)',
  },
  // Pas d'overflow: hidden sur le bouton (il couperait l'ombre sur iOS) :
  // c'est le dégradé qui épouse l'arrondi intérieur de la bordure.
  fond: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: rayon.sm - 1,
  },
  // Double liseré intérieur des plaques (inset 3 px sombre + 1 px or pâle).
  cadreInterieur: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: 3,
    bottom: 3,
    borderWidth: 1,
    borderColor: 'rgba(216, 177, 95, 0.15)',
    borderRadius: rayon.sm - 3,
  },
  cadreInterieurDanger: {
    borderColor: 'rgba(255, 140, 150, 0.14)',
  },
  emboutGauche: { position: 'absolute', left: 10 },
  emboutDroit: { position: 'absolute', right: 10 },
  icone: { position: 'absolute', left: 30 },
  presse: {
    opacity: 0.86,
    transform: [{ translateY: 1 }],
  },
  desactive: {
    opacity: 0.38,
  },
  texte: {
    fontFamily: polices.displaySemiGras,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1.8,
    textAlign: 'center',
  },
  textePrincipal: {
    color: couleurs.encre,
    textShadowColor: 'rgba(255, 244, 210, 0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  texteArcane: {
    color: couleurs.doreClair,
  },
  texteSecondaire: {
    color: couleurs.texte,
  },
  texteDanger: {
    color: '#FFC4C9',
  },
});
