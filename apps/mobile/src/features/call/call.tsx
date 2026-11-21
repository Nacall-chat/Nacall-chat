import { useRouter } from 'expo-router';
import { AndroidAudioTypePresets, AudioSession, LiveKitRoom, isTrackReference, registerGlobals, useConnectionState, useParticipants, useRoomContext, useSpeakingParticipants, useTracks, type TrackReference } from '@livekit/react-native';
import { ConnectionState, RoomEvent, Track } from 'livekit-client';
import { createContext, use, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { postJson } from '@/lib/api';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { effectiveVolume, MIC_DENIED_MESSAGE, screenShareSupport, stepVolume, type StreamItem } from '@/features/call/logic';
import { askNotificationPermission, startCallService, stopCallService } from '@/features/call/service';
import { isCurrentCall } from '@nacall/core/call-session';
import { DEAF_ATTRIBUTE, liveFlags, type PersonFlags } from '@nacall/core/room-people';
import { isWatching, reconcileScreenSubscriptions, setWatching, type WatchState } from '@nacall/core/stream';

// Prepara o WebRTC do LiveKit (obrigatório antes de qualquer call).
registerGlobals();

type CallSession = { token: string; serverUrl: string; channelId: string; name: string; startedAt: number | null; joinedAt: number };
export type LivePerson = PersonFlags & { id: string; name: string; isLocal: boolean; speaking: boolean };
export type LiveStream = StreamItem & { track?: TrackReference };
export type Live = {
  connection: ConnectionState;
  people: LivePerson[];
  streams: LiveStream[];
  deaf: boolean;
  muted: boolean;
  sharing: boolean;
  volumes: Record<string, number>;
  toggleMic: () => void;
  toggleDeaf: () => void;
  toggleScreen: () => void;
  watch: (sid: string, on: boolean) => void;
  changeVolume: (personId: string, direction: 1 | -1) => void;
};
type CallValue = {
  session: CallSession | null;
  /** Estado da sala já conectada (some quando não há call). */
  live: Live | null;
  /** Id da sala em que a pessoa está tentando entrar agora. */
  joining: string | null;
  join: (channel: { id: string; name: string }) => Promise<void>;
  leave: () => void;
};
const CallContext = createContext<CallValue | null>(null);

type TokenResponse = { token: string; serverUrl: string; startedAt?: number | null };

async function ensureMicPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true; // no iOS o sistema pergunta ao abrir o microfone
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * A call continua conectada enquanto a pessoa navega pelo app: a sala vive aqui, no topo da área logada, e as telas
 * (barra da call, tela da call, lista de salas) só leem o estado. Clicar em outra sala troca de call sem sair antes.
 */
export function CallProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const [session, setSession] = useState<CallSession | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [joining, setJoining] = useState<string | null>(null);

  const join = useCallback(async (channel: { id: string; name: string }) => {
    if (isCurrentCall(session, channel.id)) { router.navigate('/call'); return; }
    setJoining(channel.id);
    try {
      if (!(await ensureMicPermission())) throw new Error(MIC_DENIED_MESSAGE);
      await askNotificationPermission();
      const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error('Sua sessão expirou. Saia e entre de novo.');
      const result = await postJson<TokenResponse>('/api/livekit/token', { channelId: channel.id }, accessToken);
      setLive(null);
      setSession({ token: result.token, serverUrl: result.serverUrl, channelId: channel.id, name: channel.name, startedAt: result.startedAt ?? null, joinedAt: Date.now() });
      router.navigate('/call');
    } catch (error) {
      Alert.alert('Não deu para entrar na call', friendlyError(error instanceof Error ? error.message : 'Tente novamente.'));
    } finally {
      setJoining(null);
    }
  }, [router, session]);

  const leave = useCallback(() => setSession(null), []);
  // A sala antiga avisa "saí" ao ser trocada; esse aviso não pode derrubar a call nova.
  const leaveIfCurrent = useCallback((channelId: string) => setSession((current) => (isCurrentCall(current, channelId) ? null : current)), []);
  const report = useCallback((message: string) => Alert.alert('Call', message), []);

  // Segundo plano (Android): serviço em primeiro plano com o aviso "Em call", para o microfone não parar ao minimizar o app.
  useEffect(() => {
    if (!session) return;
    startCallService(session.name);
    return () => stopCallService();
  }, [session]);

  // Áudio do celular: fone/bluetooth primeiro, depois alto-falante (como numa call de grupo).
  useEffect(() => {
    if (!session) return;
    void (async () => {
      await AudioSession.configureAudio({
        android: { preferredOutputList: ['headset', 'bluetooth', 'speaker', 'earpiece'], audioTypeOptions: AndroidAudioTypePresets.communication },
        ios: { defaultOutput: 'speaker' },
      });
      await AudioSession.startAudioSession();
    })().catch(() => {});
    return () => { void AudioSession.stopAudioSession().catch(() => {}); };
  }, [session]);

  const value = useMemo<CallValue>(() => ({ session, live: session ? live : null, joining, join, leave }), [session, live, joining, join, leave]);

  return (
    <CallContext value={value}>
      {children}
      {session ? (
        <LiveKitRoom
          key={session.channelId}
          serverUrl={session.serverUrl}
          token={session.token}
          connect
          audio
          video={false}
          options={{ adaptiveStream: { pixelDensity: 'screen' }, dynacast: true }}
          onDisconnected={() => leaveIfCurrent(session.channelId)}
          onError={(error) => report(`A call deu uma engasgada: ${friendlyError(error.message)}`)}
        >
          <LiveBridge onLive={setLive} report={report} />
        </LiveKitRoom>
      ) : null}
    </CallContext>
  );
}

