import { clampVolume } from '@nacall/core/stream';

/** Regras da call no celular que não dependem do LiveKit (por isso podem ser testadas sem o aparelho). */

export const MIC_DENIED_MESSAGE = 'O NACALL precisa do microfone para você falar na call. Libere em Ajustes do celular > Apps > NACALL > Permissões.';
export const IOS_SCREEN_SHARE_MESSAGE = 'Transmitir a tela no iPhone chega numa próxima versão (o iOS exige uma extensão própria). No Android já dá para transmitir, e no iPhone você assiste normalmente.';
export const OTHER_SCREEN_SHARE_MESSAGE = 'Este aparelho não permite compartilhar a tela pelo NACALL.';

/** Quem pode transmitir a tela: o Android (captura de tela do sistema). No iPhone só assiste, por enquanto. */
export function screenShareSupport(os: string): { ok: true } | { ok: false; message: string } {
  if (os === 'android') return { ok: true };
  return { ok: false, message: os === 'ios' ? IOS_SCREEN_SHARE_MESSAGE : OTHER_SCREEN_SHARE_MESSAGE };
}

/** O volume da transmissão sobe e desce de 25 em 25% (o celular não tem o controle deslizante do site). */
export function stepVolume(current: number, direction: 1 | -1): number {
  return clampVolume(Math.round((clampVolume(current) + direction * 0.25) * 4) / 4);
}

export function volumeLabel(value: number): string {
  return `${Math.round(clampVolume(value) * 100)}%`;
}

/** Volume que de fato vai para o alto-falante: com o áudio da call fechado (fone mudo) tudo fica em zero. */
export function effectiveVolume(deaf: boolean, wanted: number): number {
  return deaf ? 0 : clampVolume(wanted);
}

export type StreamItem = { sid: string; personId: string; name: string; isLocal: boolean; watching: boolean; hasAudio: boolean };

/** Câmera do celular: frontal ("user") ou traseira ("environment"), os mesmos nomes do WebRTC. */
export type Facing = 'user' | 'environment';

export function otherFacing(current: Facing): Facing {
  return current === 'user' ? 'environment' : 'user';
}

export function facingLabel(facing: Facing): string {
  return facing === 'user' ? 'frontal' : 'traseira';
}

/** Qualidade da câmera na call: leve o bastante para o plano de dados e para o celular não esquentar. */
export const CAMERA_CAPTURE = { width: 960, height: 540, frameRate: 24 } as const;

/** O que pode dar errado ao ligar ou virar a câmera. */
export type CameraProblem = 'denied' | 'unavailable' | 'in-use' | 'failed';

export const CAMERA_UNAVAILABLE_MESSAGE = 'Não encontramos uma câmera disponível neste aparelho.';
export const CAMERA_IN_USE_MESSAGE = 'A câmera está sendo usada por outro app. Feche o outro app e tente de novo.';
export const CAMERA_FAILED_MESSAGE = 'Não deu para ligar a câmera. Tente de novo; se continuar, saia da call e entre outra vez.';
export const CAMERA_FLIP_FAILED_MESSAGE = 'Não deu para virar a câmera. Tente de novo.';

/** Onde a pessoa libera a câmera depois de negar: o caminho muda entre o Android e o iPhone. */
export function cameraDeniedMessage(os: string): string {
  const where = os === 'ios' ? 'Ajustes do iPhone > NACALL > Câmera' : 'Ajustes do celular > Apps > NACALL > Permissões > Câmera';
  return `O NACALL precisa da câmera para mostrar seu vídeo na call. Libere em ${where}.`;
}

/**
 * Lê o erro de abrir a câmera. O WebRTC do celular rejeita com um objeto simples ({ name, message }), não com `Error`,
 * então aqui só se olha `name` e `message`: permissão negada, sem câmera, câmera ocupada ou qualquer outra coisa.
 */
export function cameraProblem(error: unknown): CameraProblem {
  const info = (error && typeof error === 'object' ? error : {}) as { name?: unknown; message?: unknown };
  const text = `${typeof info.name === 'string' ? info.name : ''} ${typeof info.message === 'string' ? info.message : (typeof error === 'string' ? error : '')}`;
  if (/security|notallowed|permission|denied/i.test(text)) return 'denied';
  if (/notfound|not found|no camera|no video|overconstrained|requested device|device not found/i.test(text)) return 'unavailable';
  if (/notreadable|trackstart|could not start|in use|busy|abort/i.test(text)) return 'in-use';
  return 'failed';
}

export function cameraProblemMessage(problem: CameraProblem, os: string): string {
  if (problem === 'denied') return cameraDeniedMessage(os);
  if (problem === 'unavailable') return CAMERA_UNAVAILABLE_MESSAGE;
  if (problem === 'in-use') return CAMERA_IN_USE_MESSAGE;
  return CAMERA_FAILED_MESSAGE;
}

/** Ao virar a câmera, "indisponível" quer dizer que falta aquela câmera (a outra segue funcionando). */
export function flipProblemMessage(problem: CameraProblem, target: Facing, os: string): string {
  if (problem === 'unavailable') return `Este aparelho não tem uma câmera ${facingLabel(target)} disponível.`;
  if (problem === 'failed') return CAMERA_FLIP_FAILED_MESSAGE;
  return cameraProblemMessage(problem, os);
}
