import React, { useCallback, useState } from 'react';
import { BackHandler, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { RACES_ELYNDOR } from '../data/races';
import { SYNOPSIS_ELYNDOR } from '../data/synopsisElyndor';

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
  const [modalGuideOuvert, setModalGuideOuvert] = useState(false);
  const [modalSynopsisOuvert, setModalSynopsisOuvert] = useState(false);

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
        <ElementMenu titre={t('Guide')} onPress={() => setModalGuideOuvert(true)} />
        <Text style={styles.puceMenu}>◇</Text>
        <ElementMenu titre={t('Le monde d’Elyndor')} onPress={() => setModalSynopsisOuvert(true)} />
        <Text style={styles.puceMenu}>◇</Text>
        <ElementMenu titre={t('Quitter')} onPress={quitter} />
        {messageQuitter ? <Text style={styles.messageQuitter}>{messageQuitter}</Text> : null}
      </View>

      <Text style={styles.version}>{t('Version')} {VERSION_APP}</Text>

      <SelecteurLangue visible={modalLangueOuvert} onFermer={() => setModalLangueOuvert(false)} />
      <ModalGuide visible={modalGuideOuvert} onFermer={() => setModalGuideOuvert(false)} />
      <ModalSynopsis visible={modalSynopsisOuvert} onFermer={() => setModalSynopsisOuvert(false)} />
    </FondAtmospherique>
  );
}

