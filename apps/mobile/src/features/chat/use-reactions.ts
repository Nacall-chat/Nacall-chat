import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';
import { groupReactions, type Reaction } from '@nacall/core/message-extras';

/** Reações das mensagens carregadas (como o useReactions do site): busca, tempo real e marcar/desmarcar com resposta imediata. */
export function useReactions(messageIds: string[], me: string) {
  const db = supabase as SupabaseClient;
  const [rows, setRows] = useState<Reaction[]>([]);
  const [error, setError] = useState('');
  const ids = useRef<Set<string>>(new Set());
  const key = messageIds.join(',');
  // a lista atual de ids fica no ref (atualizada fora da renderização) para o tempo real filtrar sem recriar a assinatura
  useEffect(() => { ids.current = new Set(messageIds); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAll = useCallback(async () => {
    const list = [...ids.current];
    if (!list.length) { setRows([]); return; }
    const { data, error: failure } = await db.from('message_reactions').select('message_id,user_id,emoji').in('message_id', list.slice(-200));
    if (!failure) setRows((data ?? []) as Reaction[]);
  }, [db]);

  useEffect(() => { void fetchAll(); }, [key, fetchAll]);
  useEffect(() => {
    const channel = db.channel(`reactions-${me}`).on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, (payload) => {
      const row = (payload.new && Object.keys(payload.new).length ? payload.new : payload.old) as Partial<Reaction>;
      if (row.message_id && ids.current.has(row.message_id)) void fetchAll();
    }).subscribe();
    return () => { void db.removeChannel(channel); };
  }, [db, me, fetchAll]);

  const byMessage = useMemo(() => groupReactions(rows, me), [rows, me]);

  const toggle = useCallback(async (messageId: string, emoji: string) => {
    const mine = rows.some((r) => r.message_id === messageId && r.user_id === me && r.emoji === emoji);
    setRows((prev) => mine ? prev.filter((r) => !(r.message_id === messageId && r.user_id === me && r.emoji === emoji)) : [...prev, { message_id: messageId, user_id: me, emoji }]);
    const { error: failure } = mine
      ? await db.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', me).eq('emoji', emoji)
      : await db.from('message_reactions').insert({ message_id: messageId, emoji });
    if (failure) { setError(friendlyError(failure.message)); void fetchAll(); } else setError('');
  }, [db, me, rows, fetchAll]);

  return { byMessage, toggle, error };
}
