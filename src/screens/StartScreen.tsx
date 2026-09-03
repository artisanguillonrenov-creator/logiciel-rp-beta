import React, { useCallback, useState } from 'react';
import { BackHandler, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { StoryMeta } from '../types';
import { getStoriesIndex } from '../storage/storage';
import { couleurs, espacement, ombresLueur, polices, stylePetitesCapitales } from '../theme/theme';
import Separateur from '../components/Separateur';
import FondAtmospherique from '../components/FondAtmospherique';
import { VERSION_APP } from '../version';
import { LANGUES_SUGGEREES, useLangue } from '../i18n/LangueProvider';

const IMAGE_ACCUEIL = require('../../assets/scenes/accueil.png');

type Props = NativeStackScreenProps<RootStackParamList, 'Demarrage'>;

// Élément de menu principal ("NOUVEAU") : mis en avant par un encadré à
// glow, flanqué de losanges — repère visuel de l'action par défaut, comme
// dans un menu de jeu.
function ElementMenuPrincipal({ titre, onPress }: { titre: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.menuPrincipal}>
      <View style={styles.rangeeMenuPrincipal}>
        <View style={styles.ligneMenuPrincipal} />
        <Text style={styles.losangeMenuPrincipal}>◆</Text>
        <Text style={styles.texteMenuPrincipal}>{titre}</Text>
        <Text style={styles.losangeMenuPrincipal}>◆</Text>
        <View style={styles.ligneMenuPrincipal} />
      </View>
    </Pressable>
  );
}

function ElementMenu({ titre, onPress, desactive }: { titre: string; onPress: () => void; desactive?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={desactive} style={styles.elementMenu}>
      <Text style={[styles.texteElementMenu, desactive && styles.texteElementMenuDesactive]}>{titre}</Text>
    </Pressable>
  );
}

export default function StartScreen({ navigation }: Props) {
  const { t, langue } = useLangue();
  const [histoires, setHistoires] = useState<StoryMeta[]>([]);
  const [messageQuitter, setMessageQuitter] = useState('');
  const [modalLangueOuvert, setModalLangueOuvert] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let actif = true;
      getStoriesIndex().then((liste) => {
        if (actif) setHistoires([...liste].sort((a, b) => b.updatedAt - a.updatedAt));
      });
      return () => {
        actif = false;
      };
    }, []),
  );

  const derniereHistoire = histoires[0];

  function continuer() {
    if (!derniereHistoire) return;
    navigation.navigate('Conversation', { storyId: derniereHistoire.id });
  }

  function quitter() {
    if (Platform.OS === 'android') {
      BackHandler.exitApp();
      return;
    }
    setMessageQuitter(
      t(Platform.OS === 'web' ? 'Ferme cet onglet pour quitter Elyndor.' : 'Ferme l’application depuis le multitâche pour quitter.'),
    );
  }

  return (
    <FondAtmospherique style={styles.container} imageFond={IMAGE_ACCUEIL}>
      <Pressable style={styles.boutonLangue} onPress={() => setModalLangueOuvert(true)} hitSlop={8}>
        <Text style={styles.texteBoutonLangue}>
          🌐 {LANGUES_SUGGEREES.find((l) => l.code === langue)?.label ?? langue.toUpperCase()}
        </Text>
      </Pressable>

      <View style={styles.entete}>
        <Text style={styles.titre}>ELYNDOR</Text>
        <Text style={styles.sousTitre}>{t('Narrative Roleplay Engine')}</Text>
        <Separateur style={styles.separateur} />
      </View>

      <View style={styles.menu}>
        <ElementMenuPrincipal titre={t('Nouveau')} onPress={() => navigation.navigate('Creation')} />
        <Text style={styles.puceMenu}>◇</Text>
        <ElementMenu titre={t('Continuer')} onPress={continuer} desactive={!derniereHistoire} />
        <Text style={styles.puceMenu}>◇</Text>
        <ElementMenu titre={t('Charger conversation')} onPress={() => navigation.navigate('ChargerConversation')} />
        <Text style={styles.puceMenu}>◇</Text>
        <ElementMenu titre={t('Paramètres')} onPress={() => navigation.navigate('Reglages')} />
        <Text style={styles.puceMenu}>◇</Text>
        <ElementMenu titre={t('Quitter')} onPress={quitter} />
        {messageQuitter ? <Text style={styles.messageQuitter}>{messageQuitter}</Text> : null}
      </View>

      <Text style={styles.version}>{t('Version')} {VERSION_APP}</Text>

      <SelecteurLangue visible={modalLangueOuvert} onFermer={() => setModalLangueOuvert(false)} />
    </FondAtmospherique>
  );
}

