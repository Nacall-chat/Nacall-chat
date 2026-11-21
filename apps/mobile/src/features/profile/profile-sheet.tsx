import { Image } from 'expo-image';
import { CalendarDays, Headphones } from 'lucide-react-native';
import { createContext, use, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Animated, Dimensions, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/avatar';
import { Body, PrimaryButton } from '@/components/ui';
import { usePresence } from '@/features/social/presence';
import { useRooms } from '@/features/social/rooms';
import { useSocial } from '@/features/social/social';
import { coverUrl } from '@/lib/media-url';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';
import { profileTag } from '@nacall/core/identity';
import { presenceLine } from '@nacall/core/presence';
import { memberSinceLabel } from '@nacall/core/profile-info';

type SheetValue = { open: (userId: string) => void };
const SheetContext = createContext<SheetValue | null>(null);
export const useProfileSheet = () => {
  const value = use(SheetContext);
  if (!value) throw new Error('useProfileSheet precisa estar dentro de <ProfileSheetProvider />');
  return value;
};

/** Provedor + a folha de perfil (sobe de baixo, não cobre a tela toda e fecha arrastando ou tocando fora). */
export function ProfileSheetProvider({ children }: PropsWithChildren) {
  const [userId, setUserId] = useState<string | null>(null);
  const value = useMemo<SheetValue>(() => ({ open: setUserId }), []);
  const close = useCallback(() => setUserId(null), []);
  return (
    <SheetContext value={value}>
      {children}
      <ProfileSheet userId={userId} close={close} />
    </SheetContext>
  );
}

const CLOSE_DISTANCE = 110;

function ProfileSheet({ userId, close }: { userId: string | null; close: () => void }) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { me, profiles, friends, channels, servers, busy, requestFriend, acceptFriend, removeFriend, openDm } = useSocial();
  const { infoOf } = usePresence();
  const { callOf } = useRooms();
  const [drag] = useState(() => new Animated.Value(0));

  useEffect(() => { drag.setValue(0); }, [userId, drag]);

  // Arrastar a capa para baixo acompanha o dedo e fecha se passar de ~110 px.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => { if (g.dy > 0) drag.setValue(g.dy); },
        onPanResponderRelease: (_e, g) => {
          if (g.dy > CLOSE_DISTANCE) close();
          else Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [drag, close],
  );

  const profile = userId ? profiles[userId] : undefined;
  const own = userId === me;
  const friendship = userId ? friends.find((f) => f.sender_id === userId || f.receiver_id === userId) : undefined;
  const info = userId && !own && friendship?.status === 'accepted' ? infoOf(userId) : undefined;
  const room = userId ? callOf(userId) : undefined;
  const roomChannel = room ? channels.find((c) => c.id === room.channelId) : undefined;
  const roomServer = roomChannel ? servers.find((s) => s.id === roomChannel.server_id) : undefined;
  const since = memberSinceLabel(profile?.created_at);
  const cover = coverUrl(profile?.cover_path);

  return (
    <Modal visible={userId !== null} transparent animationType="slide" statusBarTranslucent onRequestClose={close}>
      <View style={styles.fill}>
        <Pressable accessibilityLabel="Fechar perfil" style={[StyleSheet.absoluteFill, { backgroundColor: '#000a' }]} onPress={close} />
        <Animated.View style={[styles.sheet, { backgroundColor: tokens.surface, borderColor: tokens.line, paddingBottom: insets.bottom + space.lg, transform: [{ translateY: drag }] }]}>
          <ScrollView bounces={false} contentContainerStyle={{ paddingBottom: space.lg }}>
            <View {...pan.panHandlers} style={[styles.cover, { backgroundColor: tokens.soft }]}>
              {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              <View style={styles.grabber} />
            </View>
            <View style={styles.content}>
            <View style={[styles.avatar, { borderColor: tokens.surface }]}>
              <Avatar profile={profile} size={84} radius={28} state={info?.state} />
            </View>
            <Text style={{ color: tokens.text, fontSize: 22, fontWeight: '800' }}>{profileTag(profile)}</Text>
            <Text style={{ color: tokens.muted, fontSize: 14 }}>{profile ? `@${profile.username}` : ''}</Text>
            {info ? <Text style={{ color: tokens.text, fontSize: 13, fontWeight: '700' }}>{presenceLine(info)}</Text> : null}

            {!own && userId ? (
              <View style={{ gap: space.sm, marginTop: space.sm }}>
                {!friendship ? (
                  <PrimaryButton label="Enviar solicitação" disabled={busy} onPress={() => requestFriend(userId)} />
                ) : friendship.status === 'accepted' ? (
                  <PrimaryButton label="Mensagem" disabled={busy} onPress={() => { close(); void openDm(userId); }} />
                ) : friendship.receiver_id === me ? (
                  <>
                    <PrimaryButton label="Aceitar" disabled={busy} onPress={() => acceptFriend(friendship.id)} />
                    <Pressable accessibilityRole="button" disabled={busy} onPress={() => removeFriend(friendship.id)} style={[styles.secondary, { borderColor: tokens.line, backgroundColor: tokens.panel }]}>
                      <Text style={{ color: tokens.text, fontWeight: '700' }}>Recusar</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable accessibilityRole="button" disabled={busy} onPress={() => removeFriend(friendship.id)} style={[styles.secondary, { borderColor: tokens.line, backgroundColor: tokens.panel }]}>
                    <Text style={{ color: tokens.text, fontWeight: '700' }}>Cancelar solicitação enviada</Text>
                  </Pressable>
                )}
              </View>
            ) : null}

            {room ? (
              <Section title="Em voz" icon={<Headphones size={15} color={tokens.muted} />}>
                <Text style={{ color: tokens.text, fontSize: 16, fontWeight: '800' }}>{roomChannel?.name ?? 'Sala de voz'}</Text>
                {roomServer ? <Text style={{ color: tokens.muted, fontSize: 13 }}>{`em ${roomServer.name}`}</Text> : null}
                <Text style={{ color: tokens.muted, fontSize: 13, marginTop: 4 }}>{room.participants.map((p) => p.name).join(', ')}</Text>
                <Text style={{ color: tokens.muted, fontSize: 12, marginTop: 6 }}>Entrar na chamada chega ao app numa próxima fase; por enquanto entre pelo site.</Text>
              </Section>
            ) : null}

            <Section title="Sobre mim">
              <Body>{profile?.bio || 'Essa lenda ainda não escreveu a bio.'}</Body>
            </Section>

            {since ? (
              <Section title="Membro do NACALL desde" icon={<CalendarDays size={15} color={tokens.muted} />}>
                <Body>{since}</Body>
              </Section>
            ) : null}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  const { tokens } = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: tokens.bg, borderColor: tokens.line }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon}
        <Text style={{ color: tokens.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' }}>{title}</Text>
      </View>
      <View style={{ gap: 2 }}>{children}</View>
    </View>
  );
}

const SCREEN = Dimensions.get('window').height;
const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: SCREEN * 0.88, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderBottomWidth: 0, overflow: 'hidden' },
  cover: { height: 132, alignItems: 'center' },
  grabber: { marginTop: 8, width: 44, height: 5, borderRadius: 3, backgroundColor: '#fff', opacity: 0.9 },
  content: { paddingHorizontal: space.lg, gap: 4 },
  avatar: { marginTop: -42, marginBottom: space.sm, alignSelf: 'flex-start', borderWidth: 5, borderRadius: 33, zIndex: 5, elevation: 5 },
  secondary: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  section: { marginTop: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, gap: 6 },
});
