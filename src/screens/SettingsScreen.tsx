import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { AppSettings, MoteurInference, ProfilContenu } from '../types';
import { getSettings, saveSettings } from '../storage/storage';
import { listerModeles, type ModeleOpenRouter } from '../engine/openrouter';
import { listerModelesDistants } from '../engine/llmProvider';
import { attendreConnexionChatGPT, demarrerConnexionChatGPT, etatConnexionChatGPT, listerModelesChatGPT } from '../engine/chatgptSubscription';
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
import { useLangue } from '../i18n/LangueProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'Reglages'>;

const IMAGE_REGLAGES = require('../../assets/scenes/creation-preferences.png');

export default function SettingsScreen({ navigation }: Props) {
  const { t } = useLangue();
  const { width } = useWindowDimensions();
  const estTablette = width >= 900;

  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [infermaticApiKey, setInfermaticApiKey] = useState('');
  const [infermaticModel, setInfermaticModel] = useState('');
  const [chatgptModel, setChatgptModel] = useState('');
  const [chatgptConnecte, setChatgptConnecte] = useState(false);
  const [chatgptPlan, setChatgptPlan] = useState('');
  const [chatgptCode, setChatgptCode] = useState('');
  const [chatgptVerificationUrl, setChatgptVerificationUrl] = useState('');
  const [chatgptConnexionEnCours, setChatgptConnexionEnCours] = useState(false);
  const [chatgptErreur, setChatgptErreur] = useState('');
  const [embeddingsApiKey, setEmbeddingsApiKey] = useState('');
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);
  const [messageStatut, setMessageStatut] = useState('');
  const [conserverClesWeb, setConserverClesWeb] = useState(false);
  const [avancesOuverts, setAvancesOuverts] = useState(false);
  const [erreurChargement, setErreurChargement] = useState('');

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
  const [fournisseurCatalogue, setFournisseurCatalogue] = useState<'openrouter' | 'infermatic' | 'chatgpt'>('openrouter');
  const requeteCatalogueRef = useRef(0);

  const [verificationMaj, setVerificationMaj] = useState(false);
  const [messageMaj, setMessageMaj] = useState('');
  const [urlMaj, setUrlMaj] = useState('');

  const [moteurInference, setMoteurInference] = useState<MoteurInference>('openrouter');
  const [genererImagesActive, setGenererImagesActive] = useState(false);
  const [modeleImagesGratuit, setModeleImagesGratuit] = useState(false);
  const [fournisseurImages, setFournisseurImages] = useState<'chatgpt' | 'openrouter'>('openrouter');
  const [modeleLocalPresent, setModeleLocalPresent] = useState(false);
  const [tailleModeleLocal, setTailleModeleLocal] = useState<number | null>(null);
  const [importEnCours, setImportEnCours] = useState(false);
  const [erreurModeleLocal, setErreurModeleLocal] = useState('');

  function chargerReglages() {
    setErreurChargement('');
    setChargement(true);
    getSettings().then((settings: AppSettings) => {
      setApiKey(settings.openRouterApiKey);
      setModel(settings.model);
      setInfermaticApiKey(settings.infermaticApiKey ?? '');
      setInfermaticModel(settings.infermaticModel ?? '');
      setChatgptModel(settings.chatgptModel ?? '');
      etatConnexionChatGPT().then((etat) => {
        setChatgptConnecte(etat.connected);
        setChatgptPlan(etat.planType ?? '');
      }).catch(() => {});
      setEmbeddingsApiKey(settings.embeddingsApiKey ?? '');
      setConserverClesWeb(settings.conserverClesWeb ?? false);
      const cleConfiguree = settings.moteurInference === 'infermatic' ? settings.infermaticApiKey : settings.openRouterApiKey;
      setAvancesOuverts(settings.moteurInference !== 'local' && settings.moteurInference !== 'chatgpt' && !cleConfiguree);
      setProfilContenu(settings.profilContenu);
      setCodeDeverrouillage(settings.codeDeverrouillage);
      setMoteurInference(settings.moteurInference ?? 'openrouter');
      setGenererImagesActive(settings.genererImagesActive ?? false);
      setModeleImagesGratuit(settings.modeleImagesGratuit ?? false);
      setFournisseurImages(settings.fournisseurImages ?? (settings.moteurInference === 'chatgpt' ? 'chatgpt' : 'openrouter'));
      setChargement(false);
    }).catch(() => {
      setErreurChargement(t('Impossible de lire les réglages. Réessaie après avoir déverrouillé l’appareil ou autorisé le stockage du navigateur.'));
      setChargement(false);
    });
  }

  useEffect(() => {
    chargerReglages();
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
    try {
      const settingsActuelles = await getSettings();
      await saveSettings({ ...settingsActuelles, profilContenu: profil, codeDeverrouillage: code });
      setProfilContenu(profil);
      setCodeDeverrouillage(code);
      setModalProfilOuvert(false);
    } catch {
      setErreurProfil(t('Le profil n’a pas pu être enregistré. Réessaie.'));
    }
  }

  function choisirGrandPublic() {
    sauvegarderProfil('grand_public', codeDeverrouillage);
  }

  function choisirAdulte() {
    if (!codeDeverrouillage) {
      if (codeSaisi.trim().length < 4) {
        setErreurProfil(t('Choisis un code d’au moins 4 caractères.'));
        return;
      }
      sauvegarderProfil('adulte', codeSaisi.trim());
      return;
    }
    if (codeSaisi.trim() !== codeDeverrouillage) {
      setErreurProfil(t('Code incorrect.'));
      return;
    }
    sauvegarderProfil('adulte', codeDeverrouillage);
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

  function ouvrirSelecteurModeles(fournisseur: 'openrouter' | 'infermatic' | 'chatgpt') {
    const requeteId = ++requeteCatalogueRef.current;
    setFournisseurCatalogue(fournisseur);
    setModalOuvert(true);
    setRechercheModele('');
    setModeles([]);
    setChargementModeles(true);
    setErreurModeles('');
    (fournisseur === 'chatgpt'
      ? listerModelesChatGPT()
      : fournisseur === 'infermatic'
        ? listerModelesDistants('infermatic', infermaticApiKey.trim())
        : listerModeles())
      .then((liste) => {
        if (requeteCatalogueRef.current === requeteId) {
          setModeles(fournisseur === 'chatgpt'
            ? [{ id: '', nom: 'Automatique — recommandé' }, ...liste]
            : liste);
        }
      })
      .catch((e) => {
        if (requeteCatalogueRef.current === requeteId) {
          setErreurModeles(e instanceof Error ? e.message : t('Liste indisponible pour le moment.'));
        }
      })
      .finally(() => { if (requeteCatalogueRef.current === requeteId) setChargementModeles(false); });
  }

  async function connecterChatGPT() {
    setChatgptConnexionEnCours(true);
    setChatgptErreur('');
    setChatgptCode('');
    setChatgptVerificationUrl('');
    try {
      const debut = await demarrerConnexionChatGPT();
      setChatgptCode(debut.userCode ?? '');
      setChatgptVerificationUrl(debut.verificationUrl ?? '');
      if (debut.verificationUrl) await Linking.openURL(debut.verificationUrl);
      const etat = await attendreConnexionChatGPT();
      setChatgptConnecte(etat.connected);
      setChatgptPlan(etat.planType ?? '');
      setChatgptCode('');
      setChatgptVerificationUrl('');
      if (etat.connected) setMessageStatut(etat.planType ? `ChatGPT connecté · forfait ${etat.planType}.` : 'ChatGPT connecté.');
    } catch (e) {
      setChatgptErreur(e instanceof Error ? e.message : 'Connexion ChatGPT impossible.');
    } finally {
      setChatgptConnexionEnCours(false);
    }
  }

  async function enregistrer() {
    setEnregistrement(true);
    setMessageStatut('');
    try {
      const settingsActuelles = await getSettings();
      await saveSettings({
        ...settingsActuelles,
        openRouterApiKey: apiKey.trim(),
        model: model.trim(),
        infermaticApiKey: infermaticApiKey.trim() || undefined,
        infermaticModel: infermaticModel.trim() || undefined,
        chatgptModel: chatgptModel.trim() || undefined,
        embeddingsApiKey: embeddingsApiKey.trim() || undefined,
        conserverClesWeb,
        profilContenu,
        codeDeverrouillage,
        moteurInference,
        genererImagesActive,
        modeleImagesGratuit,
        fournisseurImages,
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

  const fournisseurActif = moteurInference === 'local'
    ? t('Sur cet appareil')
    : moteurInference === 'chatgpt'
      ? 'ChatGPT Plus'
      : moteurInference === 'infermatic'
        ? 'Infermatic'
        : 'OpenRouter';

  const profilAffiche = profilContenu === 'adulte'
    ? t('Adulte')
    : profilContenu === 'grand_public'
      ? t('Grand public')
      : t('À déclarer');

  const illustrationsPretes = genererImagesActive && (fournisseurImages === 'chatgpt' ? chatgptConnecte : !!apiKey.trim());
  const etatIllustrations = !genererImagesActive
    ? t('Désactivées')
    : illustrationsPretes
      ? (fournisseurImages === 'chatgpt' ? t('ChatGPT Plus · prête') : t('OpenRouter · prête'))
      : fournisseurImages === 'chatgpt'
        ? t('Connexion ChatGPT requise')
        : t('Clé OpenRouter requise');

  if (chargement) {
    return (
      <View style={[styles.container, styles.centreChargement]}>
        <ActivityIndicator color={couleurs.accent} />
      </View>
    );
  }

  if (erreurChargement) {
    return (
      <View style={[styles.container, styles.centreChargement]}>
        <Text style={styles.statut}>{erreurChargement}</Text>
        <Bouton titre={t('Réessayer')} onPress={chargerReglages} style={styles.boutonAction} />
      </View>
    );
  }

  return (
    <FondAtmospherique style={{ flex: 1 }} densiteEtoiles="discrete" imageFond={IMAGE_REGLAGES}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contenuPage}>
        <View style={styles.entetePage}>
          <Text style={styles.surtitre}>{t('PARAMÈTRES D’ELYNDOR')}</Text>
          <Text style={styles.titre}>{t('Réglages')}</Text>
          <Text style={styles.sousTitre}>{t('Configure l’expérience, le narrateur et les services techniques sans quitter l’univers.')}</Text>
        </View>

        <View style={[styles.resumeGrid, estTablette && styles.resumeGridTablette]}>
          <Panneau style={[styles.resumeCarte, estTablette && styles.resumeCarteTablette]}>
            <Text style={styles.resumeLabel}>{t('NARRATEUR')}</Text>
            <Text style={styles.resumeValeur}>{fournisseurActif}</Text>
          </Panneau>
          <Panneau style={[styles.resumeCarte, estTablette && styles.resumeCarteTablette]}>
            <Text style={styles.resumeLabel}>{t('PROFIL')}</Text>
            <Text style={styles.resumeValeur}>{profilAffiche}</Text>
          </Panneau>
          <Panneau style={[styles.resumeCarte, estTablette && styles.resumeCarteTablette]}>
            <Text style={styles.resumeLabel}>{t('ILLUSTRATIONS')}</Text>
            <Text style={styles.resumeValeur}>{etatIllustrations}</Text>
          </Panneau>
        </View>

        <View style={[styles.colonnes, estTablette && styles.colonnesTablette]}>
          <View style={styles.colonne}>
            <Panneau style={styles.section}>
              <Text style={styles.sectionSurtitre}>{t('EXPÉRIENCE')}</Text>
              <Text style={styles.sectionTitre}>{t('Contenu & extensions')}</Text>
              <Text style={styles.sectionDescription}>{t('Ces réglages modifient ce que l’application autorise et les contenus disponibles, sans toucher à tes histoires existantes.')}</Text>

              <Pressable style={styles.ligneSelection} onPress={ouvrirModalProfil}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ligneLabel}>{t('Profil de contenu')}</Text>
                  <Text style={styles.ligneValeur}>{profilAffiche}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>

              <Text style={styles.aide}>
                {t('En Grand public, le contenu explicite est filtré et bloqué. Le mode Adulte se réactive avec le code local que tu as choisi.')}
              </Text>

              <Bouton
                titre={t('Gérer les packs de contenu')}
                variante="secondaire"
                onPress={() => navigation.navigate('Plugins')}
                style={styles.boutonAction}
              />
            </Panneau>

            <Panneau style={styles.section}>
              <Text style={styles.sectionSurtitre}>{t('IA & CONNEXION')}</Text>
              <Text style={styles.sectionTitre}>{t('Narrateur')}</Text>
              <Text style={styles.sectionDescription}>{t('Choisis où tourne le modèle de narration puis configure uniquement le fournisseur utilisé.')}</Text>

              <Text style={styles.label}>{t("Moteur d'inférence")}</Text>
              <View style={styles.rangeeMoteur}>
                <Pressable
                  style={[styles.optionMoteur, moteurInference === 'openrouter' && styles.optionMoteurActive]}
                  onPress={() => setMoteurInference('openrouter')}
                >
                  <Text style={[styles.texteOptionMoteur, moteurInference === 'openrouter' && styles.texteOptionMoteurActif]}>OpenRouter</Text>
                </Pressable>
                <Pressable
                  style={[styles.optionMoteur, moteurInference === 'infermatic' && styles.optionMoteurActive]}
                  onPress={() => { setMoteurInference('infermatic'); setModeles([]); }}
                >
                  <Text style={[styles.texteOptionMoteur, moteurInference === 'infermatic' && styles.texteOptionMoteurActif]}>Infermatic</Text>
                </Pressable>
                <Pressable
                  style={[styles.optionMoteur, moteurInference === 'chatgpt' && styles.optionMoteurActive]}
                  onPress={() => { setMoteurInference('chatgpt'); setModeles([]); }}
                >
                  <Text style={[styles.texteOptionMoteur, moteurInference === 'chatgpt' && styles.texteOptionMoteurActif]}>ChatGPT Plus</Text>
                </Pressable>
                {Platform.OS !== 'web' && (
                  <Pressable
                    style={[styles.optionMoteur, moteurInference === 'local' && styles.optionMoteurActive]}
                    onPress={() => setMoteurInference('local')}
                  >
                    <Text style={[styles.texteOptionMoteur, moteurInference === 'local' && styles.texteOptionMoteurActif]}>{t('Local')}</Text>
                  </Pressable>
                )}
              </View>

              {moteurInference === 'openrouter' && (
                <View style={styles.blocFournisseur}>
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
                  <Champ
                    label={t('Modèle de narration')}
                    value={model}
                    onChangeText={setModel}
                    placeholder="ex : anthropic/claude-sonnet-4.5"
                    autoCapitalize="none"
                    autoCorrect={false}
                    conteneurStyle={styles.champConteneur}
                  />
                  <Bouton
                    titre={t('Parcourir les modèles OpenRouter')}
                    variante="arcane"
                    onPress={() => ouvrirSelecteurModeles('openrouter')}
                    style={styles.boutonAction}
                  />
                </View>
              )}

              {moteurInference === 'chatgpt' && (
                <View style={styles.blocFournisseur}>
                  <View style={styles.etatTechnique}>
                    <Text style={styles.ligneLabel}>{t('Compte ChatGPT')}</Text>
                    <Text style={styles.ligneValeur}>
                      {chatgptConnecte ? `Connecté${chatgptPlan ? ` · ${chatgptPlan}` : ''}` : 'Non connecté'}
                    </Text>
                  </View>
                  <Text style={styles.aide}>{t('Utilise ton abonnement ChatGPT/Codex. Aucune clé API OpenAI n’est nécessaire. La consommation suit le quota de ton abonnement.')}</Text>
                  {!chatgptConnecte && (
                    <Bouton
                      titre={chatgptConnexionEnCours ? t('Connexion en cours…') : t('Se connecter avec ChatGPT')}
                      variante="arcane"
                      onPress={connecterChatGPT}
                      disabled={chatgptConnexionEnCours}
                      style={styles.boutonAction}
                    />
                  )}
                  {!!chatgptCode && (
                    <View style={styles.etatTechnique}>
                      <Text style={styles.ligneLabel}>{t('Code à saisir chez OpenAI')}</Text>
                      <Text style={styles.ligneValeur}>{chatgptCode}</Text>
                    </View>
                  )}
                  {!!chatgptVerificationUrl && (
                    <Bouton
                      titre={t('Ouvrir la page de connexion OpenAI')}
                      variante="secondaire"
                      onPress={() => Linking.openURL(chatgptVerificationUrl)}
                      style={styles.boutonAction}
                    />
                  )}
                  {!!chatgptErreur && <Text style={[styles.aide, { color: couleurs.danger }]}>{chatgptErreur}</Text>}
                  {chatgptConnecte && (
                    <View>
                    <Champ
                      label={t('Modèle ChatGPT/Codex (optionnel)')}
                      value={chatgptModel}
                      onChangeText={setChatgptModel}
                      placeholder={t('Laisser vide = modèle automatique')}
                      autoCapitalize="none"
                      autoCorrect={false}
                      conteneurStyle={styles.champConteneur}
                    />
                      <Bouton
                        titre={t('Parcourir les modèles ChatGPT')}
                        variante="arcane"
                        onPress={() => ouvrirSelecteurModeles('chatgpt')}
                        style={styles.boutonAction}
                      />
                    </View>
                  )}
                </View>
              )}

              {moteurInference === 'infermatic' && (
                <View style={styles.blocFournisseur}>
                  <Champ
                    label={t('Clé API Infermatic')}
                    value={infermaticApiKey}
                    onChangeText={setInfermaticApiKey}
                    placeholder={t('Clé Infermatic')}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    conteneurStyle={styles.champConteneur}
                  />
                  <Champ
                    label={t('Modèle de narration')}
                    value={infermaticModel}
                    onChangeText={setInfermaticModel}
                    placeholder={t('Sélectionne un modèle retourné par Infermatic')}
                    autoCapitalize="none"
                    autoCorrect={false}
                    conteneurStyle={styles.champConteneur}
                  />
                  <Bouton
                    titre={t('Parcourir les modèles Infermatic')}
                    variante="arcane"
                    onPress={() => ouvrirSelecteurModeles('infermatic')}
                    style={styles.boutonAction}
                  />
                </View>
              )}

              {Platform.OS !== 'web' && moteurInference === 'local' && (
                <View style={styles.blocFournisseur}>
                  <Text style={styles.aide}>{t("Le modèle tourne entièrement sur l'appareil, sans connexion réseau ni clé API. Les performances dépendent directement du matériel.")}</Text>
                  <View style={styles.etatTechnique}>
                    <Text style={styles.ligneLabel}>{t('Modèle local')}</Text>
                    <Text style={styles.ligneValeur}>
                      {modeleLocalPresent
                        ? `${t('Importé')} · ${formaterTailleOctets(tailleModeleLocal ?? 0)}`
                        : t('Aucun modèle importé')}
                    </Text>
                  </View>
                  <Bouton
                    titre={importEnCours ? t('Import…') : t('Importer un modèle (.litertlm ou .task)')}
                    variante="arcane"
                    onPress={importerModele}
                    desactive={importEnCours}
                    style={styles.boutonAction}
                  />
                  {modeleLocalPresent && (
                    <Bouton
                      titre={t('Supprimer le modèle local')}
                      variante="secondaire"
                      onPress={supprimerModele}
                      style={styles.boutonAction}
                      texteStyle={{ color: couleurs.danger }}
                    />
                  )}
                  {erreurModeleLocal ? <Text style={[styles.statut, { color: couleurs.danger }]}>{erreurModeleLocal}</Text> : null}
                </View>
              )}
            </Panneau>
          </View>

          <View style={styles.colonne}>
            <Panneau style={styles.section}>
              <Text style={styles.sectionSurtitre}>{t('ILLUSTRATION')}</Text>
              <Text style={styles.sectionTitre}>{t('Images de scène')}</Text>
              <Text style={styles.sectionDescription}>{t('La génération d’images reste optionnelle, fonctionne en arrière-plan et ne bloque jamais la narration.')}</Text>

              <View style={styles.rangeeMoteur}>
                <Pressable
                  style={[styles.optionMoteur, !genererImagesActive && styles.optionMoteurActive]}
                  onPress={() => setGenererImagesActive(false)}
                >
                  <Text style={[styles.texteOptionMoteur, !genererImagesActive && styles.texteOptionMoteurActif]}>{t('Désactivée')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.optionMoteur, genererImagesActive && styles.optionMoteurActive]}
                  onPress={() => setGenererImagesActive(true)}
                >
                  <Text style={[styles.texteOptionMoteur, genererImagesActive && styles.texteOptionMoteurActif]}>{t('Activée')}</Text>
                </Pressable>
              </View>

              <Text style={styles.aide}>{t('Quand elle est active, l’action « Illustrer cette scène » apparaît dans le récit. Les portraits et illustrations restent enregistrés localement et servent de références visuelles aux scènes suivantes.')}</Text>

              {genererImagesActive && (
                <View style={styles.blocFournisseur}>
                  <Text style={styles.label}>{t("Fournisseur d'images")}</Text>
                  <View style={styles.rangeeMoteur}>
                    <Pressable
                      style={[styles.optionMoteur, fournisseurImages === 'chatgpt' && styles.optionMoteurActive]}
                      onPress={() => setFournisseurImages('chatgpt')}
                    >
                      <Text style={[styles.texteOptionMoteur, fournisseurImages === 'chatgpt' && styles.texteOptionMoteurActif]}>ChatGPT Plus</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.optionMoteur, fournisseurImages === 'openrouter' && styles.optionMoteurActive]}
                      onPress={() => setFournisseurImages('openrouter')}
                    >
                      <Text style={[styles.texteOptionMoteur, fournisseurImages === 'openrouter' && styles.texteOptionMoteurActif]}>OpenRouter</Text>
                    </Pressable>
                  </View>

                  {fournisseurImages === 'chatgpt' ? (
                    <>
                      <Text style={styles.aide}>{t('Réutilise la même connexion ChatGPT/Codex que le narrateur. La génération intégrée utilise GPT Image et consomme le quota inclus de ton compte ChatGPT.')}</Text>
                      {!chatgptConnecte && <Text style={[styles.aide, { color: couleurs.danger }]}>{t('Connecte d’abord ChatGPT Plus dans la section Narrateur.')}</Text>}
                    </>
                  ) : (
                    <>
                      {moteurInference !== 'openrouter' && (
                        <Champ
                          label={t('Clé OpenRouter pour les images')}
                          value={apiKey}
                          onChangeText={setApiKey}
                          placeholder="sk-or-v1-…"
                          secureTextEntry
                          autoCapitalize="none"
                          autoCorrect={false}
                          conteneurStyle={styles.champConteneur}
                        />
                      )}
                      {!apiKey.trim() && <Text style={[styles.aide, { color: couleurs.danger }]}>{t('Une clé API OpenRouter est requise pour ce fournisseur d’images.')}</Text>}
                      <Text style={styles.label}>{t("Mode d'images OpenRouter")}</Text>
                      <View style={styles.rangeeMoteur}>
                        <Pressable style={[styles.optionMoteur, !modeleImagesGratuit && styles.optionMoteurActive]} onPress={() => setModeleImagesGratuit(false)}>
                          <Text style={[styles.texteOptionMoteur, !modeleImagesGratuit && styles.texteOptionMoteurActif]}>{t('Payant · fiable')}</Text>
                        </Pressable>
                        <Pressable style={[styles.optionMoteur, modeleImagesGratuit && styles.optionMoteurActive]} onPress={() => setModeleImagesGratuit(true)}>
                          <Text style={[styles.texteOptionMoteur, modeleImagesGratuit && styles.texteOptionMoteurActif]}>{t('Gratuit · limité')}</Text>
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              )}
            </Panneau>

            <Panneau style={styles.section}>
              <Pressable
                onPress={() => setAvancesOuverts((v) => !v)}
                style={styles.enteteSectionPliable}
                accessibilityRole="button"
                accessibilityState={{ expanded: avancesOuverts }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionSurtitre}>{t('AVANCÉ')}</Text>
                  <Text style={styles.sectionTitre}>{t('Options techniques')}</Text>
                </View>
                <Text style={styles.chevron}>{avancesOuverts ? '−' : '+'}</Text>
              </Pressable>
              <Text style={styles.sectionDescription}>{t('Clés de secours et stockage technique. À modifier seulement si tu en as besoin.')}</Text>

              {avancesOuverts && (
                <View style={styles.blocAvance}>
                  {Platform.OS === 'web' && (
                    <>
                      <Pressable
                        style={[styles.ligneSelection, conserverClesWeb && styles.ligneSelectionActive]}
                        onPress={() => setConserverClesWeb((v) => !v)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: conserverClesWeb }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.ligneLabel}>{t('Conserver les clés sur ce navigateur')}</Text>
                          <Text style={styles.ligneValeur}>{t(conserverClesWeb ? 'Activé' : 'Désactivé')}</Text>
                        </View>
                      </Pressable>
                      <Text style={styles.aide}>{t('Le stockage web n’est pas chiffré. Cette option doit rester réservée à un appareil personnel.')}</Text>
                    </>
                  )}

                  <Champ
                    label={t('Clé API embeddings de secours')}
                    value={embeddingsApiKey}
                    onChangeText={setEmbeddingsApiKey}
                    placeholder="sk-…"
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    conteneurStyle={styles.champConteneur}
                  />
                  <Text style={styles.aide}>{t('OpenRouter peut utiliser cette clé OpenAI en secours pour la recherche sémantique. Infermatic utilise ses propres embeddings.')}</Text>

                  <Text style={styles.noteSecurite}>
                    {t(Platform.OS === 'web'
                      ? 'Sur le web, les clés restent normalement dans la session du navigateur.'
                      : 'Sur Android, les clés API sont conservées dans le coffre sécurisé de l’appareil.')}
                  </Text>
                </View>
              )}
            </Panneau>

            <Panneau style={styles.section}>
              <Text style={styles.sectionSurtitre}>{t('APPLICATION')}</Text>
              <Text style={styles.sectionTitre}>{t('Maintenance')}</Text>
              <View style={styles.ligneVersion}>
                <Text style={styles.ligneLabel}>{t('Version')}</Text>
                <Text style={styles.ligneValeur}>{VERSION_APP}</Text>
              </View>
              <Bouton
                titre={verificationMaj ? t('Vérification…') : t('Vérifier les mises à jour')}
                variante="secondaire"
                onPress={verifierMaj}
                desactive={verificationMaj}
                style={styles.boutonAction}
              />
              {messageMaj ? <Text style={styles.aide}>{messageMaj}</Text> : null}
              {urlMaj ? (
                <Bouton
                  titre={t('Ouvrir la dernière version')}
                  variante="arcane"
                  onPress={() => Linking.openURL(urlMaj)}
                  style={styles.boutonAction}
                />
              ) : null}

              <View style={styles.separateurInterne} />
              <Text style={styles.ligneLabel}>{t('Outils concepteur')}</Text>
              <Text style={styles.aide}>{t('Débogage narratif, contrôles moteur et réglages de prompt avancés pour la phase de test.')}</Text>
              <Bouton
                titre={t('Ouvrir les réglages concepteur')}
                variante="secondaire"
                onPress={() => navigation.navigate('ReglagesConcepteur')}
                style={styles.boutonAction}
              />
            </Panneau>
          </View>
        </View>

        {messageStatut ? <Text style={[styles.statut, styles.statutGlobal]}>{messageStatut}</Text> : null}

        <View style={styles.zoneEnregistrement}>
          <Text style={styles.zoneEnregistrementTexte}>{t('Les changements prennent effet après enregistrement.')}</Text>
          <Bouton
            titre={enregistrement ? t('Enregistrement…') : t('Enregistrer les réglages')}
            onPress={enregistrer}
            desactive={enregistrement}
            style={styles.boutonPrincipal}
          />
        </View>

        <Modal visible={modalOuvert} animationType="slide" onRequestClose={() => setModalOuvert(false)}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalSurtitre}>{t('CATALOGUE')}</Text>
            <Text style={styles.titre}>{fournisseurCatalogue === 'chatgpt' ? t('Modèles ChatGPT') : fournisseurCatalogue === 'infermatic' ? t('Modèles Infermatic') : t('Modèles OpenRouter')}</Text>
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
                      if (fournisseurCatalogue === 'chatgpt') setChatgptModel(item.id);
                      else if (fournisseurCatalogue === 'infermatic') setInfermaticModel(item.id);
                      else setModel(item.id);
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
            <Text style={styles.modalSurtitre}>{t('EXPÉRIENCE')}</Text>
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
    backgroundColor: couleurs.fond,
  },
  centreChargement: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: espacement.lg,
  },
  contenuPage: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    paddingHorizontal: espacement.lg,
    paddingTop: espacement.xl,
    paddingBottom: espacement.xxl,
  },
  entetePage: {
    marginBottom: espacement.lg,
  },
  surtitre: {
    ...stylePetitesCapitales,
    color: couleurs.dore,
    fontSize: 11,
    letterSpacing: 2.2,
    marginBottom: 4,
  },
  titre: {
    color: couleurs.texte,
    fontFamily: polices.display,
    fontSize: 30,
    letterSpacing: 1.1,
  },
  sousTitre: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 16,
    lineHeight: 21,
    maxWidth: 720,
    marginTop: espacement.xs,
  },
  resumeGrid: {
    gap: espacement.sm,
    marginBottom: espacement.lg,
  },
  resumeGridTablette: {
    flexDirection: 'row',
  },
  resumeCarte: {
    paddingVertical: espacement.sm,
    paddingHorizontal: espacement.md,
  },
  resumeCarteTablette: {
    flex: 1,
  },
  resumeLabel: {
    ...stylePetitesCapitales,
    color: couleurs.texteFaible,
    fontSize: 9,
  },
  resumeValeur: {
    color: couleurs.doreClair,
    fontFamily: polices.titre,
    fontSize: 17,
    marginTop: 2,
  },
  colonnes: {
    gap: espacement.md,
  },
  colonnesTablette: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  colonne: {
    flex: 1,
    gap: espacement.md,
  },
  section: {
    padding: espacement.lg,
    backgroundColor: couleurs.fondCarteDense,
    borderColor: couleurs.bordureSubtile,
  },
  sectionSurtitre: {
    ...stylePetitesCapitales,
    color: couleurs.dore,
    fontSize: 9,
    letterSpacing: 1.8,
    marginBottom: 3,
  },
  sectionTitre: {
    color: couleurs.texte,
    fontFamily: polices.titre,
    fontSize: 22,
    lineHeight: 25,
  },
  sectionDescription: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 14,
    lineHeight: 19,
    marginTop: espacement.xs,
    marginBottom: espacement.md,
  },
  label: {
    ...stylePetitesCapitales,
    color: couleurs.texteAtténué,
    fontSize: 11,
    marginTop: espacement.sm,
    marginBottom: espacement.xs,
  },
  champConteneur: {
    marginTop: espacement.md,
  },
  aide: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 13,
    lineHeight: 18,
    marginTop: espacement.xs,
  },
  statut: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    marginTop: espacement.md,
  },
  statutGlobal: {
    textAlign: 'center',
  },
  ligneSelection: {
    minHeight: 58,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    backgroundColor: couleurs.fondChampSaisie,
    paddingHorizontal: espacement.md,
    paddingVertical: espacement.sm,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: espacement.sm,
  },
  ligneSelectionActive: {
    borderColor: couleurs.accent,
  },
  ligneLabel: {
    ...stylePetitesCapitales,
    color: couleurs.texteAtténué,
    fontSize: 10,
  },
  ligneValeur: {
    color: couleurs.texte,
    fontFamily: polices.corpsMedium,
    fontSize: 15,
    marginTop: 2,
  },
  chevron: {
    color: couleurs.dore,
    fontFamily: polices.display,
    fontSize: 25,
    marginLeft: espacement.sm,
  },
  rangeeMoteur: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacement.sm,
  },
  optionMoteur: {
    minHeight: 48,
    flexGrow: 1,
    flexBasis: 100,
    paddingHorizontal: espacement.sm,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    backgroundColor: couleurs.fondChampSaisie,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionMoteurActive: {
    borderColor: couleurs.accent,
    backgroundColor: 'rgba(78, 174, 248, 0.10)',
  },
  texteOptionMoteur: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corpsMedium,
    fontSize: 14,
    textAlign: 'center',
  },
  texteOptionMoteurActif: {
    color: couleurs.accentClair,
  },
  blocFournisseur: {
    marginTop: espacement.sm,
  },
  boutonAction: {
    marginTop: espacement.sm,
  },
  etatTechnique: {
    borderLeftWidth: 2,
    borderLeftColor: couleurs.accent,
    paddingLeft: espacement.sm,
    marginTop: espacement.md,
  },
  enteteSectionPliable: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  blocAvance: {
    marginTop: espacement.sm,
  },
  noteSecurite: {
    color: couleurs.texteFaible,
    fontFamily: polices.corps,
    fontSize: 12,
    lineHeight: 17,
    marginTop: espacement.md,
    fontStyle: 'italic',
  },
  ligneVersion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 42,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bordureSubtile,
  },
  separateurInterne: {
    height: 1,
    backgroundColor: couleurs.bordureSubtile,
    marginVertical: espacement.lg,
  },
  zoneEnregistrement: {
    marginTop: espacement.lg,
    padding: espacement.md,
    borderWidth: 1,
    borderColor: couleurs.bordureDoree,
    backgroundColor: 'rgba(4, 10, 18, 0.86)',
  },
  zoneEnregistrementTexte: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: espacement.sm,
  },
  boutonPrincipal: {
    alignSelf: 'stretch',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: couleurs.fond,
    padding: espacement.lg,
    paddingTop: espacement.xl,
  },
  modalSurtitre: {
    ...stylePetitesCapitales,
    color: couleurs.dore,
    fontSize: 10,
    letterSpacing: 1.8,
    marginBottom: 4,
  },
  ligneModele: {
    paddingVertical: espacement.sm,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bordure,
  },
  nomModele: {
    color: couleurs.texte,
    fontFamily: polices.corpsMedium,
    fontSize: 16,
  },
  idModele: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 12,
    marginTop: 2,
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
    fontSize: 19,
    marginBottom: espacement.xs,
  },
});
