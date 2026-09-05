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
import { Swipeable } from 'react-native-gesture-handler';
import * as Clipboard from 'expo-clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { AppSettings, EntreeLoreEmergent, Message, StoryState } from '../types';
import { getSettings, getStory, saveStory } from '../storage/storage';
import {
  calculerDebugLore,
  construirePromptDebug,
  forcerMiseAJourEtat,
  genererTour,
  regenererDernierTour,
  type DebugLore,
} from '../engine/generateTurn';
import { creerBranche } from '../engine/story';
import { detecterCommandeRetenir, verrouillerFait } from '../engine/memory';
import { suggererRepliqueJoueur } from '../engine/suggestion';
import {
  obtenirPromptScene,
  genererImageScene,
  obtenirOuGenererAvatarPnj,
  obtenirOuGenererAvatarJoueur,
  obtenirPortraitReferenceJoueur,
  pnjMentionneDansTexte,
  ID_AVATAR_JOUEUR,
} from '../engine/images';
import { obtenirAvatarPnj } from '../storage/pnjAvatarsStore';
import { ErreurOpenRouter } from '../engine/openrouter';
import { ErreurEmbeddings } from '../engine/embeddings';
import { ErreurMoteurLocal } from '../engine/localInference';
import { ErreurProfilContenu, validerEntreeUtilisateur } from '../engine/contenuAdulte';
import { exporterConversation, type FormatExport } from '../engine/conversationExport';
import { couleurs, espacement, polices, stylePetitesCapitales } from '../theme/theme';
import Bouton from '../components/Bouton';
import Champ from '../components/Champ';
import FondAtmospherique from '../components/FondAtmospherique';
import MenuActionsMessage from '../components/MenuActionsMessage';
import Panneau from '../components/Panneau';
import TexteMessageFormate from '../components/TexteMessageFormate';
import BoutonDictee from '../components/BoutonDictee';
import { useLangue } from '../i18n/LangueProvider';

const IMAGE_CONVERSATION = require('../../assets/scenes/creation-point-depart.png');

type Props = NativeStackScreenProps<RootStackParamList, 'Conversation'>;

// Rouvrir une histoire après une pause plus longue que ça déclenche le
// bandeau "La dernière fois…" (Ajouts_A_Integrer.md #3).
const SEUIL_PAUSE_MS = 6 * 60 * 60 * 1000;

// Nombre max d'avatars de PNJ envoyés comme images de référence à
// l'illustration de scène (voir illustrerScene) — même logique de plafond
// que le reste (dilue l'attention/le payload au-delà d'un certain point).
const MAX_PNJ_REFERENCE_SCENE = 2;

// Nombre max de messages du joueur (en partant de la fin) qui affichent
// l'image de son avatar en en-tête — voir le rendu de la bulle plus bas.
// Le nom seul (texte) reste affiché sur tous les messages, sans plafond :
// c'est l'IMAGE (un data: URL base64 potentiellement lourd) répétée sur
// chaque message qui pose problème sur une longue histoire.
const MAX_AVATARS_JOUEUR_AFFICHES = 20;

