import React, { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { couleurs, ombresOr, polices } from '../theme/theme';

interface IndicateurEtapesProps {
  total: number;
  actif: number;
}

// Ligne de progression « grimoire » : médaillons bleu nuit cerclés d'or ;
// les étapes passées sont ambrées, l'étape active s'illumine.
export default function IndicateurEtapes({ total, actif }: IndicateurEtapesProps) {
  return (
    <View style={styles.rangee} accessibilityRole="progressbar">
      {Array.from({ length: total }).map((_, i) => {
        const complete = i < actif;
        const estActif = i === actif;
        return (
          <Fragment key={i}>
            <View style={[styles.point, complete && styles.pointComplete, estActif && styles.pointActif, estActif && ombresOr]}>
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
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(216, 177, 95, 0.34)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A152C',
  },
  pointComplete: {
    borderColor: couleurs.dore,
    backgroundColor: '#2A1E0C',
  },
  pointActif: {
    borderColor: '#F3D997',
    backgroundColor: '#3A2A10',
    shadowOpacity: 0.55,
    shadowRadius: 10,
  },
  texte: {
    color: couleurs.texteFaible,
    fontFamily: polices.displaySemiGras,
    fontSize: 11,
  },
  texteComplete: {
    color: couleurs.doreClair,
  },
  texteActif: {
    color: couleurs.doreEclat,
  },
  rail: {
    width: 34,
    height: 1,
    backgroundColor: 'rgba(216, 177, 95, 0.18)',
    overflow: 'hidden',
  },
  railRempli: {
    height: 1,
    backgroundColor: 'rgba(216, 177, 95, 0.55)',
  },
});
