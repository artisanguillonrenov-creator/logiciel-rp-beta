import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import ActivationScreen from '../screens/ActivationScreen';
import StartScreen from '../screens/StartScreen';
import CreateScreen from '../screens/CreateScreen';
import ConversationScreen from '../screens/ConversationScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PluginsScreen from '../screens/PluginsScreen';
import { getSettings } from '../storage/storage';
import { couleurs, polices } from '../theme/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: couleurs.fond,
    card: couleurs.fond,
    text: couleurs.texte,
    border: couleurs.bordure,
    primary: couleurs.accent,
  },
};

export default function RootNavigator() {
  // Distribution "esprit" (brief Phase 2) : activation (acceptation des
  // conditions de la bêta) requise une fois par appareil avant d'accéder à
  // l'app — d'où l'attente du réglage avant de fixer l'écran de départ.
  const [pret, setPret] = useState(false);
  const [betaAcceptee, setBetaAcceptee] = useState(false);

  useEffect(() => {
    getSettings().then((settings) => {
      setBetaAcceptee(!!settings.betaAcceptee);
      setPret(true);
    });
  }, []);

  if (!pret) {
    return <View style={{ flex: 1, backgroundColor: couleurs.fond }} />;
  }

  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator
        initialRouteName={betaAcceptee ? 'Demarrage' : 'Activation'}
        screenOptions={{
          headerStyle: { backgroundColor: couleurs.fond },
          headerTintColor: couleurs.texte,
          headerTitleStyle: { fontFamily: polices.titre },
        }}
      >
        <Stack.Screen name="Activation" component={ActivationScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Demarrage" component={StartScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Creation" component={CreateScreen} options={{ title: 'Nouvelle histoire' }} />
        <Stack.Screen name="Conversation" component={ConversationScreen} options={{ title: 'Histoire' }} />
        <Stack.Screen name="Reglages" component={SettingsScreen} options={{ title: 'Réglages' }} />
        <Stack.Screen name="Plugins" component={PluginsScreen} options={{ title: 'Packs de contenu' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
