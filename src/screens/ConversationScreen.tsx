import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Swipeable } from 'react-native-gesture-handler';
import * as Clipboard from 'expo-clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { AppSettings, Message, StoryState } from '../types';
import { getSettings, getStory, saveStory } from '../storage/storage';
import {
  calculerDebugLore,
  construirePromptDebug,
  forcerMiseAJourEtat,
  genererTour,
  regenererDernierTour,
  type DebugLore,
} from '../engine/generateTurn';
import { annulerTours } from '../engine/noyauNarratif';
import { creerBranche } from '../engine/story';
import { detecterCommandeRetenir, verrouillerFait } from '../engine/memory';
import { suggererRepliqueJoueur } from '../engine/suggestion';
import { useVisualAutomation } from '../automation/useVisualAutomation';
import { ErreurOpenRouter } from '../engine/openrouter';
import { ErreurEmbeddings } from '../engine/embeddings';
import { ErreurProfilContenu, validerEntreeUtilisateur } from '../engine/contenuAdulte';
import { exporterConversation, type FormatExport } from '../engine/conversationExport';
import { couleurs, espacement, polices, rayon, stylePetitesCapitales } from '../theme/theme';
import Bouton from '../components/Bouton';
import Champ from '../components/Champ';
import FondAtmospherique from '../components/FondAtmospherique';
import MenuActionsMessage from '../components/MenuActionsMessage';
import Panneau from '../components/Panneau';
import TexteMessageFormate from '../components/TexteMessageFormate';
import BoutonDictee from '../components/BoutonDictee';
import { useLangue } from '../i18n/LangueProvider';

const IMAGE_CONVERSATION = require('../../assets/scenes/cour-des-serments.png');

type Props = NativeStackScreenProps<RootStackParamList, 'Conversation'>;

const SEUIL_PAUSE_MS = 6 * 60 * 60 * 1000;

// Les images d'avatar sont limitées aux messages récents pour éviter de
// redécoder le même PNG des dizaines de fois sur de longues histoires.
const MAX_MESSAGES_RECENTS_AVEC_AVATARS = 20;

function messageErreur(e: unknown, messageParDefaut: string): string {
  if (e instanceof ErreurOpenRouter || e instanceof ErreurEmbeddings || e instanceof ErreurProfilContenu) {
    return e.message;
  }
  if (e instanceof Error && e.message) return e.message;
  return messageParDefaut;
}

function formaterDureeGeneration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
}

