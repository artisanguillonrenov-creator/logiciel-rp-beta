import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { StoryMeta } from '../types';
import { deleteStory, getStoriesIndex, renommerStory } from '../storage/storage';
import { couleurs, espacement, polices } from '../theme/theme';
import Bouton from '../components/Bouton';
import Champ from '../components/Champ';
import FondAtmospherique from '../components/FondAtmospherique';
import Panneau from '../components/Panneau';

type Props = NativeStackScreenProps<RootStackParamList, 'ChargerConversation'>;

const IMAGE_CHARGER = require('../../assets/scenes/creation-histoire.png');

function nomAffiche(meta: StoryMeta): string {
  return meta.titre?.trim() || meta.personnageNom;
}

export default function LoadConversationScreen({ navigation }: Props) {
  const [histoires, setHistoires] = useState<StoryMeta[]>([]);
  const [renommageId, setRenommageId] = useState<string | null>(null);
  const [renommageValeur, setRenommageValeur] = useState('');
  const [suppressionId, setSuppressionId] = useState<string | null>(null);

  const recharger = useCallback(() => {
    getStoriesIndex().then((liste) => setHistoires([...liste].sort((a, b) => b.updatedAt - a.updatedAt)));
  }, []);

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

  function ouvrirRenommage(meta: StoryMeta) {
    setSuppressionId(null);
    setRenommageId(meta.id);
    setRenommageValeur(nomAffiche(meta));
  }

  async function confirmerRenommage() {
    if (!renommageId) return;
    await renommerStory(renommageId, renommageValeur);
    setRenommageId(null);
    recharger();
  }

  async function confirmerSuppression(id: string) {
    await deleteStory(id);
    setSuppressionId(null);
    recharger();
  }

  return (
    <FondAtmospherique style={{ flex: 1 }} densiteEtoiles="discrete" imageFond={IMAGE_CHARGER}>
    <View style={styles.container}>
      <Text style={styles.titre}>Charger conversation</Text>
      <FlatList
        data={histoires}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: espacement.sm, paddingBottom: espacement.xl }}
        ListEmptyComponent={<Text style={styles.aide}>Aucune conversation sauvegardée pour l'instant.</Text>}
        renderItem={({ item }) => (
          <Panneau>
            {renommageId === item.id ? (
              <>
                <Champ value={renommageValeur} onChangeText={setRenommageValeur} placeholder={item.personnageNom} />
                <View style={styles.rangeeActions}>
                  <Bouton titre="Enregistrer" onPress={confirmerRenommage} style={styles.boutonAction} />
                  <Bouton titre="Annuler" variante="secondaire" onPress={() => setRenommageId(null)} style={styles.boutonAction} />
                </View>
              </>
            ) : suppressionId === item.id ? (
              <>
                <Text style={styles.texteConfirmation}>Supprimer définitivement cette conversation ?</Text>
                <View style={styles.rangeeActions}>
                  <Bouton
                    titre="Confirmer la suppression"
                    onPress={() => confirmerSuppression(item.id)}
                    style={styles.boutonAction}
                    texteStyle={{ color: couleurs.danger }}
                  />
                  <Bouton titre="Annuler" variante="secondaire" onPress={() => setSuppressionId(null)} style={styles.boutonAction} />
                </View>
              </>
            ) : (
              <>
                <Pressable onPress={() => navigation.navigate('Conversation', { storyId: item.id })}>
                  <Text style={styles.nomPersonnage}>
                    {item.brancheDeId ? '🌿 ' : ''}
                    {nomAffiche(item)}
                  </Text>
                  <Text style={styles.descriptionPersonnage} numberOfLines={2}>
                    {item.pointDeDepart}
                  </Text>
                </Pressable>
                <View style={styles.rangeeActions}>
                  <Bouton titre="Renommer" variante="secondaire" onPress={() => ouvrirRenommage(item)} style={styles.boutonAction} />
                  <Bouton
                    titre="Supprimer"
                    variante="secondaire"
                    onPress={() => {
                      setRenommageId(null);
                      setSuppressionId(item.id);
                    }}
                    style={styles.boutonAction}
                    texteStyle={{ color: couleurs.danger }}
                  />
                </View>
              </>
            )}
          </Panneau>
        )}
      />
    </View>
    </FondAtmospherique>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: espacement.lg,
    paddingTop: espacement.xl,
  },
  titre: {
    color: couleurs.dore,
    fontFamily: polices.display,
    fontSize: 24,
    letterSpacing: 1,
    marginBottom: espacement.lg,
  },
  aide: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 15,
  },
  nomPersonnage: {
    color: couleurs.texte,
    fontFamily: polices.titre,
    fontSize: 18,
  },
  descriptionPersonnage: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 14,
    marginTop: 2,
  },
  texteConfirmation: {
    color: couleurs.texte,
    fontFamily: polices.corps,
    fontSize: 15,
  },
  rangeeActions: {
    flexDirection: 'row',
    gap: espacement.sm,
    marginTop: espacement.sm,
  },
  boutonAction: {
    flex: 1,
    paddingVertical: espacement.xs,
  },
});
