import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Message } from '../types';
import { couleurs, espacement, interfaceV2, polices, rayon, stylePetitesCapitales } from '../theme/theme';
import { useLangue } from '../i18n/LangueProvider';

// On conserve les valeurs historiques enregistrées dans les messages pour ne
// pas casser les anciennes histoires, mais l'interface n'affiche plus les
// emojis système : elle utilise des glyphes monochromes de la charte Elyndor.
const REACTIONS = [
  { valeur: '👍', glyphe: '+', label: 'Approuver' },
  { valeur: '❤️', glyphe: '♥', label: 'Aimer' },
  { valeur: '😮', glyphe: '!', label: 'Surpris' },
] as const;

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
  const { t } = useLangue();
  return (
    <Modal visible={!!message} animationType="fade" transparent onRequestClose={onFermer}>
      <Pressable style={styles.superposition} onPress={onFermer}>
        <Pressable style={styles.feuille} onPress={(e) => e.stopPropagation()}>
          {message && (
            <>
              <Text style={styles.surtitre}>{t('Réaction')}</Text>
              <View style={styles.rangeeReactions}>
                {REACTIONS.map((reaction) => (
                  <Pressable
                    key={reaction.valeur}
                    accessibilityRole="button"
                    accessibilityLabel={t(reaction.label)}
                    style={[styles.boutonReaction, message.reaction === reaction.valeur && styles.boutonReactionActif]}
                    onPress={() => onReagir(message, reaction.valeur)}
                  >
                    <Text style={[styles.glypheReaction, message.reaction === reaction.valeur && styles.glypheReactionActif]}>{reaction.glyphe}</Text>
                  </Pressable>
                ))}
              </View>
              <Separateur />
              <LigneAction titre={t('Copier le texte')} onPress={() => onCopier(message)} />
              <LigneAction titre={t('Répondre / citer')} onPress={() => onRepondre(message)} />
              <LigneAction titre={t(message.epingle ? 'Désépingler' : 'Épingler')} onPress={() => onEpingler(message)} />
              <LigneAction titre={t('Éditer')} onPress={() => onEditer(message)} />
              <LigneAction titre={t('Supprimer')} onPress={() => onSupprimer(message)} danger />
              <LigneAction titre={t('Annuler')} onPress={onFermer} discret />
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

function LigneAction({ titre, onPress, danger, discret }: { titre: string; onPress: () => void; danger?: boolean; discret?: boolean }) {
  return (
    <Pressable style={({ pressed }) => [styles.ligneAction, pressed && styles.ligneActionPressee]} onPress={onPress}>
      <Text style={[styles.texteAction, danger && styles.texteActionDanger, discret && styles.texteActionDiscret]}>{titre}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  superposition: {
    flex: 1,
    backgroundColor: 'rgba(2, 7, 13, 0.82)',
    justifyContent: 'flex-end',
  },
  feuille: {
    backgroundColor: couleurs.fondCarteDense,
    borderTopWidth: 1,
    borderColor: couleurs.bordureDoree,
    borderTopLeftRadius: rayon.xl,
    borderTopRightRadius: rayon.xl,
    paddingBottom: espacement.lg,
    paddingTop: espacement.md,
  },
  surtitre: {
    ...stylePetitesCapitales,
    color: couleurs.texteFaible,
    fontSize: 9,
    textAlign: 'center',
    marginBottom: espacement.sm,
  },
  rangeeReactions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: espacement.md,
    paddingBottom: espacement.md,
  },
  boutonReaction: {
    width: interfaceV2.cibleTactileMin,
    height: interfaceV2.cibleTactileMin,
    borderRadius: interfaceV2.cibleTactileMin / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: couleurs.bordureSubtile,
    backgroundColor: couleurs.fondChampSaisie,
  },
  boutonReactionActif: {
    borderColor: couleurs.dore,
    backgroundColor: 'rgba(201, 164, 92, 0.12)',
  },
  glypheReaction: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corpsMedium,
    fontSize: 18,
  },
  glypheReactionActif: {
    color: couleurs.doreClair,
  },
  separateur: {
    height: 1,
    backgroundColor: couleurs.bordureSubtile,
    marginHorizontal: espacement.md,
  },
  ligneAction: {
    minHeight: interfaceV2.cibleTactileMin,
    paddingVertical: espacement.sm,
    paddingHorizontal: espacement.lg,
    justifyContent: 'center',
  },
  ligneActionPressee: {
    backgroundColor: 'rgba(201, 164, 92, 0.06)',
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
  texteActionDiscret: {
    color: couleurs.texteAtténué,
  },
});
