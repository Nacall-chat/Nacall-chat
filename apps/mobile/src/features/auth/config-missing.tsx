import { View } from 'react-native';
import { Body, Eyebrow, Notice, Screen, Title } from '@/components/ui';

/** Aparece quando o app foi montado sem as variáveis públicas (nunca mostra valores). */
export function ConfigMissing() {
  return (
    <Screen>
      <View style={{ gap: 8 }}>
        <Eyebrow>CONFIGURAÇÃO</Eyebrow>
        <Title>{'O app ainda\nnão foi configurado.'}</Title>
        <Body muted>Faltam as variáveis públicas do ambiente. Copie .env.example para .env.local em apps/mobile e preencha com os dados da homologação.</Body>
      </View>
      <Notice>EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY e EXPO_PUBLIC_API_URL</Notice>
    </Screen>
  );
}
