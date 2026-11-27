import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { ChevronDown, Compass, Hash, Headphones, LogOut, Plus, Settings, Users } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, GroupIcon } from '@/components/avatar';
import { Brand } from '@/components/ui';
import { LiveBadge, PersonIcons } from '@/features/call/badges';
import { useCall } from '@/features/call/call';
import { peerOf, pendingIncoming, sortDms } from '@/features/social/logic';
import { usePresence } from '@/features/social/presence';
import { useRooms } from '@/features/social/rooms';
import { useSocial } from '@/features/social/social';
import { useUnread } from '@/features/social/unread';
import { confirmAction } from '@/lib/confirm';
import { friendlyError } from '@/lib/errors';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';
import { badgeText } from '@nacall/core/unread';
import { serverMenuItems } from '@nacall/core/server-menu';
import type { Server } from '@nacall/core/types';
import { errorText } from '@nacall/core/validation';
import { shownFlags } from '@nacall/core/room-people';
import { durationLabel } from '@nacall/core/room-clock';

const RAIL = 66;
type Nav = { closeDrawer: () => void };

/** Conteúdo da gaveta: coluna dos servidores (Início + os seus) e, ao lado, canais/salas ou amigos e mensagens diretas. */
export function DrawerPanel({ navigation }: { navigation: Nav }) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { me, profiles, friends, dms, servers, channels, railId, setRailId, nameOf, reload } = useSocial();
  const { items, total, byDm } = useUnread();
  const { infoOf, mine } = usePresence();
  const { rooms } = useRooms();
  const { session, live, joining, join, leave } = useCall();
  const { signOut } = useSession();

  const server = servers.find((s) => s.id === railId);
  const go = (path: Parameters<typeof router.navigate>[0]) => {
    router.navigate(path);
    navigation.closeDrawer();
  };
  const pending = pendingIncoming(friends, me);
  // Menu do grupo (o mesmo do site, sem as telas de configuração, que ainda são só do site): copiar o ID e sair do grupo.
  const openServerMenu = (target: Server) => {
    const items = serverMenuItems(target, me, () => false, { manage: false });
    const run = async (id: string) => {
      if (id === 'copy-id') { await Clipboard.setStringAsync(target.id); Alert.alert('ID do grupo copiado.'); return; }
      if (!(await confirmAction(`Sair de ${target.name}?`, 'Para voltar, você vai precisar de um convite novo.', 'Sair'))) return;
      const { error } = await supabase!.rpc('leave_server', { s: target.id });
      if (error) { Alert.alert('Não deu para sair', friendlyError(errorText(error))); return; }
      if (session && channels.some((c) => c.id === session.channelId && c.server_id === target.id)) leave();
      setRailId(null);
      await reload().catch(() => undefined);
    };
    Alert.alert(target.name, undefined, [
      ...items.map((item) => ({ text: item.label, style: item.danger ? ('destructive' as const) : ('default' as const), onPress: () => void run(item.id) })),
      { text: 'Cancelar', style: 'cancel' as const },
    ]);
  };
  return (
    <View style={[styles.root, { backgroundColor: tokens.surface, paddingTop: insets.top }]}>
      <View style={styles.columns}>
        {/* Coluna dos servidores */}
        <ScrollView style={[styles.rail, { backgroundColor: tokens.bg, borderRightColor: tokens.line }]} contentContainerStyle={styles.railContent} showsVerticalScrollIndicator={false}>
          <RailButton label="Início, amigos e mensagens" selected={railId === null} onPress={() => setRailId(null)} badge={total + pending}>
            <Users size={22} color={tokens.text} />
          </RailButton>
          {servers.map((s) => {
            const inCall = channels.filter((c) => c.server_id === s.id && c.kind === 'voice').reduce((sum, c) => sum + (rooms[c.id]?.count ?? 0), 0);
            return (
              <RailButton key={s.id} label={s.name} selected={railId === s.id} onPress={() => setRailId(s.id)} callCount={inCall}>
                <GroupIcon server={s} size={46} />
              </RailButton>
            );
          })}
          <RailButton label="Criar ou entrar em uma comunidade" selected={false} onPress={() => go('/servers/new')}>
            <Plus size={22} color={tokens.accent} />
          </RailButton>
        </ScrollView>

        {/* Lista ao lado: Início ou o servidor escolhido */}
        <View style={styles.side}>
          <View style={styles.sideHead}><Brand /></View>
          <ScrollView contentContainerStyle={{ padding: space.md, gap: 2 }}>
            {server ? (
              <>
                <Label>COMUNIDADE</Label>
                <Pressable accessibilityRole="button" accessibilityLabel={`Menu do grupo ${server.name}`} onPress={() => openServerMenu(server)} style={({ pressed }) => [styles.serverHead, { backgroundColor: pressed ? tokens.panel : 'transparent' }]}>
                  <Text numberOfLines={1} style={{ flex: 1, color: tokens.text, fontSize: 20, fontWeight: '800' }}>{server.name}</Text>
                  <ChevronDown size={18} color={tokens.muted} />
                </Pressable>
                {server.description ? <Text style={{ color: tokens.muted, fontSize: 13, marginBottom: space.sm }}>{server.description}</Text> : null}
                <Label>CANAIS DE TEXTO</Label>
                {channels.filter((c) => c.server_id === server.id && c.kind === 'text').map((c) => (
                  <Item key={c.id} label={c.name} icon={<Hash size={18} color={tokens.muted} />} onPress={() => go(`/channel/${c.id}`)} />
                ))}
                <Label>SALAS DE VOZ</Label>
                {channels.filter((c) => c.server_id === server.id && c.kind === 'voice').map((c) => {
                  const room = rooms[c.id];
                  const here = session?.channelId === c.id;
                  // na sala em que você está, a lista vem direto da call (muda na hora); nas outras, da última consulta
                  const people = here && live ? live.people.map((p) => ({ id: p.id, name: p.name, flags: p as { sharing: boolean; muted: boolean; deaf: boolean } })) : (room?.participants ?? []).map((p) => ({ id: p.id, name: p.name, flags: shownFlags(p) }));
                  return (
                    <View key={c.id}>
                      <Item label={c.name} icon={<Headphones size={18} color={here ? tokens.success : tokens.muted} />} meta={joining === c.id ? 'Entrando…' : here ? 'Você está aqui' : room?.count ? durationLabel(room.startedAt) : 'Entrar na call'} onPress={() => { void join({ id: c.id, name: c.name }); navigation.closeDrawer(); }} />
                      {people.map((p) => (
                        <View key={p.id} style={styles.person}>
                          <Avatar profile={profiles[p.id]} name={p.name} size={26} />
                          <Text numberOfLines={1} style={{ color: tokens.text, fontSize: 13, flex: 1 }}>{p.name}</Text>
                          {p.flags.sharing ? <LiveBadge /> : null}
                          <PersonIcons muted={p.flags.muted} deaf={p.flags.deaf} size={13} />
                        </View>
                      ))}
                    </View>
                  );
                })}
              </>
            ) : (
              <>
                <Label>CONEXÕES</Label>
                <Text style={{ color: tokens.text, fontSize: 20, fontWeight: '800', marginBottom: space.sm }}>Seu ponto de encontro</Text>
                <Item label="Amigos" icon={<Users size={18} color={tokens.muted} />} badge={pending} onPress={() => go('/')} />
                <Item label="Criar ou entrar em comunidade" icon={<Compass size={18} color={tokens.muted} />} onPress={() => go('/servers/new')} />
                <Label>MENSAGENS DIRETAS</Label>
                {dms.length === 0 ? <Text style={{ color: tokens.muted, fontSize: 13 }}>Suas conversas vão aparecer aqui.</Text> : null}
                {sortDms(dms, items).map((d) => {
                  const id = peerOf(d, me);
                  const unread = byDm[d.id] ?? 0;
                  return (
                    <Item
                      key={d.id}
                      label={nameOf(id)}
                      bold={unread > 0}
                      icon={<Avatar profile={profiles[id]} size={30} state={infoOf(id).state} />}
                      badge={unread}
                      onPress={() => go(`/dm/${d.id}`)}
                    />
                  );
                })}
              </>
            )}
          </ScrollView>

          {/* Conta */}
          <View style={[styles.account, { borderTopColor: tokens.line, backgroundColor: tokens.panel, paddingBottom: insets.bottom + space.sm }]}>
            <Avatar profile={profiles[me]} size={36} state={mine === 'invisible' ? 'offline' : mine} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: tokens.text, fontSize: 13, fontWeight: '800' }}>{nameOf(me)}</Text>
              <Text numberOfLines={1} style={{ color: tokens.muted, fontSize: 11 }}>{profiles[me] ? `@${profiles[me].username}` : ''}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Ajustes" hitSlop={8} onPress={() => go('/settings')} style={styles.iconButton}>
              <Settings size={20} color={tokens.text} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Sair da conta" hitSlop={8} onPress={() => void signOut()} style={styles.iconButton}>
              <LogOut size={20} color={tokens.text} />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function RailButton({ label, selected, onPress, badge, callCount, children }: { label: string; selected: boolean; onPress: () => void; badge?: number; callCount?: number; children: React.ReactNode }) {
  const { tokens } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} style={[styles.railButton, { backgroundColor: selected ? tokens.soft : tokens.panel, borderColor: selected ? tokens.accent : tokens.line }]}>
      {children}
      {badge ? <View style={[styles.badge, { backgroundColor: tokens.badge, borderColor: tokens.bg }]}><Text style={styles.badgeText}>{badgeText(badge)}</Text></View> : null}
      {callCount ? <View style={[styles.callBadge, { backgroundColor: '#52e49b', borderColor: tokens.bg }]}><Headphones size={10} color="#10241b" /><Text style={{ color: '#10241b', fontSize: 10, fontWeight: '900' }}>{callCount}</Text></View> : null}
    </Pressable>
  );
}

