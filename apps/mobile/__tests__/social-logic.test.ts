import type { DM, Friendship, Message, Profile } from '@nacall/core/types';
import type { PresenceInfo } from '@nacall/core/presence';
import { appendMessage, bubbleText, friendCountLabel, friendRows, friendStatusText, initialsOf, otherOf, peerOf, pendingIncoming, sameMessages, sortDms, unreadByDm } from '../src/features/social/logic';
import { avatarUrl, coverUrl, groupIconUrl } from '../src/lib/media-url';
import { mix } from '../src/theme/mix';

const ME = '11111111-1111-4111-8111-111111111111';
const A = '22222222-2222-4222-8222-222222222222';
const B = '33333333-3333-4333-8333-333333333333';
const C = '44444444-4444-4444-8444-444444444444';
const profile = (id: string, name: string, n: number): Profile => ({ id, username: name.toLowerCase(), display_name: name, bio: '', user_number: n });
const profiles = { [ME]: profile(ME, 'Eu', 1), [A]: profile(A, 'Ana', 7), [B]: profile(B, 'Bruno', 9), [C]: profile(C, 'Caio', 12) };
const info = (state: PresenceInfo['state']): PresenceInfo => ({ state, lastSeenAt: null, serverNow: null, fetchedAt: 0 });
const states: Record<string, PresenceInfo> = { [A]: info('away'), [B]: info('online'), [C]: info('offline') };
const infoOf = (id: string) => states[id];

const friends: Friendship[] = [
  { id: 'f1', sender_id: ME, receiver_id: A, status: 'accepted' },
  { id: 'f2', sender_id: B, receiver_id: ME, status: 'accepted' },
  { id: 'f3', sender_id: C, receiver_id: ME, status: 'accepted' },
  { id: 'f4', sender_id: B, receiver_id: ME, status: 'pending' },
];
const common = { friends: friends.slice(0, 3), me: ME, query: '', profiles, activeIds: new Set<string>([A]), infoOf };

describe('amigos', () => {
  test('todos: aceitos, online primeiro, depois ausente, depois offline', () => {
    const rows = friendRows({ ...common, tab: 'all' });
    expect(rows.map((r) => r.id)).toEqual([B, A, C]);
  });

  test('online some com quem está offline; em call só quem está numa sala', () => {
    expect(friendRows({ ...common, tab: 'online' }).map((r) => r.id)).toEqual([B, A]);
    expect(friendRows({ ...common, tab: 'available' }).map((r) => r.id)).toEqual([A]);
  });

  test('pendente lista só os pedidos', () => {
    const rows = friendRows({ ...common, friends, tab: 'pending' });
    expect(rows.map((r) => r.friendship.id)).toEqual(['f4']);
  });

  test('busca por nome, #número ou @usuário, sem diferenciar maiúsculas', () => {
    expect(friendRows({ ...common, tab: 'all', query: 'BRU' }).map((r) => r.id)).toEqual([B]);
    expect(friendRows({ ...common, tab: 'all', query: '#00012' }).map((r) => r.id)).toEqual([C]);
    expect(friendRows({ ...common, tab: 'all', query: 'zzz' })).toEqual([]);
  });

  test('textos de status e de contagem', () => {
    const [b, a] = friendRows({ ...common, tab: 'all' });
    expect(friendStatusText(b, ME, common.activeIds, infoOf(B))).toBe('Online');
    expect(friendStatusText(a, ME, common.activeIds, infoOf(A))).toBe('Em call');
    const pending = friendRows({ ...common, friends, tab: 'pending' })[0];
    expect(friendStatusText(pending, ME, new Set(), undefined)).toBe('Solicitação recebida');
    expect(friendStatusText({ ...pending, friendship: { ...pending.friendship, sender_id: ME, receiver_id: B } }, ME, new Set(), undefined)).toBe('Solicitação enviada');
    expect(friendCountLabel('available', 2)).toBe('Amigos em call — 2');
    expect(friendCountLabel('all', 0)).toBe('Todos os amigos — 0');
  });

  test('o outro lado, e pedidos que chegaram para mim', () => {
    expect(otherOf(friends[0], ME)).toBe(A);
    expect(otherOf(friends[1], ME)).toBe(B);
    expect(pendingIncoming(friends, ME)).toBe(1);
  });
});

