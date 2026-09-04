import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { AppSettings, MoteurInference, ProfilContenu } from '../types';
import { getSettings, saveSettings } from '../storage/storage';
import { listerModeles, type ModeleOpenRouter } from '../engine/openrouter';
import { verifierMiseAJour } from '../engine/updater';
import {
  importerModeleLocal,
  modeleLocalTelecharge,
  supprimerModeleLocal,
  tailleModeleLocalOctets,
} from '../storage/modeleLocalStore';
import { couleurs, espacement, polices, stylePetitesCapitales } from '../theme/theme';
import { VERSION_APP } from '../version';
import Bouton from '../components/Bouton';
import Champ from '../components/Champ';
import FondAtmospherique from '../components/FondAtmospherique';
import Panneau from '../components/Panneau';
import Separateur from '../components/Separateur';
import { useLangue } from '../i18n/LangueProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Reglages'>;

const IMAGE_REGLAGES = require('../../assets/scenes/creation-preferences.png');

export default function SettingsScreen({ navigation }: Props) {
  const { t } = useLangue();
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

  // Moteur d'inférence local (demande explicite de faire tourner un modèle
  // téléchargé sur l'appareil plutôt que de dépendre d'OpenRouter) — natif
  // uniquement, jamais proposé sur le build web (expo-litert-lm n'existe
  // pas côté web, voir src/engine/localInference.web.ts).
  const [moteurInference, setMoteurInference] = useState<MoteurInference>('openrouter');
  const [genererImagesActive, setGenererImagesActive] = useState(false);
  const [modeleLocalPresent, setModeleLocalPresent] = useState(false);
  const [tailleModeleLocal, setTailleModeleLocal] = useState<number | null>(null);
  const [importEnCours, setImportEnCours] = useState(false);
  const [erreurModeleLocal, setErreurModeleLocal] = useState('');

  useEffect(() => {
    getSettings().then((settings: AppSettings) => {
      setApiKey(settings.openRouterApiKey);
      setModel(settings.model);
      setEmbeddingsApiKey(settings.embeddingsApiKey ?? '');
      setProfilContenu(settings.profilContenu);
      setCodeDeverrouillage(settings.codeDeverrouillage);
      setMoteurInference(settings.moteurInference ?? 'openrouter');
      setGenererImagesActive(settings.genererImagesActive ?? false);
      setChargement(false);
    });
    rafraichirEtatModeleLocal();
  }, []);

  function rafraichirEtatModeleLocal() {
    if (Platform.OS === 'web') return;
    setModeleLocalPresent(modeleLocalTelecharge());
    setTailleModeleLocal(tailleModeleLocalOctets());
  }

  async function importerModele() {
    setImportEnCours(true);
    setErreurModeleLocal('');
    try {
      await importerModeleLocal();
      rafraichirEtatModeleLocal();
    } catch (e) {
      setErreurModeleLocal(e instanceof Error ? e.message : t('Import impossible.'));
    } finally {
      setImportEnCours(false);
    }
  }

  function supprimerModele() {
    supprimerModeleLocal();
    rafraichirEtatModeleLocal();
  }

  function formaterTailleOctets(octets: number): string {
    const go = octets / (1024 * 1024 * 1024);
    if (go >= 1) return `${go.toFixed(2)} Go`;
    return `${(octets / (1024 * 1024)).toFixed(0)} Mo`;
  }

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
        setErreurProfil(t('Choisis un code d’au moins 4 caractères.'));
        return;
      }
      sauvegarderProfil('adulte', codeSaisi.trim());
      setModalProfilOuvert(false);
      return;
    }
    if (codeSaisi.trim() !== codeDeverrouillage) {
      setErreurProfil(t('Code incorrect.'));
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
        setMessageMaj(`${t('Nouvelle version disponible')} : ${info.derniereVersion}${info.notes ? ` — ${info.notes}` : ''}`);
        setUrlMaj(info.url);
      } else {
        setMessageMaj(t('Tu utilises déjà la dernière version.'));
      }
    } catch (e) {
      setMessageMaj(e instanceof Error ? e.message : t('Vérification impossible pour le moment.'));
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
        .catch(() => setErreurModeles(t('Liste indisponible pour le moment. Tu peux saisir un identifiant de modèle manuellement.')))
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
        moteurInference,
        genererImagesActive,
      });
      setMessageStatut(t('Réglages enregistrés.'));
    } catch {
      setMessageStatut(t("Erreur lors de l'enregistrement."));
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
      <View style={[styles.container, { justifyContent: 'center', backgroundColor: couleurs.fond }]}>
        <ActivityIndicator color={couleurs.accent} />
      </View>
    );
  }

  return (
    <FondAtmospherique style={{ flex: 1 }} densiteEtoiles="discrete" imageFond={IMAGE_REGLAGES}>
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: espacement.xl }}>
      <Text style={styles.titre}>{t('Réglages')}</Text>
      <Separateur />

      <Champ
        label={t('Clé API OpenRouter')}
        value={apiKey}
        onChangeText={setApiKey}
        placeholder="sk-or-v1-…"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        conteneurStyle={styles.champConteneur}
      />
      <Text style={styles.aide}>
        {t(
          "Ta clé reste uniquement sur cet appareil (stockage local). Elle n'est jamais codée en dur ni transmise ailleurs qu'à OpenRouter.",
        )}
      </Text>

      <Champ
        label={t('Modèle')}
        value={model}
        onChangeText={setModel}
        placeholder="ex : anthropic/claude-sonnet-4.5"
        autoCapitalize="none"
        autoCorrect={false}
        conteneurStyle={styles.champConteneur}
      />
      <Bouton titre={t('Choisir parmi les modèles OpenRouter')} variante="secondaire" onPress={ouvrirSelecteurModeles} style={styles.boutonAction} />

      <Champ
        label={t('Clé API embeddings (secours, optionnelle)')}
        value={embeddingsApiKey}
        onChangeText={setEmbeddingsApiKey}
        placeholder="sk-…"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        conteneurStyle={styles.champConteneur}
      />
      <Text style={styles.aide}>
        {t(
          "La recherche sémantique du lore essaie d'abord OpenRouter avec ta clé ci-dessus. Si ton compte n'a pas accès aux embeddings, renseigne ici une clé OpenAI (compatible text-embedding-3-small) utilisée uniquement en secours pour cette fonction.",
        )}
      </Text>

      {Platform.OS !== 'web' && (
        <>
          <Text style={styles.label}>{t("Moteur d'inférence")}</Text>
          <View style={styles.rangeeMoteur}>
            <Pressable
              style={[styles.optionMoteur, moteurInference !== 'local' && styles.optionMoteurActive]}
              onPress={() => setMoteurInference('openrouter')}
            >
              <Text style={styles.texteOptionMoteur}>OpenRouter</Text>
            </Pressable>
            <Pressable
              style={[styles.optionMoteur, moteurInference === 'local' && styles.optionMoteurActive]}
              onPress={() => setMoteurInference('local')}
            >
              <Text style={styles.texteOptionMoteur}>{t("Local (sur l'appareil)")}</Text>
            </Pressable>
          </View>

          {moteurInference === 'local' ? (
            <Panneau style={styles.champConteneur}>
              <Text style={styles.aide}>
                {t(
                  "Le modèle tourne entièrement sur l'appareil, sans connexion réseau ni clé API. Sur du matériel d'entrée de gamme, la génération peut être lente ou instable — c'est un compromis assumé, pas un dysfonctionnement.",
                )}
              </Text>
              <Text style={[styles.texteOptionProfil, { marginTop: espacement.sm }]}>
                {modeleLocalPresent
                  ? `${t('Modèle importé')} (${formaterTailleOctets(tailleModeleLocal ?? 0)})`
                  : t('Aucun modèle importé')}
              </Text>
              <Bouton
                titre={importEnCours ? t('Import…') : t('Importer un modèle (.litertlm ou .task)')}
                variante="secondaire"
                onPress={importerModele}
                desactive={importEnCours}
                style={styles.boutonAction}
              />
              {modeleLocalPresent ? (
                <Bouton
                  titre={t('Supprimer le modèle local')}
                  variante="secondaire"
                  onPress={supprimerModele}
                  style={styles.boutonAction}
                />
              ) : null}
              {erreurModeleLocal ? <Text style={[styles.statut, { color: couleurs.danger }]}>{erreurModeleLocal}</Text> : null}
            </Panneau>
          ) : null}
        </>
      )}

      <Text style={styles.label}>{t('Génération d’images')}</Text>
      <View style={styles.rangeeMoteur}>
        <Pressable
          style={[styles.optionMoteur, !genererImagesActive && styles.optionMoteurActive]}
          onPress={() => setGenererImagesActive(false)}
        >
          <Text style={styles.texteOptionMoteur}>{t('Désactivée')}</Text>
        </Pressable>
        <Pressable
          style={[styles.optionMoteur, genererImagesActive && styles.optionMoteurActive]}
          onPress={() => setGenererImagesActive(true)}
        >
          <Text style={styles.texteOptionMoteur}>{t('Activée')}</Text>
        </Pressable>
      </View>
      <Text style={styles.aide}>
        {t(
          "Ajoute un bouton « Illustrer cette scène » dans la conversation, qui génère une image via le même compte OpenRouter (modèle ouvert dédié aux images, pas celui choisi pour le texte). Les images générées ne sont pas sauvegardées avec l'histoire — elles disparaissent si tu quittes l'écran.",
        )}
      </Text>

      <Text style={styles.label}>{t('Profil de contenu')}</Text>
      <Pressable style={styles.champFactice} onPress={ouvrirModalProfil}>
        <Text style={styles.texteChampFactice}>
          {profilContenu === 'adulte'
            ? t('Adulte')
            : profilContenu === 'grand_public'
              ? t('Grand public')
              : t('À déclarer — appuie ici')}
        </Text>
      </Pressable>
      <Text style={styles.aide}>
        {t(
          "En Grand public, le contenu explicite est retiré du contexte et bloqué par le contrôleur de sortie même si le modèle en produit malgré tout. Le passage en Adulte est protégé par un code que tu choisis à la première activation (pas une vraie protection anti-piratage — un garde-fou local).",
        )}
      </Text>

      {messageStatut ? <Text style={styles.statut}>{messageStatut}</Text> : null}

      <Bouton titre={enregistrement ? t('Enregistrement…') : t('Enregistrer')} onPress={enregistrer} desactive={enregistrement} style={styles.boutonPrincipal} />

      <Separateur />

      <Text style={styles.label}>{t('Packs de contenu')}</Text>
      <Bouton titre={t('Gérer les packs de contenu (plugins)')} variante="secondaire" onPress={() => navigation.navigate('Plugins')} style={styles.boutonAction} />

      <Text style={styles.label}>{t('À propos')}</Text>
      <Text style={styles.aide}>{t('Version')} {VERSION_APP}</Text>
      <Bouton titre={verificationMaj ? t('Vérification…') : t('Vérifier les mises à jour')} variante="secondaire" onPress={verifierMaj} desactive={verificationMaj} style={styles.boutonAction} />
      {messageMaj ? <Text style={styles.aide}>{messageMaj}</Text> : null}
      {urlMaj ? (
        <Bouton titre={t('Ouvrir la dernière version')} variante="secondaire" onPress={() => Linking.openURL(urlMaj)} style={styles.boutonAction} />
      ) : null}

      <Text style={styles.label}>{t('Concepteur')}</Text>
      <Bouton titre={t('Réglages concepteur')} variante="secondaire" onPress={() => navigation.navigate('ReglagesConcepteur')} style={styles.boutonAction} />
      <Text style={styles.aide}>
        {t('Débogage narratif, contrôles moteur et réglages de prompt avancés — utile pendant la phase de test.')}
      </Text>

      <Modal visible={modalOuvert} animationType="slide" onRequestClose={() => setModalOuvert(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.titre}>{t('Modèles OpenRouter')}</Text>
          <Champ value={rechercheModele} onChangeText={setRechercheModele} placeholder={t('Rechercher…')} conteneurStyle={styles.champConteneur} />
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
          <Bouton titre={t('Fermer')} variante="secondaire" onPress={() => setModalOuvert(false)} style={styles.boutonAction} />
        </View>
      </Modal>

      <Modal visible={modalProfilOuvert} animationType="slide" onRequestClose={() => setModalProfilOuvert(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.titre}>{t('Profil de contenu')}</Text>

          <Pressable onPress={choisirGrandPublic}>
            <Panneau style={[styles.optionProfil, profilContenu === 'grand_public' && styles.optionProfilActive]}>
              <Text style={styles.texteOptionProfil}>{t('Grand public')}</Text>
              <Text style={styles.aide}>{t('Contenu explicite retiré et bloqué par le contrôleur de sortie.')}</Text>
            </Panneau>
          </Pressable>

          <Panneau style={[styles.optionProfil, profilContenu === 'adulte' && styles.optionProfilActive]}>
            <Text style={styles.texteOptionProfil}>{t('Adulte')}</Text>
            <Text style={styles.aide}>
              {codeDeverrouillage
                ? t('Entre ton code pour activer.')
                : t('Choisis un code (4 caractères minimum) — il te sera redemandé pour repasser en Adulte plus tard.')}
            </Text>
            <Champ
              value={codeSaisi}
              onChangeText={setCodeSaisi}
              placeholder={t('Code')}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              conteneurStyle={styles.champConteneur}
            />
            <Bouton
              titre={codeDeverrouillage ? t('Déverrouiller') : t('Définir ce code et activer')}
              variante="secondaire"
              onPress={choisirAdulte}
              style={styles.boutonAction}
            />
          </Panneau>

          {erreurProfil ? <Text style={[styles.statut, { color: couleurs.danger }]}>{erreurProfil}</Text> : null}

          <Bouton titre={t('Fermer')} variante="secondaire" onPress={() => setModalProfilOuvert(false)} style={styles.boutonAction} />
        </View>
      </Modal>
    </ScrollView>
    </FondAtmospherique>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  rangeeMoteur: {
    flexDirection: 'row',
    marginTop: espacement.xs,
    gap: espacement.sm,
  },
  optionMoteur: {
    flex: 1,
    paddingVertical: espacement.sm,
    paddingHorizontal: espacement.sm,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    backgroundColor: couleurs.fondChampSaisie,
    alignItems: 'center',
  },
  optionMoteurActive: {
    borderColor: couleurs.accent,
  },
  texteOptionMoteur: {
    color: couleurs.texte,
    fontFamily: polices.corps,
    fontSize: 14,
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
