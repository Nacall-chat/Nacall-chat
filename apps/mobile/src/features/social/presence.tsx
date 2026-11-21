import type { SupabaseClient } from '@supabase/supabase-js';
import { createContext, use, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import { HEARTBEAT_MS, isPresenceStatus, offlineInfo, toInfo, type FriendPresence, type PresenceInfo, type PresenceStatus } from '@nacall/core/presence';

type PresenceValue = {
  /** Status que a pessoa escolheu para si (online, ausente, invisível). */
  mine: PresenceStatus;
  setMine: (status: PresenceStatus) => void;
  infoOf: (id: string) => PresenceInfo;
};
const PresenceContext = createContext<PresenceValue | null>(null);

/**
 * Presença (como use-presence.ts do site): avisa que a pessoa está com o NACALL aberto a cada 45 s,
 * avisa na hora quando o app vai para segundo plano e acompanha o estado dos amigos (a cada 30 s).
 * No celular "aberto" quer dizer app em primeiro plano; o servidor calcula online, ausente e offline.
 */
export function PresenceProvider({ me, children }: PropsWithChildren<{ me: string }>) {
  const db = supabase as SupabaseClient;
  const [mine, setMineState] = useState<PresenceStatus>('online');
  const [map, setMap] = useState<Record<string, PresenceInfo>>({});

  const loadFriends = useCallback(async () => {
    const { data, error } = await db.rpc('friends_presence');
    if (error) return;
    const at = Date.now();
    setMap(Object.fromEntries(((data ?? []) as FriendPresence[]).map((row) => [row.user_id, toInfo(row, at)])));
  }, [db]);

  const beat = useCallback(async () => { await db.rpc('touch_presence', { p_idle: false }); }, [db]);

  useEffect(() => {
    let live = true;
    void db.rpc('my_presence').then(({ data }) => { if (live && isPresenceStatus(data)) setMineState(data); });
    return () => { live = false; };
  }, [db, me]);

  useEffect(() => {
    const active = () => AppState.currentState === 'active';
    // cargas iniciais: o setState acontece depois da resposta do servidor (assíncrono)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (active()) { void beat(); void loadFriends(); }
    const heart = setInterval(() => { if (active()) void beat(); }, HEARTBEAT_MS);
    const friends = setInterval(() => { if (active()) void loadFriends(); }, 30000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') { void beat(); void loadFriends(); }
      else void db.rpc('leave_presence'); // foi para segundo plano: offline na hora
    });
    return () => { clearInterval(heart); clearInterval(friends); sub.remove(); };
  }, [db, beat, loadFriends]);

  const value = useMemo<PresenceValue>(() => ({
    mine,
    setMine: (status) => {
      setMineState(status);
      void db.rpc('set_presence', { p_status: status }).then(({ error }) => { if (error) void db.rpc('my_presence').then(({ data }) => { if (isPresenceStatus(data)) setMineState(data); }); });
    },
    infoOf: (id) => map[id] ?? offlineInfo,
  }), [mine, map, db]);

  return <PresenceContext value={value}>{children}</PresenceContext>;
}

export function usePresence() {
  const value = use(PresenceContext);
  if (!value) throw new Error('usePresence precisa estar dentro de <PresenceProvider />');
  return value;
}
