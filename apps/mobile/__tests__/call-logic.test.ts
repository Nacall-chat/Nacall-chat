import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CAMERA_CAPTURE,
  CAMERA_FAILED_MESSAGE,
  CAMERA_FLIP_FAILED_MESSAGE,
  CAMERA_IN_USE_MESSAGE,
  CAMERA_UNAVAILABLE_MESSAGE,
  cameraDeniedMessage,
  cameraProblem,
  cameraProblemMessage,
  effectiveVolume,
  facingLabel,
  flipProblemMessage,
  IOS_SCREEN_SHARE_MESSAGE,
  otherFacing,
  screenShareSupport,
  stepVolume,
  volumeLabel,
} from '@/features/call/logic';
import { liveCamera } from '@nacall/core/camera';
import { isCurrentCall } from '@nacall/core/call-session';
import { DEAF_ATTRIBUTE, liveFlags } from '@nacall/core/room-people';
import { isWatching, reconcileScreenSubscriptions, setWatching } from '@nacall/core/stream';

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');

describe('transmitir a tela no celular', () => {
  it('o Android transmite; o iPhone só assiste (e avisa por quê)', () => {
    expect(screenShareSupport('android')).toEqual({ ok: true });
    expect(screenShareSupport('ios')).toEqual({ ok: false, message: IOS_SCREEN_SHARE_MESSAGE });
    const web = screenShareSupport('web');
    expect(web.ok).toBe(false);
  });
});

describe('volume da transmissão', () => {
  it('sobe e desce de 25 em 25% e não sai da faixa', () => {
    expect(stepVolume(1, -1)).toBe(0.75);
    expect(stepVolume(0.75, -1)).toBe(0.5);
    expect(stepVolume(0, -1)).toBe(0);
    expect(stepVolume(1, 1)).toBe(1);
    expect(stepVolume(0.5, 1)).toBe(0.75);
  });
  it('mostra em porcentagem', () => {
    expect(volumeLabel(0.75)).toBe('75%');
    expect(volumeLabel(2)).toBe('100%');
  });
  it('com o fone mudo tudo vai a zero', () => {
    expect(effectiveVolume(true, 1)).toBe(0);
    expect(effectiveVolume(false, 0.5)).toBe(0.5);
  });
});

describe('regras compartilhadas com o site', () => {
  it('só assiste quem clicou em Assistir (o celular nunca abre a transmissão sozinho)', () => {
    expect(isWatching({}, 'TR_1', false)).toBe(false);
    expect(isWatching(setWatching({}, 'TR_1', true), 'TR_1', false)).toBe(true);
  });
  it('sem Assistir, vídeo e áudio da tela são desligados', () => {
    const pub = (subscribed: boolean) => ({ isSubscribed: subscribed, calls: [] as boolean[], setSubscribed(v: boolean) { this.calls.push(v); this.isSubscribed = v; } });
    const screen = { ...pub(true), trackSid: 'TR_1' };
    const audio = pub(true);
    reconcileScreenSubscriptions([{ screen, audio }], {});
    expect(screen.calls).toEqual([false]);
    expect(audio.calls).toEqual([false]);
  });
  it('o fone mudo vai no mesmo atributo que o site lê', () => {
    expect(DEAF_ATTRIBUTE).toBe('deaf');
    expect(liveFlags({ isScreenShareEnabled: false, isMicrophoneEnabled: true, attributes: { deaf: '1' } }).deaf).toBe(true);
  });
  it('o aviso de saída da sala antiga não derruba a call nova', () => {
    expect(isCurrentCall({ channelId: 'B' }, 'A')).toBe(false);
    expect(isCurrentCall({ channelId: 'A' }, 'A')).toBe(true);
  });
});

