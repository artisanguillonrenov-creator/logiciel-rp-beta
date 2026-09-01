import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { AppSettings, ProfilContenu } from '../types';
import { getSettings, saveSettings } from '../storage/storage';
import { listerModeles, type ModeleOpenRouter } from '../engine/openrouter';
import { verifierMiseAJour } from '../engine/updater';
import { couleurs, espacement, polices, stylePetitesCapitales } from '../theme/theme';
import { VERSION_APP } from '../version';
import Bouton from '../components/Bouton';
import Champ from '../components/Champ';
import Panneau from '../components/Panneau';
import Separateur from '../components/Separateur';

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

  // Auto-updater "esprit" (brief Phase 2, distribution) : vérification à la
  // demande, pas de mise à jour automatique en arrière-plan.
  const [verificationMaj, setVerificationMaj] = useState(false);
  const [messageMaj, setMessageMaj] = useState('');
  const [urlMaj, setUrlMaj] = useState('');

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

  async function verifierMaj() {
    setVerificationMaj(true);
    setMessageMaj('');
    setUrlMaj('');
    try {
      const info = await verifierMiseAJour();
      if (info.disponible) {
        setMessageMaj(`Nouvelle version disponible : ${info.derniereVersion}${info.notes ? ` — ${info.notes}` : ''}`);
        setUrlMaj(info.url);
      } else {
        setMessageMaj('Tu utilises déjà la dernière version.');
      }
    } catch (e) {
      setMessageMaj(e instanceof Error ? e.message : 'Vérification impossible pour le moment.');
    } finally {
      setVerificationMaj(false);
    }
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
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: espacement.xl }}>
      <Text style={styles.titre}>Réglages</Text>
      <Separateur />

      <Champ
        label="Clé API OpenRouter"
        value={apiKey}
        onChangeText={setApiKey}
        placeholder="sk-or-v1-…"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        conteneurStyle={styles.champConteneur}
      />
      <Text style={styles.aide}>
        Ta clé reste uniquement sur cet appareil (stockage local). Elle n'est jamais codée en dur ni transmise ailleurs
        qu'à OpenRouter.
      </Text>

      <Champ
        label="Modèle"
        value={model}
        onChangeText={setModel}
        placeholder="ex : anthropic/claude-sonnet-4.5"
        autoCapitalize="none"
        autoCorrect={false}
        conteneurStyle={styles.champConteneur}
      />
      <Bouton titre="Choisir parmi les modèles OpenRouter" variante="secondaire" onPress={ouvrirSelecteurModeles} style={styles.boutonAction} />

      <Champ
        label="Clé API embeddings (secours, optionnelle)"
        value={embeddingsApiKey}
        onChangeText={setEmbeddingsApiKey}
        placeholder="sk-…"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        conteneurStyle={styles.champConteneur}
      />
      <Text style={styles.aide}>
        La recherche sémantique du lore essaie d'abord OpenRouter avec ta clé ci-dessus. Si ton compte n'a pas accès
        aux embeddings, renseigne ici une clé OpenAI (compatible text-embedding-3-small) utilisée uniquement en
        secours pour cette fonction.
      </Text>

      <Text style={styles.label}>Profil de contenu</Text>
      <Pressable style={styles.champFactice} onPress={ouvrirModalProfil}>
        <Text style={styles.texteChampFactice}>
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

      <Bouton titre={enregistrement ? 'Enregistrement…' : 'Enregistrer'} onPress={enregistrer} desactive={enregistrement} style={styles.boutonPrincipal} />

      <Separateur />

      <Text style={styles.label}>Packs de contenu</Text>
      <Bouton titre="Gérer les packs de contenu (plugins)" variante="secondaire" onPress={() => navigation.navigate('Plugins')} style={styles.boutonAction} />

      <Text style={styles.label}>À propos</Text>
      <Text style={styles.aide}>Version {VERSION_APP}</Text>
      <Bouton titre={verificationMaj ? 'Vérification…' : 'Vérifier les mises à jour'} variante="secondaire" onPress={verifierMaj} desactive={verificationMaj} style={styles.boutonAction} />
      {messageMaj ? <Text style={styles.aide}>{messageMaj}</Text> : null}
      {urlMaj ? (
        <Bouton titre="Ouvrir la dernière version" variante="secondaire" onPress={() => Linking.openURL(urlMaj)} style={styles.boutonAction} />
      ) : null}

      <Text style={styles.label}>Concepteur</Text>
      <Bouton titre="Réglages concepteur" variante="secondaire" onPress={() => navigation.navigate('ReglagesConcepteur')} style={styles.boutonAction} />
      <Text style={styles.aide}>
        Débogage narratif, contrôles moteur et réglages de prompt avancés — utile pendant la phase de test.
      </Text>

      <Modal visible={modalOuvert} animationType="slide" onRequestClose={() => setModalOuvert(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.titre}>Modèles OpenRouter</Text>
          <Champ value={rechercheModele} onChangeText={setRechercheModele} placeholder="Rechercher…" conteneurStyle={styles.champConteneur} />
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
          <Bouton titre="Fermer" variante="secondaire" onPress={() => setModalOuvert(false)} style={styles.boutonAction} />
        </View>
      </Modal>

      <Modal visible={modalProfilOuvert} animationType="slide" onRequestClose={() => setModalProfilOuvert(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.titre}>Profil de contenu</Text>

          <Pressable onPress={choisirGrandPublic}>
            <Panneau style={[styles.optionProfil, profilContenu === 'grand_public' && styles.optionProfilActive]}>
              <Text style={styles.texteOptionProfil}>Grand public</Text>
              <Text style={styles.aide}>Contenu explicite retiré et bloqué par le contrôleur de sortie.</Text>
            </Panneau>
          </Pressable>

          <Panneau style={[styles.optionProfil, profilContenu === 'adulte' && styles.optionProfilActive]}>
            <Text style={styles.texteOptionProfil}>Adulte</Text>
            <Text style={styles.aide}>
              {codeDeverrouillage
                ? 'Entre ton code pour activer.'
                : 'Choisis un code (4 caractères minimum) — il te sera redemandé pour repasser en Adulte plus tard.'}
            </Text>
            <Champ
              value={codeSaisi}
              onChangeText={setCodeSaisi}
              placeholder="Code"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              conteneurStyle={styles.champConteneur}
            />
            <Bouton
              titre={codeDeverrouillage ? 'Déverrouiller' : 'Définir ce code et activer'}
              variante="secondaire"
              onPress={choisirAdulte}
              style={styles.boutonAction}
            />
          </Panneau>

          {erreurProfil ? <Text style={[styles.statut, { color: couleurs.danger }]}>{erreurProfil}</Text> : null}

          <Bouton titre="Fermer" variante="secondaire" onPress={() => setModalProfilOuvert(false)} style={styles.boutonAction} />
        </View>
      </Modal>
    </ScrollView>
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
    color: couleurs.dore,
    fontFamily: polices.display,
    fontSize: 26,
    letterSpacing: 1,
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
  champFactice: {
    backgroundColor: couleurs.fondChampSaisie,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    paddingHorizontal: espacement.sm,
    paddingVertical: espacement.sm,
  },
  texteChampFactice: {
    color: couleurs.texte,
    fontFamily: polices.corps,
    fontSize: 16,
  },
  aide: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 14,
    marginTop: espacement.xs,
  },
  statut: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    marginTop: espacement.md,
  },
  boutonPrincipal: {
    marginTop: espacement.lg,
  },
  boutonAction: {
    marginTop: espacement.sm,
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
    fontFamily: polices.corps,
    fontSize: 16,
  },
  idModele: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 13,
  },
  optionProfil: {
    marginTop: espacement.md,
  },
  optionProfilActive: {
    borderColor: couleurs.accent,
  },
  texteOptionProfil: {
    color: couleurs.texte,
    fontFamily: polices.titre,
    fontSize: 18,
    marginBottom: espacement.xs,
  },
});
