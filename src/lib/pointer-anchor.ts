import { anchorFrom, type Box } from './popover-place';

/** Guarda onde foi o último clique/toque para o cartão de perfil abrir ao lado dele (o cartão carrega depois do clique). */
let last: { box: Box; at: number } | null = null;

export const ANCHOR_MAX_AGE_MS = 1500;

export function installPointerAnchor(): () => void {
  const onClick = (event: MouseEvent) => {
    const target = event.target as Element | null;
    const element = target?.closest?.('button,a,[role="button"],.member,.voice-roster-person') ?? target;
    if (!element) return;
    const r = element.getBoundingClientRect();
    const click = event.clientX || event.clientY ? { x: event.clientX, y: event.clientY } : null; // por teclado, o clique vem sem posição
    last = { box: anchorFrom({ left: r.left, right: r.right, top: r.top, bottom: r.bottom }, click), at: Date.now() };
  };
  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}

/** O local do clique que abriu o cartão, se foi há pouco. */
export function recentAnchor(now = Date.now()): Box | null {
  return last && now - last.at <= ANCHOR_MAX_AGE_MS ? last.box : null;
}
