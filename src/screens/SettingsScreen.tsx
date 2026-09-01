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
import type { AppSettings, ProfilContenu } from '../types';
import { getSettings, saveSettings } from '../storage/storage';
import { listerModeles, type ModeleOpenRouter } from '../engine/openrouter';
import { couleurs, espacement, polices, rayon } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Reglages'>;

export default function SettingsScreen({ navigation }: Props) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [embeddingsApiKey, setEmbeddingsApiKey] = useState('');
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [messageStatut, setMessageStatut] = useState('');

  // Contrôle d'âge (brief Phase 2) : profil déclaré une fois par appareil,
  // code de déverrouillage requis pour repasser en ADULTE ensuite —
  // "esprit sans vraie protection" (pas de vraie sécurité, un garde-fou).
  const [profilContenu, setProfilContenu] = useState<ProfilContenu | undefined>(undefined);
  const [codeDeverrouillage, setCodeDeverrouillage] = useState<string | undefined>(undefined);
  const [modalProfilOuvert, setModalProfilOuvert] = useState(false);
  const [codeSaisi, setCodeSaisi] = useState('');
  const [erreurProfil, setErreurProfil] = useState('');

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
      setProfilContenu(settings.profilContenu);
      setCodeDeverrouillage(settings.codeDeverrouillage);
      setChargement(false);
    });
  }, []);

  async function sauvegarderProfil(profil: ProfilContenu, code: string | undefined) {
    setProfilContenu(profil);
    setCodeDeverrouillage(code);
    const settingsActuelles = await getSettings();
    await saveSettings({ ...settingsActuelles, profilContenu: profil, codeDeverrouillage: code });
  }

  function choisirGrandPublic() {
    // Redescendre vers GRAND_PUBLIC ne demande jamais de code — seul le
    // passage vers ADULTE est protégé.
    sauvegarderProfil('grand_public', codeDeverrouillage);
    setModalProfilOuvert(false);
  }

  function choisirAdulte() {
    if (!codeDeverrouillage) {
      // Premier passage en ADULTE : le code saisi devient le code de
      // déverrouillage pour les prochaines fois.
      if (codeSaisi.trim().length < 4) {
        setErreurProfil('Choisis un code d’au moins 4 caractères.');
        return;
      }
      sauvegarderProfil('adulte', codeSaisi.trim());
      setModalProfilOuvert(false);
      return;
    }
    if (codeSaisi.trim() !== codeDeverrouillage) {
      setErreurProfil('Code incorrect.');
      return;
    }
    sauvegarderProfil('adulte', codeDeverrouillage);
    setModalProfilOuvert(false);
  }

  function ouvrirModalProfil() {
    setCodeSaisi('');
    setErreurProfil('');
    setModalProfilOuvert(true);
  }

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
        profilContenu,
        codeDeverrouillage,
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

      <Text style={styles.label}>Profil de contenu</Text>
      <Pressable style={styles.champ} onPress={ouvrirModalProfil}>
        <Text style={{ color: couleurs.texte, fontSize: 15 }}>
          {profilContenu === 'adulte'
            ? 'Adulte'
            : profilContenu === 'grand_public'
              ? 'Grand public'
              : 'À déclarer — appuie ici'}
        </Text>
      </Pressable>
      <Text style={styles.aide}>
        En Grand public, le contenu explicite est retiré du contexte et bloqué par le contrôleur de sortie même si le
        modèle en produit malgré tout. Le passage en Adulte est protégé par un code que tu choisis à la première
        activation (pas une vraie protection anti-piratage — un garde-fou local).
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

      <Modal visible={modalProfilOuvert} animationType="slide" onRequestClose={() => setModalProfilOuvert(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.titre}>Profil de contenu</Text>

          <Pressable
            style={[styles.optionProfil, profilContenu === 'grand_public' && styles.optionProfilActive]}
            onPress={choisirGrandPublic}
          >
            <Text style={styles.texteOptionProfil}>Grand public</Text>
            <Text style={styles.aide}>Contenu explicite retiré et bloqué par le contrôleur de sortie.</Text>
          </Pressable>

          <Pressable
            style={[styles.optionProfil, profilContenu === 'adulte' && styles.optionProfilActive]}
            onPress={() => {}}
          >
            <Text style={styles.texteOptionProfil}>Adulte</Text>
            <Text style={styles.aide}>
              {codeDeverrouillage
                ? 'Entre ton code pour activer.'
                : 'Choisis un code (4 caractères minimum) — il te sera redemandé pour repasser en Adulte plus tard.'}
            </Text>
            <TextInput
              style={styles.champ}
              value={codeSaisi}
              onChangeText={setCodeSaisi}
              placeholder="Code"
              placeholderTextColor={couleurs.texteAtténué}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable style={styles.boutonSecondaire} onPress={choisirAdulte}>
              <Text style={styles.texteBoutonSecondaire}>{codeDeverrouillage ? 'Déverrouiller' : 'Définir ce code et activer'}</Text>
            </Pressable>
          </Pressable>

          {erreurProfil ? <Text style={[styles.statut, { color: couleurs.danger }]}>{erreurProfil}</Text> : null}

          <Pressable style={styles.boutonSecondaire} onPress={() => setModalProfilOuvert(false)}>
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
  optionProfil: {
    borderRadius: rayon.md,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    padding: espacement.md,
    marginTop: espacement.md,
  },
  optionProfilActive: {
    borderColor: couleurs.accent,
  },
  texteOptionProfil: {
    color: couleurs.texte,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: espacement.xs,
  },
});