// Guide d'utilisation (accueil) : un point d'entrée statique, jamais généré
// par le modèle — décrit ce que fait chaque action de l'écran de
// conversation, pour un premier lancement sans tutoriel interactif.
function ModalGuide({ visible, onFermer }: { visible: boolean; onFermer: () => void }) {
  const { t } = useLangue();
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onFermer}>
      <Pressable style={styles.superpositionLangue} onPress={onFermer}>
        <Pressable style={styles.feuilleGuide} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.titreLangue}>{t('Guide d’utilisation')}</Text>
          <ScrollView style={styles.scrollGuide} showsVerticalScrollIndicator={false}>
            <Text style={styles.titreSectionGuide}>{t('Commencer')}</Text>
            <Text style={styles.texteGuide}>
              {t(
                '« Nouveau » ouvre la création de personnage en quelques étapes (identité, apparence, point de départ, préférences de ton). « Continuer » reprend ta dernière histoire, « Charger conversation » ouvre la liste complète — un appui long ou un glissement permet de la renommer, l’archiver en branche ou la supprimer.',
              )}
            </Text>

            <Text style={styles.titreSectionGuide}>{t('Écrire')}</Text>
            <Text style={styles.texteGuide}>
              {t(
                'Tape ton action ou ta réplique dans le champ en bas de la conversation. Commence un message par « retiens que … » pour forcer un fait immédiatement en mémoire, sans passer par une réponse du narrateur.',
              )}
            </Text>

            <Text style={styles.titreSectionGuide}>{t('Actions rapides')}</Text>
            <Text style={styles.texteGuide}>
              {t(
                '« Régénérer » redemande une nouvelle réponse à la dernière réplique. « Continuer » fait avancer le récit sans proposer d’action précise, sans avoir à taper quoi que ce soit. « Suggérer une réplique » propose un texte à ta place dans le champ de saisie, à modifier avant d’envoyer. « Illustrer cette scène » (si activé dans Réglages) génère une image de la scène en cours.',
              )}
            </Text>

            <Text style={styles.titreSectionGuide}>{t('PNJ et portraits')}</Text>
            <Text style={styles.texteGuide}>
              {t(
                'Les personnages récurrents nommés obtiennent automatiquement un portrait (si la génération d’images est activée) : consultable et régénérable dans le panneau « Debug lore », et affiché directement à côté de leur nom dans le texte une fois généré.',
              )}
            </Text>

            <Text style={styles.titreSectionGuide}>{t('Debug lore')}</Text>
            <Text style={styles.texteGuide}>
              {t(
                'Ce panneau, en bas de la conversation, montre ce que le narrateur a utilisé pour écrire sa dernière réponse : métamoteurs et lore d’Elyndor sélectionnés, souvenirs retrouvés dans l’historique, portraits des PNJ. Utile pour comprendre une incohérence plutôt qu’une simple boîte noire.',
              )}
            </Text>

            <Text style={styles.titreSectionGuide}>{t('Réglages')}</Text>
            <Text style={styles.texteGuide}>
              {t(
                'Clé API OpenRouter, moteur d’inférence (en ligne ou modèle local), profil de contenu (Grand public par défaut), langue de l’interface, génération d’images — tout se configure depuis « Paramètres », à faire avant la première conversation.',
              )}
            </Text>

            <Text style={styles.titreSectionGuide}>{t('Exporter')}</Text>
            <Text style={styles.texteGuide}>
              {t(
                'Depuis une conversation, l’icône de téléchargement propose un export en texte brut, PDF ou EPUB — pour relire son histoire comme un livre en dehors de l’app.',
              )}
            </Text>
          </ScrollView>
          <Pressable style={styles.boutonFermerModal} onPress={onFermer}>
            <Text style={styles.texteBoutonFermerModal}>{t('Fermer')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Synopsis du monde (accueil) : contenu rédigé pour un public général — le
// lore complet (src/data/elyndorLore.json) contient des détails matures
// réservés au profil Adulte à la génération ; ce résumé s'en tient aux
// faits d'ambiance/d'histoire sans détail explicite, cohérent avec le
// principe "Grand public par défaut" de l'app.
function ModalSynopsis({ visible, onFermer }: { visible: boolean; onFermer: () => void }) {
  const { t } = useLangue();
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onFermer}>
      <Pressable style={styles.superpositionLangue} onPress={onFermer}>
        <Pressable style={styles.feuilleGuide} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.titreLangue}>{t('Le monde d’Elyndor')}</Text>
          <ScrollView style={styles.scrollGuide} showsVerticalScrollIndicator={false}>
            {SYNOPSIS_ELYNDOR.map((paragraphe, i) => (
              <Text key={i} style={styles.texteSynopsis}>
                {t(paragraphe)}
              </Text>
            ))}

            <Text style={[styles.titreSectionGuide, { marginTop: espacement.lg }]}>{t('Repères — Les Portes Astra')}</Text>
            <Text style={styles.texteGuide}>
              {t(
                'Héritage détourné d’une guerre ancienne, les Portes Astra sont des portails de téléportation instantanée reliant les quatorze capitales — accessibles à tous moyennant paiement, sous le contrôle neutre d’un conseil multiracial. Contrôler une Porte, c’est contrôler une région entière.',
              )}
            </Text>

            <Text style={styles.titreSectionGuide}>{t('Repères — Une histoire en cinq ères')}</Text>
            <Text style={styles.texteGuide}>
              {t(
                '① Les Origines — les peuples d’Elyndor vivent séparés, sans domination globale.\n② La Guerre des Voiles — des fissures dimensionnelles s’ouvrent et déversent des créatures hostiles ; une coalition de tous les peuples les referme et retourne cette magie pour créer les Portes Astra. Les Zones Corrompues nées de ce conflit n’ont jamais totalement disparu.\n③ La Domination Elfique — les Hauts-Elfes imposent leur suprématie sur une grande partie du monde.\n④ La Rébellion des Sang-Mêlé — une magie hybride interdite fracture cet empire sans le faire tomber.\n⑤ L’Ère des Royaumes (aujourd’hui) — de multiples royaumes coexistent, les guildes prospèrent, la paix reste fragile — et, en secret, les cicatrices de la Guerre des Voiles recommencent lentement à se rouvrir.',
              )}
            </Text>

            <Text style={styles.titreSectionGuide}>{t('Repères — La magie')}</Text>
            <Text style={styles.texteGuide}>
              {t(
                'Omniprésente mais inégalement accessible : dons raciaux, apprentissage long, artefacts ou pactes. Les formes simples (soins mineurs, lumière, protection) restent courantes ; les formes avancées demandent des ressources rares et ont toujours un coût visible. Aucune magie ne ressuscite les morts.',
              )}
            </Text>

            <Text style={styles.titreSectionGuide}>{t('Repères — Les peuples d’Elyndor')}</Text>
            {RACES_ELYNDOR.map((race) => (
              <Text key={race.id} style={styles.texteGuide}>
                <Text style={styles.nomRaceSynopsis}>{t(race.nom)} </Text>
                <Text style={styles.regionRaceSynopsis}>({t(race.sousTitre)})</Text>
                {' — '}
                {t(race.description)}
              </Text>
            ))}
          </ScrollView>
          <Pressable style={styles.boutonFermerModal} onPress={onFermer}>
            <Text style={styles.texteBoutonFermerModal}>{t('Fermer')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
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
  feuilleGuide: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '80%',
    backgroundColor: couleurs.fondCarte,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    padding: espacement.md,
  },
  scrollGuide: {
    marginTop: espacement.xs,
  },
  titreSectionGuide: {
    color: couleurs.dore,
    fontFamily: polices.corpsMedium,
    fontSize: 15,
    marginTop: espacement.md,
    marginBottom: espacement.xs,
  },
  texteGuide: {
    color: couleurs.texte,
    fontFamily: polices.corps,
    fontSize: 14,
    lineHeight: 21,
  },
  texteSynopsis: {
    color: couleurs.texte,
    fontFamily: polices.corps,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: espacement.sm,
  },
  nomRaceSynopsis: {
    fontFamily: polices.corpsMedium,
    color: couleurs.accentClair,
  },
  regionRaceSynopsis: {
    color: couleurs.texteAtténué,
    fontSize: 12,
  },
  boutonFermerModal: {
    alignSelf: 'center',
    marginTop: espacement.md,
    borderWidth: 1,
    borderColor: couleurs.accent,
    paddingHorizontal: espacement.lg,
    paddingVertical: espacement.sm,
  },
  texteBoutonFermerModal: {
    color: couleurs.accentClair,
    fontFamily: polices.corpsMedium,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
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
