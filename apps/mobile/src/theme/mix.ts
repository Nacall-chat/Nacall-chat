/** Mistura duas cores (#rrggbb): `amount` é a parte de `top` (0 a 1). Usada nos balões de mensagem, como o color-mix do site. */
export function mix(top: string, base: string, amount: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const part = (i: number) => Math.round(channel(top, i) * amount + channel(base, i) * (1 - amount));
  return `#${[0, 1, 2].map((i) => part(i).toString(16).padStart(2, '0')).join('')}`;
}
