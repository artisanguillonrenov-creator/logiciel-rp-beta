import React, { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { couleurs, ombresLueur } from '../theme/theme';

interface IndicateurEtapesProps {
  total: number;
  // Index (0-based) de l'étape active — les étapes d'index inférieur sont
  // marquées complétées (coche), celle-ci reçoit le glow bleu.
  actif: number;
}

// Cercles reliés par une ligne fine ; complété = coche + liseré or, actif =
// liseré bleu avec glow — remplace la barre de progression plate.
export default function IndicateurEtapes({ total, actif }: IndicateurEtapesProps) {
  return (
    <View style={styles.rangee}>
      {Array.from({ length: total }).map((_, i) => {
        const complete = i < actif;
        const estActif = i === actif;
        return (
          <Fragment key={i}>
            <View
              style={[
                styles.cercle,
                complete && styles.cercleComplete,
                estActif && styles.cercleActif,
                estActif && ombresLueur,
              ]}
            >
              <Text style={[styles.texteCercle, (complete || estActif) && styles.texteCercleActif]}>
                {complete ? '✓' : i + 1}
              </Text>
            </View>
            {i < total - 1 && <View style={styles.ligne} />}
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
  },
  cercle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: couleurs.fond,
  },
  cercleComplete: {
    borderColor: couleurs.dore,
  },
  cercleActif: {
    borderColor: couleurs.accent,
  },
  texteCercle: {
    color: couleurs.texteAtténué,
    fontSize: 12,
  },
  texteCercleActif: {
    color: couleurs.texte,
  },
  ligne: {
    width: 20,
    height: 1,
    backgroundColor: couleurs.bordure,
  },
});
