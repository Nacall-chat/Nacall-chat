'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { arrivedDms, sameUnread, withoutOpen, type UnreadDm } from '@/lib/unread';
import { playChime, primeSound } from '@/lib/notify-sound';

const attentiveNow = () => typeof document !== 'undefined' && document.visibilityState === 'visible' && document.hasFocus();

/**
 * Mensagens não lidas das DMs: carrega, mantém em tempo real (mensagens novas e leitura em outro aparelho),
 * marca como lida a conversa que a pessoa está olhando e toca o som quando chega mensagem de outra conversa.
 */
export function useUnread({ db, me, dmIds, openDm, lastIncoming }: { db: SupabaseClient; me: string; dmIds: string[]; openDm: string | null; lastIncoming: string | undefined }) {
  const [all, setAll] = useState<UnreadDm[]>([]);
  const [attentive, setAttentive] = useState(attentiveNow);
  const previous = useRef<UnreadDm[] | null>(null);
  const openRef = useRef(openDm);
  openRef.current = openDm;
  const idsKey = dmIds.slice().sort().join(',');

  const refresh = useCallback(async () => {
    const { data, error } = await db.rpc('unread_dms');
    if (error) return;
    const next = (data ?? []) as UnreadDm[];
    const arrived = arrivedDms(previous.current, next).filter(id => !(id === openRef.current && attentiveNow()));
    previous.current = next;
    setAll(prev => (sameUnread(prev, next) ? prev : next));
    if (arrived.length) playChime();
  }, [db]);

  const markRead = useCallback(async (dmId: string) => {
    const { error } = await db.rpc('mark_dm_read', { d: dmId });
    if (error) return;
    // Tira da lista já, sem esperar a resposta, e sem tocar som por isso.
    previous.current = (previous.current ?? []).filter(item => item.dm_id !== dmId);
    setAll(prev => prev.filter(item => item.dm_id !== dmId));
    void refresh();
  }, [db, refresh]);

  // Primeira carga e sempre que a lista de conversas muda.
  useEffect(() => { void refresh(); }, [refresh, idsKey]);

  // Tempo real: mensagem nova numa das minhas DMs e leitura em outro aparelho. A consulta periódica cobre o que o tempo real perder (e as DMs além das 100 do filtro).
  useEffect(() => {
    const channel = db.channel(`unread-${me}`);
    const ids = idsKey ? idsKey.split(',').slice(0, 100) : [];
    if (ids.length) channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `dm_id=in.(${ids.join(',')})` }, () => void refresh());
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'dm_reads', filter: `user_id=eq.${me}` }, () => void refresh());
    channel.subscribe();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 30000);
    return () => { window.clearInterval(timer); void db.removeChannel(channel); };
  }, [db, me, idsKey, refresh]);

  // Foco da janela: só conta como "vendo" com a aba visível e em foco. O som precisa de um toque ou tecla antes para o navegador deixar tocar.
  useEffect(() => {
    const update = () => setAttentive(attentiveNow());
    const prime = () => primeSound();
    window.addEventListener('focus', update);
    window.addEventListener('blur', update);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('pointerdown', prime, { once: true });
    window.addEventListener('keydown', prime, { once: true });
    return () => {
      window.removeEventListener('focus', update);
      window.removeEventListener('blur', update);
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('pointerdown', prime);
      window.removeEventListener('keydown', prime);
    };
  }, []);

  // Olhando uma DM: marca como lida ao abrir, a cada mensagem nova do outro e quando a janela volta ao foco.
  useEffect(() => {
    if (openDm && attentive) void markRead(openDm);
  }, [openDm, lastIncoming, attentive, markRead]);

  const items = withoutOpen(all, openDm, attentive);
  return { items, markRead, refresh };
}
