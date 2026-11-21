import type { SupabaseClient } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import { createContext, use, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { friendNumber, profileTag } from '@nacall/core/identity';
import type { Channel, DM, Friendship, Profile, Server } from '@nacall/core/types';
import { errorText, usernameKey, usernameSchema } from '@nacall/core/validation';
import { friendlyError } from '@/lib/errors';

type Member = { user_id: string; server_id: string };

type SocialValue = {
  me: string;
  profiles: Record<string, Profile>;
  friends: Friendship[];
  dms: DM[];
  servers: Server[];
  channels: Channel[];
  members: Member[];
  loaded: boolean;
  busy: boolean;
  notice: string;
  setNotice: (text: string) => void;
  /** Servidor aberto na coluna da gaveta (null = Início, com amigos e mensagens). */
  railId: string | null;
  setRailId: (id: string | null) => void;
  reload: () => Promise<void>;
  nameOf: (id: string) => string;
  requestFriend: (id: string) => void;
  acceptFriend: (friendshipId: string) => void;
  removeFriend: (friendshipId: string) => void;
  openDm: (friendId: string) => Promise<void>;
  /** true quando a solicitação foi enviada (o campo só limpa nesse caso). */
  addFriendByIdentifier: (raw: string) => Promise<boolean>;
};

const SocialContext = createContext<SocialValue | null>(null);

/**
 * Dados sociais do app: perfis, amizades, conversas diretas, servidores e canais.
 * Mesmas consultas do site (components/app.tsx); o RLS do Supabase decide o que cada pessoa enxerga.
 */
export function SocialProvider({ children }: PropsWithChildren) {
  const { session } = useSession();
  const router = useRouter();
  const db = supabase as SupabaseClient;
  const me = session?.user.id ?? '';

  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [dms, setDms] = useState<DM[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [railId, setRailId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const results = await Promise.all([
      db.from('servers').select('*').order('created_at'),
      db.from('channels').select('*').order('created_at'),
      db.from('friendships').select('*'),
      db.from('dms').select('*'),
      db.from('server_members').select('user_id,server_id'),
    ]);
    const failure = results.find((r) => r.error)?.error;
    if (failure) throw failure;
    const fs = (results[2].data ?? []) as Friendship[];
    const ds = (results[3].data ?? []) as DM[];
    const ms = (results[4].data ?? []) as Member[];
    const ids = new Set([me, ...fs.flatMap((f) => [f.sender_id, f.receiver_id]), ...ds.flatMap((d) => [d.user_a, d.user_b]), ...ms.map((m) => m.user_id)]);
    const p = await db.from('profiles').select('*').in('id', [...ids]);
    if (p.error) throw p.error;
    setProfiles(Object.fromEntries(((p.data ?? []) as Profile[]).map((x) => [x.id, x])));
    // o servidor oficial primeiro, como no site
    setServers([...((results[0].data ?? []) as Server[])].sort((a, b) => Number(Boolean(b.is_official)) - Number(Boolean(a.is_official))));
    setChannels((results[1].data ?? []) as Channel[]);
    setFriends(fs);
    setDms(ds);
    setMembers(ms);
    setLoaded(true);
  }, [db, me]);

  const safeReload = useCallback(() => { void reload().catch((e) => setNotice(friendlyError(errorText(e)))); }, [reload]);

  // carga inicial: o setState acontece depois da resposta do servidor (assíncrono)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { safeReload(); }, [safeReload]);

  // Tempo real de amizades e conversas; recarrega quando o app volta ao primeiro plano e a cada 2 minutos.
  useEffect(() => {
    const channel = db
      .channel(`social-${me}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, safeReload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dms' }, safeReload)
      .subscribe();
    const timer = setInterval(() => { if (AppState.currentState === 'active') safeReload(); }, 120000);
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') safeReload(); });
    return () => {
      clearInterval(timer);
      sub.remove();
      void db.removeChannel(channel);
    };
  }, [db, me, safeReload]);

  const act = useCallback(async (task: () => Promise<void>) => {
    setBusy(true);
    setNotice('');
    try { await task(); } catch (e) { setNotice(friendlyError(errorText(e))); } finally { setBusy(false); }
  }, []);

  const value = useMemo<SocialValue>(() => {
    const nameOf = (id: string) => (profiles[id] ? profileTag(profiles[id]) : 'Membro');
    return {
      me, profiles, friends, dms, servers, channels, members, loaded, busy, notice, setNotice, railId, setRailId,
      reload,
      nameOf,
      requestFriend: (id) => {
        if (id === me || friends.some((f) => f.sender_id === id || f.receiver_id === id)) return;
        void act(async () => {
          const { error } = await db.from('friendships').insert({ sender_id: me, receiver_id: id });
          if (error) throw error;
          await reload();
          setNotice('Solicitação enviada.');
        });
      },
      acceptFriend: (friendshipId) => {
        void act(async () => {
          const { error } = await db.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId).eq('receiver_id', me);
          if (error) throw error;
          await reload();
        });
      },
      removeFriend: (friendshipId) => {
        void act(async () => {
          const { error } = await db.from('friendships').delete().eq('id', friendshipId);
          if (error) throw error;
          await reload();
        });
      },
      openDm: async (friendId) => {
        await act(async () => {
          const { data, error } = await db.rpc('open_dm', { friend_id: friendId });
          if (error) throw error;
          await reload();
          router.navigate(`/dm/${data as string}`);
        });
      },
      addFriendByIdentifier: async (raw) => {
        let sent = false;
        await act(async () => {
          const number = friendNumber(raw);
          const query = db.from('profiles').select('id');
          const { data, error } = await (number !== null ? query.eq('user_number', number) : query.eq('username_key', usernameKey(usernameSchema.parse(raw.trim().replace(/^@/, ''))))).single();
          if (error || !data) throw new Error('Usuário não encontrado.');
          if (data.id === me) throw new Error('Use o identificador de um amigo.');
          const result = await db.from('friendships').insert({ sender_id: me, receiver_id: data.id });
          if (result.error) {
            if (result.error.code === '23505') throw new Error('Já existe uma amizade ou solicitação entre vocês. Confira sua lista.');
            throw result.error;
          }
          await reload();
          setNotice('Solicitação enviada.');
          sent = true;
        });
        return sent;
      },
    };
  }, [me, profiles, friends, dms, servers, channels, members, loaded, busy, notice, railId, reload, act, db, router]);

  return <SocialContext value={value}>{children}</SocialContext>;
}

export function useSocial() {
  const value = use(SocialContext);
  if (!value) throw new Error('useSocial precisa estar dentro de <SocialProvider />');
  return value;
}
