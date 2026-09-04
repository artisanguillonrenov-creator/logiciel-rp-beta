import React from 'react';
import { Image, StyleProp, StyleSheet, Text, TextStyle } from 'react-native';
import { analyserMessage } from '../engine/messageFormatter';
import { couleurs } from '../theme/theme';
import type { EntreeLoreEmergent } from '../types';

export interface AvatarPnjPourTexte {
  pnj: EntreeLoreEmergent;
  avatarUri: string;
}

// Table nom (complet ou prénom seul) → avatar, plus le motif regex qui va
// avec — construite une fois par rendu de bulle, pas par segment.
interface IndexAvatarsPnj {
  regex: RegExp;
  parNom: Map<string, string>;
}

function construireIndexAvatarsPnj(avatars: AvatarPnjPourTexte[]): IndexAvatarsPnj | null {
  const parNom = new Map<string, string>();
  for (const { pnj, avatarUri } of avatars) {
    const titre = pnj.titre.trim();
    if (!titre) continue;
    parNom.set(titre.toLowerCase(), avatarUri);
    const premierMot = titre.split(/\s+/)[0];
    if (premierMot.length > 2) parNom.set(premierMot.toLowerCase(), avatarUri);
  }
  if (parNom.size === 0) return null;
  // Les plus longs d'abord : "Lirael Sombre-Lune" doit matcher avant le
  // simple "Lirael" quand le nom complet est présent dans le texte.
  const cles = [...parNom.keys()].sort((a, b) => b.length - a.length);
  const echappees = cles.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`\\b(${echappees.join('|')})\\b`, 'gi');
  return { regex, parNom };
}

// Découpe un segment de narration/action en insérant un petit avatar juste
// avant chaque mention reconnue d'un PNJ — jamais dans le dialogue lui-même
// (son propre nom n'y apparaît quasiment jamais), voir l'appelant.
function segmentAvecAvatars(contenu: string, index: IndexAvatarsPnj, clePrefixe: string): React.ReactNode[] {
  const morceaux = contenu.split(index.regex);
  return morceaux.map((morceau, i) => {
    if (!morceau) return null;
    // String.split avec un groupe capturant place les correspondances aux
    // index impairs, entrelacées avec le texte non-match aux index pairs.
    if (i % 2 === 1) {
      const avatarUri = index.parNom.get(morceau.toLowerCase());
      if (avatarUri) {
        return (
          <Text key={`${clePrefixe}-${i}`}>
            <Image source={{ uri: avatarUri }} style={styles.avatarInline} />
            {' ' + morceau}
          </Text>
        );
      }
    }
    return <Text key={`${clePrefixe}-${i}`}>{morceau}</Text>;
  });
}

// Rend un message avec l'action/narration (*entre astérisques*) en italique
// et le dialogue ("entre guillemets") distingué — même analyseur que
// l'export PDF/EPUB, pour que le rendu à l'écran et le document restent
// cohérents. avatarsPnj (optionnel) : insère un petit portrait juste avant
// chaque mention d'un PNJ dont l'avatar a déjà été généré (jamais déclenché
// depuis ici — seulement affiché s'il existe déjà, voir ConversationScreen).
export default function TexteMessageFormate({
  texte,
  style,
  avatarsPnj,
}: {
  texte: string;
  style?: StyleProp<TextStyle>;
  avatarsPnj?: AvatarPnjPourTexte[];
}) {
  const segments = analyserMessage(texte);
  const index = avatarsPnj && avatarsPnj.length > 0 ? construireIndexAvatarsPnj(avatarsPnj) : null;
  return (
    <Text style={style}>
      {segments.map((seg, i) => {
        const segStyle = seg.type === 'action' ? styles.action : seg.type === 'dialogue' ? styles.dialogue : undefined;
        if (index && seg.type !== 'dialogue') {
          return (
            <Text key={i} style={segStyle}>
              {segmentAvecAvatars(seg.contenu, index, String(i))}
            </Text>
          );
        }
        return (
          <Text key={i} style={segStyle}>
            {seg.contenu}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  action: {
    fontStyle: 'italic',
    color: couleurs.texteAtténué,
  },
  dialogue: {
    color: couleurs.dore,
  },
  avatarInline: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
});
