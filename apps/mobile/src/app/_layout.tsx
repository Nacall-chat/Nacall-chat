import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ConfigMissing } from '@/features/auth/config-missing';
import { SessionProvider, useSession } from '@/lib/session';
import { supabaseConfigured } from '@/lib/supabase';
import { ThemeProvider, useTheme } from '@/theme/theme';

SplashScreen.preventAutoHideAsync();

export default function Root() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SessionProvider>
            <Navigator />
          </SessionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Rotas protegidas (Expo Router): cada grupo só existe no estado de acesso certo e a navegação
 * redireciona sozinha quando o estado muda (entrar, sair, exigir o código do 2FA).
 */
function Navigator() {
  const { status } = useSession();
  const { scheme } = useTheme();

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hide();
  }, [status]);

  if (!supabaseConfigured) return <ConfigMissing />;
  if (status === 'loading') return null;

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Protected guard={status === 'signedOut'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'mfa'}>
          <Stack.Screen name="mfa" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'ready'}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
