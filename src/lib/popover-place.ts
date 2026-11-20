/**
 * Onde abrir o cartão de perfil no desktop: ao lado de quem foi clicado, como no Discord.
 * - o que está na metade esquerda da tela abre o cartão à direita; o da metade direita (lista de membros) abre à esquerda;
 * - se não couber de um lado, vai para o outro; no fim o cartão é sempre mantido dentro da tela;
 * - na vertical o topo do cartão acompanha o topo do clicado (e sobe se faltar espaço embaixo).
 */
export type Box = { left: number; right: number; top: number; bottom: number };
export type Size = { width: number; height: number };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)));

export function placeBeside(anchor: Box, card: Size, viewport: Size, gap = 12, margin = 12): { left: number; top: number; side: 'left' | 'right' } {
  const spaceRight = viewport.width - anchor.right - margin;
  const spaceLeft = anchor.left - margin;
  const need = card.width + gap;
  let side: 'left' | 'right' = (anchor.left + anchor.right) / 2 > viewport.width / 2 ? 'left' : 'right';
  if (side === 'right' && spaceRight < need && spaceLeft >= need) side = 'left';
  else if (side === 'left' && spaceLeft < need && spaceRight >= need) side = 'right';
  const left = clamp(side === 'right' ? anchor.right + gap : anchor.left - gap - card.width, margin, viewport.width - card.width - margin);
  const top = clamp(anchor.top, margin, viewport.height - card.height - margin);
  return { left, top, side };
}

/** Linhas muito largas (a lista de amigos) não servem de âncora: nesse caso vale o ponto do clique. */
export const WIDE_ANCHOR = 320;

export function anchorFrom(rect: Box, click: { x: number; y: number } | null): Box {
  const width = rect.right - rect.left;
  if (width > WIDE_ANCHOR && click) return { left: click.x, right: click.x, top: click.y - 16, bottom: click.y + 16 };
  return rect;
}