export function useCall() {
  const value = use(CallContext);
  if (!value) throw new Error('useCall precisa estar dentro de <CallProvider />');
  return value;
}

/** Fica dentro da sala do LiveKit, junta os ganchos dela num estado só e entrega para o resto do app. */
function LiveBridge({ onLive, report }: { onLive: (live: Live) => void; report: (message: string) => void }) {
  const room = useRoomContext();
  const participants = useParticipants();
  const speaking = useSpeakingParticipants();
  const connection = useConnectionState();
  const screens = useTracks([Track.Source.ScreenShare], { onlySubscribed: false });
  const [deaf, setDeaf] = useState(false);
  const [watch, setWatch] = useState<WatchState>({});
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [, setTick] = useState(0);

  // mic, transmissão e fone mudo de todos mudam na hora
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const events = [RoomEvent.ParticipantAttributesChanged, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.TrackPublished, RoomEvent.TrackUnpublished, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished, RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected];
    for (const event of events) room.on(event, bump);
    return () => { for (const event of events) room.off(event, bump); };
  }, [room]);

  // fone mudo: o LiveKit não tem esse estado, então cada pessoa o publica num atributo (o site lê o mesmo)
  useEffect(() => {
    if (connection !== ConnectionState.Connected) return;
    void room.localParticipant.setAttributes({ [DEAF_ATTRIBUTE]: deaf ? '1' : '0' }).catch(() => {});
  }, [deaf, connection, room]);

  // ninguém é forçado a assistir: vídeo e áudio da tela só chegam depois do "Assistir"
  useEffect(() => {
    const sync = () => reconcileScreenSubscriptions(
      [...room.remoteParticipants.values()].map((p) => ({ screen: p.getTrackPublication(Track.Source.ScreenShare), audio: p.getTrackPublication(Track.Source.ScreenShareAudio) })),
      watch,
    );
    sync();
    room.on(RoomEvent.TrackPublished, sync);
    room.on(RoomEvent.TrackSubscribed, sync);
    room.on(RoomEvent.ParticipantConnected, sync);
    return () => { room.off(RoomEvent.TrackPublished, sync); room.off(RoomEvent.TrackSubscribed, sync); room.off(RoomEvent.ParticipantConnected, sync); };
  }, [room, watch]);

  // volume da voz e da transmissão (separados); com o fone mudo tudo vai a zero
  useEffect(() => {
    const apply = () => {
      for (const p of room.remoteParticipants.values()) {
        p.setVolume(effectiveVolume(deaf, 1), Track.Source.Microphone);
        p.setVolume(effectiveVolume(deaf, volumes[p.identity] ?? 1), Track.Source.ScreenShareAudio);
      }
    };
    apply();
    room.on(RoomEvent.ParticipantConnected, apply);
    room.on(RoomEvent.TrackSubscribed, apply);
    return () => { room.off(RoomEvent.ParticipantConnected, apply); room.off(RoomEvent.TrackSubscribed, apply); };
  }, [room, deaf, volumes]);

  const speakingIds = new Set(speaking.map((s) => s.identity));
  const people: LivePerson[] = participants.map((p) => ({ id: p.identity, name: p.name || 'Jogador', isLocal: p.isLocal, speaking: speakingIds.has(p.identity), ...liveFlags(p, p.isLocal ? deaf : undefined) }));
  const streams: LiveStream[] = screens.flatMap((ref) => {
    const pub = ref.publication;
    if (!pub) return [];
    const p = ref.participant;
    // a prévia da própria tela não aparece no celular (seria a tela dentro da tela)
    return [{
      sid: pub.trackSid,
      personId: p.identity,
      name: p.name || 'Jogador',
      isLocal: p.isLocal,
      watching: isWatching(watch, pub.trackSid, false),
      hasAudio: !p.isLocal && Boolean(p.getTrackPublication(Track.Source.ScreenShareAudio)),
      track: pub.track && isTrackReference(ref) ? ref : undefined,
    }];
  });
  const me = people.find((p) => p.isLocal);
  const signature = JSON.stringify({ connection, people, streams: streams.map((s) => [s.sid, s.watching, s.hasAudio, Boolean(s.track)]), deaf, volumes });

  const toggleMic = useCallback(() => {
    const lp = room.localParticipant;
    void lp.setMicrophoneEnabled(!lp.isMicrophoneEnabled).catch((e: Error) => report(friendlyError(e.message)));
  }, [room, report]);
  const toggleScreen = useCallback(() => {
    const lp = room.localParticipant;
    if (lp.isScreenShareEnabled) { void lp.setScreenShareEnabled(false).catch(() => {}); return; }
    const support = screenShareSupport(Platform.OS);
    if (!support.ok) { report(support.message); return; }
    void lp.setScreenShareEnabled(true, { audio: false }).catch(() => report('Não deu para transmitir a tela. Se o Android perguntou, toque em "Iniciar agora" para liberar.'));
  }, [room, report]);
  const toggleDeaf = useCallback(() => setDeaf((d) => !d), []);
  const watchStream = useCallback((sid: string, on: boolean) => setWatch((prev) => setWatching(prev, sid, on)), []);
  const changeVolume = useCallback((personId: string, direction: 1 | -1) => setVolumes((prev) => ({ ...prev, [personId]: stepVolume(prev[personId] ?? 1, direction) })), []);

  useEffect(() => {
    onLive({ connection, people, streams, deaf, muted: me?.muted ?? false, sharing: me?.sharing ?? false, volumes, toggleMic, toggleDeaf, toggleScreen, watch: watchStream, changeVolume });
    // só republica quando algo que a tela mostra mudou
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return null;
}
