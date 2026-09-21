import React, { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { couleurs, ombresLueur, polices } from '../theme/theme';

interface IndicateurEtapesProps {
  total: number;
  actif: number;
}

// Ligne de progression V2 : plus fine, plus éditoriale. Les étapes passées
// sont dorées (progression dans le monde), l'étape active reste bleu arcane.
export default function IndicateurEtapes({ total, actif }: IndicateurEtapesProps) {
  return (
    <View style={styles.rangee} accessibilityRole="progressbar">
      {Array.from({ length: total }).map((_, i) => {
        const complete = i < actif;
        const estActif = i === actif;
        return (
          <Fragment key={i}>
            <View style={[styles.point, complete && styles.pointComplete, estActif && styles.pointActif, estActif && ombresLueur]}>
              <Text style={[styles.texte, complete && styles.texteComplete, estActif && styles.texteActif]}>
                {complete ? '✓' : i + 1}
              </Text>
            </View>
            {i < total - 1 && (
              <View style={styles.rail}>
                <View style={[styles.railRempli, { width: i < actif ? '100%' : '0%' }]} />
              </View>
            )}
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rangee: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  point: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: couleurs.fondProfond,
  },
  pointComplete: {
    borderColor: couleurs.dore,
    backgroundColor: 'rgba(201, 164, 92, 0.12)',
  },
  pointActif: {
    borderColor: couleurs.accent,
    backgroundColor: 'rgba(147, 169, 224, 0.16)',
  },
  texte: {
    color: couleurs.texteFaible,
    fontFamily: polices.corpsMedium,
    fontSize: 10,
  },
  texteComplete: {
    color: couleurs.doreClair,
  },
  texteActif: {
    color: couleurs.accentClair,
  },
  rail: {
    width: 34,
    height: 1,
    backgroundColor: couleurs.bordure,
    overflow: 'hidden',
  },
  railRempli: {
    height: 1,
    backgroundColor: couleurs.dore,
  },
});
