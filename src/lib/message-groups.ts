/**
 * Ritmo de leitura da conversa (site e app usam esta mesma regra, via `@nacall/core/message-groups`):
 * - mensagens seguidas da mesma pessoa, com menos de 5 minutos entre elas, formam um grupo (só a primeira mostra foto, nome e hora);
 * - quando o dia muda, aparece um separador com a data.
 */
export const GROUP_WINDOW_MS = 5 * 60 * 1000;

type Stamped = { author_id: string; created_at: string };

const dayKey = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };

/** `prev` é a mensagem imediatamente anterior no tempo (ou undefined para a primeira da lista). */
export function messageLayout(prev: Stamped | undefined, cur: Stamped): { newDay: boolean; grouped: boolean } {
  const newDay = !prev || dayKey(prev.created_at) !== dayKey(cur.created_at);
  const gap = prev ? new Date(cur.created_at).getTime() - new Date(prev.created_at).getTime() : Infinity;
  const grouped = !newDay && prev!.author_id === cur.author_id && gap >= 0 && gap < GROUP_WINDOW_MS;
  return { newDay, grouped };
}

/** "Hoje", "Ontem" ou a data por extenso (com o ano só quando não é o atual). */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${d.getDate()} de ${months[d.getMonth()]}${d.getFullYear() === now.getFullYear() ? '' : ` de ${d.getFullYear()}`}`;
}
