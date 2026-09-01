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
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { AppSettings, Message, StoryState } from '../types';
import { getSettings, getStory, saveStory } from '../storage/storage';
import { calculerDebugLore, genererTour, regenererDernierTour, type DebugLore } from '../engine/generateTurn';
import { creerBranche } from '../engine/story';
import { detecterCommandeRetenir, verrouillerFait } from '../engine/memory';
import { suggererRepliqueJoueur } from '../engine/suggestion';
import { ErreurOpenRouter } from '../engine/openrouter';
import { ErreurEmbeddings } from '../engine/embeddings';
import { couleurs, espacement, polices, stylePetitesCapitales } from '../theme/theme';
import Bouton from '../components/Bouton';
import Champ from '../components/Champ';
import Panneau from '../components/Panneau';

type Props = NativeStackScreenProps<RootStackParamList, 'Conversation'>;

// Rouvrir une histoire après une pause plus longue que ça déclenche le
// bandeau "La dernière fois…" (Ajouts_A_Integrer.md #3).
const SEUIL_PAUSE_MS = 6 * 60 * 60 * 1000;

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

  // Recherche + épinglés (Ajouts_A_Integrer.md #1 et #2).
  const [modalRechercheOuvert, setModalRechercheOuvert] = useState(false);
  const [texteRecherche, setTexteRecherche] = useState('');
  const [epinglesUniquement, setEpinglesUniquement] = useState(false);

  // Résumé "la dernière fois" (Ajouts_A_Integrer.md #3).
  const [derniereFoisVisible, setDerniereFoisVisible] = useState(false);

  // Suggestion de réplique pour le joueur (Ajouts_A_Integrer.md #4).
  const [suggestionEnCours, setSuggestionEnCours] = useState(false);

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

  useEffect(() => {
    if (story) {
      navigation.setOptions({
        title: story.meta.personnageNom,
        headerRight: () => (
          <View style={styles.rangeeEntete}>
            <Pressable onPress={() => setModalRechercheOuvert(true)} hitSlop={8}>
              <Text style={styles.iconeEntete}>🔍</Text>
            </Pressable>
            <Pressable onPress={creerBrancheIci} hitSlop={8}>
              <Text style={styles.iconeEntete}>🌿</Text>
            </Pressable>
          </View>
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
  const messagesRecherche = epinglesUniquement
    ? story.messages.filter((m) => m.epingle)
    : texteRecherche.trim()
      ? story.messages.filter((m) => m.content.toLowerCase().includes(texteRecherche.trim().toLowerCase()))
      : [];

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

        {derniereFoisVisible && (
          <Panneau style={styles.bandeauDerniereFois}>
            <Text style={styles.labelDerniereFois}>La dernière fois…</Text>
            <Text style={styles.texteDerniereFois}>{story.memoire.resume}</Text>
            <Bouton titre="Continuer" variante="secondaire" onPress={() => setDerniereFoisVisible(false)} style={{ marginTop: espacement.sm }} />
          </Panneau>
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
            onScrollToIndexFailed={(info) => {
              setTimeout(() => listeRef.current?.scrollToIndex({ index: info.index, animated: true }), 100);
            }}
            renderItem={({ item }) => (
              <Pressable onLongPress={() => togglerEpingle(item.id)} delayLongPress={400}>
                <View style={[styles.bulle, item.role === 'user' ? styles.bulleJoueur : styles.bulleNarrateur]}>
                  {item.epingle ? <Text style={styles.epingleIndicateur}>📌</Text> : null}
                  <Text style={styles.texteBulle}>{item.content}</Text>
                </View>
              </Pressable>
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
        {messageStatut ? <Text style={styles.statut}>{messageStatut}</Text> : null}

        <View style={styles.zoneSaisie}>
          <View style={styles.rangeeActionsRapides}>
            {dernierEstAssistant && (
              <Bouton titre="Régénérer" variante="secondaire" onPress={regenerer} desactive={enCours} style={styles.boutonRapide} texteStyle={styles.texteBoutonRapide} />
            )}
            <Bouton
              titre={suggestionEnCours ? 'Suggestion…' : 'Suggérer une réplique'}
              variante="secondaire"
              onPress={suggererReplique}
              desactive={enCours || suggestionEnCours}
              style={styles.boutonRapide}
              texteStyle={styles.texteBoutonRapide}
            />
          </View>
          <View style={styles.rangeeSaisie}>
            <Champ
              value={saisie}
              onChangeText={setSaisie}
              placeholder="Ton action ou ta réplique… (« retiens que … » pour forcer un fait)"
              multiligne
              editable={!enCours}
              conteneurStyle={{ flex: 1 }}
              style={styles.champSaisie}
            />
            <Pressable
              style={[styles.boutonEnvoyer, (enCours || !saisie.trim()) && styles.boutonDesactive]}
              onPress={envoyer}
              disabled={enCours || !saisie.trim()}
            >
              {enCours ? <ActivityIndicator color={couleurs.accentClair} /> : <Text style={styles.texteEnvoyer}>Envoyer</Text>}
            </Pressable>
          </View>
        </View>
      </View>

      <Modal visible={modalContexteOuvert} animationType="slide" onRequestClose={() => setModalContexteOuvert(false)}>
        <ScrollView style={styles.modalContainer} contentContainerStyle={{ paddingBottom: espacement.xl }}>
          <Text style={styles.titreModal}>Contexte de l'histoire</Text>

          <Champ label="Lieu" value={lieuEdit} onChangeText={setLieuEdit} conteneurStyle={styles.champConteneur} />
          <Champ label="Ambiance" value={ambianceEdit} onChangeText={setAmbianceEdit} multiligne conteneurStyle={styles.champConteneur} />
          <Champ label="Date / période" value={dateEdit} onChangeText={setDateEdit} conteneurStyle={styles.champConteneur} />
          <Champ label="Objectifs" value={objectifsEdit} onChangeText={setObjectifsEdit} multiligne conteneurStyle={styles.champConteneur} />

          <Bouton titre="Enregistrer" onPress={enregistrerContexte} style={{ marginTop: espacement.lg }} />
          <Bouton titre="Fermer sans enregistrer" variante="secondaire" onPress={() => setModalContexteOuvert(false)} style={{ marginTop: espacement.sm }} />
        </ScrollView>
      </Modal>

      <Modal visible={modalRechercheOuvert} animationType="slide" onRequestClose={() => setModalRechercheOuvert(false)}>
        <View style={styles.modalContainer}>
          <Text style={styles.titreModal}>Recherche</Text>

          <Champ
            value={texteRecherche}
            onChangeText={(v) => {
              setTexteRecherche(v);
              setEpinglesUniquement(false);
            }}
            placeholder="Mot-clé dans la conversation…"
            conteneurStyle={styles.champConteneur}
          />
          <Bouton
            titre={epinglesUniquement ? '✓ Épinglés uniquement' : 'Épinglés uniquement'}
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
                  ? 'Aucun message épinglé — reste appuyé sur un message pour en épingler un.'
                  : texteRecherche.trim()
                    ? 'Aucun résultat.'
                    : 'Tape un mot-clé pour chercher dans la conversation.'}
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable style={styles.resultatRecherche} onPress={() => allerAuMessage(item.id)}>
                <Text style={styles.roleResultat}>
                  {item.role === 'user' ? story.meta.personnageNom : 'Narrateur'}
                  {item.epingle ? ' 📌' : ''}
                </Text>
                <Text style={styles.texteResultat} numberOfLines={2}>
                  {item.content}
                </Text>
              </Pressable>
            )}
          />
          <Bouton titre="Fermer" variante="secondaire" onPress={() => setModalRechercheOuvert(false)} style={{ marginTop: espacement.md }} />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: couleurs.fond,
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
  bulle: {
    maxWidth: '85%',
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: espacement.sm,
    paddingVertical: espacement.sm,
  },
  bulleJoueur: {
    backgroundColor: couleurs.bulleJoueur,
    alignSelf: 'flex-end',
    borderColor: 'rgba(90, 172, 255, 0.35)',
  },
  bulleNarrateur: {
    backgroundColor: couleurs.bulleNarrateur,
    alignSelf: 'flex-start',
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
