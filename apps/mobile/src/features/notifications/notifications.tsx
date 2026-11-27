import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Bell, Sparkles } from 'lucide-react-native';
import { createContext, use, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/avatar';
import { peerOf } from '@/features/social/logic';
import { useSocial } from '@/features/social/social';
import { useUnread } from '@/features/social/unread';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';
import { avisoDate, avisosKey, fetchAvisos, liveAvisos, parseAvisosRead, unreadAvisos, withRead, type Aviso } from '@nacall/core/avisos';
import { ago, badgeText, previewOf } from '@nacall/core/unread';

type NotificationsValue = { open: () => void; badge: number };
const NotificationsContext = createContext<NotificationsValue | null>(null);
export const useNotifications = () => {
  const value = use(NotificationsContext);
  if (!value) throw new Error('useNotifications precisa estar dentro de <NotificationsProvider />');
  return value;
};

/** Sino: mensagens não lidas e novidades do NACALL (as mesmas do site, da tabela product_updates; o que expirou some sozinho). */
export function NotificationsProvider({ children }: PropsWithChildren) {
  const { me } = useSocial();
  const { total } = useUnread();
  const [read, setRead] = useState<string[] | null>(null);
  const [visible, setVisible] = useState(false);
  const [list, setList] = useState<Aviso[]>([]);

  // Novidades no ar: ao entrar, a cada 10 minutos e quando o app volta ao primeiro plano.
  useEffect(() => {
    if (!supabase) return;
    const db = supabase;
    let live = true;
    const load = async () => { const next = await fetchAvisos(db); if (live) setList((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next)); };
    void load();
    const timer = setInterval(() => { if (AppState.currentState === 'active') void load(); }, 600000);
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') void load(); });
    return () => { live = false; clearInterval(timer); sub.remove(); };
  }, [me]);
  const avisos = useMemo(() => liveAvisos(list), [list]);

  useEffect(() => {
    let live = true;
    void AsyncStorage.getItem(avisosKey(me)).then((raw) => { if (live) setRead(parseAvisosRead(raw)); }).catch(() => { if (live) setRead([]); });
    return () => { live = false; };
  }, [me]);

  const unseen = useMemo(() => (read ? unreadAvisos(read, avisos) : []), [read, avisos]);

  const markSeen = useCallback(() => {
    setRead((prev) => {
      const next = withRead(prev ?? [], unseen.map((a) => a.id));
      void AsyncStorage.setItem(avisosKey(me), JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, [me, unseen]);

  const close = useCallback(() => { setVisible(false); markSeen(); }, [markSeen]);
  const value = useMemo<NotificationsValue>(() => ({ open: () => setVisible(true), badge: total + unseen.length }), [total, unseen.length]);

  return (
    <NotificationsContext value={value}>
      {children}
      <NotificationsSheet visible={visible} close={close} avisos={avisos} unseenIds={unseen.map((a) => a.id)} />
    </NotificationsContext>
  );
}

/** Botão do sino com a bolinha vermelha (mensagens + novidades). */
export function BellButton() {
  const { tokens } = useTheme();
  const { open, badge } = useNotifications();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={badge ? `Notificações: ${badge} novas` : 'Notificações'} onPress={open} style={[styles.bell, { backgroundColor: tokens.panel, borderColor: tokens.line }]}>
      <Bell size={20} color={tokens.text} />
      {badge > 0 ? (
        <View style={[styles.badge, { backgroundColor: tokens.badge, borderColor: tokens.surface }]}>
          <Text style={styles.badgeText}>{badgeText(badge)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function NotificationsSheet({ visible, close, avisos, unseenIds }: { visible: boolean; close: () => void; avisos: Aviso[]; unseenIds: string[] }) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { me, dms, profiles, nameOf } = useSocial();
  const { items } = useUnread();

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel="Fechar notificações" style={[StyleSheet.absoluteFill, { backgroundColor: '#000a' }]} onPress={close} />
        <View style={[styles.sheet, { backgroundColor: tokens.surface, borderColor: tokens.line, paddingBottom: insets.bottom + space.md }]}>
          <View style={[styles.grabber, { backgroundColor: tokens.line }]} />
          <Text style={{ color: tokens.text, fontSize: 18, fontWeight: '800', padding: space.lg, paddingBottom: space.sm }}>Notificações</Text>
          <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, gap: space.sm }}>
            <Label>MENSAGENS</Label>
            {items.length === 0 ? <Text style={{ color: tokens.muted, fontSize: 14 }}>Nenhuma mensagem nova.</Text> : null}
            {items.map((item) => {
              const dm = dms.find((d) => d.id === item.dm_id);
              const peer = dm ? peerOf(dm, me) : '';
              return (
                <Pressable key={item.dm_id} accessibilityRole="button" onPress={() => { close(); router.navigate(`/dm/${item.dm_id}`); }} style={[styles.row, { borderColor: tokens.line, backgroundColor: tokens.bg }]}>
                  <Avatar profile={profiles[peer]} size={38} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ color: tokens.text, fontWeight: '800', fontSize: 14 }}>{nameOf(peer)}</Text>
                    <Text numberOfLines={1} style={{ color: tokens.muted, fontSize: 13 }}>{previewOf(item.last_kind, item.last_body)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text style={{ color: tokens.muted, fontSize: 11 }}>{ago(item.last_at)}</Text>
                    <View style={[styles.count, { backgroundColor: tokens.badge }]}><Text style={styles.badgeText}>{badgeText(item.unread)}</Text></View>
                  </View>
                </Pressable>
              );
            })}

            <Label>NOVIDADES DO NACALL</Label>
            {avisos.length === 0 ? <Text style={{ color: tokens.muted, fontSize: 14 }}>Nenhuma novidade nos últimos dias.</Text> : null}
            {avisos.map((aviso) => (
              <View key={aviso.id} style={[styles.news, { borderColor: tokens.line, backgroundColor: tokens.bg }]}>
                <Sparkles size={18} color={tokens.accent} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: tokens.text, fontWeight: '800', fontSize: 14, flexShrink: 1 }}>{aviso.title}</Text>
                    {unseenIds.includes(aviso.id) ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tokens.badge }} /> : null}
                  </View>
                  <Text style={{ color: tokens.muted, fontSize: 11 }}>{avisoDate(aviso.date)}</Text>
                  <Text style={{ color: tokens.text, fontSize: 13, lineHeight: 18 }}>{aviso.text}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Label({ children }: { children: string }) {
  const { tokens } = useTheme();
  return <Text style={{ color: tokens.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginTop: space.sm }}>{children}</Text>;
}

const styles = StyleSheet.create({
  bell: { width: 42, height: 42, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -6, right: -6, minWidth: 19, height: 19, paddingHorizontal: 5, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  sheet: { maxHeight: '82%', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderBottomWidth: 0 },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1 },
  count: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  news: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1 },
});