describe('câmera do celular na call', () => {
  it('vira entre a frontal e a traseira', () => {
    expect(otherFacing('user')).toBe('environment');
    expect(otherFacing('environment')).toBe('user');
    expect(facingLabel('user')).toBe('frontal');
    expect(facingLabel('environment')).toBe('traseira');
  });

  it('reconhece permissão negada, câmera inexistente, câmera ocupada e o resto (o WebRTC rejeita com objeto simples, não com Error)', () => {
    expect(cameraProblem({ name: 'SecurityError', message: 'Permission denied.' })).toBe('denied');
    expect(cameraProblem(new DOMException('x', 'NotAllowedError'))).toBe('denied');
    expect(cameraProblem({ name: 'NotFoundError', message: 'Requested device not found' })).toBe('unavailable');
    expect(cameraProblem(new Error('OverconstrainedError: facingMode'))).toBe('unavailable');
    expect(cameraProblem({ name: 'NotReadableError', message: 'Could not start video source' })).toBe('in-use');
    expect(cameraProblem({ name: 'AbortError' })).toBe('in-use');
    expect(cameraProblem(new Error('algo inesperado'))).toBe('failed');
    expect(cameraProblem(undefined)).toBe('failed');
    expect(cameraProblem('Permission denied')).toBe('denied');
  });

  it('mostra a mensagem em português de cada problema, com o caminho certo nos ajustes de cada sistema', () => {
    expect(cameraProblemMessage('unavailable', 'android')).toBe(CAMERA_UNAVAILABLE_MESSAGE);
    expect(cameraProblemMessage('in-use', 'android')).toBe(CAMERA_IN_USE_MESSAGE);
    expect(cameraProblemMessage('failed', 'android')).toBe(CAMERA_FAILED_MESSAGE);
    expect(cameraProblemMessage('denied', 'android')).toBe(cameraDeniedMessage('android'));
    expect(cameraDeniedMessage('android')).toMatch(/Ajustes do celular > Apps > NACALL > Permissões > Câmera/);
    expect(cameraDeniedMessage('ios')).toMatch(/Ajustes do iPhone > NACALL > Câmera/);
  });

  it('ao virar a câmera, "indisponível" diz qual câmera falta', () => {
    expect(flipProblemMessage('unavailable', 'environment', 'android')).toBe('Este aparelho não tem uma câmera traseira disponível.');
    expect(flipProblemMessage('unavailable', 'user', 'ios')).toBe('Este aparelho não tem uma câmera frontal disponível.');
    expect(flipProblemMessage('failed', 'user', 'android')).toBe(CAMERA_FLIP_FAILED_MESSAGE);
    expect(flipProblemMessage('denied', 'user', 'ios')).toBe(cameraDeniedMessage('ios'));
  });

  it('captura leve (o celular esquenta e o plano de dados é curto)', () => {
    expect(CAMERA_CAPTURE.width * CAMERA_CAPTURE.height).toBeLessThanOrEqual(1280 * 720);
    expect(CAMERA_CAPTURE.frameRate).toBeLessThanOrEqual(30);
  });

  it('só conta como câmera ligada a faixa que não está muda (a mesma regra do site)', () => {
    const on = { participant: { identity: 'ana' }, publication: { isMuted: false } };
    const off = { participant: { identity: 'bia' }, publication: { isMuted: true } };
    const placeholder = { participant: { identity: 'caio' } };
    expect(liveCamera([on, off, placeholder], 'ana')).toBe(on);
    expect(liveCamera([on, off, placeholder], 'bia')).toBeUndefined();
    expect(liveCamera([on, off, placeholder], 'caio')).toBeUndefined();
  });
});

