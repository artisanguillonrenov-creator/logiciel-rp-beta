import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Bouton from '../components/Bouton';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import ActivationScreen from '../screens/ActivationScreen';
import StartScreen from '../screens/StartScreenStudio';
import CreateScreen from '../screens/CreateScreenStudio';
import ConversationScreen from '../screens/ConversationScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PluginsScreen from '../screens/PluginsScreen';
import DesignerSettingsScreen from '../screens/DesignerSettingsScreen';
import LoadConversationScreen from '../screens/LoadConversationScreen';
import { getSettings } from '../storage/storage';
import { couleurs, polices } from '../theme/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: couleurs.fond,
    card: couleurs.fondProfond,
    text: couleurs.texte,
    border: couleurs.bordureSubtile,
    primary: couleurs.dore,
  },
};

export default function RootNavigator() {
  const [pret, setPret] = useState(false);
  const [betaAcceptee, setBetaAcceptee] = useState(false);
  const [erreurChargement, setErreurChargement] = useState(false);

  function charger() {
    setErreurChargement(false);
    getSettings().then((settings) => {
      setBetaAcceptee(!!settings.betaAcceptee);
      setPret(true);
    }).catch(() => setErreurChargement(true));
  }
  useEffect(charger, []);

  if (!pret) {
    return <View style={{ flex: 1, backgroundColor: couleurs.fond, justifyContent: 'center', padding: 24 }}>
      {erreurChargement && <>
        <Text style={{ color: couleurs.texte, marginBottom: 16 }}>Impossible de lire les réglages. Déverrouille l’appareil ou autorise le stockage du navigateur, puis réessaie. Rien n’a été réinitialisé.</Text>
        <Bouton titre="Réessayer" onPress={charger} />
      </>}
    </View>;
  }

  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator
        initialRouteName={betaAcceptee ? 'Demarrage' : 'Activation'}
        screenOptions={{
          headerStyle: { backgroundColor: couleurs.fondProfond },
          headerTintColor: couleurs.doreClair,
          headerTitleStyle: { fontFamily: polices.titre, color: couleurs.doreClair, fontSize: 20 },
          headerShadowVisible: false,
          headerBackTitle: 'Retour',
          contentStyle: { backgroundColor: couleurs.fond },
        }}
      >
        <Stack.Screen name="Activation" component={ActivationScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Demarrage" component={StartScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Creation" component={CreateScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Conversation" component={ConversationScreen} options={{ title: 'Elyndor' }} />
        <Stack.Screen name="Reglages" component={SettingsScreen} options={{ title: 'Réglages' }} />
        <Stack.Screen name="Plugins" component={PluginsScreen} options={{ title: 'Packs de contenu' }} />
        <Stack.Screen name="ReglagesConcepteur" component={DesignerSettingsScreen} options={{ title: 'Réglages concepteur' }} />
        <Stack.Screen name="ChargerConversation" component={LoadConversationScreen} options={{ title: 'Histoires' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
