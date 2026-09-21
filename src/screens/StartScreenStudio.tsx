import React, { useCallback, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../navigation/types';
import type { StoryMeta } from '../types';
import { getStoriesIndex } from '../storage/storage';
import { obtenirPortrait } from '../data/portraits';
import { RACES_ELYNDOR } from '../data/races';
import { SYNOPSIS_ELYNDOR } from '../data/synopsisElyndor';
import { LANGUES_SUGGEREES, useLangue } from '../i18n/LangueProvider';
import { VERSION_APP } from '../version';
import FondAtmospherique from '../components/FondAtmospherique';
import Bouton from '../components/Bouton';
import Separateur from '../components/Separateur';
import { couleurs, espacement, interfaceV2, interlettrage, polices, rayon, stylePetitesCapitales } from '../theme/theme';

const IMAGE_ACCUEIL = require('../../assets/scenes/accueil.png');

type Props = NativeStackScreenProps<RootStackParamList, 'Demarrage'>;

function formaterDate(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleDateString();
  }
}

function LienBas({ titre, symbole, onPress }: { titre: string; symbole: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.lienBas, pressed && styles.presse]} onPress={onPress} hitSlop={8}>
      <Text style={styles.symboleLien}>{symbole}</Text>
      <Text style={styles.texteLien}>{titre}</Text>
    </Pressable>
  );
}

export default function StartScreenStudio({ navigation }: Props) {
  const { t, langue } = useLangue();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const compact = width < 700 || height < 700;
  const [histoires, setHistoires] = useState<StoryMeta[]>([]);
  const [erreurHistoires, setErreurHistoires] = useState('');
  const [modalLangueOuvert, setModalLangueOuvert] = useState(false);
  const [modalGuideOuvert, setModalGuideOuvert] = useState(false);
  const [modalSynopsisOuvert, setModalSynopsisOuvert] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let actif = true;
      getStoriesIndex()
        .then((liste) => {
          if (!actif) return;
          setHistoires([...liste].sort((a, b) => b.updatedAt - a.updatedAt));
          setErreurHistoires('');
        })
        .catch(() => {
          if (actif) setErreurHistoires('Impossible de lire tes histoires.');
        });
      return () => { actif = false; };
    }, []),
  );

  const derniereHistoire = histoires[0];
  const portraitDerniere = useMemo(
    () => obtenirPortrait(derniereHistoire?.raceOrigineId, derniereHistoire?.sexe),
    [derniereHistoire],
  );

  return (
    <FondAtmospherique style={styles.container} imageFond={IMAGE_ACCUEIL}>
      <View style={[styles.voile, compact && styles.voileCompact]} pointerEvents="none" />

      <View style={[styles.page, { paddingTop: Math.max(insets.top, espacement.md), paddingBottom: Math.max(insets.bottom, espacement.md) }]}>
        <Pressable style={styles.langue} onPress={() => setModalLangueOuvert(true)} hitSlop={8}>
          <Text style={styles.langueSymbole}>◎</Text>
          <Text style={styles.langueTexte}>{LANGUES_SUGGEREES.find((l) => l.code === langue)?.label ?? langue.toUpperCase()}</Text>
        </Pressable>

        <View style={[styles.marque, compact && styles.marqueCompact]}>
          <View style={styles.rangeeTitre}>
            <Text style={styles.sceau}>✦</Text>
            <Text style={[styles.titre, compact && styles.titreCompact]}>ELYNDOR</Text>
          </View>
          <Text style={styles.sousTitre}>{t('Vos décisions laissent des traces.')}</Text>
          <Separateur style={styles.separateurTitre} />
        </View>

        <View style={styles.espaceCentral} />

        <View style={[styles.actions, compact && styles.actionsCompact]}>
          {derniereHistoire ? (
            <Pressable
              style={({ pressed }) => [styles.carteContinuer, pressed && styles.presse]}
              onPress={() => navigation.navigate('Conversation', { storyId: derniereHistoire.id })}
            >
              {portraitDerniere ? (
                <Image source={portraitDerniere} style={styles.miniatureSauvegarde} resizeMode="cover" />
              ) : (
                <View style={styles.miniatureVide}><Text style={styles.runeMiniature}>◇</Text></View>
              )}
              <View style={styles.contenuContinuer}>
                <Text style={styles.labelContinuer}>{t("Continuer l'aventure")}</Text>
                <Text style={styles.nomHistoire} numberOfLines={1}>
                  {derniereHistoire.titre || derniereHistoire.personnageNom}
                </Text>
                <Text style={styles.metaHistoire} numberOfLines={1}>
                  {(derniereHistoire.contexte.lieu || t('Lieu inconnu'))} · {t('Dernière session')} : {formaterDate(derniereHistoire.updatedAt)}
                </Text>
              </View>
              <Text style={styles.flecheContinuer}>›</Text>
            </Pressable>
          ) : (
            <View style={styles.invitationPremiere}>
              <Text style={styles.invitationTitre}>{t('Ton histoire commence ici.')}</Text>
              <Text style={styles.invitationTexte}>{t('Crée un personnage, choisis ton point de départ et entre dans Elyndor.')}</Text>
            </View>
          )}

          <Bouton titre={t('Nouvelle histoire')} onPress={() => navigation.navigate('Creation')} style={styles.boutonPrincipal} />
          <Bouton
            titre={t('Charger une histoire')}
            variante="secondaire"
            onPress={() => navigation.navigate('ChargerConversation')}
            style={styles.boutonSecondaire}
          />

          {erreurHistoires ? <Text style={styles.erreur}>{t(erreurHistoires)}</Text> : null}
        </View>

        <View style={styles.pied}>
          <LienBas titre={t('Paramètres')} symbole="⚙" onPress={() => navigation.navigate('Reglages')} />
          <LienBas titre={t('Guide')} symbole="◇" onPress={() => setModalGuideOuvert(true)} />
          <LienBas titre={t("Monde d'Elyndor")} symbole="✧" onPress={() => setModalSynopsisOuvert(true)} />
        </View>

        <Text style={styles.version}>{t('Version')} {VERSION_APP}</Text>
      </View>

      <SelecteurLangue visible={modalLangueOuvert} onFermer={() => setModalLangueOuvert(false)} />
      <ModalGuide visible={modalGuideOuvert} onFermer={() => setModalGuideOuvert(false)} />
      <ModalSynopsis visible={modalSynopsisOuvert} onFermer={() => setModalSynopsisOuvert(false)} />
    </FondAtmospherique>
  );
}

