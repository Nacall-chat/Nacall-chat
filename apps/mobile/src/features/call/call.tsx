import { useRouter } from 'expo-router';
import { AndroidAudioTypePresets, AudioSession, LiveKitRoom, isTrackReference, registerGlobals, useConnectionState, useParticipants, useRoomContext, useSpeakingParticipants, useTracks, type TrackReference } from '@livekit/react-native';
import { ConnectionState, LocalVideoTrack, RoomEvent, Track } from 'livekit-client';
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import { postJson } from '@/lib/api';
import { friendlyError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { CAMERA_CAPTURE, cameraProblem, cameraProblemMessage, effectiveVolume, flipProblemMessage, MIC_DENIED_MESSAGE, otherFacing, screenShareSupport, stepVolume, type CameraProblem, type Facing, type StreamItem } from '@/features/call/logic';
import { askNotificationPermission, startCallService, stopCallService } from '@/features/call/service';
import { liveCamera } from '@nacall/core/camera';
import { isCurrentCall } from '@nacall/core/call-session';
import { DEAF_ATTRIBUTE, liveFlags, type PersonFlags } from '@nacall/core/room-people';
import { isWatching, reconcileScreenSubscriptions, setWatching, type WatchState } from '@nacall/core/stream';

// Prepara o WebRTC do LiveKit (obrigatório antes de qualquer call).
registerGlobals();

type CallSession = { token: string; serverUrl: string; channelId: string; name: string; startedAt: number | null; joinedAt: number };
export type LivePerson = PersonFlags & { id: string; name: string; isLocal: boolean; speaking: boolean; camera: boolean };
export type LiveStream = StreamItem & { track?: TrackReference };
export type Live = {
  connection: ConnectionState;
  people: LivePerson[];
  streams: LiveStream[];
  deaf: boolean;
  muted: boolean;
  sharing: boolean;
  /** Minha câmera está ligada. */
  camera: boolean;
  /** Ligando, desligando ou virando a câmera (o botão espera a vez). */
  cameraBusy: boolean;
  /** Câmera em uso: frontal ("user") ou traseira ("environment"). */
  facing: Facing;
  /** Vídeo da câmera de quem está com ela ligada, por id da pessoa (de quem está sem câmera não há entrada). */
  cameras: Record<string, TrackReference>;
  volumes: Record<string, number>;
  toggleMic: () => void;
  toggleDeaf: () => void;
  toggleScreen: () => void;
  toggleCamera: () => void;
  flipCamera: () => void;
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

async function ensureCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true; // no iPhone o sistema pergunta ao abrir a câmera
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

/** Aviso claro em português; quando a permissão foi negada, oferece abrir os ajustes do celular. */
function reportCameraProblem(problem: CameraProblem, message = cameraProblemMessage(problem, Platform.OS)): void {
  if (problem !== 'denied') { Alert.alert('Câmera', message); return; }
  Alert.alert('Câmera', message, [
    { text: 'Agora não', style: 'cancel' },
    { text: 'Abrir ajustes', onPress: () => { void Linking.openSettings().catch(() => {}); } },
  ]);
}

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
  // Com a câmera ligada o serviço também vira do tipo câmera (chamar de novo só troca o tipo, sem derrubar a call).
  const cameraOn = Boolean(session && live?.camera);
  useEffect(() => {
    if (!session) return;
    return () => stopCallService();
  }, [session]);
  useEffect(() => {
    if (!session) return;
    startCallService(session.name, cameraOn);
  }, [session, cameraOn]);

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
  const cameraRefs = useTracks([Track.Source.Camera], { onlySubscribed: true });
  const [deaf, setDeaf] = useState(false);
  const [facing, setFacing] = useState<Facing>('user');
  const [cameraBusy, setCameraBusy] = useState(false);
  const cameraBusyRef = useRef(false);
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
  // desligar a câmera deixa a faixa muda (ela não sai da sala): só faixa que não está muda conta como câmera ligada
  const cameras: Record<string, TrackReference> = {};
  for (const p of participants) {
    const ref = liveCamera(cameraRefs, p.identity);
    if (ref && isTrackReference(ref)) cameras[p.identity] = ref;
  }
  const people: LivePerson[] = participants.map((p) => ({ id: p.identity, name: p.name || 'Jogador', isLocal: p.isLocal, speaking: speakingIds.has(p.identity), camera: p.identity in cameras, ...liveFlags(p, p.isLocal ? deaf : undefined) }));
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
  const signature = JSON.stringify({ connection, people, streams: streams.map((s) => [s.sid, s.watching, s.hasAudio, Boolean(s.track)]), cameras: Object.entries(cameras).map(([id, ref]) => [id, ref.publication.trackSid, Boolean(ref.publication.track)]), deaf, volumes, facing, cameraBusy });

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
  // Uma ação de câmera por vez: toque duplo não abre a câmera duas vezes.
  const withCamera = useCallback(async (action: () => Promise<void>, onError: (error: unknown) => void) => {
    if (cameraBusyRef.current) return;
    cameraBusyRef.current = true;
    setCameraBusy(true);
    try {
      await action();
    } catch (error) {
      onError(error);
    } finally {
      cameraBusyRef.current = false;
      setCameraBusy(false);
    }
  }, []);
  const toggleCamera = useCallback(() => {
    const lp = room.localParticipant;
    void withCamera(async () => {
      if (lp.isCameraEnabled) { await lp.setCameraEnabled(false); return; }
      if (!(await ensureCameraPermission())) { reportCameraProblem('denied'); return; }
      await lp.setCameraEnabled(true, { facingMode: facing, resolution: CAMERA_CAPTURE });
    }, (error) => reportCameraProblem(cameraProblem(error)));
  }, [room, facing, withCamera]);
  // Vira entre a câmera frontal e a traseira sem desligar: a faixa publicada é reiniciada com a outra câmera.
  const flipCamera = useCallback(() => {
    const track = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
    if (!(track instanceof LocalVideoTrack) || !room.localParticipant.isCameraEnabled) return;
    const next = otherFacing(facing);
    void withCamera(async () => {
      try {
        await track.restartTrack({ facingMode: next, resolution: CAMERA_CAPTURE });
        setFacing(next);
      } catch (error) {
        // a faixa antiga já foi parada para abrir a nova: volta para a câmera de antes para o vídeo não ficar congelado
        await track.restartTrack({ facingMode: facing, resolution: CAMERA_CAPTURE }).catch(() => {});
        throw error;
      }
    }, (error) => {
      const problem = cameraProblem(error);
      reportCameraProblem(problem, flipProblemMessage(problem, next, Platform.OS));
    });
  }, [room, facing, withCamera]);
  const toggleDeaf = useCallback(() => setDeaf((d) => !d), []);
  const watchStream = useCallback((sid: string, on: boolean) => setWatch((prev) => setWatching(prev, sid, on)), []);
  const changeVolume = useCallback((personId: string, direction: 1 | -1) => setVolumes((prev) => ({ ...prev, [personId]: stepVolume(prev[personId] ?? 1, direction) })), []);

  useEffect(() => {
    onLive({ connection, people, streams, deaf, muted: me?.muted ?? false, sharing: me?.sharing ?? false, camera: me?.camera ?? false, cameraBusy, facing, cameras, volumes, toggleMic, toggleDeaf, toggleScreen, toggleCamera, flipCamera, watch: watchStream, changeVolume });
    // só republica quando algo que a tela mostra mudou
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return null;
}
