import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// Só as duas variáveis públicas (a chave de serviço nunca vai para o app).
// Referências estáticas: o Expo troca pelo valor na hora da build.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key && !url.includes('YOUR_PROJECT') && !key.startsWith('YOUR_'));

/** null quando o app foi montado sem as variáveis (a tela inicial avisa em vez de quebrar). */
export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url as string, key as string, {
      auth: {
        ...(Platform.OS !== 'web' ? { storage: AsyncStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// Receita oficial do Supabase para React Native: renova a sessão só com o app em primeiro plano.
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}
