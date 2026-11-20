/**
 * Gesto de arrastar com o dedo para abrir e fechar a gaveta de servidores (celular).
 * - arrastar para a direita abre; para a esquerda fecha;
 * - só vale um arrasto claramente horizontal, rápido o bastante e longo o bastante (rolar a tela para cima e para baixo não abre nada).
 */
export type Swipe = 'open' | 'close' | null;

export const SWIPE_MIN_DISTANCE = 64;
export const SWIPE_MAX_MS = 700;

export function swipeIntent({ dx, dy, ms }: { dx: number; dy: number; ms: number }): Swipe {
  if (ms > SWIPE_MAX_MS || Math.abs(dx) < SWIPE_MIN_DISTANCE) return null;
  if (Math.abs(dx) < Math.abs(dy) * 2) return null;
  return dx > 0 ? 'open' : 'close';
}

/** O dedo começou num lugar que já usa o gesto horizontal (campo de texto, controle deslizante, lista que rola de lado)? */
export function ownsHorizontalGesture(el: Element | null): boolean {
  for (let node: Element | null = el; node && node !== document.body; node = node.parentElement) {
    if (node.matches('input,textarea,select,video,audio,[contenteditable="true"],[role="slider"]')) return true;
    const overflowX = getComputedStyle(node).overflowX;
    if ((overflowX === 'auto' || overflowX === 'scroll') && node.scrollWidth > node.clientWidth + 1) return true;
  }
  return false;
}
