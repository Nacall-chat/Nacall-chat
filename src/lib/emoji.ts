export type EmojiItem = { emoji: string; label: string; haystack: string };
export const emojiCategories = [
  { id: 'rostos', label: 'Rostos e emoções' },
  { id: 'pessoas', label: 'Pessoas e corpo' },
  { id: 'animais', label: 'Animais e natureza' },
  { id: 'comidas', label: 'Comidas e bebidas' },
  { id: 'atividades', label: 'Atividades' },
  { id: 'viagens', label: 'Viagens e lugares' },
  { id: 'objetos', label: 'Objetos' },
  { id: 'simbolos', label: 'Símbolos' },
  { id: 'bandeiras', label: 'Bandeiras' },
] as const;

export const stripAccents = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Carrega a biblioteca (≈1.900 emojis em português, gerada por scripts/gerar-emojis.mjs) só quando o painel abre. */
export async function loadEmojis(): Promise<EmojiItem[][]> {
  const data = (await import('./emoji-data.json')).default as [string, string, string][][];
  return data.map(group => group.map(([emoji, label, words]) => ({ emoji, label, haystack: `${stripAccents(label)} ${words}` })));
}

/** Busca por palavras (sem acento e sem diferenciar maiúsculas); todas as palavras precisam aparecer. */
export function searchEmojis(groups: EmojiItem[][], query: string, limit = 150): EmojiItem[] {
  const words = stripAccents(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const found: EmojiItem[] = [];
  for (const item of groups.flat()) {
    if (words.every(word => item.haystack.includes(word))) { found.push(item); if (found.length >= limit) break; }
  }
  return found;
}

const RECENT_KEY = 'nacall:emojis-recentes';
const RECENT_MAX = 32;
export function readRecentEmojis(): string[] {
  try { const value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string').slice(0, RECENT_MAX) : []; } catch { return []; }
}
/** Põe o emoji no início dos recentes (sem repetir) e devolve a lista nova. */
export function pushRecentEmoji(emoji: string, current: string[]): string[] {
  const next = [emoji, ...current.filter(e => e !== emoji)].slice(0, RECENT_MAX);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* sem armazenamento: os recentes valem só nesta sessão */ }
  return next;
}
