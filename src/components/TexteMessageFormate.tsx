import React from 'react';
import { Image, StyleProp, StyleSheet, Text, TextStyle } from 'react-native';
import { analyserMessage } from '../engine/messageFormatter';
import { couleurs, polices } from '../theme/theme';
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

// "KAELEN" / "SOMBRE-LUNE" → "Kaelen" / "Sombre-Lune" : le narrateur écrit
// le nom en MAJUSCULES (voir la consigne de format dans promptBuilder.ts,
// pour que la détection ne confonde jamais une étiquette de personnage avec
// une phrase de narration) mais l'afficher tel quel serait criard.
function capitaliser(nom: string): string {
  return nom
    .toLowerCase()
    .split(/(-| )/)
    .map((partie) => (partie === '-' || partie === ' ' ? partie : partie.charAt(0).toUpperCase() + partie.slice(1)))
    .join('');
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

// Rend un message avec l'action/narration (*entre astérisques*) en italique,
// le dialogue ("entre guillemets") distingué, et les répliques nommées
// ("NOM : « ... »", voir le format demandé dans promptBuilder.ts) avec le
// nom du PNJ mis en avant et son avatar s'il a déjà été généré — même
// analyseur que l'export PDF/EPUB, pour que le rendu à l'écran et le
// document restent cohérents. avatarsPnj (optionnel) : jamais utilisé pour
// déclencher une génération depuis ici, seulement pour afficher un portrait
// déjà en cache (voir ConversationScreen).
export default function TexteMessageFormate({
  texte,
  style,
  avatarsPnj,
  avatarParDefaut,
  nomsPnjConnus,
}: {
  texte: string;
  style?: StyleProp<TextStyle>;
  avatarsPnj?: AvatarPnjPourTexte[];
  // Avatar à utiliser pour une réplique nommée dont l'étiquette ne
  // correspond à AUCUN PNJ connu du tout (le narrateur écrit parfois un rôle
  // générique — "MARCHAND" — au lieu du nom propre, même une fois ce nom
  // établi ailleurs dans la conversation ; voir ConversationScreen, qui ne
  // le fournit que si un seul PNJ à avatar est mentionné dans les messages
  // récents, pour ne jamais deviner à tort entre plusieurs PNJ actifs).
  avatarParDefaut?: string;
  // Noms (complet + prénom) de TOUS les PNJ connus du lore, avatar généré ou
  // non — sert à ne PAS appliquer avatarParDefaut à un PNJ légitimement
  // différent dont le portrait n'est simplement pas encore prêt (seul un nom
  // absent de cet ensemble, donc une étiquette de rôle générique, doit
  // recevoir le repli).
  nomsPnjConnus?: Set<string>;
}) {
  const segments = analyserMessage(texte);
  const index = avatarsPnj && avatarsPnj.length > 0 ? construireIndexAvatarsPnj(avatarsPnj) : null;
  return (
    <Text style={style}>
      {segments.map((seg, i) => {
        if (seg.type === 'repliquePersonnage') {
          const locuteurMinuscule = (seg.locuteur ?? '').toLowerCase();
          const avatarConnu = index?.parNom.get(locuteurMinuscule);
          const avatarUri = avatarConnu ?? (nomsPnjConnus?.has(locuteurMinuscule) ? undefined : avatarParDefaut);
          return (
            <Text key={i}>
              {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.avatarInline} /> : null}
              <Text style={styles.nomLocuteur}>
                {avatarUri ? ' ' : ''}
                {capitaliser(seg.locuteur ?? '')} :{' '}
              </Text>
              <Text style={styles.dialogue}>« {seg.contenu} »</Text>
            </Text>
          );
        }
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
  nomLocuteur: {
    fontFamily: polices.corpsMedium,
    color: couleurs.accentClair,
  },
  avatarInline: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
});
