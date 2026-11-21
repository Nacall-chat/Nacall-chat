import { HeadphoneOff, MicOff } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/theme';

/** Selo vermelho de quem está transmitindo a tela (igual ao do site). */
export function LiveBadge() {
  return (
    <View accessibilityLabel="Ao vivo" style={styles.live}>
      <View style={styles.dot} />
      <Text style={styles.liveText}>AO VIVO</Text>
    </View>
  );
}

/** Mic fechado e áudio da call fechado (fone mudo) ao lado do nome. Só mostram. */
export function PersonIcons({ muted, deaf, size = 14 }: { muted: boolean; deaf: boolean; size?: number }) {
  const { tokens } = useTheme();
  if (!muted && !deaf) return null;
  return (
    <View style={styles.icons}>
      {muted ? <View accessibilityLabel="Microfone fechado"><MicOff size={size} color={tokens.error} /></View> : null}
      {deaf ? <View accessibilityLabel="Sem ouvir a call"><HeadphoneOff size={size} color={tokens.error} /></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  live: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: '#d93a3a' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  icons: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
