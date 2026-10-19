import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Bouton from '../components/Bouton';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import ActivationScreen from '../screens/ActivationScreen';
import ChoixMondeScreen from '../screens/ChoixMondeScreen';
import StartScreenStudio from '../screens/StartScreenStudio';
import CreateScreenStudio from '../screens/CreateScreenStudio';
import ConversationScreenStudio from '../screens/ConversationScreenStudio';
import CloudOnlySettingsScreen from '../screens/CloudOnlySettingsScreen';
import PluginsScreen from '../screens/PluginsScreen';
import DesignerSettingsScreen from '../screens/DesignerSettingsScreen';
import LoadConversationScreen from '../screens/LoadConversationScreen';
import CompteScreen from '../screens/CompteScreen';
import { getSettings } from '../storage/storage';
import { MONDE_PAR_DEFAUT, monde } from '../mondes';
import { routeDeDepart, type RouteDepart } from './routeDepart';
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
  const [routeInitiale, setRouteInitiale] = useState<RouteDepart>('Activation');
  const [erreurChargement, setErreurChargement] = useState(false);

  function charger() {
    setErreurChargement(false);
    getSettings().then((settings) => {
      // Toute l'application lit le monde actif : il est appliqué avant le premier écran.
      monde.definirActif(settings.mondeActif ?? MONDE_PAR_DEFAUT);
      setRouteInitiale(routeDeDepart(settings));
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
        initialRouteName={routeInitiale}
        screenOptions={{
          headerStyle: { backgroundColor: '#030814' },
          headerTintColor: couleurs.doreClair,
          headerTitleStyle: { fontFamily: polices.display, color: couleurs.doreClair, fontSize: 17 },
          headerShadowVisible: false,
          headerBackTitle: 'Retour',
          contentStyle: { backgroundColor: couleurs.fond },
        }}
      >
        <Stack.Screen name="Activation" component={ActivationScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ChoixMonde" component={ChoixMondeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Demarrage" component={StartScreenStudio} options={{ headerShown: false }} />
        <Stack.Screen name="Creation" component={CreateScreenStudio} options={{ headerShown: false }} />
        {/* ConversationScreen monte ses actions (recherche, export, concepteur,
            branche) dans le header. Le titre visuel de la scène est déjà rendu
            juste dessous par ConversationScreenStudio : on laisse donc le
            centre du header vide pour préserver la place des commandes sur
            téléphone. */}
        <Stack.Screen
          name="Conversation"
          component={ConversationScreenStudio}
          options={{ headerTitle: () => null }}
        />
        <Stack.Screen name="Reglages" component={CloudOnlySettingsScreen} options={{ title: 'Réglages' }} />
        <Stack.Screen name="Plugins" component={PluginsScreen} options={{ title: 'Packs de contenu' }} />
        <Stack.Screen name="ReglagesConcepteur" component={DesignerSettingsScreen} options={{ title: 'Réglages concepteur' }} />
        <Stack.Screen name="ModuleConcepteur" component={DesignerSettingsScreen} options={{ title: 'Module concepteur' }} />
        <Stack.Screen name="ChargerConversation" component={LoadConversationScreen} options={{ title: 'Histoires' }} />
        <Stack.Screen name="Compte" component={CompteScreen} options={{ title: 'Compte' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