function CadreModal({ children, onFermer }: { children: React.ReactNode; onFermer: () => void }) {
  return (
    <Pressable style={styles.superposition} onPress={onFermer}>
      <Pressable style={styles.cadreModal} onPress={(e) => e.stopPropagation()}>
        {children}
      </Pressable>
    </Pressable>
  );
}

function SelecteurLangue({ visible, onFermer }: { visible: boolean; onFermer: () => void }) {
  const { t, langue, definirLangue } = useLangue();
  const [libre, setLibre] = useState('');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onFermer}>
      <CadreModal onFermer={onFermer}>
        <Text style={styles.titreModal}>{t('Langue')}</Text>
        <ScrollView style={styles.scrollModal}>
          {LANGUES_SUGGEREES.map((l) => (
            <Pressable
              key={l.code}
              style={[styles.optionLangue, langue === l.code && styles.optionLangueActive]}
              onPress={() => { definirLangue(l.code); onFermer(); }}
            >
              <Text style={[styles.texteOptionLangue, langue === l.code && styles.texteOptionLangueActive]}>{l.label}</Text>
            </Pressable>
          ))}
          <Text style={styles.labelLibre}>{t('Autre langue')}</Text>
          <View style={styles.rangeeLibre}>
            <TextInput
              style={styles.champLibre}
              value={libre}
              onChangeText={setLibre}
              placeholder={t('Code langue, ex. pt')}
              placeholderTextColor={couleurs.texteFaible}
              autoCapitalize="none"
            />
            <Pressable
              style={styles.appliquerLibre}
              onPress={() => {
                const code = libre.trim().toLowerCase();
                if (!code) return;
                definirLangue(code);
                onFermer();
              }}
            >
              <Text style={styles.texteAppliquer}>{t('Appliquer')}</Text>
            </Pressable>
          </View>
        </ScrollView>
        <Bouton titre={t('Fermer')} variante="secondaire" onPress={onFermer} style={{ marginTop: espacement.md }} />
      </CadreModal>
    </Modal>
  );
}

