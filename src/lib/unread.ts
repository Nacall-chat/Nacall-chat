/** Mensagens não lidas das conversas diretas (DMs): contagem, prévia e quando tocar o som de aviso. */
export type UnreadDm = { dm_id: string; unread: number; last_at: string; last_kind: string; last_body: string };

/** Número que cabe na bolinha vermelha. */
export const badgeText = (count: number) => (count > 99 ? '99+' : String(Math.max(0, Math.floor(count))));

/** Texto curto da última mensagem no sino: áudio e figurinha não têm texto, então ganham um rótulo. */
export function previewOf(kind: string, body: string, max = 80): string {
  if (kind === 'audio') return 'Mensagem de áudio';
  if (kind === 'sticker') return 'Figurinha';
  const text = body.replace(/\s+/g, ' ').trim();
  if (!text) return 'Nova mensagem';
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export const unreadTotal = (list: UnreadDm[]) => list.reduce((sum, item) => sum + item.unread, 0);

/** A conversa que a pessoa está olhando agora não conta como não lida: ela já está vendo. */
export const withoutOpen = (list: UnreadDm[], openDm: string | null, attentive: boolean) => (openDm && attentive ? list.filter(item => item.dm_id !== openDm) : list);

/** DMs que ganharam mensagens desde a última leitura. É o que dispara o som; a primeira carga (sem leitura anterior) nunca toca. */
export function arrivedDms(previous: UnreadDm[] | null, next: UnreadDm[]): string[] {
  if (!previous) return [];
  const before = new Map(previous.map(item => [item.dm_id, item.unread]));
  return next.filter(item => item.unread > (before.get(item.dm_id) ?? 0)).map(item => item.dm_id);
}

export const sameUnread = (a: UnreadDm[], b: UnreadDm[]) => a.length === b.length && a.every((item, i) => item.dm_id === b[i].dm_id && item.unread === b[i].unread && item.last_at === b[i].last_at);

/** "agora", "há 5 min", "há 3 h" ou a data, para a lista do sino. */
export function ago(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return new Date(iso).toLocaleDateString('pt-BR');
}
