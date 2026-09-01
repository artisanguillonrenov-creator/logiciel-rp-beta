import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import StartScreen from '../screens/StartScreen';
import CreateScreen from '../screens/CreateScreen';
import ConversationScreen from '../screens/ConversationScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { couleurs } from '../theme/theme';

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
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: couleurs.fond }, headerTintColor: couleurs.texte }}>
        <Stack.Screen name="Demarrage" component={StartScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Creation" component={CreateScreen} options={{ title: 'Création rapide' }} />
        <Stack.Screen name="Conversation" component={ConversationScreen} options={{ title: 'Histoire' }} />
        <Stack.Screen name="Reglages" component={SettingsScreen} options={{ title: 'Réglages' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
