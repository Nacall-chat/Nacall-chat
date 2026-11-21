import type { SupabaseClient } from '@supabase/supabase-js';
import { createContext, use, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import { sameUnread, unreadTotal, type UnreadDm } from '@nacall/core/unread';
import { unreadByDm } from './logic';

type UnreadValue = { items: UnreadDm[]; total: number; byDm: Record<string, number>; markRead: (dmId: string) => Promise<void> };
const UnreadContext = createContext<UnreadValue | null>(null);

/**
 * Mensagens não lidas das conversas diretas (como use-unread.ts do site): carrega, acompanha em tempo real
 * (mensagem nova e leitura em outro aparelho) e marca como lida a conversa que a pessoa está olhando.
 */
export function UnreadProvider({ me, dmIds, children }: PropsWithChildren<{ me: string; dmIds: string[] }>) {
  const db = supabase as SupabaseClient;
  const [items, setItems] = useState<UnreadDm[]>([]);
  const idsKey = dmIds.slice().sort().join(',');

  const refresh = useCallback(async () => {
    const { data, error } = await db.rpc('unread_dms');
    if (error) return;
    const next = (data ?? []) as UnreadDm[];
    setItems((prev) => (sameUnread(prev, next) ? prev : next));
  }, [db]);

  const markRead = useCallback(async (dmId: string) => {
    const { error } = await db.rpc('mark_dm_read', { d: dmId });
    if (error) return;
    setItems((prev) => prev.filter((item) => item.dm_id !== dmId)); // tira da lista já, sem esperar a resposta
    void refresh();
  }, [db, refresh]);

  useEffect(() => { void refresh(); }, [refresh, idsKey]);

  useEffect(() => {
    const channel = db.channel(`unread-${me}`);
    const ids = idsKey ? idsKey.split(',').slice(0, 100) : [];
    if (ids.length) channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `dm_id=in.(${ids.join(',')})` }, () => void refresh());
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'dm_reads', filter: `user_id=eq.${me}` }, () => void refresh());
    channel.subscribe();
    // a consulta periódica cobre o que o tempo real perder
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 30000);
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    return () => { clearInterval(timer); sub.remove(); void db.removeChannel(channel); };
  }, [db, me, idsKey, refresh]);

  const value = useMemo<UnreadValue>(() => ({ items, total: unreadTotal(items), byDm: unreadByDm(items), markRead }), [items, markRead]);
  return <UnreadContext value={value}>{children}</UnreadContext>;
}

export function useUnread() {
  const value = use(UnreadContext);
  if (!value) throw new Error('useUnread precisa estar dentro de <UnreadProvider />');
  return value;
}
