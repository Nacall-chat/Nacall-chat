/** Respostas e reações: regras puras, iguais no site e no app (via `@nacall/core/message-extras`). */
export type Reaction = { message_id: string; user_id: string; emoji: string };
export type ReactionGroup = { emoji: string; count: number; mine: boolean };

/** Reações rápidas, na ordem em que aparecem. */
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '🔥', '😮', '😢'] as const;

/** Agrupa por mensagem e por emoji, na ordem em que o emoji apareceu primeiro. */
export function groupReactions(rows: Reaction[], me: string): Record<string, ReactionGroup[]> {
  const out: Record<string, ReactionGroup[]> = {};
  for (const r of rows) {
    const list = (out[r.message_id] ??= []);
    let g = list.find(x => x.emoji === r.emoji);
    if (!g) { g = { emoji: r.emoji, count: 0, mine: false }; list.push(g); }
    g.count += 1;
    if (r.user_id === me) g.mine = true;
  }
  return out;
}

type Quotable = { body: string; kind?: string | null };
/** Trecho curto da mensagem citada (áudio e figurinha ganham rótulo). */
export function replySnippet(m: Quotable, max = 90): string {
  if (m.kind === 'audio') return 'Áudio';
  if (m.kind === 'sticker') return 'Figurinha';
  const text = m.body.replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
