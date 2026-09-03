import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Cinzel_600SemiBold, Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import {
  CormorantGaramond_400Regular,
  CormorantGaramond_500Medium,
  CormorantGaramond_600SemiBold,
} from '@expo-google-fonts/cormorant-garamond';
import RootNavigator from './src/navigation/RootNavigator';
import { couleurs } from './src/theme/theme';
import { LangueProvider } from './src/i18n/LangueProvider';

export default function App() {
  // Direction artistique (grimoire illuminé) : une seule famille serif dans
  // toute l'interface, pas de repli sans-serif — voir src/theme/theme.ts.
  // Si le chargement échoue (police non embarquée sur la plateforme), la
  // pile "Georgia, Times New Roman, serif" définie dans le thème prend le
  // relais automatiquement.
  const [policesChargees, erreurPolices] = useFonts({
    Cinzel_600SemiBold,
    Cinzel_700Bold,
    CormorantGaramond_400Regular,
    CormorantGaramond_500Medium,
    CormorantGaramond_600SemiBold,
  });

  // Une erreur de chargement ne doit pas bloquer l'app indéfiniment sur un
  // écran vide : on démarre quand même, avec le repli serif système.
  if (!policesChargees && !erreurPolices) {
    return <View style={{ flex: 1, backgroundColor: couleurs.fond }} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LangueProvider>
          <RootNavigator />
          <StatusBar style="light" />
        </LangueProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
