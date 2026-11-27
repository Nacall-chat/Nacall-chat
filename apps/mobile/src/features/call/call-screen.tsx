import { VideoTrack } from '@livekit/react-native';
import { Eye, HeadphoneOff, LogOut, Mic, MicOff, Minus, MonitorUp, Plus, SwitchCamera, Volume2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/avatar';
import { Header } from '@/components/header';
import { Body, Eyebrow } from '@/components/ui';
import { useCall, type LivePerson, type LiveStream } from '@/features/call/call';
import { LiveBadge } from '@/features/call/badges';
import { CallControls } from '@/features/call/call-controls';
import { facingLabel, otherFacing, volumeLabel } from '@/features/call/logic';
import { useSocial } from '@/features/social/social';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';
import { durationLabel } from '@nacall/core/room-clock';

/** A call em tela cheia: transmissões (só abrem no "Assistir"), quem está na sala e os controles. */
export function CallScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { session, live } = useCall();
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

  // cinco botões (mic, fone, câmera, tela e sair) cabem inclusive em telas estreitas de 320 dp
  const controlSize = Math.max(40, Math.min(54, Math.floor((width - space.lg * 2 - space.md * 2 - space.sm * 4) / 5)));
  const people = live?.people ?? [];
  const fullWidth = width - space.lg * 2;
  const tileWidth = Math.floor((fullWidth - space.sm) / 2);
  const connected = live?.connection === 'connected';
  const subtitle = connected ? `Voz conectada · ${durationLabel(session.startedAt ?? session.joinedAt, now)}` : 'Conectando…';
  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <Header title={session.name} subtitle={subtitle} />
      {live && !connected ? (
        <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: tokens.panel, borderColor: WARN }]}>
          <View style={[styles.bannerDot, { backgroundColor: WARN }]} />
          <Text style={{ color: WARN, fontWeight: '800', fontSize: 13 }}>{live.connection === 'reconnecting' || live.connection === 'signalReconnecting' ? 'Reconectando… a call continua assim que a rede voltar' : 'Conectando…'}</Text>
        </View>
      ) : null}
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: controlSize + space.xxl + insets.bottom }}>
        {live?.streams.map((stream) => <StreamBlock key={stream.sid} stream={stream} />)}

        <View style={{ gap: space.sm }}>
          <Eyebrow>{`NA CALL · ${people.length}`}</Eyebrow>
          <View style={styles.grid}>
            {people.map((person) => <PersonTile key={person.id} person={person} width={people.length === 1 ? fullWidth : tileWidth} solo={people.length === 1} />)}
          </View>
        </View>
      </ScrollView>
      <View pointerEvents="box-none" style={[styles.dockWrap, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
        <View style={[styles.dock, { backgroundColor: tokens.surface, borderColor: tokens.line }]}>
          <CallControls size={controlSize} gap={space.sm} />
        </View>
      </View>
    </View>
  );
}

/**
 * Uma pessoa na sala, em cartão: o vídeo da câmera (ou a foto de perfil) ocupa o cartão, e o nome com o estado do
 * microfone fica numa pílula por cima. Quem está falando ganha o contorno de destaque; o seu cartão com câmera tem o botão de virar.
 */
function PersonTile({ person, width, solo }: { person: LivePerson; width: number; solo: boolean }) {
  const { tokens } = useTheme();
  const { live } = useCall();
  const { profiles } = useSocial();
  const track = live?.cameras[person.id];
  const label = `${person.name}${person.isLocal ? ' (você)' : ''}`;
  const next = live ? otherFacing(live.facing) : 'user';
  return (
    <View accessibilityLabel={`${label}${person.muted ? ', microfone fechado' : ''}${person.speaking ? ', falando' : ''}`}
      style={[styles.tile, { width, aspectRatio: solo ? 4 / 3 : 3 / 4, backgroundColor: tokens.surface, borderColor: person.speaking ? tokens.accent : tokens.line, borderWidth: person.speaking ? 2 : 1 }]}>
      {live && track ? (
        // a própria câmera frontal aparece espelhada, como num espelho; quem assiste vê o vídeo normal
        <VideoTrack trackRef={track} objectFit="cover" mirror={person.isLocal && live.facing === 'user'} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={styles.tileCenter}><Avatar profile={profiles[person.id]} name={person.name} size={solo ? 88 : 64} /></View>
      )}
      {person.sharing ? <View style={styles.tileTopLeft}><LiveBadge /></View> : null}
      {live && track && person.isLocal ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Virar para a câmera ${facingLabel(next)}`} disabled={live.cameraBusy} onPress={() => live.flipCamera()} hitSlop={6}
          style={({ pressed }) => [styles.flip, { opacity: live.cameraBusy ? 0.5 : pressed ? 0.7 : 1 }]}>
          <SwitchCamera size={16} color="#fff" />
        </Pressable>
      ) : null}
      <View style={styles.pill}>
        {person.muted ? <MicOff size={13} color="#ff9cab" /> : <Mic size={13} color="#fff" />}
        {person.deaf ? <HeadphoneOff size={13} color="#ff9cab" /> : null}
        <Text numberOfLines={1} style={styles.pillText}>{label}</Text>
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

function SmallButton({ label, onPress, primary, icon, accessibilityLabel, disabled }: { label: string; onPress: () => void; primary?: boolean; icon?: React.ReactNode; accessibilityLabel?: string; disabled?: boolean }) {
  const { tokens } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.small, { backgroundColor: primary ? tokens.primary : tokens.raised, opacity: disabled ? 0.5 : 1 }]}>
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
  cameraCard: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  cameraVideo: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#080a0e' },
  cameraFoot: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md },
  stream: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  streamHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md },
  streamFoot: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#080a0e' },
  wait: { alignItems: 'center', justifyContent: 'center' },
  volume: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  step: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  small: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, minHeight: 36, borderRadius: radius.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { borderRadius: radius.lg, overflow: 'hidden', justifyContent: 'flex-end' },
  tileCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  tileTopLeft: { position: 'absolute', top: space.sm, left: space.sm },
  flip: { position: 'absolute', top: space.sm, right: space.sm, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(12,15,20,0.68)' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', maxWidth: '92%', margin: space.sm, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: 'rgba(12,15,20,0.68)' },
  pillText: { color: '#fff', fontSize: 12, fontWeight: '700', flexShrink: 1 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, marginHorizontal: space.lg, marginTop: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill },
  bannerDot: { width: 8, height: 8, borderRadius: 4 },
  dockWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: space.lg },
  dock: { paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: 28, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
});

/** Âmbar de "aguarde" (conectando/reconectando), legível nos dois temas. */
const WARN = '#c98a12';
