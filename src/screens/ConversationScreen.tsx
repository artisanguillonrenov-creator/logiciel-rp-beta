import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { AppSettings, Message, StoryState } from '../types';
import { getSettings, getStory, saveStory } from '../storage/storage';
import { genererTour, regenererDernierTour } from '../engine/generateTurn';
import { ErreurOpenRouter } from '../engine/openrouter';
import { couleurs, espacement, rayon } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Conversation'>;

export default function ConversationScreen({ route, navigation }: Props) {
  const { storyId } = route.params;
  const [story, setStory] = useState<StoryState | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [saisie, setSaisie] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const listeRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    Promise.all([getStory(storyId), getSettings()]).then(([s, settings]) => {
      setStory(s);
      setAppSettings(settings);
    });
  }, [storyId]);

  useEffect(() => {
    if (story) {
      navigation.setOptions({ title: story.meta.personnageNom });
    }
  }, [story?.meta.personnageNom]);

  const clefManquante = appSettings && !appSettings.openRouterApiKey;

  const envoyer = useCallback(async () => {
    const texte = saisie.trim();
    if (!texte || !story || !appSettings || enCours) return;

    if (!appSettings.openRouterApiKey) {
      setErreur('Configure ta clé API OpenRouter dans Réglages avant de commencer.');
      return;
    }

    setEnCours(true);
    setErreur('');
    setSaisie('');
    try {
      const { story: storyMaj } = await genererTour(story, appSettings, texte);
      setStory(storyMaj);
      await saveStory(storyMaj);
      setTimeout(() => listeRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      setSaisie(texte);
      setErreur(e instanceof ErreurOpenRouter ? e.message : 'Une erreur est survenue. Réessaie.');
    } finally {
      setEnCours(false);
    }
  }, [saisie, story, appSettings, enCours]);

  const regenerer = useCallback(async () => {
    if (!story || !appSettings || enCours) return;
    setEnCours(true);
    setErreur('');
    try {
      const { story: storyMaj } = await regenererDernierTour(story, appSettings);
      setStory(storyMaj);
      await saveStory(storyMaj);
    } catch (e) {
      setErreur(e instanceof ErreurOpenRouter ? e.message : 'Impossible de régénérer cette réponse.');
    } finally {
      setEnCours(false);
    }
  }, [story, appSettings, enCours]);

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
