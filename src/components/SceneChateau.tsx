import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, RadialGradient, Stop } from 'react-native-svg';
import { couleurs } from '../theme/theme';

// Illustration de scène dessinée à la main en SVG (silhouettes/aplats) —
// substitut à une vraie illustration peinte tant que la génération d'images
// n'est pas en place (voir la conversation : aucun fichier image transmis
// n'est récupérable côté agent, donc pas d'asset externe possible ici).
// Composée pour évoquer la même idée que la référence visuelle du porteur
// de projet (château à tours multiples, lune, reflet sur l'eau) sans
// prétendre l'égaler.

interface Tour {
  x: number;
  largeur: number;
  hauteurCorps: number;
  hauteurToit: number;
}

// Silhouette d'une ligne de tours : positions à la main plutôt que générées
// aléatoirement, pour garder une composition lisible (tours plus hautes
// groupées vers le centre-droit, comme un point focal).
const TOURS: Tour[] = [
  { x: 40, largeur: 26, hauteurCorps: 60, hauteurToit: 22 },
  { x: 80, largeur: 18, hauteurCorps: 40, hauteurToit: 16 },
  { x: 110, largeur: 34, hauteurCorps: 95, hauteurToit: 34 },
  { x: 155, largeur: 20, hauteurCorps: 55, hauteurToit: 20 },
  { x: 185, largeur: 42, hauteurCorps: 130, hauteurToit: 46 },
  { x: 238, largeur: 22, hauteurCorps: 70, hauteurToit: 24 },
  { x: 268, largeur: 16, hauteurCorps: 38, hauteurToit: 14 },
];

const LARGEUR_VUE = 320;
const HAUTEUR_VUE = 480;
const BASE_Y = 340;

const HAUTEUR_MUR = 16;
const MUR_Y = BASE_Y - HAUTEUR_MUR;

function ligneToits(): string {
  // Contour fermé : un muret bas (courtine) reliant chaque tour, avec les
  // tours qui s'élèvent depuis ce muret (corps rectangulaire + toit en
  // pointe) plutôt que des pics reliés directement à la base — sinon la
  // silhouette se lit comme une chaîne de montagnes, pas un château.
  let d = `M0,${BASE_Y} L0,${MUR_Y}`;
  for (const t of TOURS) {
    const epauleY = BASE_Y - t.hauteurCorps;
    const sommetY = epauleY - t.hauteurToit;
    d += ` L${t.x},${MUR_Y}`;
    d += ` L${t.x},${epauleY}`;
    d += ` L${t.x + t.largeur / 2},${sommetY}`;
    d += ` L${t.x + t.largeur},${epauleY}`;
    d += ` L${t.x + t.largeur},${MUR_Y}`;
  }
  d += ` L${LARGEUR_VUE},${MUR_Y} L${LARGEUR_VUE},${BASE_Y} Z`;
  return d;
}

function fenetres() {
  // Petits points lumineux dispersés sur la silhouette — suggère des
  // fenêtres éclairées sans dessiner chaque ouverture individuellement.
  const points: { x: number; y: number }[] = [
    { x: 52, y: 300 }, { x: 118, y: 270 }, { x: 130, y: 290 },
    { x: 195, y: 230 }, { x: 205, y: 260 }, { x: 210, y: 290 },
    { x: 245, y: 285 }, { x: 90, y: 310 }, { x: 160, y: 305 },
  ];
  return points.map((p, i) => (
    <Circle key={i} cx={p.x} cy={p.y} r={1.6} fill={couleurs.dore} opacity={0.75} />
  ));
}

export default function SceneChateau() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox={`0 0 ${LARGEUR_VUE} ${HAUTEUR_VUE}`} preserveAspectRatio="xMidYMax slice">
        <Defs>
          <LinearGradient id="ciel" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#050712" stopOpacity={1} />
            <Stop offset="0.55" stopColor="#0A0D1F" stopOpacity={1} />
            <Stop offset="1" stopColor={couleurs.fond} stopOpacity={1} />
          </LinearGradient>
          <RadialGradient id="halo" cx="0.88" cy="0.07" r="0.16">
            <Stop offset="0" stopColor="#C9D6F5" stopOpacity={0.3} />
            <Stop offset="1" stopColor="#C9D6F5" stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="eau" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#141A33" stopOpacity={0.9} />
            <Stop offset="1" stopColor={couleurs.fond} stopOpacity={1} />
          </LinearGradient>
        </Defs>

        <Rect x={0} y={0} width={LARGEUR_VUE} height={HAUTEUR_VUE} fill="url(#ciel)" />
        <Rect x={0} y={0} width={LARGEUR_VUE} height={HAUTEUR_VUE} fill="url(#halo)" />

        {/* Lune — reléguée au coin supérieur droit pour ne pas gêner le menu */}
        <Circle cx={282} cy={34} r={13} fill="#E8ECF8" opacity={0.9} />
        <Circle cx={282} cy={34} r={19} fill="#C9D6F5" opacity={0.12} />

        {/* Silhouette de château */}
        <Path d={ligneToits()} fill="#0D1226" opacity={0.96} />
        {fenetres()}

        {/* Reflet sur l'eau, en pied de scène */}
        <Rect x={0} y={BASE_Y} width={LARGEUR_VUE} height={HAUTEUR_VUE - BASE_Y} fill="url(#eau)" />
      </Svg>
    </View>
  );
}
