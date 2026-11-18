import { UPDATE_ID } from './novidades';

/**
 * Avisos do NACALL no sino: o que mudou em cada atualização. Para avisar todo mundo de uma atualização nova,
 * acrescente um item no topo desta lista (o `id` precisa ser único e nunca mudar). Quem ainda não viu ganha a bolinha no sino.
 * `slides: true` mostra o botão que reabre o carrossel de novidades (src/lib/novidades.ts).
 */
export type Aviso = { id: string; date: string; title: string; text: string; slides?: boolean };
export const avisos: Aviso[] = [
  { id: '2026-11-19-baloes-e-avisos', date: '2026-11-19', title: 'Balões e avisos de mensagem', text: 'Suas mensagens ficam à direita e mais claras. Quando alguém te escreve aparece uma bolinha vermelha, o sino avisa e toca um som.' },
  { id: '2026-11-18-barra-de-voz', date: '2026-11-18', title: 'Barra de voz', text: 'Microfone, fone e sair ficam sempre no mesmo lugar, em qualquer tela. Toque na barra para abrir a call.' },
  { id: UPDATE_ID, date: '2026-11-19', title: 'Áudio, emojis e figurinhas', text: 'Mande áudios, escolha entre mais de 1.800 emojis e monte sua coleção de figurinhas.', slides: true },
];

export const avisosKey = (userId: string) => `nacall:avisos:${userId}`;

export function parseAvisosRead(raw: string | null): string[] {
  try {
    const value = JSON.parse(raw ?? '[]') as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 200) : [];
  } catch { return []; }
}

/** Avisos que a pessoa ainda não viu. */
export const unreadAvisos = (read: string[], list: Aviso[] = avisos) => list.filter(aviso => !read.includes(aviso.id));

export const withRead = (read: string[], ids: string[]) => [...new Set([...read, ...ids])].slice(-200);

/**
 * Acompanha a versão publicada em /api/version. A primeira resposta vira a versão desta aba; se uma resposta seguinte for diferente, saiu uma versão nova.
 * Não depende de variável de build: a Esteira publica com a CLI da Vercel, que não leva o hash do commit para dentro do app.
 * Resposta vazia (desenvolvimento, sem versão) nunca avisa.
 */
export function trackVersion(baseline: string, latest: string): { baseline: string; update: boolean } {
  if (!latest) return { baseline, update: false };
  if (!baseline) return { baseline: latest, update: false };
  return { baseline, update: latest !== baseline };
}

const SOUND_KEY = 'nacall:aviso-som';
/** O som de aviso vem ligado; só desliga se a pessoa desligou. */
export const parseSound = (raw: string | null) => raw !== '0';
export const soundKey = SOUND_KEY;