function ModalGuide({ visible, onFermer }: { visible: boolean; onFermer: () => void }) {
  const { t } = useLangue();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onFermer}>
      <CadreModal onFermer={onFermer}>
        <Text style={styles.titreModal}>{t("Guide d'utilisation")}</Text>
        <ScrollView style={styles.scrollModal} showsVerticalScrollIndicator={false}>
          <BlocGuide titre={t('Créer')} texte={t('Choisis ton monde, ton personnage, son apparence et le point de départ de ton histoire. Les réglages avancés restent facultatifs.')} />
          <BlocGuide titre={t('Jouer')} texte={t("Écris ton action ou ta réplique. Le narrateur fait vivre le monde, les PNJ et les conséquences sans décider à ta place.")} />
          <BlocGuide titre={t('Mémoire')} texte={t('Les faits importants, relations et événements peuvent être conservés au fil de l’histoire. Écris « retiens que… » pour fixer immédiatement un souvenir.')} />
          <BlocGuide titre={t('Actions du récit')} texte={t('Régénération, suggestion de réplique, illustration, portraits et messages épinglés restent accessibles depuis le menu de la conversation.')} />
        </ScrollView>
        <Bouton titre={t('Fermer')} variante="secondaire" onPress={onFermer} style={{ marginTop: espacement.md }} />
      </CadreModal>
    </Modal>
  );
}

function BlocGuide({ titre, texte }: { titre: string; texte: string }) {
  return (
    <View style={styles.blocGuide}>
      <Text style={styles.titreGuide}>{titre}</Text>
      <Text style={styles.texteGuide}>{texte}</Text>
    </View>
  );
}