// Sélecteur de langue (accueil) : évite de faire porter à l'IA la
// traduction en direct de chaque réponse — l'interface entière (jusqu'à la
// conversation) reste en français en interne et n'est traduite qu'à
// l'affichage, une fois par chaîne, en cache (voir src/i18n/LangueProvider).
function SelecteurLangue({ visible, onFermer }: { visible: boolean; onFermer: () => void }) {
  const { langue, definirLangue, t } = useLangue();
  const [langueLibre, setLangueLibre] = useState('');

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onFermer}>
      <Pressable style={styles.superpositionLangue} onPress={onFermer}>
        <Pressable style={styles.feuilleLangue} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.titreLangue}>{t('Langue de l’interface')}</Text>
          {LANGUES_SUGGEREES.map((option) => (
            <Pressable
              key={option.code}
              style={[styles.optionLangue, option.code === langue && styles.optionLangueActive]}
              onPress={() => {
                definirLangue(option.code);
                onFermer();
              }}
            >
              <Text style={[styles.texteOptionLangue, option.code === langue && styles.texteOptionLangueActive]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
          <View style={styles.rangeeLangueLibre}>
            <TextInput
              value={langueLibre}
              onChangeText={setLangueLibre}
              placeholder={t('Autre langue (ex. japonais, néerlandais…)')}
              placeholderTextColor={couleurs.texteAtténué}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.champLangueLibre}
            />
            <Pressable
              style={styles.boutonValiderLangueLibre}
              onPress={() => {
                const code = langueLibre.trim();
                if (!code) return;
                definirLangue(code.toLowerCase());
                setLangueLibre('');
                onFermer();
              }}
            >
              <Text style={styles.texteValiderLangueLibre}>OK</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: espacement.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  entete: {
    alignItems: 'center',
    marginBottom: espacement.xl,
  },
  titre: {
    color: couleurs.dore,
    fontFamily: polices.display,
    fontSize: 88,
    letterSpacing: 5,
  },
  sousTitre: {
    ...stylePetitesCapitales,
    color: couleurs.texteAtténué,
    fontSize: 12,
    marginTop: espacement.xs,
  },
  separateur: {
    width: 160,
    marginTop: espacement.md,
  },
  menu: {
    alignItems: 'center',
  },
  menuPrincipal: {
    alignSelf: 'stretch',
  },
  rangeeMenuPrincipal: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: couleurs.accent,
    backgroundColor: 'rgba(90, 172, 255, 0.10)',
    paddingVertical: espacement.sm + 2,
    paddingHorizontal: espacement.md,
    ...ombresLueur,
  },
  ligneMenuPrincipal: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(90, 172, 255, 0.45)',
  },
  losangeMenuPrincipal: {
    color: couleurs.accentClair,
    fontSize: 10,
    marginHorizontal: espacement.sm,
  },
  texteMenuPrincipal: {
    color: couleurs.texte,
    fontFamily: polices.corpsMedium,
    fontSize: 20,
    textTransform: 'uppercase',
    letterSpacing: 3,
  },
  puceMenu: {
    color: couleurs.bordure,
    fontSize: 10,
    marginVertical: espacement.sm,
  },
  elementMenu: {
    paddingVertical: espacement.xs,
  },
  texteElementMenu: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corpsMedium,
    fontSize: 17,
    textTransform: 'uppercase',
    letterSpacing: 2,
    textAlign: 'center',
  },
  texteElementMenuDesactive: {
    opacity: 0.4,
  },
  messageQuitter: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 13,
    marginTop: espacement.md,
    textAlign: 'center',
  },
  version: {
    position: 'absolute',
    right: espacement.lg,
    bottom: espacement.lg,
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 12,
    opacity: 0.7,
  },
  boutonLangue: {
    position: 'absolute',
    left: espacement.lg,
    top: espacement.lg,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    paddingHorizontal: espacement.sm,
    paddingVertical: espacement.xs,
  },
  texteBoutonLangue: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 13,
  },
  superpositionLangue: {
    flex: 1,
    backgroundColor: 'rgba(6, 8, 18, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: espacement.lg,
  },
  feuilleLangue: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: couleurs.fondCarte,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    padding: espacement.md,
  },
  titreLangue: {
    color: couleurs.dore,
    fontFamily: polices.display,
    fontSize: 18,
    marginBottom: espacement.sm,
    textAlign: 'center',
  },
  optionLangue: {
    paddingVertical: espacement.sm,
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bordure,
  },
  optionLangueActive: {
    backgroundColor: 'rgba(90, 172, 255, 0.10)',
  },
  texteOptionLangue: {
    color: couleurs.texte,
    fontFamily: polices.corps,
    fontSize: 16,
    textAlign: 'center',
  },
  texteOptionLangueActive: {
    color: couleurs.accentClair,
  },
  rangeeLangueLibre: {
    flexDirection: 'row',
    gap: espacement.sm,
    marginTop: espacement.md,
  },
  champLangueLibre: {
    flex: 1,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    color: couleurs.texte,
    fontFamily: polices.corps,
    fontSize: 14,
    paddingHorizontal: espacement.sm,
    paddingVertical: espacement.xs,
  },
  boutonValiderLangueLibre: {
    borderWidth: 1,
    borderColor: couleurs.accent,
    paddingHorizontal: espacement.md,
    justifyContent: 'center',
  },
  texteValiderLangueLibre: {
    color: couleurs.accentClair,
    fontFamily: polices.corpsMedium,
  },
});
