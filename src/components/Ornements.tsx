import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

// Ornements du thème « grimoire nocturne » (repris de la V13.2) : mêmes
// tracés que les SVG de la version web, dessinés ici avec react-native-svg
// pour fonctionner aussi sur Android/iOS sans CSS.

const OR = '#D9B363';
const OR_CLAIR = '#F4DC9C';
const NUIT = '#07112A';
const ENCRE = '#3A260B';

type Angle = 'hautGauche' | 'hautDroit' | 'basDroit' | 'basGauche';
const ROTATION: Record<Angle, string> = {
  hautGauche: '0deg',
  hautDroit: '90deg',
  basDroit: '180deg',
  basGauche: '270deg',
};

export function CoinFiligrane({ angle, taille = 24, style }: { angle: Angle; taille?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width: taille, height: taille, transform: [{ rotate: ROTATION[angle] }] }, style]} pointerEvents="none">
      <Svg width={taille} height={taille} viewBox="0 0 26 26" fill="none">
        <Path d="M1 25V11.5A10.5 10.5 0 0 1 11.5 1H25" stroke={OR} strokeWidth={1.25} />
        <Path d="M4.6 19.5v-7A8 8 0 0 1 12.6 4.5h7" stroke={OR} strokeOpacity={0.45} strokeWidth={0.9} />
        <Path d="M8.2 14.6c0-3.6 2.8-6.4 6.4-6.4" stroke={OR_CLAIR} strokeOpacity={0.75} strokeWidth={0.9} strokeLinecap="round" />
        <Circle cx={14.9} cy={8.2} r={1.05} fill={OR_CLAIR} />
        <Circle cx={8.2} cy={14.9} r={1.05} fill={OR_CLAIR} />
        <Path d="M1 1.2l2.2 2.2L1 5.6-1.2 3.4z" fill={OR} />
      </Svg>
    </View>
  );
}

/** Les quatre coins filigranés d'un cadre, posés par-dessus son contenu. */
export function CoinsFiligranes({ taille = 24, retrait = 0 }: { taille?: number; retrait?: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <CoinFiligrane angle="hautGauche" taille={taille} style={{ position: 'absolute', top: retrait, left: retrait }} />
      <CoinFiligrane angle="hautDroit" taille={taille} style={{ position: 'absolute', top: retrait, right: retrait }} />
      <CoinFiligrane angle="basDroit" taille={taille} style={{ position: 'absolute', bottom: retrait, right: retrait }} />
      <CoinFiligrane angle="basGauche" taille={taille} style={{ position: 'absolute', bottom: retrait, left: retrait }} />
    </View>
  );
}

/** Embout en losange des boutons : or sur fond nuit, ou encre sur fond or. */
export function Embout({ cote, encre = false, style }: { cote: 'gauche' | 'droite'; encre?: boolean; style?: StyleProp<ViewStyle> }) {
  const plein = encre ? ENCRE : OR;
  const coeur = encre ? OR_CLAIR : NUIT;
  return (
    <View style={[{ width: 9, height: 14 }, cote === 'droite' && { transform: [{ scaleX: -1 }] }, style]} pointerEvents="none">
      <Svg width={9} height={14} viewBox="0 0 12 18">
        <Path d="M6.5 1.5L11 9l-4.5 7.5L2 9z" fill={plein} />
        <Path d="M6.5 5.4L8.7 9l-2.2 3.6L4.3 9z" fill={coeur} />
        <Path d="M11 9h1" stroke={plein} />
      </Svg>
    </View>
  );
}

export function EtoileOrnement({ taille = 16, style }: { taille?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width: taille, height: taille }, style]} pointerEvents="none">
      <Svg width={taille} height={taille} viewBox="0 0 20 20">
        <Path d="M10 0l1.25 8.75L20 10l-8.75 1.25L10 20l-1.25-8.75L0 10l8.75-1.25z" fill={OR_CLAIR} />
        <G rotation={45} origin="10, 10">
          <Path d="M10 4.6l.62 4.78L15.4 10l-4.78.62L10 15.4l-.62-4.78L4.6 10l4.78-.62z" fill={OR} />
        </G>
      </Svg>
    </View>
  );
}

