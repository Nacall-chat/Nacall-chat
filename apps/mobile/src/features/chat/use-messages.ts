import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { Message } from '@nacall/core/types';
import { errorText, messageSchema } from '@nacall/core/validation';
import { appendMessage, sameMessages } from '@/features/social/logic';
import { friendlyError } from '@/lib/errors';

export type ChatTarget = { type: 'dm' | 'channel'; id: string };
const PAGE = 50;

/**
 * Mensagens de uma conversa ou canal (como o efeito de mensagens do app.tsx do site): carrega as últimas 50,
 * acompanha em tempo real, reconcilia a cada 15 s (apagar mensagem não chega filtrado pelo Realtime) e envia texto.
 * Áudio e figurinha usam a mesma tabela `messages` e aparecem como aviso até terem tela própria.
 */
export function useMessages(target: ChatTarget) {
  const db = supabase as SupabaseClient;
  const field = target.type === 'channel' ? 'channel_id' : 'dm_id';
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasOlder, setHasOlder] = useState(false);
  const [error, setError] = useState('');
  const limit = useRef(PAGE);

  const fetchLatest = useCallback(async () => {
    const { data, error: failure } = await db.from('messages').select('*').eq(field, target.id).order('created_at', { ascending: false }).limit(limit.current);
    if (failure) setError(friendlyError(failure.message));
    else {
      const next = ((data ?? []) as Message[]).reverse();
      setMessages((prev) => (sameMessages(prev, next) ? prev : next));
      setHasOlder((data?.length ?? 0) === limit.current);
      setError('');
    }
    setLoading(false);
  }, [db, field, target.id]);

  useEffect(() => {
    limit.current = PAGE;
    // a tela é recriada a cada conversa (key na rota), então o estado já começa vazio e carregando
    void fetchLatest();
    const channel = db
      .channel(`messages-${target.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `${field}=eq.${target.id}` }, () => void fetchLatest())
      .subscribe();
    const timer = setInterval(() => { if (AppState.currentState === 'active') void fetchLatest(); }, 15000);
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') void fetchLatest(); });
    return () => { clearInterval(timer); sub.remove(); void db.removeChannel(channel); };
  }, [db, field, target.id, fetchLatest]);

  const loadOlder = useCallback(async () => {
    const oldest = messages[0];
    if (!oldest || !hasOlder) return;
    const { data, error: failure } = await db.from('messages').select('*').eq(field, target.id).lt('created_at', oldest.created_at).order('created_at', { ascending: false }).limit(PAGE);
    if (failure) { setError(friendlyError(failure.message)); return; }
    limit.current += data?.length ?? 0;
    setMessages((prev) => [...((data ?? []) as Message[]).reverse(), ...prev]);
    setHasOlder((data?.length ?? 0) === PAGE);
  }, [db, field, target.id, messages, hasOlder]);

  /** Devolve uma mensagem de erro em português, ou null se enviou. */
  const send = useCallback(async (text: string, replyTo?: string): Promise<string | null> => {
    try {
      const body = messageSchema.parse(text);
      const { data, error: failure } = await db.from('messages').insert({ body, ...(replyTo ? { reply_to: replyTo } : {}), [field]: target.id }).select().single();
      if (failure) throw failure;
      setMessages((prev) => appendMessage(prev, data as Message));
      return null;
    } catch (e) {
      return friendlyError(errorText(e));
    }
  }, [db, field, target.id]);

  return { messages, loading, hasOlder, error, loadOlder, send };
}
