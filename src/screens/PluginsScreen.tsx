import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Plugin } from '../types';
import { getPlugins, installerPlugin, supprimerPlugin } from '../storage/storage';
import { analyserPackJson } from '../engine/plugins';
import { couleurs, espacement, polices, rayon } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Plugins'>;

const EXEMPLE_JSON = `[
  { "titre": "Titre de l'entrée", "contenu": "Texte de lore…" }
]`;

// Packs de contenu / plugins "esprit" (brief Phase 2, distribution) :
// uniquement des données de lore collées en JSON, jamais de code — pas de
// bac à sable nécessaire puisqu'il n'y a rien à exécuter.
export default function PluginsScreen({}: Props) {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [nom, setNom] = useState('');
  const [texteJson, setTexteJson] = useState('');
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    getPlugins().then(setPlugins);
  }, []);

  async function ajouter() {
    setErreur('');
    setMessage('');
    try {
      const plugin = analyserPackJson(nom, texteJson);
      await installerPlugin(plugin);
      setPlugins((prev) => [...prev, plugin]);
      setNom('');
      setTexteJson('');
      setMessage(`Pack "${plugin.nom}" installé (${plugin.entrees.length} entrée${plugin.entrees.length > 1 ? 's' : ''}).`);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Pack invalide.');
    }
  }

  async function retirer(id: string) {
    await supprimerPlugin(id);
    setPlugins((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: espacement.lg, paddingBottom: espacement.xl }}
      data={plugins}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <>
          <Text style={styles.titre}>Packs de contenu</Text>
          <Text style={styles.aide}>
            Ajoute des entrées de lore supplémentaires (PNJ, lieux, objets…) sans mise à jour de l'application.
            Colle un JSON au format {'[{ "titre": "…", "contenu": "…" }]'}. Aucun code n'est exécuté — un pack
            n'est que du texte rejoint au reste du lore.
          </Text>

          <Text style={styles.label}>Nom du pack</Text>
          <TextInput
            style={styles.champ}
            value={nom}
            onChangeText={setNom}
            placeholder="Ex : Extension Port-Cendres"
            placeholderTextColor={couleurs.texteAtténué}
          />
          <Text style={styles.label}>Contenu JSON</Text>
          <TextInput
            style={[styles.champ, styles.champMultiligne]}
            value={texteJson}
            onChangeText={setTexteJson}
            placeholder={EXEMPLE_JSON}
            placeholderTextColor={couleurs.texteAtténué}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
          />
          {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
          {message ? <Text style={styles.statut}>{message}</Text> : null}
          <Pressable style={styles.bouton} onPress={ajouter}>
            <Text style={styles.texteBouton}>Installer le pack</Text>
          </Pressable>

          <Text style={[styles.label, { marginTop: espacement.lg }]}>Packs installés</Text>
          {plugins.length === 0 && <Text style={styles.aide}>Aucun pack installé pour l'instant.</Text>}
        </>
      }
      renderItem={({ item }) => (
        <View style={styles.cartePlugin}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nomPlugin}>{item.nom}</Text>
            <Text style={styles.descriptionPlugin}>
              {item.entrees.length} entrée{item.entrees.length > 1 ? 's' : ''}
            </Text>
          </View>
          <Pressable style={styles.boutonRetirer} onPress={() => retirer(item.id)}>
            <Text style={styles.texteBoutonRetirer}>Retirer</Text>
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: couleurs.fond,
  },
  titre: {
    color: couleurs.texte,
    fontFamily: polices.titre,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: espacement.sm,
  },
  aide: {
    color: couleurs.texteAtténué,
    fontSize: 12,
    marginBottom: espacement.md,
  },
  label: {
    color: couleurs.texteAtténué,
    fontSize: 13,
    marginTop: espacement.sm,
    marginBottom: espacement.xs,
  },
  champ: {
    backgroundColor: couleurs.fondChampSaisie,
    borderRadius: rayon.sm,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    color: couleurs.texte,
    paddingHorizontal: espacement.sm,
    paddingVertical: espacement.sm,
    fontSize: 15,
  },
  champMultiligne: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  erreur: {
    color: couleurs.danger,
    fontSize: 13,
    marginTop: espacement.sm,
  },
  statut: {
    color: couleurs.accentClair,
    fontSize: 13,
    marginTop: espacement.sm,
  },
  bouton: {
    backgroundColor: couleurs.accent,
    borderRadius: rayon.md,
    paddingVertical: espacement.md,
    alignItems: 'center',
    marginTop: espacement.md,
  },
  texteBouton: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  cartePlugin: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: couleurs.fondCarte,
    borderRadius: rayon.md,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    padding: espacement.md,
    marginBottom: espacement.sm,
  },
  nomPlugin: {
    color: couleurs.texte,
    fontSize: 15,
    fontWeight: '600',
  },
  descriptionPlugin: {
    color: couleurs.texteAtténué,
    fontSize: 12,
    marginTop: 2,
  },
  boutonRetirer: {
    borderRadius: rayon.sm,
    borderWidth: 1,
    borderColor: couleurs.bordure,
    paddingHorizontal: espacement.sm,
    paddingVertical: espacement.xs,
  },
  texteBoutonRetirer: {
    color: couleurs.danger,
    fontSize: 12,
  },
});