/** Rose des vents au-dessus du logo (accueil, activation). */
export function BoussoleOrnement({ largeur = 132, style }: { largeur?: number; style?: StyleProp<ViewStyle> }) {
  const hauteur = (largeur * 46) / 140;
  return (
    <View style={[{ width: largeur, height: hauteur }, style]} pointerEvents="none">
      <Svg width={largeur} height={hauteur} viewBox="0 0 140 46">
        <Path d="M6 23H50M90 23H134" stroke={OR} strokeOpacity={0.75} strokeWidth={1} />
        <Path d="M26 23l6-3v6zM114 23l-6-3v6z" fill={OR} fillOpacity={0.8} />
        <Circle cx={6} cy={23} r={1.8} fill={OR} />
        <Circle cx={134} cy={23} r={1.8} fill={OR} />
        <Path d="M70 0l2.6 20.4L93 23l-20.4 2.6L70 46l-2.6-20.4L47 23l20.4-2.6z" fill={OR_CLAIR} />
        <G rotation={45} origin="70, 23">
          <Path d="M70 10l1.4 11.6L83 23l-11.6 1.4L70 36l-1.4-11.6L57 23l11.6-1.4z" fill={OR} />
        </G>
        <Circle cx={70} cy={23} r={3.2} fill="#0A1328" stroke={OR_CLAIR} strokeWidth={1} />
      </Svg>
    </View>
  );
}

export type NomIcone = 'livre' | 'livres' | 'lecture' | 'plume' | 'sceau' | 'courrier' | 'invite' | 'chevron';

function TraceIcone({ nom, couleur }: { nom: NomIcone; couleur: string }) {
  const trait = { stroke: couleur, strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  switch (nom) {
    case 'livre':
      return (
        <>
          <Path {...trait} d="M3 5.8c3-1.2 6-1 9 1.2 3-2.2 6-2.4 9-1.2v12.6c-3-1.2-6-1-9 1.2-3-2.2-6-2.4-9-1.2z" />
          <Path {...trait} d="M12 7v12.4" />
        </>
      );
    case 'livres':
      return (
        <>
          <Path {...trait} d="M4 4.5h3.6v15H4zM9.4 4.5H13v15H9.4z" />
          <Path {...trait} d="M15.2 5.6l3.4-.9 3.3 14.4-3.4.9z" />
        </>
      );
    case 'lecture':
      return (
        <>
          <Circle {...trait} cx={12} cy={12} r={9.2} />
          <Path {...trait} d="M10 8.3l6 3.7-6 3.7z" fill={couleur} />
        </>
      );
    case 'plume':
      return (
        <>
          <Path {...trait} d="M20.5 3.5C12.6 5 7.6 10 5.2 18.8" />
          <Path {...trait} d="M20.5 3.5c-.6 6.3-4.6 10.6-11.4 11.8" />
          <Path {...trait} d="M5.2 18.8L3.5 20.5" />
        </>
      );
    case 'sceau':
      return (
        <>
          <Circle {...trait} cx={12} cy={10} r={5.5} />
          <Path {...trait} d="M9.2 14.8L8 21l4-2 4 2-1.2-6.2" />
          <Path {...trait} d="M12 7.6l.8 1.6 1.8.3-1.3 1.2.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.2 1.8-.3z" />
        </>
      );
    case 'courrier':
      return (
        <>
          <Rect {...trait} x={3} y={5.5} width={18} height={13} rx={1.6} />
          <Path {...trait} d="M3.6 6.6l8.4 6.4 8.4-6.4" />
        </>
      );
    case 'invite':
      return (
        <>
          <Circle {...trait} cx={9} cy={8.6} r={3.2} />
          <Path {...trait} d="M3.4 19.4c0-3.2 2.5-5.6 5.6-5.6s5.6 2.4 5.6 5.6" />
          <Circle {...trait} cx={16.6} cy={9.6} r={2.6} />
          <Path {...trait} d="M15.2 13.9c3.1.1 5.4 2.2 5.4 5.4" />
        </>
      );
    case 'chevron':
      return <Path {...trait} d="M9 5.5l6.5 6.5L9 18.5" />;
  }
}

export function Icone({ nom, taille = 22, couleur = '#F2D38C', style }: { nom: NomIcone; taille?: number; couleur?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width: taille, height: taille }, style]} pointerEvents="none">
      <Svg width={taille} height={taille} viewBox="0 0 24 24">
        <TraceIcone nom={nom} couleur={couleur} />
      </Svg>
    </View>
  );
}
