import { VideoTrack } from '@livekit/react-native';
import { Eye, LogOut, Minus, MonitorUp, Plus, Volume2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/avatar';
import { Header } from '@/components/header';
import { Body, Eyebrow } from '@/components/ui';
import { useCall, type LiveStream } from '@/features/call/call';
import { LiveBadge, PersonIcons } from '@/features/call/badges';
import { CallControls } from '@/features/call/call-controls';
import { volumeLabel } from '@/features/call/logic';
import { useSocial } from '@/features/social/social';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';
import { durationLabel } from '@nacall/core/room-clock';

/** A call em tela cheia: transmissões (só abrem no "Assistir"), quem está na sala e os controles. */
export function CallScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { session, live } = useCall();
  const { profiles } = useSocial();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.bg }}>
        <Header title="Call" />
        <View style={styles.empty}>
          <Body muted>Você não está em nenhuma call. Abra o menu e toque numa sala de voz para entrar.</Body>
        </View>
      </View>
    );
  }

  const connected = live?.connection === 'connected';
  const subtitle = connected ? `Voz conectada · ${durationLabel(session.startedAt ?? session.joinedAt, now)}` : 'Conectando…';
  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <Header title={session.name} subtitle={subtitle} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        {live?.streams.map((stream) => <StreamBlock key={stream.sid} stream={stream} />)}

        <View style={{ gap: space.sm }}>
          <Eyebrow>{`NA CALL · ${live?.people.length ?? 0}`}</Eyebrow>
          {(live?.people ?? []).map((person) => (
            <View key={person.id} style={[styles.person, { backgroundColor: tokens.surface, borderColor: person.speaking ? tokens.success : tokens.line }]}>
              <Avatar profile={profiles[person.id]} name={person.name} size={40} />
              <View style={styles.personText}>
                <Text numberOfLines={1} style={{ color: tokens.text, fontWeight: '700', fontSize: 15 }}>{person.name}{person.isLocal ? ' (você)' : ''}</Text>
              </View>
              {person.sharing ? <LiveBadge /> : null}
              <PersonIcons muted={person.muted} deaf={person.deaf} size={16} />
            </View>
          ))}
        </View>
      </ScrollView>
      <View style={[styles.controls, { backgroundColor: tokens.surface, borderTopColor: tokens.line, paddingBottom: Math.max(insets.bottom, space.md) }]}>
        <CallControls size={54} />
      </View>
    </View>
  );
}

function StreamBlock({ stream }: { stream: LiveStream }) {
  const { tokens } = useTheme();
  const { live } = useCall();
  if (!live) return null;

  // a própria transmissão: só o aviso e o botão de parar (a prévia seria a tela dentro da tela)
  if (stream.isLocal) {
    return (
      <View style={[styles.card, { backgroundColor: tokens.panel, borderColor: tokens.line }]}>
        <MonitorUp size={22} color={tokens.accent} />
        <View style={styles.personText}>
          <Text style={{ color: tokens.text, fontWeight: '800' }}>Você está transmitindo</Text>
          <Text style={{ color: tokens.muted, fontSize: 12 }}>Quem está na call escolhe se quer assistir.</Text>
        </View>
        <LiveBadge />
        <SmallButton label="Parar" onPress={() => live.toggleScreen()} />
      </View>
    );
  }

  if (!stream.watching) {
    return (
      <View style={[styles.card, { backgroundColor: tokens.panel, borderColor: tokens.line }]}>
        <MonitorUp size={22} color={tokens.accent} />
        <View style={styles.personText}>
          <Text numberOfLines={1} style={{ color: tokens.text, fontWeight: '800' }}>{stream.name}</Text>
          <Text style={{ color: tokens.muted, fontSize: 12 }}>está transmitindo a tela</Text>
        </View>
        <LiveBadge />
        <SmallButton primary icon={<Eye size={15} color={tokens.onPrimary} />} label="Assistir" accessibilityLabel={`Assistir à transmissão de ${stream.name}`} onPress={() => live.watch(stream.sid, true)} />
      </View>
    );
  }

  const volume = live.volumes[stream.personId] ?? 1;
  return (
    <View style={[styles.stream, { backgroundColor: tokens.surface, borderColor: tokens.line }]}>
      <View style={styles.streamHead}>
        <Text numberOfLines={1} style={{ color: tokens.text, fontWeight: '800', flex: 1 }}>{stream.name} está transmitindo</Text>
        <LiveBadge />
      </View>
      {stream.track ? (
        <VideoTrack trackRef={stream.track} objectFit="contain" style={styles.video} />
      ) : (
        <View style={[styles.video, styles.wait]}><Text style={{ color: tokens.muted }}>Conectando à transmissão…</Text></View>
      )}
      <View style={styles.streamFoot}>
        {stream.hasAudio ? (
          <View style={styles.volume} accessibilityLabel={`Volume da transmissão de ${stream.name}`}>
            <Volume2 size={16} color={tokens.muted} />
            <StepButton label="Diminuir o volume da transmissão" onPress={() => live.changeVolume(stream.personId, -1)}><Minus size={14} color={tokens.text} /></StepButton>
            <Text style={{ color: tokens.text, fontSize: 12, minWidth: 38, textAlign: 'center' }}>{volumeLabel(volume)}</Text>
            <StepButton label="Aumentar o volume da transmissão" onPress={() => live.changeVolume(stream.personId, 1)}><Plus size={14} color={tokens.text} /></StepButton>
          </View>
        ) : <View style={{ flex: 1 }} />}
        <SmallButton icon={<LogOut size={14} color={tokens.text} />} label="Sair da transmissão" onPress={() => live.watch(stream.sid, false)} />
      </View>
    </View>
  );
}

function SmallButton({ label, onPress, primary, icon, accessibilityLabel }: { label: string; onPress: () => void; primary?: boolean; icon?: React.ReactNode; accessibilityLabel?: string }) {
  const { tokens } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} onPress={onPress} style={[styles.small, { backgroundColor: primary ? tokens.primary : tokens.raised }]}>
      {icon}
      <Text style={{ color: primary ? tokens.onPrimary : tokens.text, fontSize: 12, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

function StepButton({ children, label, onPress }: { children: React.ReactNode; label: string; onPress: () => void }) {
  const { tokens } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={[styles.step, { backgroundColor: tokens.raised }]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, padding: space.xl, justifyContent: 'center' },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1 },
  personText: { flex: 1, minWidth: 0 },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1 },
  stream: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  streamHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md },
  streamFoot: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#080a0e' },
  wait: { alignItems: 'center', justifyContent: 'center' },
  volume: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  step: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  small: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, minHeight: 36, borderRadius: radius.sm },
  controls: { paddingTop: space.md, paddingHorizontal: space.lg, borderTopWidth: 1 },
});
