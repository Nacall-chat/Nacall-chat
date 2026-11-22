import { usePathname, useRouter } from 'expo-router';
import { Headphones } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCall } from '@/features/call/call';
import { CallControls } from '@/features/call/call-controls';
import { useKeyboardVisible } from '@/lib/use-keyboard';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';
import { durationLabel } from '@nacall/core/room-clock';

/** Barra da call em toda tela do app (menos na própria tela da call): toque para abrir, controles à mão. */
export function CallBar() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const keyboard = useKeyboardVisible();
  const { session, live } = useCall();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [session]);

  if (!session || pathname === '/call' || keyboard) return null;
  const connected = live?.connection === 'connected';
  return (
    <View style={[styles.bar, { backgroundColor: tokens.surface, borderTopColor: tokens.line, paddingBottom: Math.max(insets.bottom, space.sm) }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Abrir a call ${session.name}`} onPress={() => router.navigate('/call')} style={styles.info}>
        <Headphones size={18} color={connected ? tokens.success : tokens.muted} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: tokens.text, fontWeight: '800', fontSize: 14 }}>{session.name}</Text>
          <Text numberOfLines={1} style={{ color: connected ? tokens.success : tokens.muted, fontSize: 11 }}>
            {connected ? `Voz conectada · ${durationLabel(session.startedAt ?? session.joinedAt, now)}` : 'Conectando…'}
          </Text>
        </View>
      </Pressable>
      <CallControls size={40} gap={space.xs + 2} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingTop: space.sm, borderTopWidth: 1, borderRadius: 0 },
  info: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.xs, borderRadius: radius.md },
});
