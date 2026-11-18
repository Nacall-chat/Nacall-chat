/** Microfone e saída de áudio escolhidos pela pessoa: preferência salva neste navegador e regras da janela de permissão. */
export type MicPermission = 'granted' | 'prompt' | 'denied' | 'unknown';
export type MicPrefs = { inputId: string; outputId: string; setupDone: boolean };
export const micPrefsDefault: MicPrefs = { inputId: '', outputId: '', setupDone: false };
const KEY = 'nacall-mic';

export function parseMicPrefs(raw: string | null): MicPrefs {
  try {
    const value = JSON.parse(raw ?? '{}') as Partial<MicPrefs> | null;
    const text = (v: unknown) => (typeof v === 'string' ? v.slice(0, 512) : '');
    return { inputId: text(value?.inputId), outputId: text(value?.outputId), setupDone: value?.setupDone === true };
  } catch { return { ...micPrefsDefault }; }
}
export function readMicPrefs(): MicPrefs {
  try { return parseMicPrefs(localStorage.getItem(KEY)); } catch { return { ...micPrefsDefault }; }
}
export function saveMicPrefs(patch: Partial<MicPrefs>): MicPrefs {
  const next = { ...readMicPrefs(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* sem armazenamento: vale só nesta aba */ }
  return next;
}

/** Estado da permissão do microfone. Navegadores sem a Permissions API para o microfone devolvem "unknown". */
export async function micPermission(): Promise<MicPermission> {
  try {
    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return status.state === 'granted' || status.state === 'denied' || status.state === 'prompt' ? status.state : 'unknown';
  } catch { return 'unknown'; }
}

/** Traduz o erro do navegador em uma mensagem que diz o que fazer. */
export function microphoneError(error: unknown): Error {
  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return new Error('O navegador bloqueou o microfone. Libere a permissão no cadeado da barra de endereço e tente de novo.');
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return new Error('Nenhum microfone foi encontrado neste dispositivo.');
  if (name === 'NotReadableError' || name === 'AbortError') return new Error('Não consegui abrir o microfone. Ele pode estar em uso por outro programa.');
  return new Error('Não foi possível iniciar a gravação. Tente de novo.');
}

export type MicStage = 'skip' | 'ask' | 'choose' | 'blocked';
/**
 * O que mostrar antes de usar o microfone:
 * - skip: já liberado e já escolhido, não pergunta nada (call e áudio entram direto);
 * - choose: liberado, mas a pessoa ainda não escolheu o aparelho;
 * - ask: ainda não liberado, mostra a janela do NACALL e depois o aviso do navegador;
 * - blocked: o navegador bloqueou, explica como desbloquear.
 */
export function micStage(permission: MicPermission, prefs: MicPrefs): MicStage {
  if (permission === 'denied') return 'blocked';
  if (permission === 'granted') return prefs.setupDone ? 'skip' : 'choose';
  if (permission === 'prompt') return 'ask';
  return prefs.setupDone ? 'skip' : 'ask';
}

export type AudioDevice = { id: string; label: string };
type RawDevice = { kind: string; deviceId: string; label: string };
/** Lista legível de entradas ou saídas: sem os atalhos duplicados do Chrome e com nome mesmo antes da permissão. */
export function buildDeviceList(devices: RawDevice[], kind: 'audioinput' | 'audiooutput'): AudioDevice[] {
  const base = kind === 'audioinput' ? 'Microfone' : 'Saída de áudio';
  const list = devices.filter(d => d.kind === kind && d.deviceId !== 'communications');
  const withDefaultFirst = [...list.filter(d => d.deviceId === 'default'), ...list.filter(d => d.deviceId !== 'default')];
  return withDefaultFirst.map((d, index) => ({ id: d.deviceId, label: d.deviceId === 'default' && !d.label ? 'Padrão do sistema' : d.label.trim() || `${base} ${index + 1}` }));
}
/** Mantém o aparelho salvo se ele ainda existe; senão, o padrão do sistema ou o primeiro da lista. */
export function pickDevice(list: AudioDevice[], savedId: string): string {
  if (savedId && list.some(d => d.id === savedId)) return savedId;
  return list.find(d => d.id === 'default')?.id ?? list[0]?.id ?? '';
}
/** Restrição para getUserMedia: o aparelho escolhido é "ideal", então se ele sumiu o navegador usa o padrão. */
export const micConstraint = (inputId: string): MediaTrackConstraints => (inputId ? { deviceId: { ideal: inputId } } : {});

export async function listAudioDevices() {
  const devices = (await navigator.mediaDevices.enumerateDevices()) as RawDevice[];
  return { inputs: buildDeviceList(devices, 'audioinput'), outputs: buildDeviceList(devices, 'audiooutput') };
}
export const outputSelectionSupported = () => typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;

/** WAV curto (tom de teste da saída de áudio), gerado na hora: 16 bits, mono. */
export function toneWav(ms = 450, frequency = 523, rate = 22050): Uint8Array {
  const samples = Math.round((rate * ms) / 1000);
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); text(8, 'WAVE'); text(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) {
    const fade = Math.min(1, i / 400, (samples - i) / 400); // entrada e saída suaves para não estalar
    view.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * frequency * i) / rate) * 9000 * fade), true);
  }
  return bytes;
}