describe('configuração do app', () => {
  const app = JSON.parse(read('app.json')).expo;
  it('pede microfone e o serviço de captura de tela no Android', () => {
    expect(app.android.permissions).toEqual(expect.arrayContaining([
      'android.permission.RECORD_AUDIO',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
    ]));
  });
  it('registra os plugins do LiveKit com o serviço de transmissão ligado', () => {
    const plugins = app.plugins as (string | [string, Record<string, unknown>])[];
    const livekit = plugins.find((p) => Array.isArray(p) && p[0] === '@livekit/react-native-expo-plugin') as [string, { android: { enableScreenShareService: boolean } }];
    expect(livekit[1].android.enableScreenShareService).toBe(true);
    expect(plugins.some((p) => (Array.isArray(p) ? p[0] : p) === '@config-plugins/react-native-webrtc')).toBe(true);
  });
  it('a sala vive no provedor, a barra aparece fora da tela da call e entrar em outra sala troca de call', () => {
    const layout = read('src/app/(app)/_layout.tsx');
    expect(layout).toMatch(/<CallProvider>/);
    expect(layout).toMatch(/<CallBar \/>/);
    expect(layout).toMatch(/name="call"/);
    const drawer = read('src/features/nav/drawer-panel.tsx');
    expect(drawer).not.toMatch(/chega ao app numa próxima fase/);
    expect(drawer).toMatch(/void join\(\{ id: c\.id, name: c\.name \}\)/);
    const call = read('src/features/call/call.tsx');
    expect(call).toMatch(/key=\{session\.channelId\}/);
    expect(call).toMatch(/registerGlobals\(\)/);
  });

  it('a call continua em segundo plano: serviço em primeiro plano do tipo microfone, ligado e desligado com a call', () => {
    const manifest = read('modules/nacall-call-service/android/src/main/AndroidManifest.xml');
    expect(manifest).toMatch(/foregroundServiceType="microphone(\|camera)?"/);
    expect(manifest).toMatch(/FOREGROUND_SERVICE_MICROPHONE/);
    const service = read('modules/nacall-call-service/android/src/main/java/app/nacall/callservice/CallForegroundService.kt');
    expect(service).toMatch(/FOREGROUND_SERVICE_TYPE_MICROPHONE/);
    expect(service).toMatch(/onTaskRemoved/);
    const call = read('src/features/call/call.tsx');
    expect(call).toMatch(/startCallService\(session\.name, cameraOn\)/);
    expect(call).toMatch(/return \(\) => stopCallService\(\)/);
    expect(JSON.parse(read('app.json')).expo.ios.infoPlist.UIBackgroundModes).toContain('audio');
    expect(read('../../.github/workflows/mobile-apk.yml')).toMatch(/apps\/mobile\/modules\/\*\*/);
  });

  it('a câmera: permissão e serviço em primeiro plano do tipo câmera no Android, texto de uso no iPhone', () => {
    expect(app.android.permissions).toEqual(expect.arrayContaining([
      'android.permission.CAMERA',
      'android.permission.FOREGROUND_SERVICE_CAMERA',
    ]));
    const plugins = app.plugins as (string | [string, Record<string, string>])[];
    const options = (name: string) => (plugins.find((p) => Array.isArray(p) && p[0] === name) as [string, Record<string, string>])[1];
    // o iPhone só abre a câmera com o texto de uso: o mesmo texto nos dois plugins que escrevem a chave, sem cair no padrão em inglês
    expect(options('@config-plugins/react-native-webrtc').cameraPermission).toMatch(/câmera/);
    expect(options('expo-image-picker').cameraPermission).toBe(options('@config-plugins/react-native-webrtc').cameraPermission);

    const manifest = read('modules/nacall-call-service/android/src/main/AndroidManifest.xml');
    expect(manifest).toMatch(/foregroundServiceType="microphone\|camera"/);
    expect(manifest).toMatch(/FOREGROUND_SERVICE_CAMERA/);
    const service = read('modules/nacall-call-service/android/src/main/java/app/nacall/callservice/CallForegroundService.kt');
    expect(service).toMatch(/FOREGROUND_SERVICE_TYPE_CAMERA/);
    // o tipo câmera exige a permissão já liberada, e se falhar a call segue só com o microfone
    expect(service).toMatch(/checkSelfPermission\(Manifest\.permission\.CAMERA\)/);
    expect(service).toMatch(/catch \(e: Exception\)/);
    expect(read('modules/nacall-call-service/android/src/main/java/app/nacall/callservice/NacallCallServiceModule.kt')).toMatch(/camera: Boolean/);
  });

  it('a câmera na call: botão na barra, liga/desliga e vira pelo LiveKit, vídeo nos cartões e avatar sem câmera', () => {
    const call = read('src/features/call/call.tsx');
    expect(call).toMatch(/setCameraEnabled\(true, \{ facingMode: facing, resolution: CAMERA_CAPTURE \}\)/);
    expect(call).toMatch(/setCameraEnabled\(false\)/);
    expect(call).toMatch(/restartTrack\(\{ facingMode: next/);
    expect(call).toMatch(/PermissionsAndroid\.PERMISSIONS\.CAMERA/);
    expect(call).toMatch(/Linking\.openSettings/);
    expect(call).toMatch(/startCallService\(session\.name, cameraOn\)/);
    // trocar o tipo do serviço não pode parar e religar o serviço: parar só ao sair da call
    expect(call).toMatch(/useEffect\(\(\) => \{\s*if \(!session\) return;\s*return \(\) => stopCallService\(\);\s*\}, \[session\]\)/);
    const controls = read('src/features/call/call-controls.tsx');
    expect(controls).toMatch(/Desligar a câmera/);
    expect(controls).toMatch(/Ligar a câmera/);
    expect(controls).toMatch(/live\?\.toggleCamera\(\)/);
    const screen = read('src/features/call/call-screen.tsx');
    expect(screen).toMatch(/<VideoTrack trackRef=\{track\}/);
    expect(screen).toMatch(/live\.flipCamera\(\)/);
    expect(screen).toMatch(/<Avatar profile=\{profiles\[person\.id\]\}/);
  });
});
