/** Tecla do "apertar para falar". A pessoa escolhe a que quiser; aqui ficam a validação (o que recusar, o que só avisar),
 * o nome que aparece na tela, a leitura segura do que foi salvo e a regra de quando a tecla dispara. */
export type PttKey = { code: string; label: string };
export const DEFAULT_PTT_KEY: PttKey = { code: 'KeyV', label: 'V' };

const MAX_LABEL = 16;
const MODIFIERS = new Set(['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'AltGraph']);
const SYSTEM_KEYS = new Set(['MetaLeft', 'MetaRight', 'OSLeft', 'OSRight', 'ContextMenu', 'PrintScreen', 'CapsLock', 'NumLock', 'ScrollLock', 'Pause', 'Fn', 'FnLock', 'Power', 'Sleep', 'WakeUp']);

/** Teclas recusadas, com o motivo mostrado à pessoa. */
const REFUSED: Record<string, string> = {
  Escape: 'O Esc fecha janelas e menus. Ele só cancela esta escolha.',
  Tab: 'O Tab troca o foco entre botões e campos.',
  Enter: 'O Enter aciona o botão que estiver em foco.',
  NumpadEnter: 'O Enter aciona o botão que estiver em foco.',
  Space: 'O Espaço rola a página e aciona o botão que estiver em foco.',
  F5: 'O navegador usa o F5 para recarregar a página.',
  F11: 'O navegador usa o F11 para a tela cheia.',
  F12: 'O navegador usa o F12 para as ferramentas de desenvolvedor.',
};
const REFUSED_MODIFIER = 'Ctrl, Shift e Alt sozinhos abririam o microfone em qualquer atalho (Ctrl+C, Alt+Tab…). Escolha outra tecla.';
const REFUSED_SYSTEM = 'Essa é uma tecla do sistema e o navegador nem sempre a entrega ao site.';
const REFUSED_COMBO = 'Use uma tecla só, sem Ctrl, Alt ou Windows/Command junto.';
const REFUSED_UNKNOWN = 'Não consegui reconhecer essa tecla. Tente outra.';

/** Atalhos que o próprio NACALL usa fora de campos de texto: dá para escolher, mas a pessoa é avisada do conflito. */
export const APP_SHORTCUTS: Record<string, string> = {
  ArrowLeft: 'voltar nos avisos de novidades',
  ArrowRight: 'avançar nos avisos de novidades',
};

export type PttKeyCheck = { ok: true; key: PttKey; warning?: string } | { ok: false; reason: string };
export type KeyInput = { code: string; key?: string; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean };

const NAMES: Record<string, string> = {
  ArrowUp: 'Seta ↑', ArrowDown: 'Seta ↓', ArrowLeft: 'Seta ←', ArrowRight: 'Seta →',
  PageUp: 'Page Up', PageDown: 'Page Down', Home: 'Home', End: 'End', Insert: 'Insert', Delete: 'Delete', Backspace: 'Backspace',
  Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
  IntlBackslash: '\\', IntlRo: '/', NumpadAdd: 'Num +', NumpadSubtract: 'Num -', NumpadMultiply: 'Num *', NumpadDivide: 'Num /', NumpadDecimal: 'Num ,', NumpadComma: 'Num ,',
};

/** Nome da tecla como a pessoa a vê. Usa o caractere que a tecla gera no teclado dela (Ç, por exemplo) quando existe. */
export function pttKeyLabel(code: string, key?: string): string {
  // O teclado numérico gera os mesmos caracteres do teclado normal, então a diferença vem do código ("Num 0", não "0").
  if (code.startsWith('Numpad')) {
    const numpad = /^Numpad([0-9])$/.exec(code);
    return numpad ? `Num ${numpad[1]}` : (NAMES[code] ?? code).slice(0, MAX_LABEL);
  }
  const typed = key?.trim();
  if (typed && [...typed].length === 1) return typed.toUpperCase();
  const letter = /^Key([A-Z])$/.exec(code);
  if (letter) return letter[1]!;
  const digit = /^Digit([0-9])$/.exec(code);
  if (digit) return digit[1]!;
  return (NAMES[code] ?? code).slice(0, MAX_LABEL);
}

/** Confere uma tecla apertada: recusa as problemáticas, avisa das que têm efeito colateral e devolve a tecla pronta para salvar. */
export function validatePttKey(input: KeyInput): PttKeyCheck {
  const code = input.code;
  if (!code || code === 'Unidentified' || !/^[A-Za-z0-9]{1,24}$/.test(code)) return { ok: false, reason: REFUSED_UNKNOWN };
  if (MODIFIERS.has(code)) return { ok: false, reason: REFUSED_MODIFIER };
  if (SYSTEM_KEYS.has(code) || /^(Browser|Media|Audio|Launch|Volume)/.test(code)) return { ok: false, reason: REFUSED_SYSTEM };
  const refused = REFUSED[code];
  if (refused) return { ok: false, reason: refused };
  if (input.ctrlKey || input.altKey || input.metaKey) return { ok: false, reason: REFUSED_COMBO };
  const key: PttKey = { code, label: pttKeyLabel(code, input.key) };
  const shortcut = APP_SHORTCUTS[code];
  if (shortcut) return { ok: true, key, warning: `O NACALL usa esta tecla para ${shortcut}. Enquanto você a segura, ela também rola a página.` };
  if (/^Arrow|^Page(Up|Down)$|^(Home|End)$/.test(code)) return { ok: true, key, warning: 'Esta tecla também rola a página. Enquanto você a segura, ela deixa de rolar.' };
  if (/^F([1-9]|10)$/.test(code)) return { ok: true, key, warning: 'O navegador usa as teclas F para ajuda, busca e menus. O NACALL bloqueia essas funções enquanto você segura a tecla.' };
  return { ok: true, key };
}

/** Lê o que foi salvo no navegador. Qualquer coisa fora do formato (ou uma tecla hoje recusada) volta para o padrão. */
export function parsePttKey(raw: unknown): PttKey {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PTT_KEY };
  const { code, label } = raw as { code?: unknown; label?: unknown };
  if (typeof code !== 'string' || !validatePttKey({ code }).ok) return { ...DEFAULT_PTT_KEY };
  const text = typeof label === 'string' ? label.trim().slice(0, MAX_LABEL) : '';
  return { code, label: text || pttKeyLabel(code) };
}

export const isDefaultPttKey = (key: PttKey) => key.code === DEFAULT_PTT_KEY.code;

type Targetable = EventTarget | { closest?: (selector: string) => unknown; isContentEditable?: boolean } | null;
const TYPING = 'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="searchbox"],[role="combobox"]';

/** A pessoa está digitando? Nesse caso a tecla do apertar para falar nunca dispara. */
export function isTypingTarget(target: Targetable): boolean {
  if (!target || typeof target !== 'object') return false;
  const element = target as { closest?: (selector: string) => unknown; isContentEditable?: boolean };
  return Boolean(element.isContentEditable) || Boolean(element.closest?.(TYPING));
}

/** Esta tecla apertada deve abrir o microfone? Só a tecla escolhida, sem repetição automática, sem Ctrl/Alt/Windows e fora de campos de texto. */
export function pttShouldOpen(e: { code: string; repeat?: boolean; ctrlKey?: boolean; altKey?: boolean; metaKey?: boolean; target: Targetable }, key: PttKey): boolean {
  return e.code === key.code && !e.repeat && !e.ctrlKey && !e.altKey && !e.metaKey && !isTypingTarget(e.target);
}
