import React, { useCallback, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { couleurs, espacement, interfaceV2, polices, rayon, stylePetitesCapitales } from '../theme/theme';

// Dictée vocale — même modèle que WhatsApp : appui (bref délai pour éviter
// un tap accidentel) démarre l'écoute, glisser vers le haut annule,
// relâcher envoie le texte reconnu dans le champ de saisie.
const DELAI_AVANT_ECOUTE = 250;
const SEUIL_ANNULATION = 60;

export default function BoutonDictee({
  desactive,
  onTexteReconnu,
}: {
  desactive?: boolean;
  onTexteReconnu: (texte: string) => void;
}) {
  const [enregistrement, setEnregistrement] = useState(false);
  const [annulationEnCours, setAnnulationEnCours] = useState(false);
  const dernierTranscrit = useRef('');
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enregistrementActif = useRef(false);

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) dernierTranscrit.current = transcript;
  });

  useSpeechRecognitionEvent('end', () => {
    setEnregistrement(false);
    enregistrementActif.current = false;
  });

  useSpeechRecognitionEvent('error', () => {
    setEnregistrement(false);
    enregistrementActif.current = false;
  });

  const demarrer = useCallback(async () => {
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) return;
    } catch {
      return;
    }
    dernierTranscrit.current = '';
    enregistrementActif.current = true;
    setEnregistrement(true);
    setAnnulationEnCours(false);
    ExpoSpeechRecognitionModule.start({ lang: 'fr-FR', interimResults: true, continuous: false });
  }, []);

  const arreter = useCallback(
    (annuler: boolean) => {
      if (!enregistrementActif.current) return;
      enregistrementActif.current = false;
      setEnregistrement(false);
      if (annuler) {
        ExpoSpeechRecognitionModule.abort();
        return;
      }
      ExpoSpeechRecognitionModule.stop();
      if (dernierTranscrit.current.trim()) onTexteReconnu(dernierTranscrit.current.trim());
    },
    [onTexteReconnu],
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !desactive,
      onPanResponderGrant: () => {
        minuteur.current = setTimeout(() => {
          void demarrer();
        }, DELAI_AVANT_ECOUTE);
      },
      onPanResponderMove: (_evt, geste) => {
        if (!enregistrementActif.current) return;
        setAnnulationEnCours(geste.dy < -SEUIL_ANNULATION);
      },
      onPanResponderRelease: (_evt, geste) => {
        if (minuteur.current) {
          clearTimeout(minuteur.current);
          minuteur.current = null;
        }
        arreter(geste.dy < -SEUIL_ANNULATION);
      },
      onPanResponderTerminate: () => {
        if (minuteur.current) {
          clearTimeout(minuteur.current);
          minuteur.current = null;
        }
        arreter(true);
      },
    }),
  ).current;

  return (
    <View style={styles.conteneur} pointerEvents={desactive ? 'none' : 'auto'}>
      {enregistrement && (
        <Text style={[styles.indication, annulationEnCours && styles.indicationAnnulation]}>
          {annulationEnCours ? 'Relâche pour annuler' : 'Glisse vers le haut pour annuler'}
        </Text>
      )}
      <View
        {...panResponder.panHandlers}
        accessible
        accessibilityRole="button"
        accessibilityLabel="Dictée vocale"
        style={[
          styles.bouton,
          enregistrement && styles.boutonActif,
          annulationEnCours && styles.boutonAnnulation,
          desactive && styles.boutonDesactive,
        ]}
      >
        <Text style={[styles.icone, enregistrement && styles.iconeActive]}>
          {enregistrement ? '●' : 'VOIX'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bouton: {
    width: interfaceV2.cibleTactileMin,
    height: interfaceV2.cibleTactileMin,
    borderRadius: rayon.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4, 12, 22, 0.78)',
    borderWidth: 1,
    borderColor: couleurs.accentSombre,
  },
  boutonActif: {
    backgroundColor: 'rgba(78, 174, 248, 0.16)',
    borderColor: couleurs.accent,
  },
  boutonAnnulation: {
    backgroundColor: 'rgba(227, 112, 125, 0.14)',
    borderColor: couleurs.danger,
  },
  boutonDesactive: {
    opacity: 0.4,
  },
  icone: {
    ...stylePetitesCapitales,
    color: couleurs.accentClair,
    fontFamily: polices.corpsMedium,
    fontSize: 9,
    letterSpacing: 1,
  },
  iconeActive: {
    color: couleurs.accentClair,
    fontSize: 13,
  },
  indication: {
    position: 'absolute',
    bottom: 56,
    right: 0,
    backgroundColor: couleurs.fondCarteDense,
    borderWidth: 1,
    borderColor: couleurs.bordureSubtile,
    borderRadius: rayon.sm,
    paddingVertical: espacement.xs,
    paddingHorizontal: espacement.sm,
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 12,
    width: 180,
    textAlign: 'center',
  },
  indicationAnnulation: {
    color: couleurs.danger,
    borderColor: couleurs.danger,
  },
});
