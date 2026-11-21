import { useFocusEffect } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/avatar';
import { Header } from '@/components/header';
import { Notice } from '@/components/ui';
import { useProfileSheet } from '@/features/profile/profile-sheet';
import { bubbleText, peerOf, timeLabel } from '@/features/social/logic';
import { usePresence } from '@/features/social/presence';
import { useSocial } from '@/features/social/social';
import { useUnread } from '@/features/social/unread';
import { mix } from '@/theme/mix';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';
import type { Message } from '@nacall/core/types';
import { useMessages, type ChatTarget } from './use-messages';

/** Conversa (DM) ou canal de texto: balões (os seus à direita), histórico, tempo real e envio de texto. */
export function ChatScreen({ target }: { target: ChatTarget }) {
  const { tokens, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const { me, dms, channels, profiles, nameOf, servers } = useSocial();
  const { infoOf } = usePresence();
  const { markRead, byDm } = useUnread();
  const sheet = useProfileSheet();
  const { messages, loading, hasOlder, error, loadOlder, send } = useMessages(target);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState('');

  const dm = target.type === 'dm' ? dms.find((d) => d.id === target.id) : undefined;
  const peerId = dm ? peerOf(dm, me) : undefined;
  const channel = target.type === 'channel' ? channels.find((c) => c.id === target.id) : undefined;
  const server = channel ? servers.find((s) => s.id === channel.server_id) : undefined;

  // Conversa aberta e em foco conta como lida (e marca de novo quando chega mensagem enquanto você olha).
  const unread = target.type === 'dm' ? byDm[target.id] ?? 0 : 0;
  useFocusEffect(useCallback(() => { if (target.type === 'dm') void markRead(target.id); }, [target.type, target.id, markRead, unread, messages.length]));

  const mineBg = scheme === 'light' ? mix(tokens.accent, tokens.surface, 0.13) : mix(tokens.accent, tokens.panel, 0.22);
  const data = useMemo(() => [...messages].reverse(), [messages]); // a lista é invertida: a mais nova fica embaixo

  async function submit() {
    if (sending || !text.trim()) return;
    setSending(true);
    setFailure('');
    const problem = await send(text);
    if (problem) setFailure(problem);
    else setText('');
    setSending(false);
  }

  const renderItem = ({ item }: { item: Message }) => {
    const mine = item.author_id === me;
    const content = bubbleText(item);
    return (
      <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
        {!mine && target.type === 'channel' ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Ver perfil de ${nameOf(item.author_id)}`} onPress={() => sheet.open(item.author_id)}>
            <Avatar profile={profiles[item.author_id]} size={32} />
          </Pressable>
        ) : null}
        <View style={[styles.bubble, mine ? [styles.bubbleMine, { backgroundColor: mineBg, borderColor: mix(tokens.accent, tokens.surface, 0.3) }] : [styles.bubbleTheirs, { backgroundColor: tokens.surface, borderColor: tokens.line }]]}>
          {target.type === 'channel' && !mine ? <Text style={{ color: tokens.accent, fontSize: 12, fontWeight: '800' }}>{nameOf(item.author_id)}</Text> : null}
          <Text style={{ color: content.placeholder ? tokens.muted : tokens.text, fontSize: 15, lineHeight: 21, fontStyle: content.placeholder ? 'italic' : 'normal' }}>{content.text}</Text>
          <Text style={{ color: mix(tokens.text, mine ? mineBg : tokens.surface, 0.75), fontSize: 10, alignSelf: 'flex-end', marginTop: 2 }}>{timeLabel(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: tokens.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header
        title={dm ? nameOf(peerId as string) : `# ${channel?.name ?? 'canal'}`}
        subtitle={dm ? undefined : server?.name}
        left={dm ? <Avatar profile={profiles[peerId as string]} size={34} state={infoOf(peerId as string).state} /> : undefined}
        onTitlePress={peerId ? () => sheet.open(peerId) : undefined}
      />
      {error ? <View style={{ padding: space.md }}><Notice tone="error">{error}</Notice></View> : null}
      <FlatList
        inverted
        data={data}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        onEndReached={() => void loadOlder()}
        onEndReachedThreshold={0.4}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: space.md, gap: 6 }}
        ListEmptyComponent={
          <View style={[styles.empty, { transform: [{ scaleY: -1 }] }]}>
            <Text style={{ color: tokens.muted, textAlign: 'center' }}>{loading ? 'Carregando mensagens…' : 'Aqui ainda tá quietinho. Mande a primeira mensagem.'}</Text>
          </View>
        }
        ListFooterComponent={hasOlder ? <Text style={{ color: tokens.faint, textAlign: 'center', padding: space.md, fontSize: 12 }}>Carregando mensagens antigas…</Text> : undefined}
      />
      {failure ? <View style={{ paddingHorizontal: space.md }}><Notice tone="error">{failure}</Notice></View> : null}
      <View style={[styles.composer, { backgroundColor: tokens.surface, borderTopColor: tokens.line, paddingBottom: insets.bottom + space.sm }]}>
        <TextInput
          accessibilityLabel={dm ? `Mensagem para ${nameOf(peerId as string)}` : `Mensagem em ${channel?.name ?? 'canal'}`}
          placeholder={dm ? `Conversar com ${nameOf(peerId as string)}…` : `Conversar em #${channel?.name ?? 'canal'}…`}
          placeholderTextColor={tokens.faint}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={4000}
          style={[styles.input, { color: tokens.text, backgroundColor: tokens.bg, borderColor: tokens.line }]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar mensagem"
          disabled={sending || !text.trim()}
          onPress={() => void submit()}
          style={[styles.send, { backgroundColor: tokens.primary, opacity: sending || !text.trim() ? 0.45 : 1 }]}
        >
          <Send size={20} color={tokens.onPrimary} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, borderWidth: 1 },
  bubbleMine: { borderRadius: 16, borderTopRightRadius: 4 },
  bubbleTheirs: { borderRadius: 16, borderTopLeftRadius: 4 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm, borderTopWidth: 1 },
  input: { flex: 1, maxHeight: 120, minHeight: 44, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingTop: 12, paddingBottom: 12, fontSize: 16 },
  send: { width: 46, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: space.xl },
});
