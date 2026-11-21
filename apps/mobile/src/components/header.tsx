import { useNavigation } from 'expo-router';
import { Menu } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BellButton } from '@/features/notifications/notifications';
import { useUnread } from '@/features/social/unread';
import { useSocial } from '@/features/social/social';
import { pendingIncoming } from '@/features/social/logic';
import { badgeText } from '@nacall/core/unread';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';

type DrawerNav = { openDrawer?: () => void };

/** Barra de cima das telas: botão do menu (com a soma de mensagens e pedidos de amizade), título e ações. */
export function Header({ title, subtitle, left, right, onTitlePress }: { title: ReactNode; subtitle?: string; left?: ReactNode; right?: ReactNode; onTitlePress?: () => void }) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation() as unknown as DrawerNav;
  const { total } = useUnread();
  const { friends, me } = useSocial();
  const badge = total + pendingIncoming(friends, me);
  return (
    <View style={[styles.bar, { paddingTop: insets.top + space.sm, backgroundColor: tokens.surface, borderBottomColor: tokens.line }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Abrir menu: servidores, canais e conversas" onPress={() => navigation.openDrawer?.()} style={[styles.menu, { backgroundColor: tokens.panel, borderColor: tokens.line }]}>
        <Menu size={21} color={tokens.text} />
        {badge > 0 ? (
          <View style={[styles.badge, { backgroundColor: tokens.badge, borderColor: tokens.surface }]}>
            <Text style={styles.badgeText}>{badgeText(badge)}</Text>
          </View>
        ) : null}
      </Pressable>
      {left}
      <Pressable disabled={!onTitlePress} onPress={onTitlePress} style={styles.title} accessibilityRole={onTitlePress ? 'button' : 'header'}>
        <Text numberOfLines={1} style={{ color: tokens.text, fontSize: 17, fontWeight: '800' }}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={{ color: tokens.muted, fontSize: 12 }}>{subtitle}</Text> : null}
      </Pressable>
      {right}
      <BellButton />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingBottom: space.sm, borderBottomWidth: 1 },
  menu: { width: 42, height: 42, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -6, right: -6, minWidth: 19, height: 19, paddingHorizontal: 5, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  title: { flex: 1, minWidth: 0 },
});