function ModalSynopsis({ visible, onFermer }: { visible: boolean; onFermer: () => void }) {
  const { t } = useLangue();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onFermer}>
      <CadreModal onFermer={onFermer}>
        <Text style={styles.titreModal}>{t("Le monde d'Elyndor")}</Text>
        <ScrollView style={styles.scrollModal} showsVerticalScrollIndicator={false}>
          {SYNOPSIS_ELYNDOR.map((paragraphe, i) => <Text key={i} style={styles.texteSynopsis}>{t(paragraphe)}</Text>)}
          <Separateur style={{ marginVertical: espacement.md }} />
          <Text style={styles.titreGuide}>{t("Peuples d'Elyndor")}</Text>
          {RACES_ELYNDOR.map((race) => (
            <View key={race.id} style={styles.raceLigne}>
              <Text style={styles.raceNom}>{t(race.nom)}</Text>
              <Text style={styles.raceDescription}>{t(race.description)}</Text>
            </View>
          ))}
        </ScrollView>
        <Bouton titre={t('Fermer')} variante="secondaire" onPress={onFermer} style={{ marginTop: espacement.md }} />
      </CadreModal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  voile: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(2, 8, 15, 0.18)',
  },
  voileCompact: { backgroundColor: 'rgba(2, 8, 15, 0.30)' },
  page: {
    flex: 1,
    paddingHorizontal: espacement.lg,
  },
  langue: {
    position: 'absolute',
    zIndex: 5,
    top: espacement.md,
    right: espacement.lg,
    minHeight: interfaceV2.cibleTactileMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: espacement.sm,
  },
  langueSymbole: { color: couleurs.dore, fontSize: 16 },
  langueTexte: { color: couleurs.texteAtténué, fontFamily: polices.displaySemiGras, letterSpacing: interlettrage.pilule, fontSize: 11 },
  marque: { alignItems: 'center', marginTop: espacement.xl },
  marqueCompact: { marginTop: espacement.lg },
  rangeeTitre: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sceau: { color: couleurs.dore, fontSize: 34, textShadowColor: 'rgba(201,164,92,0.35)', textShadowRadius: 8 },
  titre: {
    color: couleurs.doreClair,
    fontFamily: polices.display,
    fontSize: 64,
    letterSpacing: interlettrage.logo,
    textShadowColor: 'rgba(201,164,92,0.18)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 40,
  },
  titreCompact: { fontSize: 44, letterSpacing: 8 },
  sousTitre: {
    color: '#C9CFE0',
    fontFamily: polices.corps,
    fontSize: 21,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowRadius: 6,
  },
  separateurTitre: { width: 150, marginTop: espacement.sm },
  espaceCentral: { flex: 1, minHeight: 12 },
  actions: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    gap: espacement.sm,
    marginBottom: espacement.md,
  },
  actionsCompact: { maxWidth: 460 },
  carteContinuer: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: couleurs.fondCarte,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    borderRadius: rayon.lg,
    overflow: 'hidden',
    marginBottom: espacement.xs,
  },
  miniatureSauvegarde: { width: 88, minHeight: 88 },
  miniatureVide: { width: 88, alignItems: 'center', justifyContent: 'center', backgroundColor: couleurs.fondCarteDense },
  runeMiniature: { color: couleurs.dore, fontSize: 24 },
  contenuContinuer: { flex: 1, justifyContent: 'center', paddingHorizontal: espacement.md, paddingVertical: espacement.sm },
  labelContinuer: { fontFamily: polices.displaySemiGras, textTransform: 'uppercase', letterSpacing: interlettrage.labelSection, color: couleurs.dore, fontSize: 11 },
  nomHistoire: { color: couleurs.texte, fontFamily: polices.displaySemiGras, letterSpacing: interlettrage.nomPersonnage, fontSize: 13, marginTop: 3 },
  metaHistoire: { color: couleurs.texteAtténué, fontFamily: polices.corps, fontSize: 15, marginTop: 3 },
  flecheContinuer: { color: couleurs.dore, fontFamily: polices.titre, fontSize: 32, alignSelf: 'center', paddingRight: espacement.md },
  invitationPremiere: {
    backgroundColor: couleurs.fondCarte,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    borderRadius: rayon.lg,
    padding: espacement.md,
    marginBottom: espacement.xs,
  },
  invitationTitre: { color: couleurs.doreClair, fontFamily: polices.titre, fontSize: 20, textAlign: 'center' },
  invitationTexte: { color: couleurs.texteAtténué, fontFamily: polices.corps, fontSize: 15, textAlign: 'center', marginTop: 4 },
  boutonPrincipal: {},
  boutonSecondaire: {},
  erreur: { color: couleurs.danger, fontFamily: polices.corps, textAlign: 'center', marginTop: 4 },
  pied: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: espacement.sm,
    marginBottom: espacement.xs,
  },
  lienBas: {
    minHeight: interfaceV2.cibleTactileMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: espacement.sm,
  },
  symboleLien: { color: couleurs.dore, fontSize: 14 },
  texteLien: { color: couleurs.texteAtténué, fontFamily: polices.displaySemiGras, letterSpacing: interlettrage.pilule, fontSize: 11 },
  presse: { opacity: 0.72 },
  version: {
    position: 'absolute',
    left: espacement.sm,
    bottom: 2,
    color: couleurs.texteFaible,
    fontFamily: polices.corps,
    fontSize: 10,
  },
  superposition: {
    flex: 1,
    backgroundColor: 'rgba(3, 5, 11, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: espacement.lg,
  },
  cadreModal: {
    width: '100%',
    maxWidth: interfaceV2.largeurPanneauMax,
    maxHeight: '84%',
    backgroundColor: couleurs.fondCarteDense,
    borderWidth: 1,
    borderColor: couleurs.bordureDoree,
    borderRadius: rayon.xl,
    padding: espacement.lg,
  },
  titreModal: { color: couleurs.doreClair, fontFamily: polices.displaySemiGras, letterSpacing: interlettrage.titreEcran, fontSize: 20, textAlign: 'center', marginBottom: espacement.md },
  scrollModal: { flexGrow: 0 },
  optionLangue: { minHeight: 48, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: couleurs.bordureSubtile },
  optionLangueActive: { backgroundColor: 'rgba(201,164,92,0.10)' },
  texteOptionLangue: { color: couleurs.texte, fontFamily: polices.corps, fontSize: 16, textAlign: 'center' },
  texteOptionLangueActive: { color: couleurs.doreClair },
  labelLibre: { ...stylePetitesCapitales, color: couleurs.texteAtténué, fontSize: 10, marginTop: espacement.md, marginBottom: espacement.xs },
  rangeeLibre: { flexDirection: 'row', gap: espacement.sm },
  champLibre: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: couleurs.bordure, color: couleurs.texte, paddingHorizontal: espacement.sm, fontFamily: polices.corps },
  appliquerLibre: { minHeight: 48, justifyContent: 'center', borderWidth: 1, borderColor: couleurs.accent, paddingHorizontal: espacement.md },
  texteAppliquer: { color: couleurs.accentClair, fontFamily: polices.corpsMedium },
  blocGuide: { marginBottom: espacement.md },
  titreGuide: { color: couleurs.dore, fontFamily: polices.titre, fontSize: 17, marginBottom: 2 },
  texteGuide: { color: couleurs.texte, fontFamily: polices.corps, fontSize: 15, lineHeight: 22 },
  texteSynopsis: { color: couleurs.texte, fontFamily: polices.corps, fontSize: 15, lineHeight: 22, marginBottom: espacement.sm },
  raceLigne: { marginBottom: espacement.sm },
  raceNom: { color: couleurs.dore, fontFamily: polices.corpsMedium, fontSize: 15 },
  raceDescription: { color: couleurs.texteAtténué, fontFamily: polices.corps, fontSize: 13, lineHeight: 19 },
});
