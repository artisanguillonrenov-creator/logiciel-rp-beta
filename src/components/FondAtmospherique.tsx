import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Image, ImageSourcePropType, Platform, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { couleurs } from '../theme/theme';
import SceneChateau from './SceneChateau';

interface FondAtmospheriqueProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  // Certains écrans (formulaires denses) préfèrent un ciel plus discret pour
  // ne pas distraire de la lecture — voir CreateScreen.
  densiteEtoiles?: 'normale' | 'discrete';
  // Illustration peinte (fournie par le porteur de projet) à utiliser comme
  // fond plutôt que la scène dessinée en SVG — voir assets/scenes.
  imageFond?: ImageSourcePropType;
}

interface Etoile {
  x: number;
  y: number;
  taille: number;
  opaciteBase: number;
  duree: number;
  retard: number;
}

// Positions déterministes (pas de Math.random() à chaque rendu, sinon le
// ciel "saute" à chaque re-render de l'écran) — un petit générateur à seed
// fixe suffit, pas besoin d'une vraie lib de PRNG pour un effet décoratif.
function genererEtoiles(nombre: number, seed: number): Etoile[] {
  let graine = seed;
  function suivant() {
    graine = (graine * 9301 + 49297) % 233280;
    return graine / 233280;
  }
  return Array.from({ length: nombre }, () => ({
    x: suivant() * 100,
    y: suivant() * 100,
    taille: 1 + suivant() * 1.8,
    opaciteBase: 0.25 + suivant() * 0.5,
    duree: 2200 + suivant() * 2600,
    retard: suivant() * 3000,
  }));
}

function Etoile({ etoile }: { etoile: Etoile }) {
  const opacite = useRef(new Animated.Value(etoile.opaciteBase)).current;

  useEffect(() => {
    const boucle = Animated.loop(
      Animated.sequence([
        Animated.timing(opacite, {
          toValue: etoile.opaciteBase * 0.25,
          duration: etoile.duree,
          delay: etoile.retard,
          useNativeDriver: true,
        }),
        Animated.timing(opacite, {
          toValue: etoile.opaciteBase,
          duration: etoile.duree,
          useNativeDriver: true,
        }),
      ]),
    );
    boucle.start();
    return () => boucle.stop();
  }, [etoile, opacite]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: `${etoile.x}%`,
        top: `${etoile.y}%`,
        width: etoile.taille,
        height: etoile.taille,
        borderRadius: etoile.taille,
        backgroundColor: couleurs.accentClair,
        opacity: opacite,
      }}
    />
  );
}

// Fioriture d'angle : simple cadre ouvert (deux traits) dans chaque coin de
// l'écran — reprend le vocabulaire déjà établi (traits fins + losange, voir
// Separateur) plutôt que d'introduire de la vraie illustration vectorielle.
function FiorituresAngles() {
  return (
    <>
      <View style={[styles.coin, styles.coinHautGauche]} />
      <View style={[styles.coin, styles.coinHautDroit]} />
      <View style={[styles.coin, styles.coinBasGauche]} />
      <View style={[styles.coin, styles.coinBasDroit]} />
    </>
  );
}

/**
 * Habillage atmosphérique commun (ciel étoilé + vignettage + fioritures
 * d'angle) au-dessus du fond uni du thème — rapproche l'ambiance de la
 * direction artistique d'origine sans dépendre d'illustrations externes
 * (droits/génération d'images remis à plus tard, voir la conversation).
 */
// Sur web, un fond simplement en `position: absolute` reste calé sur son
// conteneur — si le contenu défilable (curseurs, discussion...) dépasse la
// hauteur de l'écran, ce conteneur peut s'étirer avec lui, et le fond
// "voyage" avec le contenu au lieu de rester en place (particulièrement
// visible au zoom navigateur, qui recalcule différemment du natif). En
// `position: fixed`, la couche décorative entière (image, étoiles,
// vignettage, angles) se cale une fois pour toutes sur la fenêtre du
// navigateur, quel que soit le défilement ou le zoom — natif n'a pas ce
// souci (l'écran est déjà borné par le navigateur de l'app) donc y garde
// `absoluteFill` inchangé.
const styleCoucheDecor: ViewStyle =
  Platform.OS === 'web'
    ? ({ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 } as unknown as ViewStyle)
    : StyleSheet.absoluteFill;

export default function FondAtmospherique({ children, style, densiteEtoiles = 'normale', imageFond }: FondAtmospheriqueProps) {
  const etoiles = useMemo(() => genererEtoiles(densiteEtoiles === 'discrete' ? 22 : 45, 7), [densiteEtoiles]);

  return (
    <View style={[styles.container, style]}>
      <View style={styleCoucheDecor} pointerEvents="none">
        {imageFond ? (
          <>
            <Image source={imageFond} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <View style={styles.scrimImage} />
          </>
        ) : (
          <SceneChateau />
        )}
        {etoiles.map((e, i) => (
          <Etoile key={i} etoile={e} />
        ))}
        <LinearGradient
          colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[styles.vignetteBord, styles.vignetteHaut]}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={[styles.vignetteBord, styles.vignetteBas]}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.vignetteBord, styles.vignetteGauche]}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 0 }}
          style={[styles.vignetteBord, styles.vignetteDroite]}
        />
        <FiorituresAngles />
      </View>
      {children}
    </View>
  );
}

const TAILLE_COIN = 34;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: couleurs.fond,
  },
  scrimImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 7, 18, 0.42)',
  },
  vignetteBord: {
    position: 'absolute',
  },
  vignetteHaut: { top: 0, left: 0, right: 0, height: 140 },
  vignetteBas: { bottom: 0, left: 0, right: 0, height: 140 },
  vignetteGauche: { top: 0, bottom: 0, left: 0, width: 90 },
  vignetteDroite: { top: 0, bottom: 0, right: 0, width: 90 },
  coin: {
    position: 'absolute',
    width: TAILLE_COIN,
    height: TAILLE_COIN,
    borderColor: 'rgba(228, 211, 160, 0.35)',
  },
  coinHautGauche: { top: 18, left: 18, borderTopWidth: 1, borderLeftWidth: 1 },
  coinHautDroit: { top: 18, right: 18, borderTopWidth: 1, borderRightWidth: 1 },
  coinBasGauche: { bottom: 18, left: 18, borderBottomWidth: 1, borderLeftWidth: 1 },
  coinBasDroit: { bottom: 18, right: 18, borderBottomWidth: 1, borderRightWidth: 1 },
});
