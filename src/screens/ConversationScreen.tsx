import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
import type { AppSettings, Message, StoryState } from '../types';
import { getSettings, getStory, saveStory } from '../storage/storage';
import { calculerDebugLore, genererTour, regenererDernierTour, type DebugLore } from '../engine/generateTurn';
import { creerBranche } from '../engine/story';
import { ErreurOpenRouter } from '../engine/openrouter';
import { ErreurEmbeddings } from '../engine/embeddings';
import { couleurs, espacement, rayon } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Conversation'>;

function messageErreur(e: unknown, messageParDefaut: string): string {
  if (e instanceof ErreurOpenRouter || e instanceof ErreurEmbeddings) return e.message;
  return messageParDefaut;
}

export default function ConversationScreen({ route, navigation }: Props) {
  const { storyId } = route.params;
  const [story, setStory] = useState<StoryState | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [saisie, setSaisie] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [debugLore, setDebugLore] = useState<DebugLore | null>(null);
  const [debugOuvert, setDebugOuvert] = useState(false);
  const listeRef = useRef<FlatList<Message>>(null);

  // Panneau "Contexte de l'Histoire" (brief Phase 2) : lieu, date, ambiance,
  // objectifs en prose, consultable et modifiable en cours de partie.
  const [modalContexteOuvert, setModalContexteOuvert] = useState(false);
  const [lieuEdit, setLieuEdit] = useState('');
  const [ambianceEdit, setAmbianceEdit] = useState('');
  const [dateEdit, setDateEdit] = useState('');
  const [objectifsEdit, setObjectifsEdit] = useState('');

  useEffect(() => {
    Promise.all([getStory(storyId), getSettings()]).then(([s, settings]) => {
      setStory(s);
      setAppSettings(settings);
    });
  }, [storyId]);

  // Branches de conversation (brief Phase 2) : bouton d'en-tête pour créer
  // une copie indépendante de l'histoire à partir de son état courant.
  const creerBrancheIci = useCallback(async () => {
    if (!story) return;
    const branche = creerBranche(story);
    await saveStory(branche);
    navigation.navigate('Conversation', { storyId: branche.meta.id });
  }, [story, navigation]);

  useEffect(() => {
    if (story) {
      navigation.setOptions({
        title: story.meta.personnageNom,
        headerRight: () => (
          <Pressable onPress={creerBrancheIci} hitSlop={8} style={{ paddingHorizontal: espacement.xs }}>
            <Text style={{ color: couleurs.accentClair, fontSize: 13 }}>Brancher</Text>
          </Pressable>
        ),
      });
    }
  }, [story?.meta.personnageNom, creerBrancheIci]);

  // TODO(debug): recalcule le panneau de debug pour le dernier message
  // joueur dès qu'une histoire est ouverte, pas seulement après un envoi —
  // sinon rouvrir une conversation existante n'affiche jamais rien.
  useEffect(() => {
    if (!story || !appSettings) return;
    const dernierMessageJoueur = [...story.messages].reverse().find((m) => m.role === 'user');
    if (dernierMessageJoueur) {
      calculerDebugLore(story, dernierMessageJoueur.content, appSettings)
        .then(setDebugLore)
        .catch(() => {});
    }
  }, [story, appSettings]);

  const clefManquante = appSettings && !appSettings.openRouterApiKey;
  const profilNonDeclare = appSettings && !appSettings.profilContenu;

  const envoyer = useCallback(async () => {
    const texte = saisie.trim();
    if (!texte || !story || !appSettings || enCours) return;

    if (!appSettings.openRouterApiKey) {
      setErreur('Configure ta clé API OpenRouter dans Réglages avant de commencer.');
      return;
    }
    if (!appSettings.profilContenu) {
      setErreur('Déclare un profil de contenu (Grand public / Adulte) dans Réglages avant de commencer.');
      return;
    }

    setEnCours(true);
    setErreur('');
    setSaisie('');
    // TODO(debug): calculée en parallèle de l'appel API pour rester visible
    // même si la génération échoue ensuite (non bloquant : meilleur effort).
    calculerDebugLore(story, texte, appSettings).then(setDebugLore).catch(() => {});
    try {
      const { story: storyMaj, debugLore: debugMaj } = await genererTour(story, appSettings, texte);
      setStory(storyMaj);
      setDebugLore(debugMaj);
      await saveStory(storyMaj);
      setTimeout(() => listeRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      setSaisie(texte);
      setErreur(messageErreur(e, 'Une erreur est survenue. Réessaie.'));
    } finally {
      setEnCours(false);
    }
  }, [saisie, story, appSettings, enCours]);

  const regenerer = useCallback(async () => {
    if (!story || !appSettings || enCours) return;
    setEnCours(true);
    setErreur('');
    try {
      const { story: storyMaj, debugLore: debugMaj } = await regenererDernierTour(story, appSettings);
      setStory(storyMaj);
      setDebugLore(debugMaj);
      await saveStory(storyMaj);
    } catch (e) {
      setErreur(messageErreur(e, 'Impossible de régénérer cette réponse.'));
    } finally {
      setEnCours(false);
    }
  }, [story, appSettings, enCours]);

  function ouvrirContexte() {
    if (!story) return;
    setLieuEdit(story.meta.contexte.lieu);
    setAmbianceEdit(story.meta.contexte.ambiance);
    setDateEdit(story.meta.contexte.dateChronique);
    setObjectifsEdit(story.meta.contexte.objectifs);
    setModalContexteOuvert(true);
  }

  async function enregistrerContexte() {
    if (!story) return;
    const storyMaj: StoryState = {
      ...story,
      meta: {
        ...story.meta,
        contexte: {
          lieu: lieuEdit.trim(),
          ambiance: ambianceEdit.trim(),
          dateChronique: dateEdit.trim(),
          objectifs: objectifsEdit.trim(),
        },
      },
    };
    setStory(storyMaj);
    await saveStory(storyMaj);
    setModalContexteOuvert(false);
  }

  if (!story || !appSettings) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator color={couleurs.accent} />
      </View>
    );
  }

  const dernierEstAssistant = story.messages[story.messages.length - 1]?.role === 'assistant';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: couleurs.fond }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.container}>
        {clefManquante && (
          <Pressable style={styles.bandeauAlerte} onPress={() => navigation.navigate('Reglages')}>
            <Text style={styles.texteBandeau}>Aucune clé API configurée — appuie ici pour aller dans Réglages.</Text>
          </Pressable>
        )}
        {profilNonDeclare && (
          <Pressable style={styles.bandeauAlerte} onPress={() => navigation.navigate('Reglages')}>
            <Text style={styles.texteBandeau}>Profil de contenu non déclaré — appuie ici pour aller dans Réglages.</Text>
          </Pressable>
        )}

        <Pressable style={styles.bandeauContexte} onPress={ouvrirContexte}>
          <Text style={styles.texteBandeauContexte} numberOfLines={1}>
            📍 {story.meta.contexte.lieu || 'Contexte de l’histoire'}
            {story.meta.contexte.ambiance ? ` — ${story.meta.contexte.ambiance}` : ''}
          </Text>
        </Pressable>
        {story.meta.brancheDeId && (
          <View style={styles.bandeauBranche}>
            <Text style={styles.texteBandeauBranche}>
              🌿 Branche créée au message {story.meta.pointDeBranchement ?? '?'}
            </Text>
          </View>
        )}

        {story.messages.length === 0 ? (
          <View style={styles.centreVide}>
            <Text style={styles.pointDeDepart}>{story.meta.pointDeDepart}</Text>
            <Text style={styles.aideVide}>Écris ta première action ou réplique pour commencer.</Text>
          </View>
        ) : (
          <FlatList
            ref={listeRef}
            data={story.messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: espacement.md, gap: espacement.sm }}
            onContentSizeChange={() => listeRef.current?.scrollToEnd({ animated: false })}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.bulle,
                  item.role === 'user' ? styles.bulleJoueur : styles.bulleNarrateur,
                ]}
              >
                <Text style={styles.texteBulle}>{item.content}</Text>
              </View>
            )}
          />
        )}

        {debugLore && (
          <Pressable style={styles.boutonDebug} onPress={() => setDebugOuvert((v) => !v)}>
            <Text style={styles.texteBoutonDebug}>
              {debugOuvert ? '▾' : '▸'} Debug lore ({debugLore.metamoteurs.length} métamoteurs,{' '}
              {debugLore.loreElyndor.length} entrées Elyndor)
            </Text>
          </Pressable>
        )}
        {debugOuvert && debugLore && (
          <ScrollView style={styles.panneauDebug}>
            <Text style={styles.titreDebug}>Métamoteurs sélectionnés</Text>
            {debugLore.metamoteurs.map((titre) => (
              <Text key={titre} style={styles.ligneDebug}>
                • {titre}
              </Text>
            ))}
            <Text style={[styles.titreDebug, { marginTop: espacement.sm }]}>Lore Elyndor sélectionné</Text>
            {debugLore.loreElyndor.map((titre) => (
              <Text key={titre} style={styles.ligneDebug}>
                • {titre}
              </Text>
            ))}
          </ScrollView>
        )}

        {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

        <View style={styles.zoneSaisie}>
          {dernierEstAssistant && (
            <Pressable style={styles.boutonRegenerer} onPress={regenerer} disabled={enCours}>
              <Text style={styles.texteBoutonRegenerer}>Régénérer</Text>
            </Pressable>
          )}
          <View style={styles.rangeeSaisie}>
            <TextInput
              style={styles.champSaisie}
              value={saisie}
              onChangeText={setSaisie}
              placeholder="Ton action ou ta réplique…"
              placeholderTextColor={couleurs.texteAtténué}
              multiline
              editable={!enCours}
            />
            <Pressable
              style={[styles.boutonEnvoyer, (enCours || !saisie.trim()) && styles.boutonDesactive]}
              onPress={envoyer}
              disabled={enCours || !saisie.trim()}
            >
              {enCours ? <ActivityIndicator color="#fff" /> : <Text style={styles.texteEnvoyer}>Envoyer</Text>}
            </Pressable>
          </View>
        </View>
      </View>

      <Modal visible={modalContexteOuvert} animationType="slide" onRequestClose={() => setModalContexteOuvert(false)}>
        <ScrollView style={styles.modalContainer} contentContainerStyle={{ paddingBottom: espacement.xl }}>
          <Text style={styles.titreModal}>Contexte de l'histoire</Text>

          <Text style={styles.labelModal}>Lieu</Text>
          <TextInput
            style={styles.champModal}
            value={lieuEdit}
            onChangeText={setLieuEdit}
            placeholderTextColor={couleurs.texteAtténué}
          />

          <Text style={styles.labelModal}>Ambiance</Text>
          <TextInput
            style={[styles.champModal, styles.champModalMultiligne]}
            value={ambianceEdit}
            onChangeText={setAmbianceEdit}
            multiline
            placeholderTextColor={couleurs.texteAtténué}
          />

          <Text style={styles.labelModal}>Date / période</Text>
          <TextInput
            style={styles.champModal}
            value={dateEdit}
            onChangeText={setDateEdit}
            placeholderTextColor={couleurs.texteAtténué}
          />

          <Text style={styles.labelModal}>Objectifs</Text>
          <TextInput
            style={[styles.champModal, styles.champModalMultiligne]}
            value={objectifsEdit}
            onChangeText={setObjectifsEdit}
            multiline
            placeholderTextColor={couleurs.texteAtténué}
          />

          <Pressable style={styles.boutonEnvoyer} onPress={enregistrerContexte}>
            <Text style={styles.texteEnvoyer}>Enregistrer</Text>
          </Pressable>
          <Pressable style={styles.boutonRegenerer} onPress={() => setModalContexteOuvert(false)}>
            <Text style={styles.texteBoutonRegenerer}>Fermer sans enregistrer</Text>
          </Pressable>
        </ScrollView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: couleurs.fond,
  },
  centreVide: {
    flex: 1,
    justifyContent: 'center',
    padding: espacement.lg,
  },
  pointDeDepart: {
    color: couleurs.texte,
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  aideVide: {
    color: couleurs.texteAtténué,
    fontSize: 13,
    textAlign: 'center',
    marginTop: espacement.sm,
  },
  bulle: {
    maxWidth: '85%',
    borderRadius: rayon.md,
    paddingHorizontal: espacement.sm,
    paddingVertical: espacement.sm,
  },
  bulleJoueur: {
    backgroundColor: couleurs.bulleJoueur,
    alignSelf: 'flex-end',
  },
  bulleNarrateur: {
    backgroundColor: couleurs.bulleNarrateur,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: couleurs.bordure,
  },
  texteBulle: {
    color: couleurs.texte,
    fontSize: 15,
    lineHeight: 21,
  },
  erreur: {
    color: couleurs.danger,
    paddingHorizontal: espacement.md,
    paddingBottom: espacement.xs,
  },
  boutonDebug: {
    paddingHorizontal: espacement.md,
    paddingVertical: espacement.xs,
    backgroundColor: couleurs.fondCarte,
    borderTopWidth: 1,
    borderTopColor: couleurs.bordure,
  },
  texteBoutonDebug: {
    color: couleurs.texteAtténué,
    fontSize: 12,
  },
  panneauDebug: {
    maxHeight: 180,
    backgroundColor: couleurs.fondCarte,
    paddingHorizontal: espacement.md,
    paddingBottom: espacement.sm,
  },
  titreDebug: {
    color: couleurs.accent,
    fontSize: 12,
    fontWeight: '700',
    marginTop: espacement.xs,
  },
  ligneDebug: {
    color: couleurs.texteAtténué,
    fontSize: 12,
    lineHeight: 18,
  },
  bandeauContexte: {
    paddingHorizontal: espacement.md,
    paddingVertical: espacement.xs,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bordure,
  },
  texteBandeauContexte: {
    color: couleurs.accentClair,
    fontSize: 12,
  },
  bandeauBranche: {
    paddingHorizontal: espacement.md,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bordure,
  },
  texteBandeauBranche: {
    color: couleurs.texteAtténué,
    fontSize: 11,
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: couleurs.fond,
    padding: espacement.lg,
    paddingTop: espacement.xl,
  },
  titreModal: {
    color: couleurs.texte,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: espacement.md,
  },
  labelModal: {
    color: couleurs.texteAtténué,
    fontSize: 13,
    marginTop: espacement.md,
    marginBottom: espacement.xs,
  },
  champModal: {
    backgroundColor: couleurs.fondChampSaisie,
    borderRadius: rayon.sm,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    color: couleurs.texte,
    paddingHorizontal: espacement.sm,
    paddingVertical: espacement.sm,
    fontSize: 15,
  },
  champModalMultiligne: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  bandeauAlerte: {
    backgroundColor: '#3a2a1f',
    padding: espacement.sm,
  },
  texteBandeau: {
    color: '#ffd08a',
    fontSize: 12,
    textAlign: 'center',
  },
  zoneSaisie: {
    borderTopWidth: 1,
    borderTopColor: couleurs.bordure,
    padding: espacement.sm,
  },
  boutonRegenerer: {
    alignSelf: 'flex-start',
    paddingVertical: espacement.xs,
    paddingHorizontal: espacement.sm,
    borderRadius: rayon.sm,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    marginBottom: espacement.xs,
  },
  texteBoutonRegenerer: {
    color: couleurs.texteAtténué,
    fontSize: 12,
  },
  rangeeSaisie: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: espacement.sm,
  },
  champSaisie: {
    flex: 1,
    backgroundColor: couleurs.fondChampSaisie,
    borderRadius: rayon.md,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    color: couleurs.texte,
    paddingHorizontal: espacement.sm,
    paddingVertical: espacement.sm,
    fontSize: 15,
    maxHeight: 120,
  },
  boutonEnvoyer: {
    backgroundColor: couleurs.accent,
    borderRadius: rayon.md,
    paddingHorizontal: espacement.md,
    paddingVertical: espacement.sm,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 84,
  },
  boutonDesactive: {
    opacity: 0.5,
  },
  texteEnvoyer: {
    color: '#fff',
    fontWeight: '600',
  },
});
