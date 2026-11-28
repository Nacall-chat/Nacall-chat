import { Headphones, HeadphoneOff, Mic, MicOff, MonitorOff, MonitorUp, PhoneOff, Video, VideoOff } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useCall } from '@/features/call/call';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

/** Mic, fone, câmera, tela e sair: os mesmos botões na barra da call e na tela da call. */
export function CallControls({ size = 46, gap = space.md }: { size?: number; gap?: number }) {
  const { tokens } = useTheme();
  const { live, leave } = useCall();
  const iconSize = Math.round(size * 0.46);
  const muted = live?.muted ?? false;
  const deaf = live?.deaf ?? false;
  const sharing = live?.sharing ?? false;
  const camera = live?.camera ?? false;
  return (
    <View style={[styles.row, { gap }]}>
      <RoundButton size={size} label={muted ? 'Ligar microfone' : 'Desligar microfone'} off={muted} filled={!muted} onPress={() => live?.toggleMic()} disabled={!live}>
        {muted ? <MicOff size={iconSize} color={tokens.error} /> : <Mic size={iconSize} color={tokens.onPrimary} />}
      </RoundButton>
      <RoundButton size={size} label={deaf ? 'Voltar a ouvir a call' : 'Silenciar o áudio da call'} off={deaf} onPress={() => live?.toggleDeaf()} disabled={!live}>
        {deaf ? <HeadphoneOff size={iconSize} color={tokens.error} /> : <Headphones size={iconSize} color={tokens.text} />}
      </RoundButton>
      <RoundButton size={size} label={camera ? 'Desligar a câmera' : 'Ligar a câmera'} on={camera} onPress={() => live?.toggleCamera()} disabled={!live || live.cameraBusy}>
        {camera ? <Video size={iconSize} color={tokens.accent} /> : <VideoOff size={iconSize} color={tokens.text} />}
      </RoundButton>
      <RoundButton size={size} label={sharing ? 'Parar de transmitir a tela' : 'Transmitir a tela'} on={sharing} onPress={() => live?.toggleScreen()} disabled={!live}>
        {sharing ? <MonitorOff size={iconSize} color={tokens.accent} /> : <MonitorUp size={iconSize} color={tokens.text} />}
      </RoundButton>
      <Pressable accessibilityRole="button" accessibilityLabel="Sair da call" onPress={leave} style={({ pressed }) => [styles.round, { width: size, height: size, backgroundColor: tokens.badge, opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
        <PhoneOff size={iconSize} color="#fff" />
      </Pressable>
    </View>
  );
}

function RoundButton({ children, label, onPress, off, on, filled, disabled, size }: { children: ReactNode; label: string; onPress: () => void; off?: boolean; on?: boolean; filled?: boolean; disabled?: boolean; size: number }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: on }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.round, { width: size, height: size, backgroundColor: filled ? tokens.primary : on ? tokens.soft : off ? `${tokens.error}22` : tokens.panel, borderColor: filled ? tokens.primary : on ? tokens.accent : off ? tokens.error : tokens.line, opacity: disabled ? 0.5 : pressed ? 0.75 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] }]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  round: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: 'transparent' },
});
