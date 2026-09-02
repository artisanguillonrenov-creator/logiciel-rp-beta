import React, { useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Creativite, Longueur, NiveauCurseur, Persona } from '../types';
import { creerNouvelleHistoire } from '../engine/story';
import { getPersonas, saveStory, savePersona } from '../storage/storage';
import { couleurs, espacement, polices, stylePetitesCapitales } from '../theme/theme';
import Bouton from '../components/Bouton';
import Champ from '../components/Champ';
import FondAtmospherique from '../components/FondAtmospherique';
import IndicateurEtapes from '../components/IndicateurEtapes';
import Panneau from '../components/Panneau';
import Separateur from '../components/Separateur';

// Une illustration par étape (brief Phase 2) — la dernière (Récapitulatif)
// reprend celle de l'accueil pour boucler le parcours visuellement.
const IMAGES_ETAPES = [
  require('../../assets/scenes/creation-histoire.png'),
  require('../../assets/scenes/creation-personnage.png'),
  require('../../assets/scenes/creation-point-depart.png'),
  require('../../assets/scenes/creation-preferences.png'),
  require('../../assets/scenes/accueil.png'),
];

function genererIdPersona(): string {
  return `persona-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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

const OPTIONS_SEXE: { valeur: string; label: string }[] = [
  { valeur: 'Homme', label: 'Homme' },
  { valeur: 'Femme', label: 'Femme' },
  { valeur: 'Autre', label: 'Autre' },
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
  const [sexe, setSexe] = useState('');
  const [raceOrigine, setRaceOrigine] = useState('');
  const [age, setAge] = useState('');
  const [apparence, setApparence] = useState('');
  const [description, setDescription] = useState('');

  // Bibliothèque de personas (brief Phase 2) : réutiliser {{user}} d'une
  // histoire à l'autre sans ressaisir nom/description à chaque fois.
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [modalPersonasOuvert, setModalPersonasOuvert] = useState(false);
  const [messagePersona, setMessagePersona] = useState('');

  useEffect(() => {
    getPersonas().then(setPersonas);
  }, []);

  function choisirPersona(persona: Persona) {
    setNom(persona.nom);
    setDescription(persona.description);
    setSexe(persona.sexe ?? '');
    setRaceOrigine(persona.raceOrigine ?? '');
    setAge(persona.age ?? '');
    setApparence(persona.apparence ?? '');
    setModalPersonasOuvert(false);
  }

  async function enregistrerPersonaDansBibliotheque() {
    if (!nom.trim() || !description.trim()) return;
    const persona: Persona = {
      id: genererIdPersona(),
      nom: nom.trim(),
      description: description.trim(),
      sexe: sexe || undefined,
      raceOrigine: raceOrigine.trim() || undefined,
      age: age.trim() || undefined,
      apparence: apparence.trim() || undefined,
      createdAt: Date.now(),
    };
    await savePersona(persona);
    setPersonas((prev) => [...prev, persona]);
    setMessagePersona('Personnage enregistré dans la bibliothèque.');
  }

  // Compose la description finale envoyée au moteur : les champs structurés
  // (sexe, race/origine, âge, apparence) en tête, suivis de la description
  // libre — personnageDescription reste un simple texte côté moteur (prompt,
  // validateur, suggestions…), donc pas besoin d'y toucher pour ce nouveau
  // niveau de détail.
  function composerDescriptionPersonnage(): string {
    const lignes: string[] = [];
    if (sexe) lignes.push(`Sexe : ${sexe}`);
    if (raceOrigine.trim()) lignes.push(`Race / origine : ${raceOrigine.trim()}`);
    if (age.trim()) lignes.push(`Âge : ${age.trim()}`);
    if (apparence.trim()) lignes.push(`Apparence : ${apparence.trim()}`);
    if (description.trim()) lignes.push(description.trim());
    return lignes.join('\n');
  }

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
        personnageDescription: composerDescriptionPersonnage(),
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
    <FondAtmospherique style={{ flex: 1 }} densiteEtoiles="discrete" imageFond={IMAGES_ETAPES[etape]}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.etapeIndicateur}>{ETAPES[etape]}</Text>
        <IndicateurEtapes total={ETAPES.length} actif={etape} />
        <Separateur style={{ marginBottom: espacement.lg }} />

        {etape === 0 && (
          <>
            <Text style={styles.titre}>Histoire</Text>
            <Champ label="Lieu de départ" value={lieu} onChangeText={setLieu} placeholder="Ex : Paris, royaume humain" conteneurStyle={styles.champConteneur} />
            <Champ
              label="Ambiance"
              value={ambiance}
              onChangeText={setAmbiance}
              placeholder="Le ton, l'atmosphère recherchée pour cette histoire"
              multiligne
              conteneurStyle={styles.champConteneur}
            />
            <Champ
              label="Date / période (optionnel)"
              value={dateChronique}
              onChangeText={setDateChronique}
              placeholder="Ex : début de saison des pluies"
              conteneurStyle={styles.champConteneur}
            />
            <Champ
              label="Objectifs (optionnel)"
              value={objectifs}
              onChangeText={setObjectifs}
              placeholder="Ce que le personnage cherche à accomplir, en quelques phrases"
              multiligne
              conteneurStyle={styles.champConteneur}
            />
          </>
        )}

        {etape === 1 && (
          <>
            <Text style={styles.titre}>Personnage</Text>
            {personas.length > 0 && (
              <Bouton
                titre="Choisir depuis la bibliothèque"
                variante="secondaire"
                onPress={() => setModalPersonasOuvert(true)}
                style={styles.boutonAction}
              />
            )}
            <Champ
              label="Nom du personnage"
              value={nom}
              onChangeText={(v) => {
                setNom(v);
                setMessagePersona('');
              }}
              placeholder="Ex : Aelis Corvenn"
              conteneurStyle={styles.champConteneur}
            />

            <Text style={styles.label}>Sexe</Text>
            <RangeeOptions options={OPTIONS_SEXE} valeur={sexe} onChange={setSexe} />

            <Champ
              label="Race / origine"
              value={raceOrigine}
              onChangeText={setRaceOrigine}
              placeholder="Ex : Humain, Elfe des bois, Née en exil…"
              conteneurStyle={styles.champConteneur}
            />
            <Champ
              label="Âge"
              value={age}
              onChangeText={setAge}
              placeholder="Ex : 29"
              keyboardType="number-pad"
              conteneurStyle={styles.champConteneur}
            />
            <Champ
              label="Apparence"
              value={apparence}
              onChangeText={setApparence}
              placeholder="Silhouette, visage, tenue, signes distinctifs…"
              multiligne
              conteneurStyle={styles.champConteneur}
            />
            <Champ
              label="Description"
              value={description}
              onChangeText={(v) => {
                setDescription(v);
                setMessagePersona('');
              }}
              placeholder="Personnalité, passé, ce qui le pousse à avancer…"
              multiligne
              conteneurStyle={styles.champConteneur}
            />
            <Bouton
              titre="Enregistrer dans la bibliothèque"
              variante="secondaire"
              onPress={enregistrerPersonaDansBibliotheque}
              desactive={!nom.trim() || !description.trim()}
              style={styles.boutonAction}
            />
            {messagePersona ? <Text style={styles.aide}>{messagePersona}</Text> : null}
          </>
        )}

        {etape === 2 && (
          <>
            <Text style={styles.titre}>Point de départ</Text>
            <Champ
              label="En une phrase"
              value={pointDeDepart}
              onChangeText={setPointDeDepart}
              placeholder="Ex : Elle arrive aux portes d'Elyndor à la nuit tombée."
              conteneurStyle={styles.champConteneur}
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
            <Panneau style={styles.recapBloc}>
              <Text style={styles.recapLabel}>Histoire</Text>
              <Text style={styles.recapTexte}>{lieu} — {ambiance}</Text>
              {dateChronique ? <Text style={styles.recapTexte}>{dateChronique}</Text> : null}
              {objectifs ? <Text style={styles.recapTexte}>{objectifs}</Text> : null}
            </Panneau>
            <Panneau style={styles.recapBloc}>
              <Text style={styles.recapLabel}>Personnage</Text>
              <Text style={styles.recapTexte}>{nom}</Text>
              {(sexe || raceOrigine || age) ? (
                <Text style={styles.recapTexte}>
                  {[sexe, raceOrigine.trim(), age.trim() ? `${age.trim()} ans` : ''].filter(Boolean).join(' · ')}
                </Text>
              ) : null}
              {apparence.trim() ? <Text style={styles.recapTexte}>{apparence.trim()}</Text> : null}
              <Text style={styles.recapTexte}>{description}</Text>
            </Panneau>
            <Panneau style={styles.recapBloc}>
              <Text style={styles.recapLabel}>Point de départ</Text>
              <Text style={styles.recapTexte}>{pointDeDepart}</Text>
            </Panneau>
            <Panneau style={styles.recapBloc}>
              <Text style={styles.recapLabel}>Préférences</Text>
              <Text style={styles.recapTexte}>
                Créativité {OPTIONS_CREATIVITE.find((o) => o.valeur === creativite)?.label} · Longueur{' '}
                {OPTIONS_LONGUEUR.find((o) => o.valeur === longueur)?.label} · Violence{' '}
                {OPTIONS_CURSEUR.find((o) => o.valeur === violence)?.label} · Romance{' '}
                {OPTIONS_CURSEUR.find((o) => o.valeur === romance)?.label}
              </Text>
            </Panneau>
          </>
        )}

        {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

        <Separateur style={{ marginTop: espacement.lg, marginBottom: espacement.sm }} />
        <View style={styles.rangeeNavigation}>
          {etape > 0 && <Bouton titre="Précédent" variante="secondaire" onPress={precedent} style={{ flex: 1 }} />}
          {etape < ETAPES.length - 1 ? (
            <Bouton titre="Suivant" onPress={suivant} desactive={!etapeValide} style={{ flex: 1 }} />
          ) : (
            <Bouton
              titre={enregistrement ? 'Création…' : "Commencer l'histoire"}
              onPress={valider}
              desactive={enregistrement}
              style={{ flex: 1 }}
            />
          )}
        </View>
      </ScrollView>

      <Modal visible={modalPersonasOuvert} animationType="slide" onRequestClose={() => setModalPersonasOuvert(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.titre}>Bibliothèque de personnages</Text>
          <FlatList
            data={personas}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable style={styles.lignePersona} onPress={() => choisirPersona(item)}>
                <Text style={styles.nomPersona}>{item.nom}</Text>
                {(item.sexe || item.raceOrigine || item.age) ? (
                  <Text style={styles.descriptionPersona}>
                    {[item.sexe, item.raceOrigine, item.age ? `${item.age} ans` : ''].filter(Boolean).join(' · ')}
                  </Text>
                ) : null}
                <Text style={styles.descriptionPersona} numberOfLines={2}>
                  {item.description}
                </Text>
              </Pressable>
            )}
          />
          <Bouton titre="Fermer" variante="secondaire" onPress={() => setModalPersonasOuvert(false)} style={{ marginTop: espacement.md }} />
        </View>
      </Modal>
    </KeyboardAvoidingView>
    </FondAtmospherique>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: espacement.lg,
    paddingTop: espacement.xl,
  },
  etapeIndicateur: {
    ...stylePetitesCapitales,
    color: couleurs.accentClair,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: espacement.md,
  },
  titre: {
    color: couleurs.dore,
    fontFamily: polices.titre,
    fontSize: 24,
    marginBottom: espacement.md,
  },
  label: {
    ...stylePetitesCapitales,
    color: couleurs.texteAtténué,
    fontSize: 12,
    marginTop: espacement.md,
    marginBottom: espacement.xs,
  },
  champConteneur: {
    marginTop: espacement.md,
  },
  rangeeOptions: {
    flexDirection: 'row',
    gap: espacement.sm,
  },
  option: {
    flex: 1,
    paddingVertical: espacement.sm,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    alignItems: 'center',
  },
  optionActive: {
    borderColor: couleurs.accent,
    backgroundColor: 'rgba(90, 172, 255, 0.10)',
  },
  texteOption: {
    ...stylePetitesCapitales,
    color: couleurs.texteAtténué,
    fontSize: 12,
  },
  texteOptionActive: {
    color: couleurs.accentClair,
  },
  aide: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 13,
    marginTop: espacement.md,
  },
  boutonAction: {
    marginTop: espacement.md,
  },
  recapBloc: {
    marginBottom: espacement.sm,
  },
  recapLabel: {
    ...stylePetitesCapitales,
    color: couleurs.accentClair,
    fontSize: 12,
    marginBottom: espacement.xs,
  },
  recapTexte: {
    color: couleurs.texte,
    fontFamily: polices.corps,
    fontSize: 16,
    lineHeight: 22,
  },
  erreur: {
    color: couleurs.danger,
    fontFamily: polices.corps,
    marginTop: espacement.md,
  },
  rangeeNavigation: {
    flexDirection: 'row',
    gap: espacement.sm,
    marginBottom: espacement.xl,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: couleurs.fond,
    padding: espacement.lg,
    paddingTop: espacement.xl,
  },
  lignePersona: {
    paddingVertical: espacement.sm,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bordure,
  },
  nomPersona: {
    color: couleurs.texte,
    fontFamily: polices.titre,
    fontSize: 17,
  },
  descriptionPersona: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 14,
    marginTop: 2,
  },
});
