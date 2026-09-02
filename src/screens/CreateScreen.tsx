import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Image,
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
import { MONDES } from '../data/mondes';
import { creerNouvelleHistoire } from '../engine/story';
import { getPersonas, saveStory, savePersona } from '../storage/storage';
import { couleurs, espacement, ombresLueur, polices, stylePetitesCapitales } from '../theme/theme';
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

// Carte sélectionnable d'un monde, dans la liste de gauche de l'étape
// "Choisir l'histoire" — un seul monde pour l'instant (Elyndor) mais le
// composant est prévu pour une liste qui grandira plus tard.
function CarteMonde({ monde, selectionne, onPress }: { monde: (typeof MONDES)[number]; selectionne: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.carteMonde, selectionne && styles.carteMondeActive]}>
      <Image source={monde.image} style={styles.imageCarteMonde} resizeMode="cover" />
      <View style={styles.infoCarteMonde}>
        <Text style={styles.nomMonde}>{monde.nom}</Text>
        <Text style={styles.genreMonde}>{monde.genre}</Text>
      </View>
    </Pressable>
  );
}

export default function CreateScreen({ navigation }: Props) {
  const [etape, setEtape] = useState(0);

  // Étape 1 — Histoire (choix du monde + panneau Contexte de l'Histoire,
  // brief Phase 2)
  const [mondeSelectionne, setMondeSelectionne] = useState(MONDES[0]?.id ?? '');
  const [lieu, setLieu] = useState('');

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

  const mondeActif = MONDES.find((m) => m.id === mondeSelectionne);

  const etapeValide = [
    lieu.trim().length > 0,
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
          // Ambiance/date/objectifs ne sont plus saisis à la création — le
          // monde choisi porte déjà son ton (genre, description, tags) ;
          // ces champs restent éditables ensuite depuis le panneau Contexte
          // de l'Histoire, en conversation.
          ambiance: mondeActif?.genre ?? '',
          dateChronique: '',
          objectifs: '',
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
            <Text style={styles.titre}>Choisir l'histoire</Text>

            <Text style={styles.label}>Monde</Text>
            <View style={styles.rangeeChoixMonde}>
              <View style={styles.listeMondes}>
                {MONDES.map((monde) => (
                  <CarteMonde
                    key={monde.id}
                    monde={monde}
                    selectionne={monde.id === mondeSelectionne}
                    onPress={() => setMondeSelectionne(monde.id)}
                  />
                ))}
              </View>

              {mondeActif && (
                <Panneau style={styles.presentationMonde}>
                  <Text style={styles.labelPresentation}>Présentation</Text>
                  <Separateur style={{ width: 60, marginTop: espacement.xs, marginBottom: espacement.md, alignSelf: 'center' }} />
                  <Image source={mondeActif.image} style={styles.imagePresentationMonde} resizeMode="cover" />
                  <Text style={styles.descriptionMonde}>{mondeActif.description}</Text>
                  <View style={styles.rangeeTagsMonde}>
                    {mondeActif.tags.map((tag) => (
                      <View key={tag} style={styles.tagMonde}>
                        <Text style={styles.texteTagMonde}>{tag.toUpperCase()}</Text>
                      </View>
                    ))}
                  </View>
                </Panneau>
              )}
            </View>

            <Separateur style={{ marginVertical: espacement.lg }} />

            <Champ label="Lieu de départ" value={lieu} onChangeText={setLieu} placeholder="Ex : Paris, royaume humain" conteneurStyle={styles.champConteneur} />
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
              <Text style={styles.recapTexte}>{mondeActif?.nom} — {lieu}</Text>
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
  rangeeChoixMonde: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: espacement.md,
  },
  listeMondes: {
    flex: 1,
    gap: espacement.sm,
  },
  carteMonde: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: couleurs.bordure,
    backgroundColor: 'rgba(10, 13, 26, 0.55)',
    overflow: 'hidden',
  },
  carteMondeActive: {
    borderColor: couleurs.accent,
    ...ombresLueur,
  },
  imageCarteMonde: {
    width: 96,
    height: 76,
  },
  infoCarteMonde: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: espacement.sm,
  },
  nomMonde: {
    color: couleurs.texte,
    fontFamily: polices.titre,
    fontSize: 18,
  },
  genreMonde: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 13,
    marginTop: 2,
  },
  presentationMonde: {
    flex: 1.4,
  },
  labelPresentation: {
    ...stylePetitesCapitales,
    color: couleurs.dore,
    fontSize: 13,
    textAlign: 'center',
  },
  imagePresentationMonde: {
    width: '100%',
    height: 140,
    marginBottom: espacement.sm,
  },
  descriptionMonde: {
    color: couleurs.texte,
    fontFamily: polices.corps,
    fontSize: 15,
    lineHeight: 21,
  },
  rangeeTagsMonde: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacement.xs,
    marginTop: espacement.sm,
  },
  tagMonde: {
    borderWidth: 1,
    borderColor: couleurs.bordure,
    paddingHorizontal: espacement.sm,
    paddingVertical: 4,
  },
  texteTagMonde: {
    ...stylePetitesCapitales,
    color: couleurs.texteAtténué,
    fontSize: 10,
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
