import React, { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import type { Plugin } from '../types';
import { getPlugins, installerPlugin, supprimerPlugin } from '../storage/storage';
import { analyserPackJson } from '../engine/plugins';
import { couleurs, espacement, polices, stylePetitesCapitales } from '../theme/theme';
import Bouton from '../components/Bouton';
import Champ from '../components/Champ';
import FondAtmospherique from '../components/FondAtmospherique';
import Panneau from '../components/Panneau';
import Separateur from '../components/Separateur';

type Props = NativeStackScreenProps<RootStackParamList, 'Plugins'>;

const IMAGE_PLUGINS = require('../../assets/scenes/creation-personnage.png');

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
    <FondAtmospherique style={{ flex: 1 }} densiteEtoiles="discrete" imageFond={IMAGE_PLUGINS}>
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: espacement.lg, paddingBottom: espacement.xl }}
      data={plugins}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <>
          <Text style={styles.titre}>Packs de contenu</Text>
          <Separateur />
          <Text style={styles.aide}>
            Ajoute des entrées de lore supplémentaires (PNJ, lieux, objets…) sans mise à jour de l'application.
            Colle un JSON au format {'[{ "titre": "…", "contenu": "…" }]'}. Aucun code n'est exécuté — un pack
            n'est que du texte rejoint au reste du lore.
          </Text>

          <Champ label="Nom du pack" value={nom} onChangeText={setNom} placeholder="Ex : Extension Port-Cendres" conteneurStyle={styles.champConteneur} />
          <Champ
            label="Contenu JSON"
            value={texteJson}
            onChangeText={setTexteJson}
            placeholder={EXEMPLE_JSON}
            multiligne
            autoCapitalize="none"
            autoCorrect={false}
            conteneurStyle={styles.champConteneur}
          />
          {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
          {message ? <Text style={styles.statut}>{message}</Text> : null}
          <Bouton titre="Installer le pack" onPress={ajouter} style={styles.boutonInstaller} />

          <Text style={[styles.label, { marginTop: espacement.lg }]}>Packs installés</Text>
          {plugins.length === 0 && <Text style={styles.aide}>Aucun pack installé pour l'instant.</Text>}
        </>
      }
      renderItem={({ item }) => (
        <Panneau style={styles.cartePlugin}>
          <View style={{ flex: 1 }}>
            <Text style={styles.nomPlugin}>{item.nom}</Text>
            <Text style={styles.descriptionPlugin}>
              {item.entrees.length} entrée{item.entrees.length > 1 ? 's' : ''}
            </Text>
          </View>
          <Bouton titre="Retirer" variante="secondaire" onPress={() => retirer(item.id)} texteStyle={{ color: couleurs.danger }} />
        </Panneau>
      )}
    />
    </FondAtmospherique>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  titre: {
    color: couleurs.dore,
    fontFamily: polices.display,
    fontSize: 24,
    letterSpacing: 1,
  },
  aide: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 14,
    marginBottom: espacement.md,
  },
  label: {
    ...stylePetitesCapitales,
    color: couleurs.texteAtténué,
    fontSize: 12,
    marginBottom: espacement.xs,
  },
  champConteneur: {
    marginBottom: espacement.sm,
  },
  erreur: {
    color: couleurs.danger,
    fontFamily: polices.corps,
    fontSize: 14,
    marginTop: espacement.sm,
  },
  statut: {
    color: couleurs.accentClair,
    fontFamily: polices.corps,
    fontSize: 14,
    marginTop: espacement.sm,
  },
  boutonInstaller: {
    marginTop: espacement.md,
  },
  cartePlugin: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: espacement.sm,
  },
  nomPlugin: {
    color: couleurs.texte,
    fontFamily: polices.titre,
    fontSize: 17,
  },
  descriptionPlugin: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 13,
    marginTop: 2,
  },
});
