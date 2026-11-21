import { createContext, use, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { postJson } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { RoomSnapshot } from '@nacall/core/room-clock';

type RoomsValue = {
  rooms: Record<string, RoomSnapshot>;
  /** Quem está em alguma sala de voz agora. */
  activeIds: Set<string>;
  /** A sala em que a pessoa está, entre as salas dos servidores que você também participa. */
  callOf: (userId: string) => RoomSnapshot | undefined;
};
const RoomsContext = createContext<RoomsValue | null>(null);

/**
 * Quem está em cada sala de voz (consulta a rota /api/livekit/rooms, a mesma do site, a cada 12 s com o app aberto).
 * Só mostra a informação: entrar na call chega numa fase própria.
 */
export function RoomsProvider({ voiceChannelIds, children }: PropsWithChildren<{ voiceChannelIds: string[] }>) {
  const [rooms, setRooms] = useState<Record<string, RoomSnapshot>>({});
  const idsKey = voiceChannelIds.slice().sort().join(',');

  useEffect(() => {
    if (!idsKey) { setRooms({}); return; }
    let live = true;
    const read = async () => {
      if (AppState.currentState !== 'active') return;
      try {
        const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
        const token = data.session?.access_token;
        if (!token) return;
        const ids = idsKey.split(',');
        const batches = Array.from({ length: Math.ceil(ids.length / 30) }, (_, i) => ids.slice(i * 30, i * 30 + 30));
        const parts = await Promise.all(batches.map((channelIds) => postJson<{ rooms: RoomSnapshot[] }>('/api/livekit/rooms', { channelIds }, token)));
        if (!live) return;
        const next = Object.fromEntries(parts.flatMap((p) => p.rooms).map((r) => [r.channelId, r]));
        setRooms((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      } catch {
        // sem rede ou sala indisponível: mantém o que já tinha
      }
    };
    void read();
    const timer = setInterval(() => void read(), 12000);
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') void read(); });
    return () => { live = false; clearInterval(timer); sub.remove(); };
  }, [idsKey]);

  const value = useMemo<RoomsValue>(() => {
    const activeIds = new Set(Object.values(rooms).flatMap((room) => room.participants.map((p) => p.id)));
    return { rooms, activeIds, callOf: (userId) => Object.values(rooms).find((room) => room.participants.some((p) => p.id === userId)) };
  }, [rooms]);

  return <RoomsContext value={value}>{children}</RoomsContext>;
}

export function useRooms() {
  const value = use(RoomsContext);
  if (!value) throw new Error('useRooms precisa estar dentro de <RoomsProvider />');
  return value;
}
