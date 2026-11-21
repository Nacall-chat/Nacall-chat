import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { effectiveVolume, IOS_SCREEN_SHARE_MESSAGE, screenShareSupport, stepVolume, volumeLabel } from '@/features/call/logic';
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
    expect(manifest).toMatch(/foregroundServiceType="microphone"/);
    expect(manifest).toMatch(/FOREGROUND_SERVICE_MICROPHONE/);
    const service = read('modules/nacall-call-service/android/src/main/java/app/nacall/callservice/CallForegroundService.kt');
    expect(service).toMatch(/FOREGROUND_SERVICE_TYPE_MICROPHONE/);
    expect(service).toMatch(/onTaskRemoved/);
    const call = read('src/features/call/call.tsx');
    expect(call).toMatch(/startCallService\(session\.name\)/);
    expect(call).toMatch(/return \(\) => stopCallService\(\)/);
    expect(JSON.parse(read('app.json')).expo.ios.infoPlist.UIBackgroundModes).toContain('audio');
    expect(read('../../.github/workflows/mobile-apk.yml')).toMatch(/apps\/mobile\/modules\/\*\*/);
  });
});
