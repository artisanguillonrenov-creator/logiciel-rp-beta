import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { listerMondes, monde, paquetMonde } from '../mondes';
import { memoriserMondeActif } from '../mondes/memorisation';
import { couleurs, espacement, interfaceV2, polices, rayon, styleCarteImageSelectionnee, stylePetitesCapitales } from '../theme/theme';
import Bouton from '../components/Bouton';
import FondAtmospherique from '../components/FondAtmospherique';
import { useLangue } from '../i18n/LangueProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'ChoixMonde'>;

/**
 * Choix du monde, avant l'accueil : affiché au premier lancement, quand aucun
 * monde n'est mémorisé, ou depuis le lien « Changer de monde » de l'accueil.
 * Le monde choisi est mémorisé dans les réglages de l'appareil.
 */
export default function ChoixMondeScreen({ navigation }: Props) {
  const { t } = useLangue();
  const { width } = useWindowDimensions();
  const tablette = width >= 760;
  const mondes = listerMondes();
  const [selection, setSelection] = useState(monde.actifId());
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreur, setErreur] = useState('');
  const choisi = paquetMonde(selection);

  async function entrer() {
    if (enregistrement) return;
    setEnregistrement(true);
    setErreur('');
    try {
      await memoriserMondeActif(choisi.id);
      navigation.reset({ index: 0, routes: [{ name: 'Demarrage' }] });
    } catch {
      setErreur(t("Impossible d'enregistrer le monde choisi. Réessaie."));
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <FondAtmospherique style={styles.ecran} densiteEtoiles="discrete" imageFond={choisi.carte.image}>
      <View style={styles.voile} pointerEvents="none" />
      <View style={styles.page}>
        <View style={styles.barreSuperieure}>
          {navigation.canGoBack() ? (
            <Pressable onPress={() => navigation.goBack()} style={styles.retourCompact}>
              <Text style={styles.texteRetour}>‹ {t('Accueil')}</Text>
            </Pressable>
          ) : <View style={styles.retourCompact} />}
          <Text style={styles.marqueMini}>{choisi.marque.titre}</Text>
          <View style={styles.espaceBarre} />
        </View>

        <ScrollView contentContainerStyle={[styles.contenu, tablette && styles.contenuTablette]} showsVerticalScrollIndicator={false}>
          <View style={styles.enteteEtape}>
            <View style={styles.ligneTitre}>
              <Text style={styles.runeTitre}>✦</Text>
              <Text style={styles.titre}>{t('Choisis ton monde')}</Text>
            </View>
            <Text style={styles.sousTitre}>{t('Une porte d’entrée visuelle, pas un formulaire.')}</Text>
          </View>

          <View style={[styles.deuxColonnes, !tablette && styles.colonneUnique]}>
            <View style={[styles.colonneIllustration, tablette && styles.colonneIllustrationHaut]}>
              <Image source={choisi.carte.image} style={styles.imageHero} resizeMode="cover" />
              <View style={styles.cartoucheHero}>
                <Text style={styles.nomHero}>{choisi.carte.nom}</Text>
                <Text style={styles.metaHero}>{t(choisi.carte.genre)}</Text>
              </View>
            </View>
            <View style={styles.colonneChoix}>
              {mondes.map((paquet) => (
                <Pressable
                  key={paquet.id}
                  onPress={() => setSelection(paquet.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: paquet.id === selection }}
                  style={[styles.carte, paquet.id === selection && styles.carteActive]}
                >
                  <Image source={paquet.carte.image} style={styles.miniature} resizeMode="cover" />
                  <View style={styles.texteCarte}>
                    <Text style={styles.titreCarte}>{paquet.carte.nom}</Text>
                    <Text style={styles.descriptionCarte}>{t(paquet.carte.description)}</Text>
                    <View style={styles.tags}>
                      {paquet.carte.tags.slice(0, 4).map((tag) => <Text key={tag} style={styles.tag}>{t(tag)}</Text>)}
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
          <Bouton
            titre={enregistrement ? t('Ouverture…') : t(`Entrer dans ${choisi.carte.nom}`)}
            onPress={entrer}
            desactive={enregistrement}
            style={styles.bouton}
          />
        </ScrollView>
      </View>
    </FondAtmospherique>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1 },
  voile: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(3, 10, 18, 0.70)' },
  page: { flex: 1 },
  barreSuperieure: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: couleurs.bordureSubtile,
    paddingHorizontal: espacement.md,
    backgroundColor: 'rgba(4, 10, 18, 0.82)',
  },
  retourCompact: { minWidth: 90, minHeight: interfaceV2.cibleTactileMin, justifyContent: 'center' },
  texteRetour: { color: couleurs.doreClair, fontFamily: polices.corpsMedium, fontSize: 15 },
  marqueMini: { flex: 1, textAlign: 'center', color: couleurs.dore, fontFamily: polices.displaySemiGras, letterSpacing: 3, fontSize: 16 },
  espaceBarre: { minWidth: 90 },
  contenu: { width: '100%', maxWidth: 1180, alignSelf: 'center', padding: espacement.md, paddingBottom: espacement.xxl },
  contenuTablette: { paddingHorizontal: espacement.xl },
  enteteEtape: { marginBottom: espacement.lg },
  ligneTitre: { flexDirection: 'row', alignItems: 'center', gap: espacement.sm },
  runeTitre: { color: couleurs.dore, fontSize: 18 },
  titre: { flex: 1, color: couleurs.doreClair, fontFamily: polices.displaySemiGras, fontSize: 25 },
  sousTitre: { color: couleurs.texteAtténué, fontFamily: polices.corps, fontSize: 15, marginTop: 4, marginLeft: 28 },
  deuxColonnes: { flexDirection: 'row', alignItems: 'stretch', gap: espacement.lg },
  colonneUnique: { flexDirection: 'column' },
  colonneIllustration: { flex: 0.85, borderWidth: 1, borderColor: couleurs.bordureDoree, backgroundColor: couleurs.fondCarteDense, overflow: 'hidden', borderRadius: rayon.sm },
  colonneIllustrationHaut: { alignSelf: 'flex-start' },
  colonneChoix: { flex: 1.28, minWidth: 0, gap: espacement.md },
  imageHero: { width: '100%', aspectRatio: 4 / 5, maxHeight: 560 },
  cartoucheHero: { padding: espacement.md, backgroundColor: couleurs.fondCarteDense },
  nomHero: { color: couleurs.doreClair, fontFamily: polices.titre, fontSize: 24 },
  metaHero: { color: couleurs.texteAtténué, fontFamily: polices.corps, fontSize: 13, marginTop: 2 },
  carte: { borderWidth: 1, borderColor: couleurs.bordureSubtile, backgroundColor: couleurs.fondCarte, overflow: 'hidden', borderRadius: rayon.sm },
  carteActive: styleCarteImageSelectionnee,
  miniature: { width: '100%', height: 170 },
  texteCarte: { padding: espacement.md },
  titreCarte: { color: couleurs.doreClair, fontFamily: polices.titre, fontSize: 22 },
  descriptionCarte: { color: couleurs.texte, fontFamily: polices.corps, fontSize: 15, lineHeight: 21, marginTop: 4 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: espacement.sm },
  tag: { ...stylePetitesCapitales, color: couleurs.texteAtténué, fontSize: 9, borderWidth: 1, borderColor: couleurs.bordureSubtile, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  erreur: { color: couleurs.danger, fontFamily: polices.corps, fontSize: 14, marginTop: espacement.md, textAlign: 'center' },
  bouton: { marginTop: espacement.lg, alignSelf: 'center', minWidth: 260 },
});
