import { Check, MessageCircle, Search, UserPlus, Users, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar } from '@/components/avatar';
import { Header } from '@/components/header';
import { Field, Notice, PrimaryButton } from '@/components/ui';
import { useProfileSheet } from '@/features/profile/profile-sheet';
import { confirmAction } from '@/lib/confirm';
import { friendCountLabel, friendRows, friendStatusText, friendTabs, type FriendRow, type FriendTab } from '@/features/social/logic';
import { usePresence } from '@/features/social/presence';
import { useRooms } from '@/features/social/rooms';
import { useSocial } from '@/features/social/social';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';
import { profileTag } from '@nacall/core/identity';

/** Início: lista de amigos com abas (Online, Em call, Todos, Pendente), busca e "Adicionar amigo". */
export function FriendsScreen() {
  const { tokens } = useTheme();
  const { me, profiles, friends, busy, notice, acceptFriend, removeFriend, openDm, addFriendByIdentifier } = useSocial();
  const { infoOf } = usePresence();
  const { activeIds } = useRooms();
  const sheet = useProfileSheet();
  const [tab, setTab] = useState<FriendTab>('all');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [identifier, setIdentifier] = useState('');

  const rows = useMemo(
    () => friendRows({ friends, me, tab, query, profiles, activeIds, infoOf: (id) => infoOf(id) }),
    [friends, me, tab, query, profiles, activeIds, infoOf],
  );
  const hasPendingIncoming = friends.some((f) => f.receiver_id === me && f.status === 'pending');

  async function add() {
    const raw = identifier.trim();
    if (!raw) return;
    // só limpa o campo se enviou; se deu erro, a pessoa corrige sem digitar tudo de novo
    if (await addFriendByIdentifier(raw)) setIdentifier('');
  }

  const renderRow = ({ item }: { item: FriendRow }) => {
    const accepted = item.friendship.status === 'accepted';
    const info = accepted ? infoOf(item.id) : undefined;
    return (
      <View style={[styles.row, { borderBottomColor: tokens.line }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Ver perfil de ${profileTag(profiles[item.id])}`} onPress={() => sheet.open(item.id)} style={styles.person}>
          <Avatar profile={profiles[item.id]} size={44} state={info?.state} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: tokens.text, fontSize: 15, fontWeight: '800' }}>{profileTag(profiles[item.id])}</Text>
            <Text numberOfLines={1} style={{ color: tokens.muted, fontSize: 12 }}>{friendStatusText(item, me, activeIds, info)}</Text>
          </View>
        </Pressable>
        {accepted ? (
          <IconButton label="Conversar" onPress={() => void openDm(item.id)} disabled={busy}><MessageCircle size={19} color={tokens.text} /></IconButton>
        ) : item.friendship.receiver_id === me ? (
          <IconButton label="Aceitar" onPress={() => acceptFriend(item.friendship.id)} disabled={busy}><Check size={19} color={tokens.text} /></IconButton>
        ) : null}
        <IconButton
          label={accepted ? 'Remover amigo' : 'Cancelar ou recusar'}
          disabled={busy}
          onPress={() => {
            // remover um amigo pede confirmação (como no site); pedidos saem direto
            if (!accepted) removeFriend(item.friendship.id);
            else void confirmAction('Remover este amigo?', 'Vocês deixam de ser amigos. Dá para adicionar de novo depois.').then((ok) => { if (ok) removeFriend(item.friendship.id); });
          }}
        >
          <X size={19} color={tokens.text} />
        </IconButton>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: tokens.bg }}>
      <Header title="Amigos" left={<Users size={22} color={tokens.accent} />} />
      <View style={{ padding: space.md, gap: space.md }}>
        <View style={styles.addRow}>
          <View style={[styles.segment, { backgroundColor: tokens.bg, borderColor: tokens.line }]}>
            {friendTabs.map(([id, label]) => (
              <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: tab === id }} onPress={() => { setTab(id); setAdding(false); }} style={[styles.tab, tab === id && !adding ? { backgroundColor: tokens.soft, borderColor: tokens.line } : null]}>
                <Text numberOfLines={1} style={{ color: tab === id && !adding ? tokens.accent : tokens.text, fontSize: 12, fontWeight: '700' }}>{label}{id === 'pending' && hasPendingIncoming ? ' •' : ''}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Pressable accessibilityRole="button" onPress={() => setAdding((v) => !v)} style={[styles.addButton, { backgroundColor: tokens.primary }]}>
          <UserPlus size={17} color={tokens.onPrimary} />
          <Text style={{ color: tokens.onPrimary, fontWeight: '800' }}>Adicionar amigo</Text>
        </Pressable>

        {adding ? (
          <View style={{ gap: space.sm }}>
            <Field label="Nome #00001 ou @usuário" placeholder="Never #00001 ou @usuario" autoCapitalize="none" autoCorrect={false} value={identifier} onChangeText={setIdentifier} maxLength={80} hint="Encontre sua galera e envie uma solicitação." />
            <PrimaryButton label="Enviar solicitação" disabled={busy || !identifier.trim()} onPress={() => void add()} />
          </View>
        ) : (
          <View style={[styles.search, { backgroundColor: tokens.surface, borderColor: tokens.line }]}>
            <Search size={18} color={tokens.muted} />
            <TextInput accessibilityLabel="Buscar amigos" placeholder="Buscar amigos" placeholderTextColor={tokens.faint} value={query} onChangeText={setQuery} autoCapitalize="none" style={{ flex: 1, color: tokens.text, fontSize: 16, paddingVertical: 10 }} />
          </View>
        )}
        {notice ? <Notice>{notice}</Notice> : null}
      </View>

      {!adding ? (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.friendship.id}
          renderItem={renderRow}
          contentContainerStyle={{ paddingHorizontal: space.md, paddingBottom: space.xxl }}
          ListHeaderComponent={<Text style={{ color: tokens.muted, fontSize: 12, fontWeight: '800', marginBottom: space.sm }}>{friendCountLabel(tab, rows.length)}</Text>}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', gap: space.md, paddingTop: space.xxl }}>
              <Users size={36} color={tokens.accent} />
              <Text style={{ color: tokens.muted }}>Ninguém por aqui ainda.</Text>
              <Pressable accessibilityRole="button" onPress={() => setAdding(true)} style={[styles.secondary, { borderColor: tokens.line, backgroundColor: tokens.panel }]}>
                <Text style={{ color: tokens.text, fontWeight: '700' }}>Adicionar amigo</Text>
              </Pressable>
            </View>
          }
        />
      ) : null}
    </View>
  );
}

function IconButton({ label, onPress, disabled, children }: { label: string; onPress: () => void; disabled?: boolean; children: React.ReactNode }) {
  const { tokens } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.icon, { backgroundColor: tokens.panel, borderColor: tokens.line, opacity: disabled ? 0.5 : 1 }]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  addRow: { flexDirection: 'row' },
  segment: { flex: 1, flexDirection: 'row', padding: 3, gap: 2, borderWidth: 1, borderRadius: 12 },
  tab: { flex: 1, minHeight: 40, borderRadius: 9, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  addButton: { minHeight: 46, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: space.md, borderWidth: 1, borderRadius: radius.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, borderBottomWidth: 1 },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minWidth: 0 },
  icon: { width: 44, height: 44, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  secondary: { minHeight: 46, paddingHorizontal: space.lg, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
