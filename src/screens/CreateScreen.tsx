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
import type { Creativite, Longueur, NiveauCurseur } from '../types';
import { creerNouvelleHistoire } from '../engine/story';
import { saveStory } from '../storage/storage';
import { couleurs, espacement, polices, rayon } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Creation'>;

// Parcours de création en 5 étapes (brief Phase 2) : Histoire → Personnage
// → Point de départ → Préférences → Récapitulatif — remplace l'écran
// unique de la bêta.
const ETAPES = ['Histoire', 'Personnage', 'Point de départ', 'Préférences', 'Récapitulatif'] as const;

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

const OPTIONS_CURSEUR: { valeur: NiveauCurseur; label: string }[] = [
  { valeur: 'faible', label: 'Faible' },
  { valeur: 'modere', label: 'Modéré' },
  { valeur: 'eleve', label: 'Élevé' },
];

function RangeeOptions<T extends string>({
  options,
  valeur,
  onChange,
}: {
  options: { valeur: T; label: string }[];
  valeur: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.rangeeOptions}>
      {options.map((opt) => (
        <Pressable
          key={opt.valeur}
          style={[styles.option, valeur === opt.valeur && styles.optionActive]}
          onPress={() => onChange(opt.valeur)}
        >
          <Text style={[styles.texteOption, valeur === opt.valeur && styles.texteOptionActive]}>{opt.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function CreateScreen({ navigation }: Props) {
  const [etape, setEtape] = useState(0);

  // Étape 1 — Histoire (panneau Contexte de l'Histoire, brief Phase 2)
  const [lieu, setLieu] = useState('');
  const [ambiance, setAmbiance] = useState('');
  const [dateChronique, setDateChronique] = useState('');
  const [objectifs, setObjectifs] = useState('');

  // Étape 2 — Personnage
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');

  // Étape 3 — Point de départ
  const [pointDeDepart, setPointDeDepart] = useState('');

  // Étape 4 — Préférences
  const [creativite, setCreativite] = useState<Creativite>('moyenne');
  const [longueur, setLongueur] = useState<Longueur>('moyenne');
  const [violence, setViolence] = useState<NiveauCurseur>('modere');
  const [romance, setRomance] = useState<NiveauCurseur>('modere');

  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState('');

  const etapeValide = [
    lieu.trim().length > 0 && ambiance.trim().length > 0,
    nom.trim().length > 0 && description.trim().length > 0,
    pointDeDepart.trim().length > 0,
    true,
    true,
  ][etape];

  function suivant() {
    if (!etapeValide) return;
    setEtape((e) => Math.min(e + 1, ETAPES.length - 1));
  }

  function precedent() {
    setEtape((e) => Math.max(e - 1, 0));
  }

  async function valider() {
    if (enregistrement) return;
    setEnregistrement(true);
    setErreur('');
    try {
      const histoire = creerNouvelleHistoire({
        personnageNom: nom.trim(),
        personnageDescription: description.trim(),
        pointDeDepart: pointDeDepart.trim(),
        contexte: {
          lieu: lieu.trim(),
          ambiance: ambiance.trim(),
          dateChronique: dateChronique.trim(),
          objectifs: objectifs.trim(),
        },
        settings: { creativite, longueur, violence, romance },
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
        <Text style={styles.etapeIndicateur}>
          Étape {etape + 1}/{ETAPES.length} — {ETAPES[etape]}
        </Text>
        <View style={styles.barreProgression}>
          {ETAPES.map((_, i) => (
            <View key={i} style={[styles.segmentProgression, i <= etape && styles.segmentProgressionActif]} />
          ))}
        </View>

        {etape === 0 && (
          <>
            <Text style={styles.titre}>Histoire</Text>
            <Text style={styles.label}>Lieu de départ</Text>
            <TextInput
              style={styles.champ}
              value={lieu}
              onChangeText={setLieu}
              placeholder="Ex : Paris, royaume humain"
              placeholderTextColor={couleurs.texteAtténué}
            />
            <Text style={styles.label}>Ambiance</Text>
            <TextInput
              style={[styles.champ, styles.champMultiligne]}
              value={ambiance}
              onChangeText={setAmbiance}
              placeholder="Le ton, l'atmosphère recherchée pour cette histoire"
              placeholderTextColor={couleurs.texteAtténué}
              multiline
            />
            <Text style={styles.label}>Date / période (optionnel)</Text>
            <TextInput
              style={styles.champ}
              value={dateChronique}
              onChangeText={setDateChronique}
              placeholder="Ex : début de saison des pluies"
              placeholderTextColor={couleurs.texteAtténué}
            />
            <Text style={styles.label}>Objectifs (optionnel)</Text>
            <TextInput
              style={[styles.champ, styles.champMultiligne]}
              value={objectifs}
              onChangeText={setObjectifs}
              placeholder="Ce que le personnage cherche à accomplir, en quelques phrases"
              placeholderTextColor={couleurs.texteAtténué}
              multiline
            />
          </>
        )}

        {etape === 1 && (
          <>
            <Text style={styles.titre}>Personnage</Text>
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
          </>
        )}

        {etape === 2 && (
          <>
            <Text style={styles.titre}>Point de départ</Text>
            <Text style={styles.label}>En une phrase</Text>
            <TextInput
              style={styles.champ}
              value={pointDeDepart}
              onChangeText={setPointDeDepart}
              placeholder="Ex : Elle arrive aux portes d'Elyndor à la nuit tombée."
              placeholderTextColor={couleurs.texteAtténué}
            />
          </>
        )}

        {etape === 3 && (
          <>
            <Text style={styles.titre}>Préférences</Text>
            <Text style={styles.label}>Créativité</Text>
            <RangeeOptions options={OPTIONS_CREATIVITE} valeur={creativite} onChange={setCreativite} />
            <Text style={styles.label}>Longueur de réponse</Text>
            <RangeeOptions options={OPTIONS_LONGUEUR} valeur={longueur} onChange={setLongueur} />
            <Text style={styles.label}>Violence</Text>
            <RangeeOptions options={OPTIONS_CURSEUR} valeur={violence} onChange={setViolence} />
            <Text style={styles.label}>Romance</Text>
            <RangeeOptions options={OPTIONS_CURSEUR} valeur={romance} onChange={setRomance} />
            <Text style={styles.aide}>
              Ces curseurs sont plafonnés par le profil de contenu de l'appareil (Réglages) s'il est configuré en
              Grand public.
            </Text>
          </>
        )}

        {etape === 4 && (
          <>
            <Text style={styles.titre}>Récapitulatif</Text>
            <View style={styles.recapBloc}>
              <Text style={styles.recapLabel}>Histoire</Text>
              <Text style={styles.recapTexte}>{lieu} — {ambiance}</Text>
              {dateChronique ? <Text style={styles.recapTexte}>{dateChronique}</Text> : null}
              {objectifs ? <Text style={styles.recapTexte}>{objectifs}</Text> : null}
            </View>
            <View style={styles.recapBloc}>
              <Text style={styles.recapLabel}>Personnage</Text>
              <Text style={styles.recapTexte}>{nom}</Text>
              <Text style={styles.recapTexte}>{description}</Text>
            </View>
            <View style={styles.recapBloc}>
              <Text style={styles.recapLabel}>Point de départ</Text>
              <Text style={styles.recapTexte}>{pointDeDepart}</Text>
            </View>
            <View style={styles.recapBloc}>
              <Text style={styles.recapLabel}>Préférences</Text>
              <Text style={styles.recapTexte}>
                Créativité {OPTIONS_CREATIVITE.find((o) => o.valeur === creativite)?.label} · Longueur{' '}
                {OPTIONS_LONGUEUR.find((o) => o.valeur === longueur)?.label} · Violence{' '}
                {OPTIONS_CURSEUR.find((o) => o.valeur === violence)?.label} · Romance{' '}
                {OPTIONS_CURSEUR.find((o) => o.valeur === romance)?.label}
              </Text>
            </View>
          </>
        )}

        {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

        <View style={styles.rangeeNavigation}>
          {etape > 0 && (
            <Pressable style={styles.boutonSecondaire} onPress={precedent}>
              <Text style={styles.texteBoutonSecondaire}>Précédent</Text>
            </Pressable>
          )}
          {etape < ETAPES.length - 1 ? (
            <Pressable
              style={[styles.boutonPrincipal, !etapeValide && styles.boutonDesactive]}
              onPress={suivant}
              disabled={!etapeValide}
            >
              <Text style={styles.texteBoutonPrincipal}>Suivant</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.boutonPrincipal} onPress={valider} disabled={enregistrement}>
              <Text style={styles.texteBoutonPrincipal}>{enregistrement ? 'Création…' : "Commencer l'histoire"}</Text>
            </Pressable>
          )}
        </View>
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
  etapeIndicateur: {
    color: couleurs.texteAtténué,
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: espacement.xs,
  },
  barreProgression: {
    flexDirection: 'row',
    gap: espacement.xs,
    marginBottom: espacement.lg,
  },
  segmentProgression: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: couleurs.bordure,
  },
  segmentProgressionActif: {
    backgroundColor: couleurs.accent,
  },
  titre: {
    color: couleurs.texte,
    fontFamily: polices.titre,
    fontSize: 22,
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
  aide: {
    color: couleurs.texteAtténué,
    fontSize: 12,
    marginTop: espacement.md,
  },
  recapBloc: {
    backgroundColor: couleurs.fondCarte,
    borderRadius: rayon.md,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    padding: espacement.md,
    marginBottom: espacement.sm,
  },
  recapLabel: {
    color: couleurs.accentClair,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: espacement.xs,
  },
  recapTexte: {
    color: couleurs.texte,
    fontSize: 14,
    lineHeight: 20,
  },
  erreur: {
    color: couleurs.danger,
    marginTop: espacement.md,
  },
  rangeeNavigation: {
    flexDirection: 'row',
    gap: espacement.sm,
    marginTop: espacement.lg,
    marginBottom: espacement.xl,
  },
  boutonPrincipal: {
    flex: 1,
    backgroundColor: couleurs.accent,
    borderRadius: rayon.md,
    paddingVertical: espacement.md,
    alignItems: 'center',
  },
  boutonDesactive: {
    opacity: 0.5,
  },
  texteBoutonPrincipal: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  boutonSecondaire: {
    flex: 1,
    borderRadius: rayon.md,
    paddingVertical: espacement.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: couleurs.bordure,
  },
  texteBoutonSecondaire: {
    color: couleurs.texte,
    fontSize: 16,
  },
});
