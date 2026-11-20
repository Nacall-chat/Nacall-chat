import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Body, Brand, Eyebrow, LinkButton, Notice, PrimaryButton, Screen, Title } from '@/components/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useTheme, type ThemePreference } from '@/theme/theme';

type Me = { display_name: string; username: string };
const next: Record<ThemePreference, ThemePreference> = { system: 'dark', dark: 'light', light: 'system' };
const label: Record<ThemePreference, string> = { system: 'Tema: sistema', dark: 'Tema: escuro', light: 'Tema: claro' };

/**
 * Marco da Fase 0: prova que a sessão, o RLS e o tema funcionam no app.
 * As telas de verdade (Amigos, conversas, servidores) entram na Fase 1.
 */
export default function Home() {
  const { session, signOut } = useSession();
  const { preference, setPreference } = useTheme();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase || !session) return;
    void supabase
      .from('profiles')
      .select('display_name,username')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error: failure }) => {
        if (failure) setError('Não foi possível ler seu perfil agora.');
        else setMe(data as Me);
      });
  }, [session]);

  return (
    <Screen>
      <Brand />
      <View style={{ gap: 8 }}>
        <Eyebrow>VOCÊ ENTROU</Eyebrow>
        <Title>{me ? `Salve,\n${me.display_name}.` : 'Salve.'}</Title>
        {me ? <Body muted>{`@${me.username}`}</Body> : null}
      </View>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Notice>Esta é a base do app (Fase 0). Amigos, conversas, servidores e call chegam nas próximas fases.</Notice>
      <PrimaryButton label={label[preference]} onPress={() => setPreference(next[preference])} />
      <LinkButton label="Sair" onPress={() => void signOut()} />
    </Screen>
  );
}
