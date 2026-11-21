/**
 * Regras das telas sociais, sem React: ficam aqui para testar e para o app e o site fazerem as mesmas contas.
 * (Espelham components/friends-panel.tsx, app.tsx e use-unread.ts do site.)
 */
import type { DM, Friendship, Message, Profile } from '@nacall/core/types';
import { profileTag } from '@nacall/core/identity';
import { presenceOrder, stateLabel, type PresenceInfo } from '@nacall/core/presence';
import type { UnreadDm } from '@nacall/core/unread';

export type FriendTab = 'online' | 'available' | 'all' | 'pending';
export const friendTabs: [FriendTab, string][] = [['online', 'Online'], ['available', 'Em call'], ['all', 'Todos'], ['pending', 'Pendente']];

/** O outro lado de uma conversa direta. */
export const peerOf = (dm: DM, me: string) => (dm.user_a === me ? dm.user_b : dm.user_a);
/** O outro lado de uma amizade. */
export const otherOf = (friendship: Friendship, me: string) => (friendship.sender_id === me ? friendship.receiver_id : friendship.sender_id);

export type FriendRow = { friendship: Friendship; id: string };

export function friendRows(input: {
  friends: Friendship[];
  me: string;
  tab: FriendTab;
  query: string;
  profiles: Record<string, Profile>;
  activeIds: Set<string>;
  infoOf: (id: string) => PresenceInfo | undefined;
}): FriendRow[] {
  const { friends, me, tab, query, profiles, activeIds, infoOf } = input;
  const needle = query.trim().toLowerCase();
  const rows = friends
    .filter((f) => (tab === 'pending' ? f.status === 'pending' : f.status === 'accepted'))
    .map((friendship) => ({ friendship, id: otherOf(friendship, me) }))
    .filter(({ id }) => tab !== 'available' || activeIds.has(id))
    .filter(({ id }) => tab !== 'online' || (infoOf(id)?.state ?? 'offline') !== 'offline')
    .filter(({ id }) => !needle || [profileTag(profiles[id]), profiles[id]?.username ?? ''].join(' ').toLowerCase().includes(needle));
  return rows.sort((a, b) => presenceOrder(infoOf(a.id)?.state ?? 'offline') - presenceOrder(infoOf(b.id)?.state ?? 'offline'));
}

export const friendCountLabel = (tab: FriendTab, count: number) =>
  `${tab === 'pending' ? 'Solicitações' : tab === 'available' ? 'Amigos em call' : tab === 'online' ? 'Amigos online' : 'Todos os amigos'} — ${count}`;

/** Linha de status embaixo do nome na lista de amigos. */
export function friendStatusText(row: FriendRow, me: string, activeIds: Set<string>, info?: PresenceInfo): string {
  if (row.friendship.status === 'accepted') return activeIds.has(row.id) ? 'Em call' : stateLabel[info?.state ?? 'offline'];
  return row.friendship.receiver_id === me ? 'Solicitação recebida' : 'Solicitação enviada';
}

/** Pedidos de amizade que chegaram para mim e aguardam resposta. */
export const pendingIncoming = (friends: Friendship[], me: string) => friends.filter((f) => f.receiver_id === me && f.status === 'pending').length;

/** Conversas com mensagem nova primeiro (a mais recente no topo); as demais mantêm a ordem. */
export function sortDms(dms: DM[], unread: UnreadDm[]): DM[] {
  const latest = new Map(unread.map((u) => [u.dm_id, new Date(u.last_at).getTime()]));
  return [...dms].sort((a, b) => (latest.get(b.id) ?? -1) - (latest.get(a.id) ?? -1));
}

export const unreadByDm = (items: UnreadDm[]) => Object.fromEntries(items.map((u) => [u.dm_id, u.unread])) as Record<string, number>;

/** Mensagens em ordem cronológica, sem repetir ids (realtime e envio local podem trazer a mesma). */
export function appendMessage(list: Message[], message: Message): Message[] {
  return list.some((m) => m.id === message.id) ? list : [...list, message];
}

export const sameMessages = (a: Message[], b: Message[]) => a.length === b.length && a.every((m, i) => m.id === b[i].id && m.body === b[i].body);

/** O que mostrar no balão: texto, ou um aviso para o que o app ainda não toca (áudio e figurinha). */
export function bubbleText(message: Pick<Message, 'kind' | 'body'>): { text: string; placeholder: boolean } {
  if (message.kind === 'audio') return { text: 'Mensagem de áudio — o app ainda não toca áudios; ouça no site.', placeholder: true };
  if (message.kind === 'sticker') return { text: 'Figurinha — o app ainda não mostra figurinhas; veja no site.', placeholder: true };
  return { text: message.body, placeholder: false };
}

export const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** Iniciais para o avatar sem foto. */
export const initialsOf = (name: string) => name.trim().slice(0, 2).toUpperCase() || '?';
