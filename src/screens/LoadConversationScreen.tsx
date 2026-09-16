import React, { useCallback, useRef, useState } from 'react';
import { Animated, FlatList, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { StoryMeta } from '../types';
import { deleteStory, getStoriesIndex, renommerStory } from '../storage/storage';
import { couleurs, espacement, polices, stylePetitesCapitales } from '../theme/theme';
import { obtenirPortrait } from '../data/portraits';
import Bouton from '../components/Bouton';
import Champ from '../components/Champ';
import FondAtmospherique from '../components/FondAtmospherique';
import Panneau from '../components/Panneau';
import { useLangue } from '../i18n/LangueProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'ChargerConversation'>;

const IMAGE_CHARGER = require('../../assets/scenes/creation-histoire.png');

function nomAffiche(meta: StoryMeta): string {
  return meta.titre?.trim() || meta.personnageNom;
}

function formaterDerniereSession(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return new Date(timestamp).toISOString().slice(0, 10);
  }
}

export default function LoadConversationScreen({ navigation }: Props) {
  const { t } = useLangue();
  const { width } = useWindowDimensions();
  const estTablette = width >= 760;
  const [histoires, setHistoires] = useState<StoryMeta[]>([]);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);
  const [renommageId, setRenommageId] = useState<string | null>(null);
  const [renommageValeur, setRenommageValeur] = useState('');
  const [suppressionId, setSuppressionId] = useState<string | null>(null);
  const swipeablesRef = useRef<Map<string, Swipeable>>(new Map());

  const recharger = useCallback(() => {
    setChargement(true);
    setErreur('');
    getStoriesIndex().then((liste) => setHistoires([...liste].sort((a, b) => b.updatedAt - a.updatedAt)))
      .catch((e) => setErreur(e instanceof Error ? e.message : 'Impossible de lire les histoires.'))
      .finally(() => setChargement(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      let actif = true;
      setChargement(true);
      setErreur('');
      getStoriesIndex().then((liste) => {
        if (actif) setHistoires([...liste].sort((a, b) => b.updatedAt - a.updatedAt));
      }).catch((e) => { if (actif) setErreur(e instanceof Error ? e.message : 'Impossible de lire les histoires.'); })
        .finally(() => { if (actif) setChargement(false); });
      return () => {
        actif = false;
      };
    }, []),
  );

  function ouvrirRenommage(meta: StoryMeta) {
    setSuppressionId(null);
    setRenommageId(meta.id);
    setRenommageValeur(nomAffiche(meta));
  }

  async function confirmerRenommage() {
    if (!renommageId) return;
    try {
      await renommerStory(renommageId, renommageValeur);
      setRenommageId(null);
      recharger();
    } catch (e) { setErreur(e instanceof Error ? e.message : 'Renommage impossible.'); }
  }

  async function confirmerSuppression(id: string) {
    try {
      await deleteStory(id);
      setSuppressionId(null);
      swipeablesRef.current.delete(id);
      recharger();
    } catch (e) { setErreur(e instanceof Error ? e.message : 'Suppression impossible.'); }
  }

  function demanderSuppressionParSwipe(item: StoryMeta) {
    swipeablesRef.current.get(item.id)?.close();
    setRenommageId(null);
    setSuppressionId(item.id);
  }

  return (
    <FondAtmospherique style={{ flex: 1 }} densiteEtoiles="discrete" imageFond={IMAGE_CHARGER}>
      <View style={styles.container}>
        <View style={styles.entetePage}>
          <Text style={styles.surtitre}>{t('ARCHIVES D’ELYNDOR')}</Text>
          <Text style={styles.titre}>{t('Vos histoires')}</Text>
          <Text style={styles.sousTitre}>
            {histoires.length > 0
              ? `${histoires.length} ${t(histoires.length > 1 ? 'histoires sauvegardées' : 'histoire sauvegardée')}`
              : t('Retrouvez ici les récits que vous avez commencés.')}
          </Text>
        </View>

        {erreur ? (
          <View style={styles.blocErreur}>
            <Text style={[styles.aide, { color: couleurs.danger }]}>{t(erreur)}</Text>
            <Bouton titre={t('Réessayer')} onPress={recharger} style={{ marginTop: espacement.sm }} />
          </View>
        ) : null}

        <FlatList
          key={estTablette ? 'tablet-grid' : 'mobile-list'}
          data={histoires}
          keyExtractor={(item) => item.id}
          numColumns={estTablette ? 2 : 1}
          columnWrapperStyle={estTablette ? styles.rangeeColonnes : undefined}
          contentContainerStyle={styles.liste}
          ListEmptyComponent={erreur ? null : (
            <Panneau style={styles.etatVide}>
              <Text style={styles.etatVideTitre}>{t(chargement ? 'Chargement…' : 'Aucune histoire pour le moment')}</Text>
              <Text style={styles.aide}>{t(chargement ? 'Nous ouvrons les archives.' : 'Commencez une nouvelle histoire depuis l’accueil ; elle apparaîtra ici automatiquement.')}</Text>
            </Panneau>
          )}
          renderItem={({ item }) => {
            const portrait = obtenirPortrait(item.raceOrigineId, item.sexe);
            const lieu = item.contexte?.lieu?.trim();
            const dateChronique = item.contexte?.dateChronique?.trim();
            return (
              <View style={[styles.cellule, estTablette && styles.celluleTablette]}>
                <Swipeable
                  ref={(ref) => {
                    if (ref) swipeablesRef.current.set(item.id, ref);
                    else swipeablesRef.current.delete(item.id);
                  }}
                  renderRightActions={(_progress, dragX) => {
                    const opacite = dragX.interpolate({ inputRange: [-80, -20, 0], outputRange: [1, 0.3, 0], extrapolate: 'clamp' });
                    return (
                      <Pressable onPress={() => demanderSuppressionParSwipe(item)} style={styles.actionSwipeSupprimer}>
                        <Animated.Text style={[styles.texteActionSwipe, { opacity: opacite }]}>{t('Supprimer')}</Animated.Text>
                      </Pressable>
                    );
                  }}
                  overshootRight={false}
                >
                  <Panneau style={styles.carteHistoire}>
                    {renommageId === item.id ? (
                      <View style={styles.zoneEdition}>
                        <Text style={styles.labelEdition}>{t('RENOMMER L’HISTOIRE')}</Text>
                        <Champ value={renommageValeur} onChangeText={setRenommageValeur} placeholder={item.personnageNom} />
                        <View style={styles.rangeeActions}>
                          <Bouton titre={t('Enregistrer')} onPress={confirmerRenommage} style={styles.boutonAction} />
                          <Bouton titre={t('Annuler')} variante="secondaire" onPress={() => setRenommageId(null)} style={styles.boutonAction} />
                        </View>
                      </View>
                    ) : suppressionId === item.id ? (
                      <View style={styles.zoneEdition}>
                        <Text style={styles.labelEdition}>{t('SUPPRESSION DÉFINITIVE')}</Text>
                        <Text style={styles.texteConfirmation}>{t('Supprimer définitivement cette histoire ?')}</Text>
                        <Text style={styles.aide}>{t('Cette action effacera la sauvegarde et ne pourra pas être annulée.')}</Text>
                        <View style={styles.rangeeActions}>
                          <Bouton
                            titre={t('Supprimer')}
                            variante="secondaire"
                            onPress={() => confirmerSuppression(item.id)}
                            style={styles.boutonAction}
                            texteStyle={{ color: couleurs.danger }}
                          />
                          <Bouton titre={t('Conserver')} onPress={() => setSuppressionId(null)} style={styles.boutonAction} />
                        </View>
                      </View>
                    ) : (
                      <>
                        <Pressable
                          onPress={() => navigation.navigate('Conversation', { storyId: item.id })}
                          style={({ pressed }) => [styles.corpsCarte, pressed && styles.cartePressee]}
                        >
                          <View style={styles.zoneVisuelle}>
                            <Image source={portrait ?? IMAGE_CHARGER} style={styles.portrait} resizeMode="cover" />
                            <View style={styles.voilePortrait} />
                            {item.brancheDeId ? <Text style={styles.badgeBranche}>{t('BRANCHE')}</Text> : null}
                          </View>

                          <View style={styles.contenuCarte}>
                            <Text style={styles.nomHistoire} numberOfLines={1}>{nomAffiche(item)}</Text>
                            <Text style={styles.nomPersonnage} numberOfLines={1}>{item.personnageNom}</Text>

                            {(lieu || dateChronique) ? (
                              <Text style={styles.ligneContexte} numberOfLines={1}>
                                {[lieu ? t(lieu) : '', dateChronique ? t(dateChronique) : ''].filter(Boolean).join(' · ')}
                              </Text>
                            ) : null}

                            <Text style={styles.descriptionPersonnage} numberOfLines={3}>{t(item.pointDeDepart)}</Text>

                            <View style={styles.piedCarte}>
                              <View>
                                <Text style={styles.labelSession}>{t('DERNIÈRE SESSION')}</Text>
                                <Text style={styles.dateSession}>{formaterDerniereSession(item.updatedAt)}</Text>
                              </View>
                              <Text style={styles.ouvrirSymbole}>›</Text>
                            </View>
                          </View>
                        </Pressable>

                        <View style={styles.barreActions}>
                          <Bouton
                            titre={t('Reprendre')}
                            onPress={() => navigation.navigate('Conversation', { storyId: item.id })}
                            style={styles.boutonReprendre}
                          />
                          <Pressable onPress={() => ouvrirRenommage(item)} style={styles.actionTexte}>
                            <Text style={styles.texteAction}>{t('Renommer')}</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => {
                              setRenommageId(null);
                              setSuppressionId(item.id);
                            }}
                            style={styles.actionTexte}
                          >
                            <Text style={[styles.texteAction, { color: couleurs.danger }]}>{t('Supprimer')}</Text>
                          </Pressable>
                        </View>
                      </>
                    )}
                  </Panneau>
                </Swipeable>
              </View>
            );
          }}
        />
      </View>
    </FondAtmospherique>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: espacement.lg,
    paddingTop: espacement.lg,
  },
  entetePage: {
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
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
    fontSize: 15,
    marginTop: 4,
  },
  blocErreur: {
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
    marginBottom: espacement.md,
  },
  liste: {
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
    paddingBottom: espacement.xl,
    gap: espacement.md,
  },
  rangeeColonnes: {
    gap: espacement.md,
  },
  cellule: {
    width: '100%',
    marginBottom: espacement.md,
  },
  celluleTablette: {
    flex: 1,
    width: undefined,
  },
  carteHistoire: {
    padding: 0,
    overflow: 'hidden',
    backgroundColor: couleurs.fondCarteDense,
    borderColor: couleurs.bordureSubtile,
  },
  corpsCarte: {
    flexDirection: 'row',
    minHeight: 190,
  },
  cartePressee: {
    opacity: 0.84,
  },
  zoneVisuelle: {
    width: 126,
    minHeight: 190,
    position: 'relative',
    backgroundColor: couleurs.fondProfond,
  },
  portrait: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  voilePortrait: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4, 10, 18, 0.14)',
    borderRightWidth: 1,
    borderRightColor: couleurs.bordureDoree,
  },
  badgeBranche: {
    ...stylePetitesCapitales,
    position: 'absolute',
    left: espacement.xs,
    bottom: espacement.xs,
    color: couleurs.doreClair,
    backgroundColor: 'rgba(4, 10, 18, 0.82)',
    borderWidth: 1,
    borderColor: couleurs.bordureDoree,
    paddingHorizontal: 6,
    paddingVertical: 3,
    fontSize: 9,
  },
  contenuCarte: {
    flex: 1,
    padding: espacement.md,
  },
  nomHistoire: {
    color: couleurs.doreClair,
    fontFamily: polices.titre,
    fontSize: 20,
    lineHeight: 23,
  },
  nomPersonnage: {
    ...stylePetitesCapitales,
    color: couleurs.texteAtténué,
    fontSize: 10,
    marginTop: 2,
  },
  ligneContexte: {
    color: couleurs.accentClair,
    fontFamily: polices.corpsMedium,
    fontSize: 12,
    marginTop: espacement.sm,
  },
  descriptionPersonnage: {
    color: couleurs.texte,
    fontFamily: polices.corps,
    fontSize: 14,
    lineHeight: 19,
    marginTop: espacement.xs,
    opacity: 0.92,
  },
  piedCarte: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: espacement.sm,
  },
  labelSession: {
    ...stylePetitesCapitales,
    color: couleurs.texteFaible,
    fontSize: 9,
  },
  dateSession: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 12,
    marginTop: 1,
  },
  ouvrirSymbole: {
    color: couleurs.dore,
    fontFamily: polices.display,
    fontSize: 30,
    lineHeight: 30,
  },
  barreActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacement.sm,
    padding: espacement.sm,
    borderTopWidth: 1,
    borderTopColor: couleurs.bordureSubtile,
    backgroundColor: 'rgba(4, 10, 18, 0.54)',
  },
  boutonReprendre: {
    flex: 1,
    minHeight: 42,
    paddingVertical: espacement.xs,
  },
  actionTexte: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: espacement.xs,
  },
  texteAction: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corpsMedium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  zoneEdition: {
    padding: espacement.md,
  },
  labelEdition: {
    ...stylePetitesCapitales,
    color: couleurs.dore,
    fontSize: 10,
    marginBottom: espacement.sm,
  },
  aide: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 14,
    lineHeight: 19,
  },
  texteConfirmation: {
    color: couleurs.texte,
    fontFamily: polices.titre,
    fontSize: 18,
    marginBottom: espacement.xs,
  },
  rangeeActions: {
    flexDirection: 'row',
    gap: espacement.sm,
    marginTop: espacement.md,
  },
  boutonAction: {
    flex: 1,
  },
  actionSwipeSupprimer: {
    backgroundColor: 'rgba(100, 20, 30, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    width: 96,
    marginLeft: espacement.sm,
    borderWidth: 1,
    borderColor: couleurs.danger,
  },
  texteActionSwipe: {
    color: '#FFFFFF',
    fontFamily: polices.corpsMedium,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  etatVide: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 620,
    padding: espacement.xl,
  },
  etatVideTitre: {
    color: couleurs.doreClair,
    fontFamily: polices.titre,
    fontSize: 21,
    marginBottom: espacement.xs,
  },
});
