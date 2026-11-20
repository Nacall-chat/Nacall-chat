import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dark, light, type ThemeTokens } from '../src/theme/tokens';

const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
const luminance = (hex: string) => {
  const [r, g, b] = [0, 1, 2].map((i) => channel(hex, i)).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const expand = (hex: string) => (hex.length === 4 ? `#${[1, 2, 3].map((i) => hex[i] + hex[i]).join('')}` : hex);

describe('tema do app', () => {
  test.each([['escuro', dark], ['claro', light]] as const)('%s: texto, secundário, destaque e erro passam de 4,5:1 em todos os fundos', (_name, tokens: ThemeTokens) => {
    for (const fg of ['text', 'muted', 'accent', 'error', 'success'] as const) {
      for (const bg of ['bg', 'surface', 'panel', 'raised', 'soft'] as const) {
        expect({ fg, bg, ratio: contrast(tokens[fg], tokens[bg]) >= 4.5 }).toEqual({ fg, bg, ratio: true });
      }
    }
  });

  test('o texto do botão principal e o do selo vermelho são legíveis nos dois temas', () => {
    for (const tokens of [dark, light]) {
      expect(contrast(tokens.onPrimary, tokens.primary)).toBeGreaterThanOrEqual(4.5);
      expect(contrast('#ffffff', tokens.badge)).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('a marca CALL é legível sobre o fundo de cada tema', () => {
    expect(contrast(dark.brandCall, dark.surface)).toBeGreaterThanOrEqual(3);
    expect(contrast(light.brandCall, light.surface)).toBeGreaterThanOrEqual(4.5);
  });

  // Guarda de divergência: as cores do app vêm das variáveis CSS do site.
  test('as cores do app são as mesmas do site (jacall.css)', () => {
    const css = readFileSync(join(__dirname, '../../../src/app/jacall.css'), 'utf8').split(/\r?\n/);
    const vars = (line: string) => Object.fromEntries([...line.matchAll(/--([a-z-]+):(#[0-9a-fA-F]{3,6})\b/g)].map((m) => [m[1], expand(m[2]).toLowerCase()]));
    const site = { dark: vars(css.find((l) => l.startsWith(':root{'))!), light: vars(css.find((l) => l.startsWith(':root[data-theme=light]'))!) };
    for (const [name, tokens] of [['dark', dark], ['light', light]] as const) {
      for (const key of ['bg', 'surface', 'panel', 'raised', 'accent', 'primary', 'text', 'muted', 'faint', 'line', 'soft', 'success', 'error'] as const) {
        expect({ name, key, value: tokens[key].toLowerCase() }).toEqual({ name, key, value: site[name][key] });
      }
    }
  });
});
