import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Creativite, Longueur } from '../types';
import { creerNouvelleHistoire } from '../engine/story';
import { saveStory } from '../storage/storage';
import { couleurs, espacement, polices, rayon } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Creation'>;

const OPTIONS_CREATIVITE: { valeur: Creativite; label: string }[] = [
  { valeur: 'faible', label: 'Faible' },
  { valeur: 'moyenne', label: 'Moyenne' },
  { valeur: 'elevee', label: 'Élevée' },
];

const OPTIONS_LONGUEUR: { valeur: Longueur; label: string }[] = [
  { valeur: 'courte', label: 'Courte' },
  { valeur: 'moyenne', label: 'Moyenne' },
  { valeur: 'longue', label: 'Longue' },
];

export default function CreateScreen({ navigation }: Props) {
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [pointDeDepart, setPointDeDepart] = useState('');
  const [creativite, setCreativite] = useState<Creativite>('moyenne');
  const [longueur, setLongueur] = useState<Longueur>('moyenne');
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState('');

  const pretAValider = nom.trim().length > 0 && description.trim().length > 0 && pointDeDepart.trim().length > 0;

  async function valider() {
    if (!pretAValider || enregistrement) return;
    setEnregistrement(true);
    setErreur('');
    try {
      const histoire = creerNouvelleHistoire({
        personnageNom: nom.trim(),
        personnageDescription: description.trim(),
        pointDeDepart: pointDeDepart.trim(),
        // violence/romance : réglages par défaut pour l'instant — de vrais
        // curseurs arrivent avec le parcours de création en 5 étapes
        // (brief Phase 2, étape "Préférences").
        settings: { creativite, longueur, violence: 'modere', romance: 'modere' },
      });
      await saveStory(histoire);
      navigation.replace('Conversation', { storyId: histoire.meta.id });
    } catch (e) {
      setErreur("Impossible d'enregistrer l'histoire. Réessaie.");
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: couleurs.fond }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.titre}>Création rapide</Text>

        <Text style={styles.label}>Nom du personnage</Text>
        <TextInput
          style={styles.champ}
          value={nom}
          onChangeText={setNom}
          placeholder="Ex : Aelis Corvenn"
          placeholderTextColor={couleurs.texteAtténué}
        />

        <Text style={styles.label}>Courte description</Text>
        <TextInput
          style={[styles.champ, styles.champMultiligne]}
          value={description}
          onChangeText={setDescription}
          placeholder="Qui est ce personnage, en quelques phrases ?"
          placeholderTextColor={couleurs.texteAtténué}
          multiline
        />

        <Text style={styles.label}>Point de départ (une phrase)</Text>
        <TextInput
          style={styles.champ}
          value={pointDeDepart}
          onChangeText={setPointDeDepart}
          placeholder="Ex : Elle arrive aux portes d'Elyndor à la nuit tombée."
          placeholderTextColor={couleurs.texteAtténué}
        />

        <Text style={styles.label}>Créativité</Text>
        <View style={styles.rangeeOptions}>
          {OPTIONS_CREATIVITE.map((opt) => (
            <Pressable
              key={opt.valeur}
              style={[styles.option, creativite === opt.valeur && styles.optionActive]}
              onPress={() => setCreativite(opt.valeur)}
            >
              <Text style={[styles.texteOption, creativite === opt.valeur && styles.texteOptionActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Longueur de réponse</Text>
        <View style={styles.rangeeOptions}>
          {OPTIONS_LONGUEUR.map((opt) => (
            <Pressable
              key={opt.valeur}
              style={[styles.option, longueur === opt.valeur && styles.optionActive]}
              onPress={() => setLongueur(opt.valeur)}
            >
              <Text style={[styles.texteOption, longueur === opt.valeur && styles.texteOptionActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

        <Pressable
          style={[styles.boutonPrincipal, !pretAValider && styles.boutonDesactive]}
          onPress={valider}
          disabled={!pretAValider || enregistrement}
        >
          <Text style={styles.texteBoutonPrincipal}>
            {enregistrement ? 'Création…' : "Commencer l'histoire"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: espacement.lg,
    paddingTop: espacement.xl,
    gap: espacement.xs,
  },
  titre: {
    color: couleurs.texte,
    fontFamily: polices.titre,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: espacement.md,
  },
  label: {
    color: couleurs.texteAtténué,
    fontSize: 13,
    marginTop: espacement.md,
    marginBottom: espacement.xs,
  },
  champ: {
    backgroundColor: couleurs.fondChampSaisie,
    borderRadius: rayon.sm,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    color: couleurs.texte,
    paddingHorizontal: espacement.sm,
    paddingVertical: espacement.sm,
    fontSize: 15,
  },
  champMultiligne: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  rangeeOptions: {
    flexDirection: 'row',
    gap: espacement.sm,
  },
  option: {
    flex: 1,
    paddingVertical: espacement.sm,
    borderRadius: rayon.sm,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    alignItems: 'center',
  },
  optionActive: {
    backgroundColor: couleurs.accent,
    borderColor: couleurs.accent,
  },
  texteOption: {
    color: couleurs.texteAtténué,
    fontSize: 13,
  },
  texteOptionActive: {
    color: '#fff',
    fontWeight: '600',
  },
  erreur: {
    color: couleurs.danger,
    marginTop: espacement.md,
  },
  boutonPrincipal: {
    backgroundColor: couleurs.accent,
    borderRadius: rayon.md,
    paddingVertical: espacement.md,
    alignItems: 'center',
    marginTop: espacement.lg,
    marginBottom: espacement.xl,
  },
  boutonDesactive: {
    opacity: 0.5,
  },
  texteBoutonPrincipal: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