function Label({ children }: { children: string }) {
  const { tokens } = useTheme();
  return <Text style={{ color: tokens.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: space.md, marginBottom: 4 }}>{children}</Text>;
}

function Item({ label, icon, meta, badge, bold, onPress }: { label: string; icon: React.ReactNode; meta?: string; badge?: number; bold?: boolean; onPress: () => void }) {
  const { tokens } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.item, { backgroundColor: pressed ? tokens.panel : 'transparent' }]}>
      {icon}
      <Text numberOfLines={1} style={{ flex: 1, color: tokens.text, fontSize: 15, fontWeight: bold ? '800' : '500' }}>{label}</Text>
      {meta ? <Text style={{ color: tokens.accent, fontSize: 11, fontWeight: '700' }}>{meta}</Text> : null}
      {badge ? <View style={[styles.itemBadge, { backgroundColor: tokens.badge }]}><Text style={styles.badgeText}>{badgeText(badge)}</Text></View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  columns: { flex: 1, flexDirection: 'row' },
  rail: { width: RAIL, flexGrow: 0, borderRightWidth: 1 },
  railContent: { alignItems: 'center', gap: 10, paddingVertical: space.md },
  railButton: { width: 48, height: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  side: { flex: 1, minWidth: 0 },
  sideHead: { paddingHorizontal: space.lg, paddingVertical: space.md },
  serverHead: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: space.sm, marginHorizontal: -space.sm, paddingHorizontal: space.sm, borderRadius: radius.sm },
  item: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.sm, borderRadius: radius.sm },
  person: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 36, paddingVertical: 4 },
  account: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm, borderTopWidth: 1 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  callBadge: { position: 'absolute', right: -5, bottom: -5, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 10, borderWidth: 2 },
  itemBadge: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
