import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { AppSettings } from '../types';
import { getSettings, saveSettings } from '../storage/storage';
import { listerModeles, type ModeleOpenRouter } from '../engine/openrouter';
import { couleurs, espacement, rayon } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Reglages'>;

export default function SettingsScreen({ navigation }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [embeddingsApiKey, setEmbeddingsApiKey] = useState('');
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [messageStatut, setMessageStatut] = useState('');

  const [modalOuvert, setModalOuvert] = useState(false);
  const [modeles, setModeles] = useState<ModeleOpenRouter[]>([]);
  const [rechercheModele, setRechercheModele] = useState('');
  const [chargementModeles, setChargementModeles] = useState(false);
  const [erreurModeles, setErreurModeles] = useState('');

  useEffect(() => {
    getSettings().then((settings: AppSettings) => {
      setApiKey(settings.openRouterApiKey);
      setModel(settings.model);
      setEmbeddingsApiKey(settings.embeddingsApiKey ?? '');
      setChargement(false);
    });
  }, []);

  function ouvrirSelecteurModeles() {
    setModalOuvert(true);
    if (modeles.length === 0) {
      setChargementModeles(true);
      setErreurModeles('');
      listerModeles()
        .then(setModeles)
        .catch(() => setErreurModeles('Liste indisponible pour le moment. Tu peux saisir un identifiant de modèle manuellement.'))
        .finally(() => setChargementModeles(false));
    }
  }

  async function enregistrer() {
    setEnregistrement(true);
    setMessageStatut('');
    try {
      await saveSettings({
        openRouterApiKey: apiKey.trim(),
        model: model.trim(),
        embeddingsApiKey: embeddingsApiKey.trim() || undefined,
      });
      setMessageStatut('Réglages enregistrés.');
    } catch {
      setMessageStatut("Erreur lors de l'enregistrement.");
    } finally {
      setEnregistrement(false);
    }
  }

  const modelesFiltres = modeles.filter(
    (m) =>
      m.nom.toLowerCase().includes(rechercheModele.toLowerCase()) ||
      m.id.toLowerCase().includes(rechercheModele.toLowerCase()),
  );

  if (chargement) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator color={couleurs.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titre}>Réglages</Text>

      <Text style={styles.label}>Clé API OpenRouter</Text>
      <TextInput
        style={styles.champ}
        value={apiKey}
        onChangeText={setApiKey}
        placeholder="sk-or-v1-…"
        placeholderTextColor={couleurs.texteAtténué}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.aide}>
        Ta clé reste uniquement sur cet appareil (stockage local). Elle n'est jamais codée en dur ni transmise ailleurs
        qu'à OpenRouter.
      </Text>

      <Text style={styles.label}>Modèle</Text>
      <TextInput
        style={styles.champ}
        value={model}
        onChangeText={setModel}
        placeholder="ex : anthropic/claude-sonnet-4.5"
        placeholderTextColor={couleurs.texteAtténué}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable style={styles.boutonSecondaire} onPress={ouvrirSelecteurModeles}>
        <Text style={styles.texteBoutonSecondaire}>Choisir parmi les modèles OpenRouter</Text>
      </Pressable>

      <Text style={styles.label}>Clé API embeddings (secours, optionnelle)</Text>
      <TextInput
        style={styles.champ}
        value={embeddingsApiKey}
        onChangeText={setEmbeddingsApiKey}
        placeholder="sk-…"
        placeholderTextColor={couleurs.texteAtténué}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Text style={styles.aide}>
        La recherche sémantique du lore essaie d'abord OpenRouter avec ta clé ci-dessus. Si ton compte n'a pas accès
        aux embeddings, renseigne ici une clé OpenAI (compatible text-embedding-3-small) utilisée uniquement en
        secours pour cette fonction.
      </Text>

      {messageStatut ? <Text style={styles.statut}>{messageStatut}</Text> : null}

      <Pressable style={styles.boutonPrincipal} onPress={enregistrer} disabled={enregistrement}>
        <Text style={styles.texteBoutonPrincipal}>{enregistrement ? 'Enregistrement…' : 'Enregistrer'}</Text>
      </Pressable>

      <Modal visible={modalOuvert} animationType="slide" onRequestClose={() => setModalOuvert(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.titre}>Modèles OpenRouter</Text>
          <TextInput
            style={styles.champ}
            value={rechercheModele}
            onChangeText={setRechercheModele}
            placeholder="Rechercher…"
            placeholderTextColor={couleurs.texteAtténué}
          />
          {chargementModeles ? (
            <ActivityIndicator color={couleurs.accent} style={{ marginTop: espacement.lg }} />
          ) : erreurModeles ? (
            <Text style={styles.statut}>{erreurModeles}</Text>
          ) : (
            <FlatList
              style={{ marginTop: espacement.sm }}
              data={modelesFiltres}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.ligneModele}
                  onPress={() => {
                    setModel(item.id);
                    setModalOuvert(false);
                  }}
                >
                  <Text style={styles.nomModele}>{item.nom}</Text>
                  <Text style={styles.idModele}>{item.id}</Text>
                </Pressable>
              )}
            />
          )}
          <Pressable style={styles.boutonSecondaire} onPress={() => setModalOuvert(false)}>
            <Text style={styles.texteBoutonSecondaire}>Fermer</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: couleurs.fond,
    padding: espacement.lg,
    paddingTop: espacement.xl,
  },
  titre: {
    color: couleurs.texte,
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
  aide: {
    color: couleurs.texteAtténué,
    fontSize: 12,
    marginTop: espacement.xs,
  },
  statut: {
    color: couleurs.texteAtténué,
    marginTop: espacement.md,
  },
  boutonPrincipal: {
    backgroundColor: couleurs.accent,
    borderRadius: rayon.md,
    paddingVertical: espacement.md,
    alignItems: 'center',
    marginTop: espacement.lg,
  },
  texteBoutonPrincipal: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  boutonSecondaire: {
    borderRadius: rayon.md,
    paddingVertical: espacement.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: couleurs.bordure,
    marginTop: espacement.sm,
  },
  texteBoutonSecondaire: {
    color: couleurs.texte,
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: couleurs.fond,
    padding: espacement.lg,
    paddingTop: espacement.xl,
  },
  ligneModele: {
    paddingVertical: espacement.sm,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bordure,
  },
  nomModele: {
    color: couleurs.texte,
    fontSize: 15,
  },
  idModele: {
    color: couleurs.texteAtténué,
    fontSize: 12,
  },
});
