/** O que a lista de salas mostra ao lado de cada pessoa: está transmitindo, microfone fechado, sem ouvir a call. */
export type PersonFlags = { sharing: boolean; muted: boolean; deaf: boolean };

/** Ids de origem das faixas no protocolo do LiveKit (conferidos contra o enum do servidor nos testes). */
export const TRACK_SOURCE = { CAMERA: 1, MICROPHONE: 2, SCREEN_SHARE: 3, SCREEN_SHARE_AUDIO: 4 } as const;

/** Atributo do participante em que cada pessoa avisa que fechou o áudio da call (o LiveKit não tem "fone mudo"). */
export const DEAF_ATTRIBUTE = 'deaf';

type ServerInfo = { tracks?: { source: number; muted: boolean }[]; attributes?: Record<string, string> };

/** Lê os três sinais de um participante a partir do que o servidor do LiveKit informa (lista de salas). */
export function personFlags(info: ServerInfo): PersonFlags {
  const tracks = info.tracks ?? [];
  const mic = tracks.find(t => t.source === TRACK_SOURCE.MICROPHONE);
  return {
    sharing: tracks.some(t => t.source === TRACK_SOURCE.SCREEN_SHARE),
    muted: !mic || mic.muted,
    deaf: info.attributes?.[DEAF_ATTRIBUTE] === '1',
  };
}

type LiveInfo = { isScreenShareEnabled: boolean; isMicrophoneEnabled: boolean; attributes?: Record<string, string> };

/** O mesmo, mas lido direto do cliente LiveKit de quem já está na sala (muda na hora, sem esperar a consulta). */
export function liveFlags(p: LiveInfo, deafOverride?: boolean): PersonFlags {
  return {
    sharing: p.isScreenShareEnabled,
    muted: !p.isMicrophoneEnabled,
    deaf: deafOverride ?? p.attributes?.[DEAF_ATTRIBUTE] === '1',
  };
}

/** Sinais mostrados para uma pessoa: os ao vivo (quando ela está na sua call) ou os da última consulta. */
export function shownFlags(person: Partial<PersonFlags>, live?: PersonFlags): PersonFlags {
  return live ?? { sharing: Boolean(person.sharing), muted: Boolean(person.muted), deaf: Boolean(person.deaf) };
}

/** Chave estável para só avisar a tela quando algum sinal mudou. */
export function flagsKey(map: Record<string, PersonFlags>): string {
  return Object.keys(map).sort().map(id => `${id}:${map[id].sharing ? 1 : 0}${map[id].muted ? 1 : 0}${map[id].deaf ? 1 : 0}`).join(',');
}
