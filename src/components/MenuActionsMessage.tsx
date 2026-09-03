import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Message } from '../types';
import { couleurs, espacement, polices } from '../theme/theme';

const EMOJIS_REACTION = ['👍', '❤️', '😮'];

// Menu contextuel unique, déclenché par appui long sur un message —
// convention standard (WhatsApp, Messages) : toutes les actions derrière un
// seul geste déjà connu, plutôt que des icônes séparées visibles en
// permanence sur chaque message.
export default function MenuActionsMessage({
  message,
  onFermer,
  onCopier,
  onRepondre,
  onReagir,
  onEpingler,
  onEditer,
  onSupprimer,
}: {
  message: Message | null;
  onFermer: () => void;
  onCopier: (message: Message) => void;
  onRepondre: (message: Message) => void;
  onReagir: (message: Message, emoji: string) => void;
  onEpingler: (message: Message) => void;
  onEditer: (message: Message) => void;
  onSupprimer: (message: Message) => void;
}) {
  return (
    <Modal visible={!!message} animationType="fade" transparent onRequestClose={onFermer}>
      <Pressable style={styles.superposition} onPress={onFermer}>
        <Pressable style={styles.feuille} onPress={(e) => e.stopPropagation()}>
          {message && (
            <>
              <View style={styles.rangeeReactions}>
                {EMOJIS_REACTION.map((emoji) => (
                  <Pressable
                    key={emoji}
                    style={[styles.boutonEmoji, message.reaction === emoji && styles.boutonEmojiActif]}
                    onPress={() => onReagir(message, emoji)}
                  >
                    <Text style={styles.emoji}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
              <Separateur />
              <LigneAction titre="Copier le texte" onPress={() => onCopier(message)} />
              <LigneAction titre="Répondre / citer" onPress={() => onRepondre(message)} />
              <LigneAction titre={message.epingle ? 'Désépingler' : 'Épingler'} onPress={() => onEpingler(message)} />
              <LigneAction titre="Éditer" onPress={() => onEditer(message)} />
              <LigneAction titre="Supprimer" onPress={() => onSupprimer(message)} danger />
              <LigneAction titre="Annuler" onPress={onFermer} />
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Separateur() {
  return <View style={styles.separateur} />;
}

function LigneAction({ titre, onPress, danger }: { titre: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable style={styles.ligneAction} onPress={onPress}>
      <Text style={[styles.texteAction, danger && styles.texteActionDanger]}>{titre}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  superposition: {
    flex: 1,
    backgroundColor: 'rgba(6, 8, 18, 0.75)',
    justifyContent: 'flex-end',
  },
  feuille: {
    backgroundColor: couleurs.fondCarte,
    borderTopWidth: 1,
    borderColor: couleurs.bordure,
    paddingBottom: espacement.lg,
    paddingTop: espacement.md,
  },
  rangeeReactions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: espacement.lg,
    paddingBottom: espacement.sm,
  },
  boutonEmoji: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  boutonEmojiActif: {
    borderColor: couleurs.accent,
    backgroundColor: 'rgba(90, 172, 255, 0.10)',
  },
  emoji: {
    fontSize: 24,
  },
  separateur: {
    height: 1,
    backgroundColor: couleurs.bordure,
    marginHorizontal: espacement.md,
  },
  ligneAction: {
    paddingVertical: espacement.md,
    paddingHorizontal: espacement.lg,
  },
  texteAction: {
    color: couleurs.texte,
    fontFamily: polices.corps,
    fontSize: 17,
    textAlign: 'center',
  },
  texteActionDanger: {
    color: couleurs.danger,
  },
});
