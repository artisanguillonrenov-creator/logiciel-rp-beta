import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
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

// Les packs restent strictement des données de lore JSON : aucune exécution
// de code. Cette version ne change que la hiérarchie et la lisibilité de l'écran.
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
      setMessage(`Pack « ${plugin.nom} » installé · ${plugin.entrees.length} entrée${plugin.entrees.length > 1 ? 's' : ''}.`);
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
        contentContainerStyle={styles.contenu}
        data={plugins}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.largeur}>
            <View style={styles.entete}>
              <Text style={styles.surtitre}>EXTENSIONS DU MONDE</Text>
              <Text style={styles.titre}>Packs de contenu</Text>
              <Text style={styles.sousTitre}>
                Enrichissez Elyndor avec du lore supplémentaire sans modifier le moteur narratif.
              </Text>
            </View>

            <Panneau style={styles.carteInstallation}>
              <Text style={styles.titreCarte}>Installer un pack</Text>
              <Text style={styles.aide}>
                Un pack contient uniquement du texte de lore — PNJ, lieux, objets ou factions. Aucun code n’est
                exécuté. Le format attendu est une liste JSON d’entrées avec un titre et un contenu.
              </Text>
              <Separateur style={styles.separateur} />
              <Champ
                label="Nom du pack"
                value={nom}
                onChangeText={setNom}
                placeholder="Ex : Extension Port-Cendres"
                conteneurStyle={styles.champConteneur}
              />
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
            </Panneau>

            <View style={styles.enteteListe}>
              <View>
                <Text style={styles.label}>PACKS INSTALLÉS</Text>
                <Text style={styles.compteur}>{plugins.length} actif{plugins.length > 1 ? 's' : ''}</Text>
              </View>
            </View>

            {plugins.length === 0 ? (
              <Panneau style={styles.etatVide}>
                <Text style={styles.etatVideTitre}>Aucune extension installée</Text>
                <Text style={styles.aide}>
                  Elyndor utilise actuellement uniquement son lore principal. Vous pourrez ajouter des packs ici
                  sans toucher à vos histoires sauvegardées.
                </Text>
              </Panneau>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.largeur}>
            <Panneau style={styles.cartePlugin}>
              <View style={styles.identitePlugin}>
                <Text style={styles.nomPlugin}>{item.nom}</Text>
                <Text style={styles.descriptionPlugin}>
                  {item.entrees.length} entrée{item.entrees.length > 1 ? 's' : ''} de lore
                </Text>
              </View>
              <Bouton
                titre="Retirer"
                variante="secondaire"
                onPress={() => retirer(item.id)}
                style={styles.boutonRetirer}
                texteStyle={{ color: couleurs.danger }}
              />
            </Panneau>
          </View>
        )}
      />
    </FondAtmospherique>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contenu: {
    paddingHorizontal: espacement.lg,
    paddingTop: espacement.lg,
    paddingBottom: espacement.xxl,
  },
  largeur: {
    width: '100%',
    maxWidth: 920,
    alignSelf: 'center',
  },
  entete: {
    marginBottom: espacement.lg,
  },
  surtitre: {
    ...stylePetitesCapitales,
    color: couleurs.dore,
    fontSize: 10,
    letterSpacing: 2.2,
    marginBottom: 4,
  },
  titre: {
    color: couleurs.texte,
    fontFamily: polices.display,
    fontSize: 30,
    letterSpacing: 1.1,
  },
  sousTitre: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 15,
    lineHeight: 21,
    marginTop: espacement.xs,
  },
  carteInstallation: {
    padding: espacement.lg,
    backgroundColor: couleurs.fondCarteDense,
    borderColor: couleurs.bordureDoree,
  },
  titreCarte: {
    color: couleurs.doreClair,
    fontFamily: polices.titre,
    fontSize: 22,
  },
  aide: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 14,
    lineHeight: 20,
    marginTop: espacement.xs,
  },
  separateur: {
    marginVertical: espacement.md,
  },
  label: {
    ...stylePetitesCapitales,
    color: couleurs.dore,
    fontSize: 10,
    letterSpacing: 1.8,
  },
  compteur: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 13,
    marginTop: 2,
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
    fontFamily: polices.corpsMedium,
    fontSize: 14,
    marginTop: espacement.sm,
  },
  boutonInstaller: {
    marginTop: espacement.md,
  },
  enteteListe: {
    marginTop: espacement.xl,
    marginBottom: espacement.sm,
  },
  cartePlugin: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: espacement.sm,
    padding: espacement.md,
    backgroundColor: couleurs.fondCarteDense,
  },
  identitePlugin: {
    flex: 1,
    paddingRight: espacement.md,
  },
  nomPlugin: {
    color: couleurs.texte,
    fontFamily: polices.titre,
    fontSize: 19,
  },
  descriptionPlugin: {
    color: couleurs.texteAtténué,
    fontFamily: polices.corps,
    fontSize: 13,
    marginTop: 2,
  },
  boutonRetirer: {
    minWidth: 112,
  },
  etatVide: {
    padding: espacement.lg,
    marginBottom: espacement.md,
  },
  etatVideTitre: {
    color: couleurs.texte,
    fontFamily: polices.titre,
    fontSize: 18,
  },
});