export default function ConversationScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useLangue();
  const { storyId } = route.params;
  const [story, setStory] = useState<StoryState | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [saisie, setSaisie] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [messageStatut, setMessageStatut] = useState('');
  const [debugLore, setDebugLore] = useState<DebugLore | null>(null);
  const debugLoreMessageIdRef = useRef<string | null>(null);
  const [debugOuvert, setDebugOuvert] = useState(false);
  const [actionsOuvertes, setActionsOuvertes] = useState(false);
  const [portraitsOuverts, setPortraitsOuverts] = useState(false);
  const [rechargement, setRechargement] = useState(0);
  const [sauvegardeEnEchec, setSauvegardeEnEchec] = useState(false);
  const listeRef = useRef<FlatList<Message>>(null);

  const [modalContexteOuvert, setModalContexteOuvert] = useState(false);
  const [lieuEdit, setLieuEdit] = useState('');
  const [ambianceEdit, setAmbianceEdit] = useState('');
  const [dateEdit, setDateEdit] = useState('');
  const [objectifsEdit, setObjectifsEdit] = useState('');
  const [erreurContexte, setErreurContexte] = useState('');

  const [modalRechercheOuvert, setModalRechercheOuvert] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [rechercheIndex, setRechercheIndex] = useState(0);

  const [modalContextePromptOuvert, setModalContextePromptOuvert] = useState(false);
  const [promptDebug, setPromptDebug] = useState('');
  const [promptDebugCharge, setPromptDebugCharge] = useState(false);

  const [modalExportOuvert, setModalExportOuvert] = useState(false);
  const [exportEnCours, setExportEnCours] = useState(false);

  const [modalEditionOuvert, setModalEditionOuvert] = useState(false);
  const [messageEdition, setMessageEdition] = useState<Message | null>(null);
  const [texteEdition, setTexteEdition] = useState('');
  const [erreurEdition, setErreurEdition] = useState('');

  const [modalSuppressionOuvert, setModalSuppressionOuvert] = useState(false);
  const [messageSuppression, setMessageSuppression] = useState<Message | null>(null);

  const [modalReponseOuvert, setModalReponseOuvert] = useState(false);
  const [messageReponse, setMessageReponse] = useState<Message | null>(null);

  const [suggestion, setSuggestion] = useState('');
  const [suggestionEnCours, setSuggestionEnCours] = useState(false);

  const [miseAJourEtatEnCours, setMiseAJourEtatEnCours] = useState(false);

  const [modalInfosOuvert, setModalInfosOuvert] = useState(false);

  const [modalImageOuvert, setModalImageOuvert] = useState(false);
  const [imageGeneree, setImageGeneree] = useState('');
  const [imageEnCours, setImageEnCours] = useState(false);
  const [erreurImage, setErreurImage] = useState('');

  const visual = useVisualAutomation(storyId);

  const charger = useCallback(async () => {
    try {
      setErreur('');
      const [s, reglages] = await Promise.all([getStory(storyId), getSettings()]);
      setStory(s);
      setAppSettings(reglages);
    } catch (e) {
      setErreur(messageErreur(e, t('Impossible de charger la conversation.')));
    }
  }, [storyId, t, rechargement]);

  useFocusEffect(
    useCallback(() => {
      void charger();
    }, [charger]),
  );

  useEffect(() => {
    if (!story) return;
    if (Date.now() - story.updatedAt > SEUIL_PAUSE_MS) {
      setMessageStatut(t('La chronique reprend après une longue pause.'));
    }
  }, [story?.meta.id]);

  async function sauvegarder(suivante: StoryState) {
    setStory(suivante);
    try {
      await saveStory(suivante);
      setSauvegardeEnEchec(false);
    } catch (e) {
      setSauvegardeEnEchec(true);
      setErreur(messageErreur(e, t('La sauvegarde a échoué.')));
    }
  }

  async function envoyer() {
    if (!story || !appSettings || enCours || !saisie.trim()) return;
    const texte = saisie.trim();
    setErreur('');
    try {
      validerEntreeUtilisateur(texte, appSettings.profilContenu);
    } catch (e) {
      setErreur(messageErreur(e, t('Message refusé.')));
      return;
    }
    setSaisie('');
    setEnCours(true);
    try {
      const resultat = await genererTour(story, appSettings, texte, messageReponse?.id);
      setMessageReponse(null);
      await sauvegarder(resultat.story);
      setDebugLore(resultat.debugLore);
      debugLoreMessageIdRef.current = resultat.story.messages.at(-1)?.id ?? null;
      if (resultat.aEteCorrige) setMessageStatut(t('Une incohérence a été corrigée automatiquement.'));
    } catch (e) {
      setErreur(messageErreur(e, t('Une erreur est survenue. Réessaie.')));
      setSaisie(texte);
    } finally {
      setEnCours(false);
    }
  }

  async function regenerer() {
    if (!story || !appSettings || enCours) return;
    setErreur('');
    setEnCours(true);
    try {
      const resultat = await regenererDernierTour(story, appSettings);
      await sauvegarder(resultat.story);
      setDebugLore(resultat.debugLore);
      debugLoreMessageIdRef.current = resultat.story.messages.at(-1)?.id ?? null;
    } catch (e) {
      setErreur(messageErreur(e, t('Régénération impossible.')));
    } finally {
      setEnCours(false);
    }
  }

  async function suggerer() {
    if (!story || !appSettings || suggestionEnCours) return;
    setSuggestionEnCours(true);
    setSuggestion('');
    try {
      setSuggestion(await suggererRepliqueJoueur(story, appSettings));
    } catch (e) {
      setErreur(messageErreur(e, t('Suggestion impossible.')));
    } finally {
      setSuggestionEnCours(false);
    }
  }

  async function forcerEtat() {
    if (!story || !appSettings || miseAJourEtatEnCours) return;
    setMiseAJourEtatEnCours(true);
    try {
      await sauvegarder(await forcerMiseAJourEtat(story, appSettings));
      setMessageStatut(t('État narratif mis à jour.'));
    } catch (e) {
      setErreur(messageErreur(e, t('Mise à jour impossible.')));
    } finally {
      setMiseAJourEtatEnCours(false);
    }
  }

  async function chargerDebug() {
    if (!story || !appSettings) return;
    setPromptDebugCharge(false);
    setModalContextePromptOuvert(true);
    try {
      setPromptDebug(await construirePromptDebug(story, '', appSettings));
    } catch (e) {
      setPromptDebug(messageErreur(e, t('Impossible de construire le contexte.')));
    } finally {
      setPromptDebugCharge(true);
    }
  }

  async function chargerLoreDebug() {
    if (!story || !appSettings) return;
    try {
      const dernier = story.messages.at(-1)?.content ?? '';
      setDebugLore(await calculerDebugLore(story, dernier, appSettings));
      debugLoreMessageIdRef.current = story.messages.at(-1)?.id ?? null;
      setDebugOuvert(true);
    } catch (e) {
      setErreur(messageErreur(e, t('Impossible de calculer le debug lore.')));
    }
  }

  function ouvrirEdition(message: Message) {
    setMessageEdition(message);
    setTexteEdition(message.content);
    setErreurEdition('');
    setModalEditionOuvert(true);
  }

  async function enregistrerEdition() {
    if (!story || !messageEdition || !texteEdition.trim()) return;
    try {
      validerEntreeUtilisateur(texteEdition.trim(), appSettings?.profilContenu);
    } catch (e) {
      setErreurEdition(messageErreur(e, t('Modification refusée.')));
      return;
    }
    const index = story.messages.findIndex((m) => m.id === messageEdition.id);
    if (index < 0) return;
    const messages = story.messages.slice(0, index + 1).map((m) =>
      m.id === messageEdition.id ? { ...m, content: texteEdition.trim() } : m,
    );
    const suivante = annulerTours({ ...story, messages }, story.messages.slice(index + 1).map((m) => m.id));
    await sauvegarder(suivante);
    setModalEditionOuvert(false);
  }

  async function confirmerSuppression() {
    if (!story || !messageSuppression) return;
    const index = story.messages.findIndex((m) => m.id === messageSuppression.id);
    if (index < 0) return;
    const idsSupprimes = story.messages.slice(index).map((m) => m.id);
    await sauvegarder(annulerTours({ ...story, messages: story.messages.slice(0, index) }, idsSupprimes));
    setModalSuppressionOuvert(false);
  }

  async function copier(texte: string) {
    await Clipboard.setStringAsync(texte);
    setMessageStatut(t('Copié.'));
  }

  async function exporter(format: FormatExport) {
    if (!story || exportEnCours) return;
    setExportEnCours(true);
    try {
      await exporterConversation(story, format);
      setModalExportOuvert(false);
    } catch (e) {
      setErreur(messageErreur(e, t('Export impossible.')));
    } finally {
      setExportEnCours(false);
    }
  }

  async function illustrerScene() {
    // La génération d'images externe a été retirée. L'interface conserve
    // seulement les images/portraits déjà présents dans les sauvegardes.
    setErreurImage(t('La génération d’images n’est pas disponible avec Elyndor Cloud pour le moment.'));
    setModalImageOuvert(true);
  }

  const messagesFiltres = story?.messages.filter((m) =>
    !recherche.trim() || m.content.toLowerCase().includes(recherche.trim().toLowerCase()),
  ) ?? [];

  const indexRecherche = Math.min(rechercheIndex, Math.max(0, messagesFiltres.length - 1));

  const avatarsRecents = new Set(
    (story?.messages.slice(-MAX_MESSAGES_RECENTS_AVEC_AVATARS) ?? []).map((m) => m.id),
  );

  if (!story || !appSettings) {
    return (
      <FondAtmospherique image={IMAGE_CONVERSATION} overlay={0.75}>
        <View style={styles.centre}>
          {erreur ? <Text style={styles.erreur}>{erreur}</Text> : <ActivityIndicator size="large" />}
        </View>
      </FondAtmospherique>
    );
  }

  return (
    <FondAtmospherique image={IMAGE_CONVERSATION} overlay={0.82}>
      <View style={[styles.page, { paddingTop: insets.top }]}> 
        <View style={styles.entete}>
          <View style={styles.enteteTexte}>
            <Text style={styles.titre}>{story.meta.titre}</Text>
            <Text style={styles.sousTitre}>{story.meta.personnageNom}</Text>
          </View>
          <Pressable onPress={() => setActionsOuvertes(true)} style={styles.boutonMenu}>
            <Text style={styles.boutonMenuTexte}>⋮</Text>
          </Pressable>
        </View>

        {messageStatut ? (
          <Pressable onPress={() => setMessageStatut('')}>
            <Text style={styles.statut}>{messageStatut}</Text>
          </Pressable>
        ) : null}
        {sauvegardeEnEchec ? <Text style={styles.erreur}>{t('Sauvegarde non confirmée.')}</Text> : null}
        {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

        <FlatList
          ref={listeRef}
          data={messagesFiltres}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.liste}
          renderItem={({ item }) => (
            <Swipeable
              renderRightActions={() => (
                <View style={styles.actionsSwipe}>
                  <Pressable onPress={() => copier(item.content)}><Text style={styles.actionSwipe}>Copier</Text></Pressable>
                  <Pressable onPress={() => ouvrirEdition(item)}><Text style={styles.actionSwipe}>Éditer</Text></Pressable>
                  <Pressable onPress={() => { setMessageSuppression(item); setModalSuppressionOuvert(true); }}><Text style={styles.actionSwipe}>Suppr.</Text></Pressable>
                </View>
              )}
            >
              <Pressable
                onLongPress={() => { setMessageReponse(item); setModalReponseOuvert(true); }}
                style={[styles.message, item.role === 'user' ? styles.messageUser : styles.messageAssistant]}
              >
                <TexteMessageFormate texte={item.content} />
                {item.role === 'assistant' && item.dureeGenerationMs !== undefined ? (
                  <Text style={styles.metaMessage}>{formaterDureeGeneration(item.dureeGenerationMs)}</Text>
                ) : null}
                {avatarsRecents.has(item.id) && item.avatarUri ? (
                  <Image source={{ uri: item.avatarUri }} style={styles.avatarMessage} />
                ) : null}
              </Pressable>
            </Swipeable>
          )}
        />

        {messageReponse ? (
          <View style={styles.reponseA}>
            <Text numberOfLines={1}>{t('Réponse à :')} {messageReponse.content}</Text>
            <Pressable onPress={() => setMessageReponse(null)}><Text>✕</Text></Pressable>
          </View>
        ) : null}

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.composer}>
            <BoutonDictee onTexte={(texte) => setSaisie((s) => `${s}${s ? ' ' : ''}${texte}`)} disabled={enCours} />
            <View style={styles.champComposer}>
              <Champ valeur={saisie} onChange={setSaisie} placeholder={t('Que fais-tu ?')} multiline />
            </View>
            <Bouton titre={enCours ? t('…') : t('Envoyer')} onPress={envoyer} disabled={enCours || !saisie.trim()} />
          </View>
        </KeyboardAvoidingView>
      </View>

      <Modal visible={actionsOuvertes} transparent animationType="fade" onRequestClose={() => setActionsOuvertes(false)}>
        <Pressable style={styles.overlay} onPress={() => setActionsOuvertes(false)}>
          <Panneau style={styles.menuActions}>
            <Bouton titre={t('Régénérer la dernière réponse')} onPress={() => { setActionsOuvertes(false); void regenerer(); }} />
            <Bouton titre={t('Suggérer une réplique')} onPress={() => { setActionsOuvertes(false); void suggerer(); }} />
            <Bouton titre={t('Recherche')} onPress={() => { setActionsOuvertes(false); setModalRechercheOuvert(true); }} />
            <Bouton titre={t('Contexte')} onPress={() => { setActionsOuvertes(false); setLieuEdit(story.meta.contexte.lieu); setAmbianceEdit(story.meta.contexte.ambiance); setDateEdit(story.meta.contexte.dateChronique ?? ''); setObjectifsEdit(story.meta.contexte.objectifs ?? ''); setModalContexteOuvert(true); }} />
            <Bouton titre={t('Portraits')} onPress={() => { setActionsOuvertes(false); setPortraitsOuverts(true); }} />
            <Bouton titre={t('Exporter')} onPress={() => { setActionsOuvertes(false); setModalExportOuvert(true); }} />
            <Bouton titre={t('Infos')} onPress={() => { setActionsOuvertes(false); setModalInfosOuvert(true); }} />
            <Bouton titre={t('Fermer')} onPress={() => setActionsOuvertes(false)} />
          </Panneau>
        </Pressable>
      </Modal>

      <Modal visible={modalContexteOuvert} animationType="slide" onRequestClose={() => setModalContexteOuvert(false)}>
        <ScrollView contentContainerStyle={styles.modalPage}>
          <Text style={styles.titreModal}>{t('Contexte')}</Text>
          <Champ valeur={lieuEdit} onChange={setLieuEdit} label={t('Lieu')} />
          <Champ valeur={ambianceEdit} onChange={setAmbianceEdit} label={t('Ambiance')} multiline />
          <Champ valeur={dateEdit} onChange={setDateEdit} label={t('Date chronique')} />
          <Champ valeur={objectifsEdit} onChange={setObjectifsEdit} label={t('Objectifs')} multiline />
          {erreurContexte ? <Text style={styles.erreur}>{erreurContexte}</Text> : null}
          <Bouton titre={t('Enregistrer')} onPress={async () => {
            try {
              validerEntreeUtilisateur([lieuEdit, ambianceEdit, dateEdit, objectifsEdit].join('\n'), appSettings.profilContenu);
              await sauvegarder({ ...story, meta: { ...story.meta, contexte: { ...story.meta.contexte, lieu: lieuEdit, ambiance: ambianceEdit, dateChronique: dateEdit, objectifs: objectifsEdit } } });
              setModalContexteOuvert(false);
            } catch (e) {
              setErreurContexte(messageErreur(e, t('Contexte refusé.')));
            }
          }} />
          <Bouton titre={t('Annuler')} onPress={() => setModalContexteOuvert(false)} />
        </ScrollView>
      </Modal>

      <Modal visible={modalRechercheOuvert} animationType="slide" onRequestClose={() => setModalRechercheOuvert(false)}>
        <View style={styles.modalPage}>
          <Text style={styles.titreModal}>{t('Recherche')}</Text>
          <Champ valeur={recherche} onChange={(v) => { setRecherche(v); setRechercheIndex(0); }} />
          <Text>{messagesFiltres.length ? `${indexRecherche + 1} / ${messagesFiltres.length}` : t('Aucun résultat')}</Text>
          <View style={styles.ligneBoutons}>
            <Bouton titre="←" onPress={() => setRechercheIndex((i) => Math.max(0, i - 1))} />
            <Bouton titre="→" onPress={() => setRechercheIndex((i) => Math.min(messagesFiltres.length - 1, i + 1))} />
          </View>
          <Bouton titre={t('Fermer')} onPress={() => setModalRechercheOuvert(false)} />
        </View>
      </Modal>

      <Modal visible={modalContextePromptOuvert} animationType="slide" onRequestClose={() => setModalContextePromptOuvert(false)}>
        <ScrollView contentContainerStyle={styles.modalPage}>
          <Text style={styles.titreModal}>{t('Contexte envoyé au modèle')}</Text>
          {!promptDebugCharge ? <ActivityIndicator /> : <Text selectable>{promptDebug}</Text>}
          <Bouton titre={t('Fermer')} onPress={() => setModalContextePromptOuvert(false)} />
        </ScrollView>
      </Modal>

      <Modal visible={debugOuvert} animationType="slide" onRequestClose={() => setDebugOuvert(false)}>
        <ScrollView contentContainerStyle={styles.modalPage}>
          <Text style={styles.titreModal}>{t('Debug lore')}</Text>
          <Text>{JSON.stringify(debugLore, null, 2)}</Text>
          <Bouton titre={t('Fermer')} onPress={() => setDebugOuvert(false)} />
        </ScrollView>
      </Modal>

      <Modal visible={portraitsOuverts} animationType="slide" onRequestClose={() => setPortraitsOuverts(false)}>
        <ScrollView contentContainerStyle={styles.modalPage}>
          <Text style={styles.titreModal}>{t('Portraits')}</Text>
          <Text>{t('Les portraits déjà enregistrés restent disponibles. La génération externe est désactivée avec Elyndor Cloud.')}</Text>
          <Bouton titre={t('Fermer')} onPress={() => setPortraitsOuverts(false)} />
        </ScrollView>
      </Modal>

      <Modal visible={modalExportOuvert} transparent animationType="fade" onRequestClose={() => setModalExportOuvert(false)}>
        <View style={styles.overlay}>
          <Panneau style={styles.menuActions}>
            <Bouton titre="TXT" onPress={() => void exporter('txt')} disabled={exportEnCours} />
            <Bouton titre="PDF" onPress={() => void exporter('pdf')} disabled={exportEnCours} />
            <Bouton titre="EPUB" onPress={() => void exporter('epub')} disabled={exportEnCours} />
            <Bouton titre={t('Annuler')} onPress={() => setModalExportOuvert(false)} />
          </Panneau>
        </View>
      </Modal>

      <Modal visible={modalEditionOuvert} animationType="slide" onRequestClose={() => setModalEditionOuvert(false)}>
        <View style={styles.modalPage}>
          <Text style={styles.titreModal}>{t('Modifier le message')}</Text>
          <Champ valeur={texteEdition} onChange={setTexteEdition} multiline />
          {erreurEdition ? <Text style={styles.erreur}>{erreurEdition}</Text> : null}
          <Bouton titre={t('Enregistrer')} onPress={() => void enregistrerEdition()} />
          <Bouton titre={t('Annuler')} onPress={() => setModalEditionOuvert(false)} />
        </View>
      </Modal>

      <Modal visible={modalSuppressionOuvert} transparent animationType="fade" onRequestClose={() => setModalSuppressionOuvert(false)}>
        <View style={styles.overlay}>
          <Panneau style={styles.menuActions}>
            <Text>{t('Supprimer ce message et toute la suite ?')}</Text>
            <Bouton titre={t('Supprimer')} onPress={() => void confirmerSuppression()} />
            <Bouton titre={t('Annuler')} onPress={() => setModalSuppressionOuvert(false)} />
          </Panneau>
        </View>
      </Modal>

      <Modal visible={modalReponseOuvert} transparent animationType="fade" onRequestClose={() => setModalReponseOuvert(false)}>
        <Pressable style={styles.overlay} onPress={() => setModalReponseOuvert(false)}>
          <MenuActionsMessage
            onCopier={() => messageReponse && void copier(messageReponse.content)}
            onModifier={() => { if (messageReponse) ouvrirEdition(messageReponse); setModalReponseOuvert(false); }}
            onSupprimer={() => { setMessageSuppression(messageReponse); setModalSuppressionOuvert(false); setModalReponseOuvert(false); }}
            onRepondre={() => setModalReponseOuvert(false)}
          />
        </Pressable>
      </Modal>

      <Modal visible={modalInfosOuvert} animationType="slide" onRequestClose={() => setModalInfosOuvert(false)}>
        <ScrollView contentContainerStyle={styles.modalPage}>
          <Text style={styles.titreModal}>{t('Informations')}</Text>
          <Bouton titre={t('Debug lore')} onPress={() => void chargerLoreDebug()} />
          <Bouton titre={t('Voir le contexte modèle')} onPress={() => void chargerDebug()} />
          <Bouton titre={t('Forcer mise à jour état')} onPress={() => void forcerEtat()} disabled={miseAJourEtatEnCours} />
          <Bouton titre={t('Fermer')} onPress={() => setModalInfosOuvert(false)} />
        </ScrollView>
      </Modal>

      <Modal visible={modalImageOuvert} transparent animationType="fade" onRequestClose={() => setModalImageOuvert(false)}>
        <View style={styles.overlay}>
          <Panneau style={styles.menuActions}>
            {imageEnCours ? <ActivityIndicator /> : null}
            {imageGeneree ? <Image source={{ uri: imageGeneree }} style={styles.imageGeneree} /> : null}
            {erreurImage ? <Text style={styles.erreur}>{erreurImage}</Text> : null}
            <Bouton titre={t('Fermer')} onPress={() => setModalImageOuvert(false)} />
          </Panneau>
        </View>
      </Modal>
    </FondAtmospherique>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espacement.xl },
  entete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: espacement.lg, paddingVertical: espacement.md },
  enteteTexte: { flex: 1 },
  titre: { fontFamily: polices.titre, fontSize: 24, color: couleurs.texteClair },
  sousTitre: { fontFamily: polices.texte, fontSize: 14, color: couleurs.texteSecondaire },
  boutonMenu: { padding: espacement.md },
  boutonMenuTexte: { color: couleurs.texteClair, fontSize: 28 },
  statut: { padding: espacement.sm, textAlign: 'center', color: couleurs.or },
  erreur: { color: couleurs.danger, padding: espacement.sm },
  liste: { padding: espacement.md, gap: espacement.sm },
  message: { padding: espacement.md, borderRadius: rayon.md, maxWidth: '90%' },
  messageUser: { alignSelf: 'flex-end', backgroundColor: couleurs.surfaceClaire },
  messageAssistant: { alignSelf: 'flex-start', backgroundColor: couleurs.surfaceSombre },
  metaMessage: { marginTop: espacement.xs, fontSize: 11, opacity: 0.65 },
  avatarMessage: { width: 36, height: 36, borderRadius: 18, marginTop: espacement.xs },
  actionsSwipe: { flexDirection: 'row', alignItems: 'center', gap: espacement.sm, paddingHorizontal: espacement.sm },
  actionSwipe: { color: couleurs.texteClair },
  reponseA: { flexDirection: 'row', justifyContent: 'space-between', padding: espacement.sm, backgroundColor: couleurs.surfaceClaire },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: espacement.sm, padding: espacement.sm },
  champComposer: { flex: 1 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: espacement.lg },
  menuActions: { width: '100%', maxWidth: 520, gap: espacement.sm },
  modalPage: { flexGrow: 1, padding: espacement.xl, gap: espacement.md, backgroundColor: couleurs.fond },
  titreModal: { fontFamily: polices.titre, fontSize: 24, color: couleurs.texteClair, ...stylePetitesCapitales },
  ligneBoutons: { flexDirection: 'row', gap: espacement.sm },
  imageGeneree: { width: '100%', aspectRatio: 1, resizeMode: 'contain' },
});
