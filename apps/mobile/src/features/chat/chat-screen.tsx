import { useFocusEffect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Copy, CornerUpLeft, Send, X } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/avatar';
import { Header } from '@/components/header';
import { Notice } from '@/components/ui';
import { useProfileSheet } from '@/features/profile/profile-sheet';
import { useKeyboardVisible } from '@/lib/use-keyboard';
import { bubbleText, peerOf, timeLabel } from '@/features/social/logic';
import { usePresence } from '@/features/social/presence';
import { useSocial } from '@/features/social/social';
import { useUnread } from '@/features/social/unread';
import { mix } from '@/theme/mix';
import { useTheme } from '@/theme/theme';
import { radius, space } from '@/theme/tokens';
import { dayLabel, messageLayout } from '@nacall/core/message-groups';
import { QUICK_REACTIONS, replySnippet } from '@nacall/core/message-extras';
import { useReactions } from './use-reactions';
import type { Message } from '@nacall/core/types';
import { useMessages, type ChatTarget } from './use-messages';

/** Conversa (DM) ou canal de texto: balões (os seus à direita), histórico, tempo real e envio de texto. */
export function ChatScreen({ target }: { target: ChatTarget }) {
  const { tokens, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardVisible();
  const { me, dms, channels, profiles, nameOf, servers } = useSocial();
  const { infoOf } = usePresence();
  const { markRead, byDm } = useUnread();
  const sheet = useProfileSheet();
  const { messages, loading, hasOlder, error, loadOlder, send } = useMessages(target);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const sendLock = useRef(false); // dois toques no mesmo instante enviariam duas vezes (o estado só atualiza na próxima renderização)
  const [failure, setFailure] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [actionsFor, setActionsFor] = useState<Message | null>(null);
  const messageIds = useMemo(() => messages.map((m) => m.id), [messages]);
  const reactions = useReactions(messageIds, me);

  const dm = target.type === 'dm' ? dms.find((d) => d.id === target.id) : undefined;
  const peerId = dm ? peerOf(dm, me) : undefined;
  const channel = target.type === 'channel' ? channels.find((c) => c.id === target.id) : undefined;
  const server = channel ? servers.find((s) => s.id === channel.server_id) : undefined;

  // Conversa aberta e em foco conta como lida (e marca de novo quando chega mensagem enquanto você olha).
  const unread = target.type === 'dm' ? byDm[target.id] ?? 0 : 0;
  // unread e messages.length entram nas dependências de propósito: chegou mensagem com a conversa aberta, marca de novo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => { if (target.type === 'dm') void markRead(target.id); }, [target.type, target.id, markRead, unread, messages.length]));

  const mineBg = scheme === 'light' ? mix(tokens.accent, tokens.surface, 0.13) : mix(tokens.accent, tokens.panel, 0.22);
  const data = useMemo(() => [...messages].reverse(), [messages]); // a lista é invertida: a mais nova fica embaixo

  async function submit() {
    if (sendLock.current || !text.trim()) return;
    sendLock.current = true;
    setSending(true);
    setFailure('');
    const problem = await send(text, replyTo?.id);
    if (problem) setFailure(problem);
    else { setText(''); setReplyTo(null); }
    setSending(false);
    sendLock.current = false;
  }

  const renderItem = ({ item, index }: { item: Message; index: number }) => {
    const mine = item.author_id === me;
    // a lista é invertida: a mensagem anterior no tempo é a do índice seguinte
    const lay = messageLayout(data[index + 1], item);
    const showHead = !lay.grouped;
    const content = bubbleText(item);
    return (
      <View>
      {lay.newDay ? (
        <View style={styles.daySep}>
          <View style={[styles.dayLine, { backgroundColor: tokens.line }]} />
          <Text style={{ color: tokens.faint, fontSize: 11, fontWeight: '700' }}>{dayLabel(item.created_at)}</Text>
          <View style={[styles.dayLine, { backgroundColor: tokens.line }]} />
        </View>
      ) : null}
      <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
        {!mine && target.type === 'channel' ? (showHead ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Ver perfil de ${nameOf(item.author_id)}`} onPress={() => sheet.open(item.author_id)}>
            <Avatar profile={profiles[item.author_id]} size={32} />
          </Pressable>
        ) : <View style={{ width: 32 }} />) : null}
        <Pressable onLongPress={() => setActionsFor(item)} delayLongPress={300} accessibilityHint="Toque e segure para responder ou reagir" style={styles.bubbleWrap}>
        <View style={[styles.bubble, styles.bubbleFull, mine ? [styles.bubbleMine, { backgroundColor: mineBg, borderColor: mix(tokens.accent, tokens.surface, 0.3) }] : [styles.bubbleTheirs, { backgroundColor: tokens.surface, borderColor: tokens.line }]]}>
          {target.type === 'channel' && !mine && showHead ? <Text style={{ color: tokens.accent, fontSize: 13, fontWeight: '800', marginBottom: 1 }}>{nameOf(item.author_id)}</Text> : null}
          {item.reply_to ? <Quote original={messages.find((m) => m.id === item.reply_to)} nameOf={nameOf} background={mix(tokens.text, mine ? mineBg : tokens.surface, 0.08)} /> : null}
          <Text style={{ color: content.placeholder ? tokens.muted : tokens.text, fontSize: 15, lineHeight: 21, fontStyle: content.placeholder ? 'italic' : 'normal' }}>{content.text}</Text>
          <Text style={{ color: mix(tokens.text, mine ? mineBg : tokens.surface, 0.75), fontSize: 11, alignSelf: 'flex-end', marginTop: 3 }}>{timeLabel(item.created_at)}</Text>
        </View>
        {reactions.byMessage[item.id]?.length ? (
          <View style={[styles.reactions, mine ? styles.reactionsMine : null]}>
            {reactions.byMessage[item.id].map((r) => (
              <Pressable key={r.emoji} accessibilityRole="button" accessibilityState={{ selected: r.mine }} accessibilityLabel={`${r.emoji} ${r.count} ${r.count === 1 ? 'reação' : 'reações'}${r.mine ? ', inclusive a sua' : ''}`} onPress={() => void reactions.toggle(item.id, r.emoji)} hitSlop={4}
                style={({ pressed }) => [styles.chip, { borderColor: r.mine ? tokens.accent : tokens.line, backgroundColor: r.mine ? tokens.soft : tokens.panel, opacity: pressed ? 0.7 : 1 }]}>
                <Text style={{ fontSize: 14 }}>{r.emoji}</Text>
                <Text style={{ color: r.mine ? tokens.accent : tokens.muted, fontSize: 12, fontWeight: '700' }}>{r.count}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        </Pressable>
      </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: tokens.bg }} behavior="padding">
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
        contentContainerStyle={{ padding: space.md, gap: 8 }}
        ListEmptyComponent={
          <View style={[styles.empty, { transform: [{ scaleY: -1 }] }]}>
            <Text style={{ color: tokens.muted, textAlign: 'center' }}>{loading ? 'Carregando mensagens…' : 'Aqui ainda tá quietinho. Mande a primeira mensagem.'}</Text>
          </View>
        }
        ListFooterComponent={hasOlder ? <Text style={{ color: tokens.muted, textAlign: 'center', padding: space.md, fontSize: 12 }}>Carregando mensagens antigas…</Text> : undefined}
      />
      {failure || reactions.error ? <View style={{ paddingHorizontal: space.md }}><Notice tone="error">{failure || reactions.error}</Notice></View> : null}
      {replyTo ? (
        <View style={[styles.replyBar, { backgroundColor: tokens.panel, borderTopColor: tokens.line }]}>
          <CornerUpLeft size={16} color={tokens.muted} />
          <Text numberOfLines={1} style={{ flex: 1, color: tokens.muted, fontSize: 13 }}>Respondendo a <Text style={{ color: tokens.text, fontWeight: '800' }}>{nameOf(replyTo.author_id)}</Text>: {replySnippet(replyTo)}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancelar resposta" hitSlop={10} onPress={() => setReplyTo(null)}><X size={18} color={tokens.muted} /></Pressable>
        </View>
      ) : null}
      <View style={[styles.composer, { backgroundColor: tokens.surface, borderTopColor: tokens.line, paddingBottom: (keyboard ? 0 : insets.bottom) + space.sm }]}>
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
      <Modal visible={!!actionsFor} transparent animationType="fade" onRequestClose={() => setActionsFor(null)}>
        <Pressable style={styles.sheetShade} accessibilityLabel="Fechar ações" onPress={() => setActionsFor(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: tokens.surface, borderColor: tokens.line, paddingBottom: insets.bottom + space.md }]}>
            <View style={styles.sheetReactions}>
              {QUICK_REACTIONS.map((e) => (
                <Pressable key={e} accessibilityRole="button" accessibilityLabel={`Reagir com ${e}`} onPress={() => { if (actionsFor) void reactions.toggle(actionsFor.id, e); setActionsFor(null); }}
                  style={({ pressed }) => [styles.sheetEmoji, { backgroundColor: pressed ? tokens.raised : tokens.panel }]}><Text style={{ fontSize: 24 }}>{e}</Text></Pressable>
              ))}
            </View>
            <Pressable accessibilityRole="button" onPress={() => { setReplyTo(actionsFor); setActionsFor(null); }} style={({ pressed }) => [styles.sheetItem, { backgroundColor: pressed ? tokens.panel : 'transparent' }]}>
              <CornerUpLeft size={20} color={tokens.text} /><Text style={{ color: tokens.text, fontSize: 16 }}>Responder</Text>
            </Pressable>
            {actionsFor && (actionsFor.kind ?? 'text') === 'text' ? (
              <Pressable accessibilityRole="button" onPress={() => { void Clipboard.setStringAsync(actionsFor.body); setActionsFor(null); }} style={({ pressed }) => [styles.sheetItem, { backgroundColor: pressed ? tokens.panel : 'transparent' }]}>
                <Copy size={20} color={tokens.text} /><Text style={{ color: tokens.text, fontSize: 16 }}>Copiar texto</Text>
              </Pressable>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', paddingHorizontal: 13, paddingTop: 9, paddingBottom: 7, borderWidth: 1 },
  bubbleMine: { borderRadius: 16, borderTopRightRadius: 4 },
  bubbleTheirs: { borderRadius: 16, borderTopLeftRadius: 4 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.sm, borderTopWidth: 1 },
  input: { flex: 1, maxHeight: 120, minHeight: 44, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingTop: 12, paddingBottom: 12, fontSize: 16 },
  send: { width: 46, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: space.xl },
  bubbleWrap: { maxWidth: '82%' },
  bubbleFull: { maxWidth: '100%' },
  quote: { borderLeftWidth: 3, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 5 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 },
  reactionsMine: { justifyContent: 'flex-end' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 30, paddingHorizontal: 9, borderRadius: 999, borderWidth: 1 },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm, borderTopWidth: 1 },
  sheetShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, paddingTop: space.md, paddingHorizontal: space.md, gap: 4 },
  sheetReactions: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.sm },
  sheetEmoji: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 52, paddingHorizontal: space.sm, borderRadius: radius.sm },
  daySep: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: space.sm },
  dayLine: { flex: 1, height: StyleSheet.hairlineWidth },
});

/** Citação dentro da resposta: quem escreveu a original e um trecho dela. */
function Quote({ original, nameOf, background }: { original?: Message; nameOf: (id: string) => string; background: string }) {
  const { tokens } = useTheme();
  return (
    <View style={[styles.quote, { borderLeftColor: tokens.accent, backgroundColor: background }]}>
      <Text numberOfLines={1} style={{ color: tokens.accent, fontSize: 12, fontWeight: '800' }}>{original ? nameOf(original.author_id) : 'Mensagem'}</Text>
      <Text numberOfLines={1} style={{ color: tokens.muted, fontSize: 13 }}>{original ? replySnippet(original) : 'anterior ou apagada'}</Text>
    </View>
  );
}