describe('conversas', () => {
  const dms: DM[] = [{ id: 'd1', user_a: ME, user_b: A }, { id: 'd2', user_a: B, user_b: ME }, { id: 'd3', user_a: ME, user_b: C }];

  test('o outro lado da DM', () => {
    expect(peerOf(dms[0], ME)).toBe(A);
    expect(peerOf(dms[1], ME)).toBe(B);
  });

  test('DM com mensagem nova sobe, a mais recente primeiro', () => {
    const unread = [
      { dm_id: 'd3', unread: 1, last_at: '2026-11-20T10:00:00Z', last_kind: 'text', last_body: 'oi' },
      { dm_id: 'd2', unread: 4, last_at: '2026-11-20T12:00:00Z', last_kind: 'text', last_body: 'ei' },
    ];
    expect(sortDms(dms, unread).map((d) => d.id)).toEqual(['d2', 'd3', 'd1']);
    expect(unreadByDm(unread)).toEqual({ d3: 1, d2: 4 });
  });

  const msg = (id: string, body = 'x', kind?: Message['kind']): Message => ({ id, author_id: ME, body, created_at: '2026-11-20T10:00:00Z', channel_id: null, dm_id: 'd1', kind });

  test('mensagem repetida (tempo real + envio) não duplica', () => {
    const list = [msg('1'), msg('2')];
    expect(appendMessage(list, msg('2'))).toBe(list);
    expect(appendMessage(list, msg('3')).map((m) => m.id)).toEqual(['1', '2', '3']);
    expect(sameMessages(list, [msg('1'), msg('2')])).toBe(true);
    expect(sameMessages(list, [msg('1'), msg('2', 'editada')])).toBe(false);
  });

  test('áudio e figurinha viram aviso (o app ainda não toca), texto fica como está', () => {
    expect(bubbleText(msg('1', 'oi'))).toEqual({ text: 'oi', placeholder: false });
    expect(bubbleText(msg('2', '', 'audio')).placeholder).toBe(true);
    expect(bubbleText(msg('3', '', 'sticker')).placeholder).toBe(true);
  });
});

describe('detalhes', () => {
  test('iniciais do avatar', () => {
    expect(initialsOf('cupincha')).toBe('CU');
    expect(initialsOf('  ')).toBe('?');
  });

  test('endereços das imagens só aceitam os caminhos que o site gera', () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://proj.supabase.co/';
    const uuid = '11111111-1111-4111-8111-111111111111';
    expect(avatarUrl(`${uuid}/abc_DEF-1.webp`)).toBe(`https://proj.supabase.co/storage/v1/object/public/avatars/${uuid}/abc_DEF-1.webp`);
    expect(avatarUrl('../../etc/passwd')).toBe('');
    expect(avatarUrl(undefined)).toBe('');
    expect(coverUrl(`${uuid}/${uuid}.gif`)).toContain('/profile-covers/');
    expect(coverUrl(`${uuid}/${uuid}.png`)).toBe('');
    expect(groupIconUrl(`${uuid}/${uuid}.webp`)).toContain('/group-icons/');
    expect(groupIconUrl('x/y.gif')).toBe('');
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  });

  test('mistura de cores dos balões', () => {
    expect(mix('#ffffff', '#000000', 0.5)).toBe('#808080');
    expect(mix('#8fe3b0', '#252d39', 0)).toBe('#252d39');
    expect(mix('#8fe3b0', '#252d39', 1)).toBe('#8fe3b0');
  });
});
