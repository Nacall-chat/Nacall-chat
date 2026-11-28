/** Status de presença entre amigos: o servidor calcula online/ausente/offline; aqui ficam os rótulos e os cálculos de tempo. */
export type PresenceState = 'online' | 'away' | 'offline';
export type PresenceStatus = 'online' | 'away' | 'invisible';
export type FriendPresence = { user_id: string; state: PresenceState; last_seen_at: string | null; server_now: string };
export type PresenceInfo = { state: PresenceState; lastSeenAt: string | null; serverNow: string | null; fetchedAt: number };
/** Linha de server_presence(): só quem está online ou ausente no servidor aberto (sem "visto por último", que é só entre amigos). */
export type ServerPresence = { user_id: string; state: 'online' | 'away' };

export const HEARTBEAT_MS = 45000;
export const IDLE_AFTER_MS = 5 * 60 * 1000;

export const stateLabel: Record<PresenceState, string> = { online: 'Online', away: 'Ausente', offline: 'Offline' };
export const statusLabel: Record<PresenceStatus, string> = { online: 'Online', away: 'Ausente', invisible: 'Invisível' };
export const statusHint: Record<PresenceStatus, string> = { online: 'Seus amigos veem que você está aqui.', away: 'Aparece como ausente para seus amigos.', invisible: 'Você usa o NACALL, mas aparece offline.' };
export const isPresenceStatus = (value: unknown): value is PresenceStatus => value === 'online' || value === 'away' || value === 'invisible';

/** Sem atividade (mouse, teclado ou toque) há tempo demais: conta como ausente. */
export const isIdle = (lastActivity: number, now: number, limit = IDLE_AFTER_MS) => now - lastActivity >= limit;

const order: Record<PresenceState, number> = { online: 0, away: 1, offline: 2 };
export const presenceOrder = (state: PresenceState) => order[state];

/** O que mostrar de quem não está na lista (nunca entrou, não é amigo): offline sem hora. */
export const offlineInfo: PresenceInfo = { state: 'offline', lastSeenAt: null, serverNow: null, fetchedAt: 0 };

/** Linhas de server_presence() viram um mapa id → estado; valor inesperado é ignorado (conta como offline). */
export function toServerStates(rows: ServerPresence[]): Record<string, PresenceState> {
  return Object.fromEntries(rows.filter(row => row.state === 'online' || row.state === 'away').map(row => [row.user_id, row.state]));
}

/**
 * Bolinha de um membro na lista do servidor: você mesmo mostra o status que escolheu; amigos usam a presença de amigos
 * (que já vem completa); os demais membros usam a presença do servidor, e quem não veio nela está offline.
 */
export function memberState(id: string, me: string, mine: PresenceStatus, friends: Record<string, PresenceInfo>, server: Record<string, PresenceState>): PresenceState | 'invisible' {
  if (id === me) return mine;
  return friends[id]?.state ?? server[id] ?? 'offline';
}

export function toInfo(row: FriendPresence, fetchedAt: number): PresenceInfo {
  return { state: row.state, lastSeenAt: row.last_seen_at, serverNow: row.server_now, fetchedAt };
}

/**
 * "há 30 min", "há 3 h", "ontem"... A conta usa a hora do servidor (a do aparelho pode estar errada),
 * somando só o tempo que passou aqui desde a consulta.
 */
export function sinceLabel(info: PresenceInfo, now = Date.now()): string {
  if (!info.lastSeenAt || !info.serverNow) return 'ainda não entrou';
  const elapsed = Math.max(0, new Date(info.serverNow).getTime() - new Date(info.lastSeenAt).getTime() + (info.fetchedAt ? Math.max(0, now - info.fetchedAt) : 0));
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return 'agora há pouco';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ontem';
  if (days < 30) return `há ${days} dias`;
  return new Date(info.lastSeenAt).toLocaleDateString('pt-BR');
}

/** Linha de apoio do cartão: "Online agora" ou "Visto pela última vez há 30 min". */
export function presenceLine(info: PresenceInfo, now = Date.now()): string {
  if (info.state === 'online') return 'Online agora';
  if (info.state === 'away') return 'Ausente';
  return info.lastSeenAt ? `Visto pela última vez ${sinceLabel(info, now)}` : 'Ainda não entrou';
}
