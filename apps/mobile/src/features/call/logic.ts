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
