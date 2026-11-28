'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { HEARTBEAT_MS, isIdle, isPresenceStatus, toInfo, toServerStates, type FriendPresence, type PresenceInfo, type PresenceState, type PresenceStatus, type ServerPresence } from '@/lib/presence';

/**
 * Presença: avisa o servidor que a pessoa está com o NACALL aberto (a cada 45 s; ausente depois de 5 min sem mexer),
 * avisa na hora quando ela fecha a aba, e mantém o estado dos amigos (consulta a cada 30 s).
 * O status escolhido (online, ausente, invisível) fica no servidor, então vale em qualquer aparelho.
 * Com um servidor aberto (`serverId`), também acompanha quem dos membros está online ou ausente, mesmo sem amizade.
 */
export function usePresence({ db, me, friendKey, serverId = null }: { db: SupabaseClient; me: string; friendKey: string; serverId?: string | null }) {
  const [mine, setMine] = useState<PresenceStatus>('online');
  const [map, setMap] = useState<Record<string, PresenceInfo>>({});
  const [serverMap, setServerMap] = useState<Record<string, PresenceState>>({});
  const activity = useRef(Date.now());
  const idle = useRef(false);
  const token = useRef('');

  const loadFriends = useCallback(async () => {
    const { data, error } = await db.rpc('friends_presence');
    if (error) return;
    const at = Date.now();
    setMap(Object.fromEntries(((data ?? []) as FriendPresence[]).map(row => [row.user_id, toInfo(row, at)])));
  }, [db]);

  const beat = useCallback(async () => {
    idle.current = isIdle(activity.current, Date.now());
    const { data: { session } } = await db.auth.getSession();
    token.current = session?.access_token ?? '';
    await db.rpc('touch_presence', { p_idle: idle.current });
  }, [db]);

  useEffect(() => {
    let live = true;
    void db.rpc('my_presence').then(({ data }) => { if (live && isPresenceStatus(data)) setMine(data); });
    return () => { live = false; };
  }, [db, me]);

  // Sinal de vida, atividade da pessoa e saída da aba.
  useEffect(() => {
    void beat();
    const timer = window.setInterval(() => void beat(), HEARTBEAT_MS);
    const touch = () => {
      activity.current = Date.now();
      if (idle.current) { idle.current = false; void beat(); } // voltou: deixa de ser ausente na hora
    };
    const leave = () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key || !token.current) return;
      void fetch(`${url}/rest/v1/rpc/leave_presence`, { method: 'POST', keepalive: true, headers: { apikey: key, Authorization: `Bearer ${token.current}`, 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {});
    };
    const back = (e: PageTransitionEvent) => { if (e.persisted) void beat(); };
    const events = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'] as const;
    for (const name of events) window.addEventListener(name, touch, { passive: true });
    window.addEventListener('pagehide', leave);
    window.addEventListener('pageshow', back);
    return () => {
      window.clearInterval(timer);
      for (const name of events) window.removeEventListener(name, touch);
      window.removeEventListener('pagehide', leave);
      window.removeEventListener('pageshow', back);
    };
  }, [beat]);

  // Estado dos amigos: ao entrar, quando a lista de amigos muda, a cada 30 s e quando a aba volta ao foco.
  useEffect(() => {
    void loadFriends();
    const visible = () => { if (document.visibilityState === 'visible') void loadFriends(); };
    const timer = window.setInterval(visible, 30000);
    document.addEventListener('visibilitychange', visible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [loadFriends, friendKey]);

  // Membros do servidor aberto: só a lista desse servidor, ao abrir, a cada 30 s e quando a aba volta ao foco.
  useEffect(() => {
    setServerMap({});
    if (!serverId) return;
    let live = true;
    const load = async () => {
      if (document.visibilityState !== 'visible') return;
      const { data, error } = await db.rpc('server_presence', { p_server: serverId });
      if (live && !error) setServerMap(toServerStates((data ?? []) as ServerPresence[]));
    };
    void load();
    const timer = window.setInterval(() => void load(), 30000);
    document.addEventListener('visibilitychange', load);
    return () => { live = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', load); };
  }, [db, serverId]);

  const setStatus = useCallback(async (next: PresenceStatus) => {
    const previous = mine;
    setMine(next);
    const { error } = await db.rpc('set_presence', { p_status: next });
    if (error) setMine(previous);
    return !error;
  }, [db, mine]);

  return { mine, setStatus, map, serverMap };
}