function messageErreur(e: unknown, messageParDefaut: string): string {
  if (e instanceof ErreurOpenRouter || e instanceof ErreurEmbeddings || e instanceof ErreurMoteurLocal || e instanceof ErreurProfilContenu) {
    return e.message;
  }
  // Repli générique historique — mais s'il s'agit bien d'une Error avec un
  // message exploitable, on l'affiche plutôt que de le masquer : un message
  // précis (même une trace technique) aide à diagnostiquer, un texte
  // générique ne fait que cacher la vraie cause (voir échange support du
  // 3 sept. : erreur générique persistante sans piste exploitable).
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
  const [debugOuvert, setDebugOuvert] = useState(false);
  const listeRef = useRef<FlatList<Message>>(null);

  // Panneau "Contexte de l'Histoire" (brief Phase 2) : lieu, date, ambiance,
  // objectifs en prose, consultable et modifiable en cours de partie.
  const [modalContexteOuvert, setModalContexteOuvert] = useState(false);
  const [lieuEdit, setLieuEdit] = useState('');
  const [ambianceEdit, setAmbianceEdit] = useState('');
  const [dateEdit, setDateEdit] = useState('');
  const [objectifsEdit, setObjectifsEdit] = useState('');
  const [erreurContexte, setErreurContexte] = useState('');

  // Recherche + épinglés (Ajouts_A_Integrer.md #1 et #2).
  const [modalRechercheOuvert, setModalRechercheOuvert] = useState(false);
  const [texteRecherche, setTexteRecherche] = useState('');
  const [epinglesUniquement, setEpinglesUniquement] = useState(false);

  // Résumé "la dernière fois" (Ajouts_A_Integrer.md #3).
  const [derniereFoisVisible, setDerniereFoisVisible] = useState(false);

  // Suggestion de réplique pour le joueur (Ajouts_A_Integrer.md #4).
  const [suggestionEnCours, setSuggestionEnCours] = useState(false);

  // Illustration de scène à la demande — réglage désactivé par défaut (voir
  // SettingsScreen). Jamais persistée avec l'histoire (voir images.ts).
  const [imageEnCours, setImageEnCours] = useState(false);
  const [imageGeneree, setImageGeneree] = useState<string | null>(null);
  const [erreurImage, setErreurImage] = useState('');

  // Portraits PNJ — cache local (data: URL) alimenté depuis le stockage
  // persistant (pnjAvatarsStore) au chargement, généré à la demande sinon.
  const [avatarsPnj, setAvatarsPnj] = useState<Record<string, string>>({});
  const [avatarsPnjEnCours, setAvatarsPnjEnCours] = useState<Record<string, boolean>>({});
  const [erreurAvatarPnj, setErreurAvatarPnj] = useState('');
  // Portrait agrandi (tap sur un avatar, dans le texte ou une galerie —
  // PNJ ou joueur) — affiche simplement en plus grand ce qui est déjà en
  // cache, aucun appel réseau. Forme générique (pas EntreeLoreEmergent) :
  // le joueur n'a pas de fiche de lore émergent.
  const [portraitAgrandi, setPortraitAgrandi] = useState<{ titre: string; avatarUri: string } | null>(null);

  // Avatar du joueur généré par le modèle d'image (même principe que les
  // PNJ, voir avatarsPnj) — vient en plus du portrait peint statique choisi
  // à la création (obtenirPortraitReferenceJoueur), ne le remplace pas.
  const [avatarJoueur, setAvatarJoueur] = useState<string | null>(null);
  const [avatarJoueurEnCours, setAvatarJoueurEnCours] = useState(false);

  // Suppression de message(s) : bouton visible sur chaque message, choix
  // entre supprimer ce seul message ou lui et tout ce qui suit.
  const [messageASupprimer, setMessageASupprimer] = useState<string | null>(null);

  // Menu contextuel d'actions sur un message (copier, répondre, réagir,
  // épingler, éditer, supprimer) — déclenché par appui long, à la place
  // d'icônes séparées visibles en permanence.
  const [messageActionsPour, setMessageActionsPour] = useState<Message | null>(null);
  const [messageEnReponseA, setMessageEnReponseA] = useState<Message | null>(null);
  const [messageAEditer, setMessageAEditer] = useState<Message | null>(null);
  const [texteEdition, setTexteEdition] = useState('');

  // Téléchargement de la conversation (texte / PDF / EPUB).
  const [modalExportOuvert, setModalExportOuvert] = useState(false);
  const [exportEnCours, setExportEnCours] = useState<FormatExport | null>(null);

  // Réglages concepteur (Ajouts_A_Integrer.md #6, mode test) : état brut,
  // mise à jour forcée, prompt système, overrides modèle/température —
  // uniquement visible quand appSettings.modeConcepteur est actif.
  const [modalConcepteurOuvert, setModalConcepteurOuvert] = useState(false);
  const [modeleOverrideEdit, setModeleOverrideEdit] = useState('');
  const [temperatureOverrideEdit, setTemperatureOverrideEdit] = useState('');
  const [promptSysteme, setPromptSysteme] = useState('');
  const [chargementPrompt, setChargementPrompt] = useState(false);
  const [majForceeEnCours, setMajForceeEnCours] = useState(false);
  const [messageConcepteur, setMessageConcepteur] = useState('');

  useEffect(() => {
    Promise.all([getStory(storyId), getSettings()]).then(([s, settings]) => {
      setStory(s);
      setAppSettings(settings);
      if (s && s.messages.length > 0 && s.memoire.resume.trim() && Date.now() - s.meta.updatedAt > SEUIL_PAUSE_MS) {
        setDerniereFoisVisible(true);
      }
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

  function ouvrirConcepteur() {
    if (!story) return;
    setModeleOverrideEdit(story.meta.modeleOverride ?? '');
    setTemperatureOverrideEdit(story.meta.temperatureOverride !== undefined ? String(story.meta.temperatureOverride) : '');
    setPromptSysteme('');
    setMessageConcepteur('');
    setModalConcepteurOuvert(true);
  }

  useEffect(() => {
    if (story) {
      navigation.setOptions({
        title: story.meta.personnageNom,
        headerRight: () => (
          <View style={styles.rangeeEntete}>
            <Pressable onPress={() => setModalRechercheOuvert(true)} hitSlop={8}>
              <Text style={styles.iconeEntete}>🔍</Text>
            </Pressable>
            <Pressable onPress={() => setModalExportOuvert(true)} hitSlop={8}>
              <Text style={styles.iconeEntete}>⬇️</Text>
            </Pressable>
            {appSettings?.modeConcepteur && (
              <Pressable onPress={ouvrirConcepteur} hitSlop={8}>
                <Text style={styles.iconeEntete}>🛠</Text>
              </Pressable>
            )}
            <Pressable onPress={creerBrancheIci} hitSlop={8}>
              <Text style={styles.iconeEntete}>🌿</Text>
            </Pressable>
          </View>
        ),
      });
    }
  }, [story?.meta.personnageNom, creerBrancheIci, appSettings?.modeConcepteur]);

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

  const clefManquante = appSettings && appSettings.moteurInference !== 'local' && !appSettings.openRouterApiKey;
  const profilNonDeclare = appSettings && !appSettings.profilContenu;

  const envoyer = useCallback(async (texteOverride?: string) => {
    const texte = (texteOverride ?? saisie).trim();
    if (!texte || !story || !appSettings || enCours) return;

    // Commande rapide "retiens que X" (Ajouts_A_Integrer.md #5) : force un
    // fait en mémoire canon immédiatement, sans appel modèle ni passage par
    // le pipeline de validation du lore émergent — et sans devenir un
    // message dans la conversation, puisque ce n'est pas une réplique.
    const faitForce = detecterCommandeRetenir(texte);
    if (faitForce) {
      const storyMaj: StoryState = { ...story, memoire: verrouillerFait(story.memoire, faitForce, story.messages.length) };
      setStory(storyMaj);
      await saveStory(storyMaj);
      setSaisie('');
      setMessageStatut(`Retenu : « ${faitForce} »`);
      setTimeout(() => setMessageStatut(''), 4000);
      return;
    }

    if (appSettings.moteurInference !== 'local' && !appSettings.openRouterApiKey) {
      setErreur('Configure ta clé API OpenRouter dans Réglages avant de commencer.');
      return;
    }
    if (!appSettings.profilContenu) {
      setErreur('Déclare un profil de contenu (Grand public / Adulte) dans Réglages avant de commencer.');
      return;
    }

    // Filtre centralisé (audit sécurité) : un message tapé par le joueur
    // n'était jusqu'ici jamais vérifié avant envoi — seule la réponse du
    // narrateur l'était. Le texte reste dans le champ de saisie, à
    // reformuler, plutôt que d'être effacé.
    const controleEntree = validerEntreeUtilisateur(texte, appSettings.profilContenu);
    if (!controleEntree.ok) {
      setErreur(controleEntree.motif);
      return;
    }

    setEnCours(true);
    setErreur('');
    setSaisie('');
    const reponseAId = messageEnReponseA?.id;
    setMessageEnReponseA(null);
    // TODO(debug): calculée en parallèle de l'appel API pour rester visible
    // même si la génération échoue ensuite (non bloquant : meilleur effort).
    calculerDebugLore(story, texte, appSettings).then(setDebugLore).catch(() => {});
    try {
      const { story: storyMaj, debugLore: debugMaj } = await genererTour(story, appSettings, texte, reponseAId);
      setStory(storyMaj);
      setDebugLore(debugMaj);
      try {
        await saveStory(storyMaj);
        setTimeout(() => listeRef.current?.scrollToEnd({ animated: true }), 100);
      } catch (e) {
        // La réponse est déjà générée et affichée ci-dessus (setStory) : ne
        // pas remettre le texte envoyé dans le champ (contrairement au catch
        // ci-dessous) ni le traiter comme un tour raté — sinon un nouvel
        // envoi régénérerait une deuxième réponse pour le même message. Seule
        // la sauvegarde a échoué (ex. quota de stockage dépassé) ; le joueur
        // doit juste le savoir.
        setErreur(messageErreur(e, "Cette réponse n'a pas pu être sauvegardée."));
      }
    } catch (e) {
      setSaisie(texte);
      setErreur(messageErreur(e, 'Une erreur est survenue. Réessaie.'));
    } finally {
      setEnCours(false);
    }
  }, [saisie, story, appSettings, enCours, messageEnReponseA]);

  // Bouton rapide "Continuer" : jusqu'ici, faire avancer le récit sans
  // proposer d'action précise obligeait à taper "continue" à la main à
  // chaque fois. Même chemin que l'envoi normal (envoyer), juste avec un
  // texte fixe au lieu de la saisie — le joueur tapait déjà "continue" avec
  // de bons résultats, donc même mot plutôt qu'une formulation nouvelle et
  // non éprouvée.
  const continuerRecit = useCallback(() => envoyer('continue'), [envoyer]);

  const regenerer = useCallback(async () => {
    if (!story || !appSettings || enCours) return;
    setEnCours(true);
    setErreur('');
    try {
      const { story: storyMaj, debugLore: debugMaj } = await regenererDernierTour(story, appSettings);
      setStory(storyMaj);
      setDebugLore(debugMaj);
      try {
        await saveStory(storyMaj);
      } catch (e) {
        setErreur(messageErreur(e, "Cette réponse n'a pas pu être sauvegardée."));
      }
    } catch (e) {
      setErreur(messageErreur(e, 'Impossible de régénérer cette réponse.'));
    } finally {
      setEnCours(false);
    }
  }, [story, appSettings, enCours]);

  const suggererReplique = useCallback(async () => {
    if (!story || !appSettings || enCours || suggestionEnCours) return;
    setSuggestionEnCours(true);
    setErreur('');
    try {
      const suggestion = await suggererRepliqueJoueur(story, appSettings);
      setSaisie(suggestion);
    } catch (e) {
      setErreur(messageErreur(e, 'Impossible de suggérer une réplique pour le moment.'));
    } finally {
      setSuggestionEnCours(false);
    }
  }, [story, appSettings, enCours, suggestionEnCours]);

  // Tout PNJ nommé du lore émergent — "provisoire" (vu une seule fois)
  // inclus. Exiger "récurrent confirmé" (statut "permanent") laissait tout
  // début de conversation sans aucun avatar possible : la confirmation
  // n'arrive qu'après une seconde mention, donc rien ne se déclenchait
  // jamais tant qu'on n'était pas déjà plusieurs tours avancé. Le seul coût
  // du choix inverse (générer dès la première mention) : un appel payant
  // pour un PNJ qui ne reviendra peut-être jamais — acceptable, l'avatar
  // reste en cache si le personnage revient.
  // Filet de sécurité : le personnage joueur ne doit jamais apparaître ici
  // — normalement déjà exclu à l'extraction (emergentLore.ts), mais une
  // histoire dont une fiche "PNJ" au nom du joueur a été créée avant ce
  // correctif garderait sinon cette fiche indéfiniment (la fusion sur
  // reconfirmation ne modifie jamais un titre déjà enregistré).
  const nomJoueurMinuscule = story?.meta.personnageNom.trim().toLowerCase();
  const pnjConnus =
    story?.loreEmergent.filter((e) => e.categorie === 'pnj' && e.titre.trim().toLowerCase() !== nomJoueurMinuscule) ?? [];

  // PNJ dont l'avatar a déjà été généré (voir avatarsPnj) — seuls ceux-là
  // s'affichent dans le texte des messages (voir TexteMessageFormate),
  // jamais générés à la volée pendant la lecture.
  const avatarsPnjPourTexte = pnjConnus
    .filter((pnj) => avatarsPnj[pnj.id])
    .map((pnj) => ({ pnj, avatarUri: avatarsPnj[pnj.id] }));

  const illustrerScene = useCallback(async () => {
    if (!story || !appSettings || imageEnCours) return;
    setImageEnCours(true);
    setErreurImage('');
    try {
      const prompt = await obtenirPromptScene(story, appSettings);
      // Images de référence envoyées au modèle d'image, EN PLUS du portrait
      // peint statique déjà utilisé (portraitReference, inchangé) : l'avatar
      // du joueur généré par le modèle d'image (même style que la scène) et
      // les avatars des PNJ présents dans la scène (max 2) — meilleure
      // cohérence visuelle qu'une description texte seule. genererImageScene
      // filtre lui-même les entrées vides (portrait pas encore généré...).
      const portraitReference = await obtenirPortraitReferenceJoueur(story);
      const dernierMessageNarrateur = [...story.messages].reverse().find((m) => m.role === 'assistant');
      const texteSceneMinuscule = (dernierMessageNarrateur?.content ?? story.meta.pointDeDepart).toLowerCase();
      const avatarsPnjPresents = avatarsPnjPourTexte
        .filter(({ pnj }) => pnjMentionneDansTexte(pnj, texteSceneMinuscule))
        .slice(0, MAX_PNJ_REFERENCE_SCENE)
        .map(({ avatarUri }) => avatarUri);
      const url = await genererImageScene(appSettings.openRouterApiKey, prompt, appSettings.modeleImagesGratuit, [
        portraitReference,
        avatarJoueur,
        ...avatarsPnjPresents,
      ]);
      setImageGeneree(url);
    } catch (e) {
      setErreurImage(messageErreur(e, "Impossible de générer l'illustration pour le moment."));
    } finally {
      setImageEnCours(false);
    }
  }, [story, appSettings, imageEnCours, avatarJoueur, avatarsPnjPourTexte]);

  // Repli pour une réplique nommée par un rôle générique ("MARCHAND :")
  // plutôt que par le nom propre du PNJ ("KAELEN :") — constaté en usage
  // réel : le narrateur ne bascule pas toujours sur le nom une fois établi,
  // même après plusieurs régénérations. Plutôt que de forcer le modèle (déjà
  // tenté, pas fiable), on retrouve le PNJ probable en cherchant qui est
  // mentionné par son nom dans TOUTE l'histoire (pas seulement les derniers
  // messages : le PNJ est connu du narrateur dès qu'il l'a inventé, une
  // fenêtre récente ne fait que perdre le lien une fois son nom sorti des
  // derniers tours, alors qu'il continue de parler via son rôle) —
  // seulement si un SEUL PNJ à avatar est mentionné, pour ne jamais deviner
  // à tort s'il y en a plusieurs en scène.
  const texteHistoireEntiere = (story?.messages ?? [])
    .map((m) => m.content)
    .join('\n')
    .toLowerCase();
  const pnjMentionnesDansHistoire = avatarsPnjPourTexte.filter(({ pnj }) => pnjMentionneDansTexte(pnj, texteHistoireEntiere));
  const avatarParDefautLocuteur = pnjMentionnesDansHistoire.length === 1 ? pnjMentionnesDansHistoire[0].avatarUri : undefined;
  const pnjParDefautLocuteur = pnjMentionnesDansHistoire.length === 1 ? pnjMentionnesDansHistoire[0].pnj : undefined;

  // Noms de TOUS les PNJ connus (avatar généré ou non) — sert à distinguer,
  // pour une réplique nommée sans avatar en cache, un PNJ légitimement
  // différent dont le portrait n'est pas encore prêt (ne doit PAS recevoir
  // avatarParDefautLocuteur, sous peine d'afficher le visage d'un autre PNJ
  // sous son nom) d'une étiquette de rôle générique inconnue du lore
  // ("MARCHAND" au lieu de "KAELEN"), seul cas où ce repli est pertinent.
  // Constaté en usage réel : tant qu'un seul PNJ avait son portrait généré,
  // chaque nouveau PNJ nommé affichait ce même portrait le temps que le
  // sien soit prêt.
  const nomsPnjConnus = new Set<string>();
  pnjConnus.forEach((pnj) => {
    const titre = pnj.titre.trim().toLowerCase();
    if (!titre) return;
    nomsPnjConnus.add(titre);
    const premierMot = titre.split(/\s+/)[0];
    if (premierMot.length > 2) nomsPnjConnus.add(premierMot);
  });

  // Clé stable des PNJ connus — sert de dépendance d'effet.
  const clePnjConnus = pnjConnus
    .map((p) => p.id)
    .sort()
    .join(',');

  // Charge le portrait déjà généré de chaque PNJ nommé (stockage persistant,
  // aucun appel réseau) et, s'il n'existe pas encore et que la génération
  // d'images est activée (Réglages), le génère automatiquement une seule
  // fois puis le sauvegarde — obtenirOuGenererAvatarPnj revérifie le cache
  // avant tout appel réseau, donc jamais régénéré ensuite pour ce PNJ. Un
  // par un (pas en parallèle) pour ne pas envoyer une rafale d'appels
  // payants dès que plusieurs PNJ apparaissent dans le même tour.
  useEffect(() => {
    if (!story) return;
    let annule = false;
    (async () => {
      for (const pnj of pnjConnus) {
        if (annule) return;
        if (avatarsPnj[pnj.id]) continue;
        const existant = await obtenirAvatarPnj(story.meta.id, pnj.id);
        if (annule) return;
        if (existant) {
          setAvatarsPnj((prev) => ({ ...prev, [pnj.id]: existant }));
          continue;
        }
        if (!appSettings?.genererImagesActive || !appSettings.openRouterApiKey || avatarsPnjEnCours[pnj.id]) continue;
        setAvatarsPnjEnCours((prev) => ({ ...prev, [pnj.id]: true }));
        try {
          const url = await obtenirOuGenererAvatarPnj(story, pnj, appSettings);
          if (!annule) setAvatarsPnj((prev) => ({ ...prev, [pnj.id]: url }));
        } catch (e) {
          if (!annule) setErreurAvatarPnj(messageErreur(e, `Impossible de générer le portrait de ${pnj.titre} pour le moment.`));
        } finally {
          setAvatarsPnjEnCours((prev) => ({ ...prev, [pnj.id]: false }));
        }
      }
    })();
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.meta.id, clePnjConnus, appSettings?.genererImagesActive, appSettings?.openRouterApiKey]);

  const genererAvatarPourPnj = useCallback(
    async (pnj: EntreeLoreEmergent) => {
      if (!story || !appSettings || avatarsPnjEnCours[pnj.id]) return;
      setAvatarsPnjEnCours((prev) => ({ ...prev, [pnj.id]: true }));
      setErreurAvatarPnj('');
      try {
        const url = await obtenirOuGenererAvatarPnj(story, pnj, appSettings);
        setAvatarsPnj((prev) => ({ ...prev, [pnj.id]: url }));
      } catch (e) {
        setErreurAvatarPnj(messageErreur(e, `Impossible de générer le portrait de ${pnj.titre} pour le moment.`));
      } finally {
        setAvatarsPnjEnCours((prev) => ({ ...prev, [pnj.id]: false }));
      }
    },
    [story, appSettings, avatarsPnjEnCours]
  );

  // Même principe que l'effet PNJ ci-dessus, mais pour le portrait du joueur
  // (un seul, pas de liste) — charge le cache, puis génère automatiquement
  // si la génération d'images est activée.
  useEffect(() => {
    if (!story) return;
    let annule = false;
    (async () => {
      const existant = await obtenirAvatarPnj(story.meta.id, ID_AVATAR_JOUEUR);
      if (annule) return;
      if (existant) {
        setAvatarJoueur(existant);
        return;
      }
      if (!appSettings?.genererImagesActive || !appSettings.openRouterApiKey || avatarJoueurEnCours) return;
      setAvatarJoueurEnCours(true);
      try {
        const url = await obtenirOuGenererAvatarJoueur(story, appSettings);
        if (!annule) setAvatarJoueur(url);
      } catch (e) {
        if (!annule) setErreurAvatarPnj(messageErreur(e, 'Impossible de générer ton portrait pour le moment.'));
      } finally {
        if (!annule) setAvatarJoueurEnCours(false);
      }
    })();
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?.meta.id, appSettings?.genererImagesActive, appSettings?.openRouterApiKey]);

  const genererAvatarJoueur = useCallback(async () => {
    if (!story || !appSettings || avatarJoueurEnCours) return;
    setAvatarJoueurEnCours(true);
    setErreurAvatarPnj('');
    try {
      const url = await obtenirOuGenererAvatarJoueur(story, appSettings);
      setAvatarJoueur(url);
    } catch (e) {
      setErreurAvatarPnj(messageErreur(e, 'Impossible de générer ton portrait pour le moment.'));
    } finally {
      setAvatarJoueurEnCours(false);
    }
  }, [story, appSettings, avatarJoueurEnCours]);

  const togglerEpingle = useCallback(
    async (id: string) => {
      if (!story) return;
      const messages = story.messages.map((m) => (m.id === id ? { ...m, epingle: !m.epingle } : m));
      const storyMaj = { ...story, messages };
      setStory(storyMaj);
      await saveStory(storyMaj);
    },
    [story],
  );

  // Actions du menu contextuel (appui long sur un message).
  async function copierMessage(m: Message) {
    await Clipboard.setStringAsync(m.content);
    setMessageActionsPour(null);
    setMessageStatut('Copié.');
    setTimeout(() => setMessageStatut(''), 2000);
  }

  function repondreAMessage(m: Message) {
    setMessageEnReponseA(m);
    setMessageActionsPour(null);
  }

  async function reagirAMessage(m: Message, emoji: string) {
    if (!story) return;
    const messages = story.messages.map((msg) =>
      msg.id === m.id ? { ...msg, reaction: msg.reaction === emoji ? undefined : emoji } : msg,
    );
    const storyMaj = { ...story, messages };
    setStory(storyMaj);
    await saveStory(storyMaj);
    setMessageActionsPour(null);
  }

  function epinglerDepuisMenu(m: Message) {
    togglerEpingle(m.id);
    setMessageActionsPour(null);
  }

  function editerDepuisMenu(m: Message) {
    setMessageAEditer(m);
    setTexteEdition(m.content);
    setMessageActionsPour(null);
  }

  async function enregistrerEdition() {
    if (!story || !messageAEditer) return;
    const messages = story.messages.map((m) => (m.id === messageAEditer.id ? { ...m, content: texteEdition } : m));
    const storyMaj = { ...story, messages };
    setStory(storyMaj);
    await saveStory(storyMaj);
    setMessageAEditer(null);
  }

  function supprimerDepuisMenu(m: Message) {
    setMessageActionsPour(null);
    setMessageASupprimer(m.id);
  }

  async function lancerExport(format: FormatExport) {
    if (!story || exportEnCours) return;
    setExportEnCours(format);
    try {
      await exporterConversation(story, format);
      setModalExportOuvert(false);
    } catch (e) {
      setErreur(messageErreur(e, "Impossible de générer l'export pour le moment."));
    } finally {
      setExportEnCours(null);
    }
  }

  // Suppression de message(s) : les index qui gouvernent la cadence des
  // pipelines périodiques (mémoire, directeur) sont bornés à la nouvelle
  // longueur, comme pour la régénération (regenererDernierTour) — sinon un
  // curseur resté au-delà de la fin des messages bloquerait silencieusement
  // toute future mise à jour.
  function tronquerCurseurs(story: StoryState, nouvelleLongueur: number): Pick<StoryState, 'memoire' | 'directeur'> {
    return {
      memoire: { ...story.memoire, dernierMessageIndexMaj: Math.min(story.memoire.dernierMessageIndexMaj, nouvelleLongueur) },
      directeur: { ...story.directeur, dernierBeatIndex: Math.min(story.directeur.dernierBeatIndex, nouvelleLongueur) },
    };
  }

  async function supprimerMessageSeul(id: string) {
    if (!story) return;
    const index = story.messages.findIndex((m) => m.id === id);
    if (index < 0) return;
    const messages = [...story.messages.slice(0, index), ...story.messages.slice(index + 1)];
    const storyMaj: StoryState = { ...story, messages, ...tronquerCurseurs(story, messages.length) };
    setStory(storyMaj);
    await saveStory(storyMaj);
    setMessageASupprimer(null);
  }

  async function supprimerMessagesASuivant(id: string) {
    if (!story) return;
    const index = story.messages.findIndex((m) => m.id === id);
    if (index < 0) return;
    const messages = story.messages.slice(0, index);
    const storyMaj: StoryState = { ...story, messages, ...tronquerCurseurs(story, messages.length) };
    setStory(storyMaj);
    await saveStory(storyMaj);
    setMessageASupprimer(null);
  }

  function allerAuMessage(id: string) {
    if (!story) return;
    const index = story.messages.findIndex((m) => m.id === id);
    if (index < 0) return;
    setModalRechercheOuvert(false);
    requestAnimationFrame(() => {
      listeRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
    });
  }

  function ouvrirContexte() {
    if (!story) return;
    setLieuEdit(story.meta.contexte.lieu);
    setAmbianceEdit(story.meta.contexte.ambiance);
    setDateEdit(story.meta.contexte.dateChronique);
    setObjectifsEdit(story.meta.contexte.objectifs);
    setErreurContexte('');
    setModalContexteOuvert(true);
  }

  async function enregistrerContexte() {
    if (!story) return;
    const texteComplet = [lieuEdit, ambianceEdit, dateEdit, objectifsEdit].join('\n');
    const controle = validerEntreeUtilisateur(texteComplet, appSettings?.profilContenu);
    if (!controle.ok) {
      setErreurContexte(controle.motif);
      return;
    }
    setErreurContexte('');
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

  async function enregistrerOverridesConcepteur() {
    if (!story) return;
    const temperature = temperatureOverrideEdit.trim() ? Number(temperatureOverrideEdit.trim()) : undefined;
    const storyMaj: StoryState = {
      ...story,
      meta: {
        ...story.meta,
        modeleOverride: modeleOverrideEdit.trim() || undefined,
        temperatureOverride: temperature !== undefined && !Number.isNaN(temperature) ? temperature : undefined,
      },
    };
    setStory(storyMaj);
    await saveStory(storyMaj);
    setMessageConcepteur('Réglages de prompt enregistrés pour cette histoire.');
    setTimeout(() => setMessageConcepteur(''), 3000);
  }

  async function voirPromptSysteme() {
    if (!story || !appSettings) return;
    setChargementPrompt(true);
    setPromptSysteme('');
    try {
      const derniereEntree = [...story.messages].reverse().find((m) => m.role === 'user')?.content ?? saisie;
      const prompt = await construirePromptDebug(story, derniereEntree || story.meta.pointDeDepart, appSettings);
      setPromptSysteme(prompt);
    } catch (e) {
      setPromptSysteme(messageErreur(e, 'Impossible de construire le prompt pour le moment.'));
    } finally {
      setChargementPrompt(false);
    }
  }

  async function forcerMiseAJourMaintenant() {
    if (!story || !appSettings || majForceeEnCours) return;
    setMajForceeEnCours(true);
    setMessageConcepteur('');
    try {
      const storyMaj = await forcerMiseAJourEtat(story, appSettings);
      setStory(storyMaj);
      await saveStory(storyMaj);
      setMessageConcepteur('Mémoire, directeur, monde et social mis à jour.');
    } catch (e) {
      setMessageConcepteur(messageErreur(e, 'Mise à jour impossible pour le moment.'));
    } finally {
      setMajForceeEnCours(false);
    }
  }

  if (!story || !appSettings) {
    return (
      <View style={[styles.container, { justifyContent: 'center', backgroundColor: couleurs.fond }]}>
        <ActivityIndicator color={couleurs.accent} />
      </View>
    );
  }

  const dernierEstAssistant = story.messages[story.messages.length - 1]?.role === 'assistant';
  const messagesRecherche = epinglesUniquement
    ? story.messages.filter((m) => m.epingle)
    : texteRecherche.trim()
      ? story.messages.filter((m) => m.content.toLowerCase().includes(texteRecherche.trim().toLowerCase()))
      : [];

  return (
    <FondAtmospherique style={{ flex: 1 }} densiteEtoiles="discrete" imageFond={IMAGE_CONVERSATION}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <View style={styles.container}>
        {clefManquante && (
          <Pressable style={styles.bandeauAlerte} onPress={() => navigation.navigate('Reglages')}>
            <Text style={styles.texteBandeau}>{t('Aucune clé API configurée — appuie ici pour aller dans Réglages.')}</Text>
          </Pressable>
        )}
        {profilNonDeclare && (
          <Pressable style={styles.bandeauAlerte} onPress={() => navigation.navigate('Reglages')}>
            <Text style={styles.texteBandeau}>{t('Profil de contenu non déclaré — appuie ici pour aller dans Réglages.')}</Text>
          </Pressable>
        )}

        <Pressable style={styles.bandeauContexte} onPress={ouvrirContexte}>
          <Text style={styles.texteBandeauContexte} numberOfLines={1}>
            📍 {(story.meta.contexte.lieu && t(story.meta.contexte.lieu)) || t('Contexte de l’histoire')}
            {story.meta.contexte.ambiance ? ` — ${t(story.meta.contexte.ambiance)}` : ''}
          </Text>
        </Pressable>
        {story.meta.brancheDeId && (
          <View style={styles.bandeauBranche}>
            <Text style={styles.texteBandeauBranche}>
              🌿 {t('Branche créée au message')} {story.meta.pointDeBranchement ?? '?'}
            </Text>
          </View>
        )}

        {derniereFoisVisible && (
          <Panneau style={styles.bandeauDerniereFois}>
            <Text style={styles.labelDerniereFois}>{t('La dernière fois…')}</Text>
            <Text style={styles.texteDerniereFois}>{t(story.memoire.resume)}</Text>
            <Bouton titre={t('Continuer')} variante="secondaire" onPress={() => setDerniereFoisVisible(false)} style={{ marginTop: espacement.sm }} />
          </Panneau>
        )}

        {story.messages.length === 0 ? (
          <View style={styles.centreVide}>
            <Text style={styles.pointDeDepart}>{t(story.meta.pointDeDepart)}</Text>
            <Text style={styles.aideVide}>{t('Écris ta première action ou réplique pour commencer.')}</Text>
          </View>
        ) : (
          <FlatList
            ref={listeRef}
            data={story.messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: espacement.md, gap: espacement.sm }}
            onContentSizeChange={() => listeRef.current?.scrollToEnd({ animated: false })}
            onScrollToIndexFailed={(info) => {
              setTimeout(() => listeRef.current?.scrollToIndex({ index: info.index, animated: true }), 100);
            }}
            renderItem={({ item, index }) => {
              const messageCite = item.reponseAId ? story.messages.find((m) => m.id === item.reponseAId) : undefined;
              return (
                <View style={[styles.groupeMessage, item.role === 'user' ? styles.groupeMessageJoueur : styles.groupeMessageNarrateur]}>
                  {messageCite && (
                    <View style={styles.citationPreview}>
                      <Text style={styles.texteCitationPreview} numberOfLines={1}>
                        {messageCite.role === 'user' ? story.meta.personnageNom : t('Narrateur')} : {t(messageCite.content)}
                      </Text>
                    </View>
                  )}
                  {item.role === 'user' && (
                    // Contrairement aux PNJ (avatar affiché en détectant leur
                    // nom DANS le texte narré), le joueur écrit ses messages
                    // sans jamais s'y nommer lui-même — aucune détection
                    // possible. Son nom + avatar sont donc affichés en
                    // en-tête de la bulle, inconditionnellement, plutôt que
                    // par le même mécanisme que TexteMessageFormate.
                    //
                    // L'IMAGE (avatarJoueur, un data: URL base64 pouvant
                    // peser plusieurs centaines de Ko à quelques Mo) n'est
                    // affichée que sur les derniers messages — sur une
                    // longue histoire (constaté en usage réel : 74 messages),
                    // la décoder identique des dizaines de fois d'affilée a
                    // fait planter l'appli (écran blanc, plantage natif côté
                    // mémoire, pas une erreur JS rattrapable) là où avant
                    // aucun message du joueur n'embarquait d'image. Le nom
                    // seul (texte, négligeable) reste affiché partout.
                    <Pressable
                      style={styles.enTeteMessageJoueur}
                      onPress={
                        avatarJoueur ? () => setPortraitAgrandi({ titre: story.meta.personnageNom, avatarUri: avatarJoueur }) : undefined
                      }
                    >
                      {avatarJoueur && story.messages.length - index <= MAX_AVATARS_JOUEUR_AFFICHES ? (
                        <Image source={{ uri: avatarJoueur }} style={styles.avatarInlineJoueur} />
                      ) : null}
                      <Text style={styles.nomMessageJoueur}>{story.meta.personnageNom}</Text>
                    </Pressable>
                  )}
                  <Pressable onLongPress={() => setMessageActionsPour(item)} delayLongPress={400}>
                    <View style={[styles.bulle, item.role === 'user' ? styles.bulleJoueur : styles.bulleNarrateur]}>
                      {item.epingle ? <Text style={styles.epingleIndicateur}>📌</Text> : null}
                      <TexteMessageFormate
                        texte={t(item.content)}
                        style={styles.texteBulle}
                        avatarsPnj={item.role === 'assistant' ? avatarsPnjPourTexte : undefined}
                        avatarParDefaut={item.role === 'assistant' ? avatarParDefautLocuteur : undefined}
                        pnjParDefaut={item.role === 'assistant' ? pnjParDefautLocuteur : undefined}
                        nomsPnjConnus={item.role === 'assistant' ? nomsPnjConnus : undefined}
                        onPressAvatar={
                          item.role === 'assistant'
                            ? (pnj) => setPortraitAgrandi({ titre: pnj.titre, avatarUri: avatarsPnj[pnj.id] })
                            : undefined
                        }
                      />
                    </View>
                  </Pressable>
                  {item.reaction ? <Text style={styles.reactionIndicateur}>{item.reaction}</Text> : null}
                  <Text style={styles.metaMessage}>
                    {index + 1}/{story.messages.length}
                    {item.role === 'assistant' && item.dureeGenerationMs ? ` · ${formaterDureeGeneration(item.dureeGenerationMs)}` : ''}
                  </Text>
                </View>
              );
            }}
            ListFooterComponent={
              imageGeneree
                ? () => (
                    <Panneau style={styles.panneauImageGeneree}>
                      <Text style={styles.titreModal}>{t('Illustration de la scène')}</Text>
                      <Image source={{ uri: imageGeneree }} style={styles.imageGeneree} resizeMode="contain" />
                      <Text style={styles.aideImageGeneree}>{t("Appuie longuement sur l'image pour l'enregistrer.")}</Text>
                      <Bouton titre={t('Fermer')} variante="secondaire" onPress={() => setImageGeneree(null)} style={{ marginTop: espacement.sm }} />
                    </Panneau>
                  )
                : undefined
            }
          />
        )}

        {debugLore && (
          <Pressable style={styles.boutonDebug} onPress={() => setDebugOuvert((v) => !v)}>
            <Text style={styles.texteBoutonDebug}>
              {debugOuvert ? '▾' : '▸'} Debug lore ({debugLore.metamoteurs.length} métamoteurs,{' '}
              {debugLore.loreElyndor.length} entrées Elyndor, {debugLore.souvenirs.length} souvenirs)
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
            <Text style={[styles.titreDebug, { marginTop: espacement.sm }]}>
              Souvenirs retrouvés (recherche de secours dans l'historique)
            </Text>
            {debugLore.souvenirs.length === 0 ? (
              <Text style={styles.ligneDebug}>Aucun — rien d'assez pertinent hors des échanges récents.</Text>
            ) : (
              debugLore.souvenirs.map((extrait) => (
                <Text key={extrait} style={styles.ligneDebug}>
                  • {extrait}
                </Text>
              ))
            )}
            <Text style={[styles.titreDebug, { marginTop: espacement.sm }]}>Mon portrait</Text>
            <Text style={styles.aideImageGeneree}>
              {appSettings?.genererImagesActive
                ? t('Généré automatiquement par le modèle d\'image, en plus du portrait choisi à la création — sert aussi de référence pour la cohérence des scènes illustrées.')
                : t("Active la génération d'images dans Réglages pour le générer automatiquement.")}
            </Text>
            <View style={styles.grillePortraitsPnj}>
              <View style={styles.cartePortraitPnj}>
                {avatarJoueur ? (
                  <Pressable onPress={() => setPortraitAgrandi({ titre: story.meta.personnageNom, avatarUri: avatarJoueur })}>
                    <Image source={{ uri: avatarJoueur }} style={styles.imagePortraitPnj} resizeMode="cover" />
                  </Pressable>
                ) : (
                  <View style={[styles.imagePortraitPnj, styles.imagePortraitPnjVide]}>
                    {avatarJoueurEnCours ? <ActivityIndicator size="small" color={couleurs.accentClair} /> : null}
                  </View>
                )}
                <Text style={styles.nomPortraitPnj} numberOfLines={1}>
                  {story.meta.personnageNom}
                </Text>
                {appSettings?.genererImagesActive && (
                  <Bouton
                    titre={t(avatarJoueur ? 'Régénérer' : 'Générer')}
                    variante="secondaire"
                    onPress={genererAvatarJoueur}
                    desactive={avatarJoueurEnCours}
                    style={styles.boutonPortraitPnj}
                    texteStyle={styles.texteBoutonPortraitPnj}
                  />
                )}
              </View>
            </View>

            <Text style={[styles.titreDebug, { marginTop: espacement.sm }]}>Portraits des PNJ</Text>
            <Text style={styles.aideImageGeneree}>
              {appSettings?.genererImagesActive
                ? t('Générés automatiquement dès qu\'un PNJ est nommé, puis conservés.')
                : t("Active la génération d'images dans Réglages pour les générer automatiquement.")}
            </Text>
            {pnjConnus.length === 0 ? (
              <Text style={styles.ligneDebug}>Aucun PNJ nommé pour l'instant.</Text>
            ) : (
              <View style={styles.grillePortraitsPnj}>
                {pnjConnus.map((pnj) => (
                  <View key={pnj.id} style={styles.cartePortraitPnj}>
                    {avatarsPnj[pnj.id] ? (
                      <Pressable onPress={() => setPortraitAgrandi({ titre: pnj.titre, avatarUri: avatarsPnj[pnj.id] })}>
                        <Image source={{ uri: avatarsPnj[pnj.id] }} style={styles.imagePortraitPnj} resizeMode="cover" />
                      </Pressable>
                    ) : (
                      <View style={[styles.imagePortraitPnj, styles.imagePortraitPnjVide]}>
                        {avatarsPnjEnCours[pnj.id] ? <ActivityIndicator size="small" color={couleurs.accentClair} /> : null}
                      </View>
                    )}
                    <Text style={styles.nomPortraitPnj} numberOfLines={1}>
                      {pnj.titre}
                    </Text>
                    {appSettings?.genererImagesActive && (
                      <Bouton
                        titre={t(avatarsPnj[pnj.id] ? 'Régénérer' : 'Générer')}
                        variante="secondaire"
                        onPress={() => genererAvatarPourPnj(pnj)}
                        desactive={!!avatarsPnjEnCours[pnj.id]}
                        style={styles.boutonPortraitPnj}
                        texteStyle={styles.texteBoutonPortraitPnj}
                      />
                    )}
                  </View>
                ))}
              </View>
            )}
            {erreurAvatarPnj ? <Text style={styles.erreur}>{t(erreurAvatarPnj)}</Text> : null}
          </ScrollView>
        )}

        {erreur ? <Text style={styles.erreur}>{t(erreur)}</Text> : null}
        {erreurImage ? <Text style={styles.erreur}>{t(erreurImage)}</Text> : null}
        {messageStatut ? <Text style={styles.statut}>{t(messageStatut)}</Text> : null}

        <View style={[styles.zoneSaisie, { paddingBottom: espacement.sm + insets.bottom }]}>
          {messageEnReponseA && (
            <View style={styles.bandeauReponseA}>
              <Text style={styles.texteBandeauReponseA} numberOfLines={1}>
                {t('Réponse à')} {messageEnReponseA.role === 'user' ? story.meta.personnageNom : t('Narrateur')} :{' '}
                {t(messageEnReponseA.content)}
              </Text>
              <Pressable onPress={() => setMessageEnReponseA(null)} hitSlop={8}>
                <Text style={styles.boutonFermerReponseA}>✕</Text>
              </Pressable>
            </View>
          )}
          <View style={styles.rangeeActionsRapides}>
            {dernierEstAssistant && (
              <Bouton titre={t('Régénérer')} variante="secondaire" onPress={regenerer} desactive={enCours} style={styles.boutonRapide} texteStyle={styles.texteBoutonRapide} />
            )}
            <Bouton
              titre={t('Continuer')}
              variante="secondaire"
              onPress={continuerRecit}
              desactive={enCours}
              style={styles.boutonRapide}
              texteStyle={styles.texteBoutonRapide}
            />
            <Bouton
              titre={suggestionEnCours ? t('Suggestion…') : t('Suggérer une réplique')}
              variante="secondaire"
              onPress={suggererReplique}
              desactive={enCours || suggestionEnCours}
              style={styles.boutonRapide}
              texteStyle={styles.texteBoutonRapide}
            />
            {appSettings?.genererImagesActive && (
              <Bouton
                titre={imageEnCours ? t('Illustration…') : t('Illustrer cette scène')}
                variante="secondaire"
                onPress={illustrerScene}
                desactive={enCours || imageEnCours}
                style={styles.boutonRapide}
                texteStyle={styles.texteBoutonRapide}
              />
            )}
          </View>
          <View style={styles.rangeeSaisie}>
            <Champ
              value={saisie}
              onChangeText={setSaisie}
              placeholder={t('Ton action ou ta réplique… (« retiens que … » pour forcer un fait)')}
              multiligne
              editable={!enCours}
              conteneurStyle={{ flex: 1 }}
              style={styles.champSaisie}
            />
            <BoutonDictee
              desactive={enCours}
              onTexteReconnu={(texte) => setSaisie((v) => (v.trim() ? `${v.trim()} ${texte}` : texte))}
            />
            <Pressable
              style={[styles.boutonEnvoyer, (enCours || !saisie.trim()) && styles.boutonDesactive]}
              onPress={() => envoyer()}
              disabled={enCours || !saisie.trim()}
            >
              {enCours ? <ActivityIndicator color={couleurs.accentClair} /> : <Text style={styles.texteEnvoyer}>{t('Envoyer')}</Text>}
            </Pressable>
          </View>
        </View>
      </View>

      <Modal visible={modalContexteOuvert} animationType="slide" onRequestClose={() => setModalContexteOuvert(false)}>
        <ScrollView style={styles.modalContainer} contentContainerStyle={{ paddingBottom: espacement.xl }}>
          <Text style={styles.titreModal}>{t("Contexte de l'histoire")}</Text>

          <Champ label={t('Lieu')} value={lieuEdit} onChangeText={setLieuEdit} conteneurStyle={styles.champConteneur} />
          <Champ label={t('Ambiance')} value={ambianceEdit} onChangeText={setAmbianceEdit} multiligne conteneurStyle={styles.champConteneur} />
          <Champ label={t('Date / période')} value={dateEdit} onChangeText={setDateEdit} conteneurStyle={styles.champConteneur} />
          <Champ label={t('Objectifs')} value={objectifsEdit} onChangeText={setObjectifsEdit} multiligne conteneurStyle={styles.champConteneur} />

          {erreurContexte ? <Text style={styles.erreur}>{t(erreurContexte)}</Text> : null}

          <Bouton titre={t('Enregistrer')} onPress={enregistrerContexte} style={{ marginTop: espacement.lg }} />
          <Bouton titre={t('Fermer sans enregistrer')} variante="secondaire" onPress={() => setModalContexteOuvert(false)} style={{ marginTop: espacement.sm }} />
        </ScrollView>
      </Modal>

      <Modal visible={modalRechercheOuvert} animationType="slide" onRequestClose={() => setModalRechercheOuvert(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.titreModal}>{t('Recherche')}</Text>

          <Champ
            value={texteRecherche}
            onChangeText={(v) => {
              setTexteRecherche(v);
              setEpinglesUniquement(false);
            }}
            placeholder={t('Mot-clé dans la conversation…')}
            conteneurStyle={styles.champConteneur}
          />
          <Bouton
            titre={epinglesUniquement ? `✓ ${t('Épinglés uniquement')}` : t('Épinglés uniquement')}
            variante={epinglesUniquement ? 'principal' : 'secondaire'}
            onPress={() => {
              setEpinglesUniquement((v) => !v);
              setTexteRecherche('');
            }}
            style={{ marginTop: espacement.sm }}
          />

          <FlatList
            style={{ marginTop: espacement.md }}
            data={messagesRecherche}
            keyExtractor={(m) => m.id}
            ListEmptyComponent={
              <Text style={styles.aideRecherche}>
                {epinglesUniquement
                  ? t('Aucun message épinglé — reste appuyé sur un message pour en épingler un.')
                  : texteRecherche.trim()
                    ? t('Aucun résultat.')
                    : t('Tape un mot-clé pour chercher dans la conversation.')}
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable style={styles.resultatRecherche} onPress={() => allerAuMessage(item.id)}>
                <Text style={styles.roleResultat}>
                  {item.role === 'user' ? story.meta.personnageNom : t('Narrateur')}
                  {item.epingle ? ' 📌' : ''}
                </Text>
                <Text style={styles.texteResultat} numberOfLines={2}>
                  {t(item.content)}
                </Text>
              </Pressable>
            )}
          />
          <Bouton titre={t('Fermer')} variante="secondaire" onPress={() => setModalRechercheOuvert(false)} style={{ marginTop: espacement.md }} />
        </View>
      </Modal>

      <Modal visible={!!messageASupprimer} animationType="fade" transparent onRequestClose={() => setMessageASupprimer(null)}>
        <View style={styles.superpositionSuppression}>
          <Panneau style={styles.panneauSuppression}>
            <Text style={styles.titreModal}>{t('Supprimer')}</Text>
            <Bouton
              titre={t('Supprimer ce message')}
              variante="secondaire"
              onPress={() => messageASupprimer && supprimerMessageSeul(messageASupprimer)}
              texteStyle={{ color: couleurs.danger }}
              style={{ marginTop: espacement.sm }}
            />
            <Bouton
              titre={t('Supprimer ce message et les suivants')}
              variante="secondaire"
              onPress={() => messageASupprimer && supprimerMessagesASuivant(messageASupprimer)}
              texteStyle={{ color: couleurs.danger }}
              style={{ marginTop: espacement.sm }}
            />
            <Bouton titre={t('Annuler')} variante="secondaire" onPress={() => setMessageASupprimer(null)} style={{ marginTop: espacement.sm }} />
          </Panneau>
        </View>
      </Modal>

      <MenuActionsMessage
        message={messageActionsPour}
        onFermer={() => setMessageActionsPour(null)}
        onCopier={copierMessage}
        onRepondre={repondreAMessage}
        onReagir={reagirAMessage}
        onEpingler={epinglerDepuisMenu}
        onEditer={editerDepuisMenu}
        onSupprimer={supprimerDepuisMenu}
      />

      <Modal visible={!!messageAEditer} animationType="slide" onRequestClose={() => setMessageAEditer(null)}>
        <View style={styles.modalContainer}>
          <Text style={styles.titreModal}>{t('Éditer le message')}</Text>
          <Champ value={texteEdition} onChangeText={setTexteEdition} multiligne conteneurStyle={styles.champConteneur} style={{ minHeight: 160 }} />
          <Bouton titre={t('Enregistrer')} onPress={enregistrerEdition} style={{ marginTop: espacement.lg }} />
          <Bouton titre={t('Annuler')} variante="secondaire" onPress={() => setMessageAEditer(null)} style={{ marginTop: espacement.sm }} />
        </View>
      </Modal>

      <Modal visible={!!portraitAgrandi} animationType="fade" transparent onRequestClose={() => setPortraitAgrandi(null)}>
        <Pressable style={styles.superpositionSuppression} onPress={() => setPortraitAgrandi(null)}>
          <Panneau style={styles.panneauPortraitAgrandi}>
            {portraitAgrandi?.avatarUri ? (
              <Image source={{ uri: portraitAgrandi.avatarUri }} style={styles.imagePortraitAgrandi} resizeMode="cover" />
            ) : null}
            <Text style={styles.titreModal}>{portraitAgrandi?.titre}</Text>
            <Bouton titre={t('Fermer')} variante="secondaire" onPress={() => setPortraitAgrandi(null)} style={{ marginTop: espacement.sm }} />
          </Panneau>
        </Pressable>
      </Modal>

      <Modal visible={modalExportOuvert} animationType="fade" transparent onRequestClose={() => setModalExportOuvert(false)}>
        <Pressable style={styles.superpositionSuppression} onPress={() => setModalExportOuvert(false)}>
          <Panneau style={styles.panneauSuppression}>
            <Text style={styles.titreModal}>{t('Télécharger la conversation')}</Text>
            {(['texte', 'pdf', 'epub'] as FormatExport[]).map((format) => (
              <Bouton
                key={format}
                titre={
                  exportEnCours === format
                    ? t('Génération…')
                    : format === 'texte'
                      ? t('Texte brut (.txt)')
                      : format === 'pdf'
                        ? 'PDF'
                        : t('EPUB (liseuse)')
                }
                variante="secondaire"
                desactive={!!exportEnCours}
                onPress={() => lancerExport(format)}
                style={{ marginTop: espacement.sm }}
              />
            ))}
            <Bouton titre={t('Annuler')} variante="secondaire" onPress={() => setModalExportOuvert(false)} style={{ marginTop: espacement.sm }} desactive={!!exportEnCours} />
          </Panneau>
        </Pressable>
      </Modal>

      <Modal visible={modalConcepteurOuvert} animationType="slide" onRequestClose={() => setModalConcepteurOuvert(false)}>
        <ScrollView style={styles.modalContainer} contentContainerStyle={{ paddingBottom: espacement.xl }}>
          <Text style={styles.titreModal}>Concepteur — {story.meta.personnageNom}</Text>

          <Text style={styles.labelConcepteur}>Contrôles moteur</Text>
          <Bouton
            titre={majForceeEnCours ? 'Mise à jour…' : 'Forcer la mise à jour maintenant'}
            variante="secondaire"
            onPress={forcerMiseAJourMaintenant}
            desactive={majForceeEnCours}
            style={{ marginTop: espacement.sm }}
          />
          <Bouton
            titre={chargementPrompt ? 'Construction…' : 'Voir le prompt système'}
            variante="secondaire"
            onPress={voirPromptSysteme}
            desactive={chargementPrompt}
            style={{ marginTop: espacement.sm }}
          />
          {messageConcepteur ? <Text style={styles.statut}>{messageConcepteur}</Text> : null}
          {promptSysteme ? (
            <Panneau style={{ marginTop: espacement.sm }}>
              <Text style={styles.textePromptSysteme}>{promptSysteme}</Text>
            </Panneau>
          ) : null}

          <Text style={styles.labelConcepteur}>Réglages de prompt avancés (cette histoire)</Text>
          <Champ
            label="Modèle (override, optionnel)"
            value={modeleOverrideEdit}
            onChangeText={setModeleOverrideEdit}
            placeholder={appSettings.model}
            autoCapitalize="none"
            autoCorrect={false}
            conteneurStyle={styles.champConteneur}
          />
          <Champ
            label="Température (override, optionnel)"
            value={temperatureOverrideEdit}
            onChangeText={setTemperatureOverrideEdit}
            placeholder="0.0 à 2.0"
            keyboardType="numeric"
            conteneurStyle={styles.champConteneur}
          />
          <Bouton titre="Enregistrer ces réglages" onPress={enregistrerOverridesConcepteur} style={{ marginTop: espacement.sm }} />

          <Text style={styles.labelConcepteur}>État brut du moteur</Text>
          <Panneau style={{ marginTop: espacement.sm }}>
            <Text style={styles.sousTitreEtat}>Mémoire</Text>
            <Text style={styles.texteEtatBrut}>{JSON.stringify(story.memoire, null, 2)}</Text>
            <Text style={styles.sousTitreEtat}>Directeur narratif</Text>
            <Text style={styles.texteEtatBrut}>{JSON.stringify(story.directeur, null, 2)}</Text>
            <Text style={styles.sousTitreEtat}>Monde</Text>
            <Text style={styles.texteEtatBrut}>{JSON.stringify(story.monde, null, 2)}</Text>
            <Text style={styles.sousTitreEtat}>Social</Text>
            <Text style={styles.texteEtatBrut}>{JSON.stringify(story.social, null, 2)}</Text>
          </Panneau>

          <Bouton titre="Fermer" variante="secondaire" onPress={() => setModalConcepteurOuvert(false)} style={{ marginTop: espacement.lg }} />
        </ScrollView>
      </Modal>
    </KeyboardAvoidingView>
    </FondAtmospherique>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  rangeeEntete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacement.md,
  },
  iconeEntete: {
    fontSize: 18,
  },
  centreVide: {
    flex: 1,
    justifyContent: 'center',
    padding: espacement.lg,
  },
  pointDeDepart: {
    color: couleurs.texte,
    fontFamily: polices.corps,
    fontSize: 18,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  aideVide: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 14,
    textAlign: 'center',
    marginTop: espacement.sm,
  },
  groupeMessage: {
    maxWidth: '85%',
  },
  groupeMessageJoueur: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  groupeMessageNarrateur: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  enTeteMessageJoueur: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  avatarInlineJoueur: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 5,
  },
  nomMessageJoueur: {
    fontFamily: polices.corpsMedium,
    color: couleurs.accentClair,
    fontSize: 12,
  },
  bulle: {
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: espacement.sm,
    paddingVertical: espacement.sm,
  },
  bulleJoueur: {
    backgroundColor: couleurs.bulleJoueur,
    borderColor: 'rgba(90, 172, 255, 0.35)',
  },
  bulleNarrateur: {
    backgroundColor: couleurs.bulleNarrateur,
    borderColor: couleurs.bordure,
  },
  texteBulle: {
    color: couleurs.texte,
    fontFamily: polices.corps,
    fontSize: 17,
    lineHeight: 24,
  },
  epingleIndicateur: {
    position: 'absolute',
    top: -8,
    right: -6,
    fontSize: 13,
  },
  reactionIndicateur: {
    fontSize: 15,
    marginTop: 2,
  },
  metaMessage: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 10,
    marginTop: 2,
    opacity: 0.6,
  },
  citationPreview: {
    borderLeftWidth: 2,
    borderLeftColor: couleurs.accent,
    paddingLeft: espacement.xs,
    marginBottom: 2,
    opacity: 0.7,
  },
  texteCitationPreview: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 12,
    fontStyle: 'italic',
  },
  superpositionSuppression: {
    flex: 1,
    backgroundColor: 'rgba(6, 8, 18, 0.75)',
    justifyContent: 'center',
    padding: espacement.lg,
  },
  panneauSuppression: {
    alignSelf: 'stretch',
  },
  panneauImageGeneree: {
    alignSelf: 'stretch',
  },
  imageGeneree: {
    width: '100%',
    aspectRatio: 3 / 4,
    marginTop: espacement.sm,
    borderRadius: 4,
  },
  aideImageGeneree: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 12,
    marginTop: espacement.xs,
  },
  erreur: {
    color: couleurs.danger,
    fontFamily: polices.corps,
    paddingHorizontal: espacement.md,
    paddingBottom: espacement.xs,
  },
  statut: {
    color: couleurs.accentClair,
    fontFamily: polices.corps,
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
    fontFamily: polices.corps,
    fontSize: 13,
  },
  panneauDebug: {
    maxHeight: 180,
    backgroundColor: couleurs.fondCarte,
    paddingHorizontal: espacement.md,
    paddingBottom: espacement.sm,
  },
  titreDebug: {
    color: couleurs.accentClair,
    fontFamily: polices.corpsMedium,
    fontSize: 12,
    marginTop: espacement.xs,
  },
  ligneDebug: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 13,
    lineHeight: 18,
  },
  grillePortraitsPnj: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: espacement.sm,
    marginTop: espacement.xs,
  },
  cartePortraitPnj: {
    width: 76,
    alignItems: 'center',
  },
  imagePortraitPnj: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: couleurs.bordure,
  },
  imagePortraitPnjVide: {
    backgroundColor: couleurs.fondCarte,
  },
  panneauPortraitAgrandi: {
    alignSelf: 'center',
    alignItems: 'center',
  },
  imagePortraitAgrandi: {
    width: 260,
    height: 260,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    marginBottom: espacement.md,
  },
  nomPortraitPnj: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 11,
    marginTop: espacement.xs / 2,
    textAlign: 'center',
  },
  boutonPortraitPnj: {
    paddingVertical: espacement.xs / 2,
    paddingHorizontal: espacement.xs,
    marginTop: espacement.xs / 2,
  },
  texteBoutonPortraitPnj: {
    fontSize: 10,
  },
  bandeauContexte: {
    paddingHorizontal: espacement.md,
    paddingVertical: espacement.xs,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bordure,
  },
  texteBandeauContexte: {
    color: couleurs.accentClair,
    fontFamily: polices.corps,
    fontSize: 14,
  },
  bandeauBranche: {
    paddingHorizontal: espacement.md,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bordure,
  },
  texteBandeauBranche: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 12,
    fontStyle: 'italic',
  },
  bandeauDerniereFois: {
    margin: espacement.md,
    marginBottom: 0,
  },
  labelDerniereFois: {
    ...stylePetitesCapitales,
    color: couleurs.dore,
    fontSize: 12,
    marginBottom: espacement.xs,
  },
  texteDerniereFois: {
    color: couleurs.texte,
    fontFamily: polices.corps,
    fontSize: 16,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: couleurs.fond,
    padding: espacement.lg,
    paddingTop: espacement.xl,
  },
  titreModal: {
    color: couleurs.dore,
    fontFamily: polices.display,
    fontSize: 22,
    letterSpacing: 1,
    marginBottom: espacement.md,
  },
  champConteneur: {
    marginTop: espacement.md,
  },
  labelConcepteur: {
    ...stylePetitesCapitales,
    color: couleurs.accentClair,
    fontSize: 12,
    marginTop: espacement.lg,
    marginBottom: espacement.xs,
  },
  textePromptSysteme: {
    color: couleurs.texte,
    fontFamily: polices.corps,
    fontSize: 13,
    lineHeight: 18,
  },
  sousTitreEtat: {
    ...stylePetitesCapitales,
    color: couleurs.dore,
    fontSize: 11,
    marginTop: espacement.sm,
    marginBottom: 2,
  },
  texteEtatBrut: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 12,
    lineHeight: 16,
  },
  aideRecherche: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 14,
    marginTop: espacement.md,
  },
  resultatRecherche: {
    paddingVertical: espacement.sm,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bordure,
  },
  roleResultat: {
    ...stylePetitesCapitales,
    color: couleurs.accentClair,
    fontSize: 11,
    marginBottom: 2,
  },
  texteResultat: {
    color: couleurs.texte,
    fontFamily: polices.corps,
    fontSize: 15,
    lineHeight: 21,
  },
  bandeauAlerte: {
    backgroundColor: '#3a2a1f',
    padding: espacement.sm,
  },
  texteBandeau: {
    color: '#ffd08a',
    fontFamily: polices.corps,
    fontSize: 13,
    textAlign: 'center',
  },
  zoneSaisie: {
    borderTopWidth: 1,
    borderTopColor: couleurs.bordure,
    padding: espacement.sm,
  },
  bandeauReponseA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: couleurs.fondCarte,
    borderLeftWidth: 2,
    borderLeftColor: couleurs.accent,
    paddingHorizontal: espacement.sm,
    paddingVertical: espacement.xs,
    marginBottom: espacement.xs,
  },
  texteBandeauReponseA: {
    flex: 1,
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 12,
    fontStyle: 'italic',
  },
  boutonFermerReponseA: {
    color: couleurs.texteAtténué,
    fontSize: 14,
    paddingLeft: espacement.sm,
  },
  rangeeActionsRapides: {
    flexDirection: 'row',
    gap: espacement.xs,
    marginBottom: espacement.xs,
  },
  boutonRapide: {
    paddingVertical: espacement.xs,
    paddingHorizontal: espacement.sm,
    alignSelf: 'flex-start',
  },
  texteBoutonRapide: {
    fontSize: 11,
  },
  rangeeSaisie: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: espacement.sm,
  },
  champSaisie: {
    maxHeight: 120,
  },
  boutonEnvoyer: {
    backgroundColor: 'rgba(90, 172, 255, 0.10)',
    borderWidth: 1,
    borderColor: couleurs.accent,
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
    color: couleurs.accentClair,
    fontFamily: polices.corpsMedium,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
