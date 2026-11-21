/**
 * Cores do NACALL, iguais às variáveis CSS do site (src/app/jacall.css + theme-fixes.css).
 * Ficam num lugar só para o app e o site não divergirem; o teste de contraste confere os pares de cores.
 */
export type ThemeTokens = {
  bg: string;
  surface: string;
  panel: string;
  raised: string;
  accent: string;
  primary: string;
  onPrimary: string;
  text: string;
  muted: string;
  faint: string;
  line: string;
  soft: string;
  success: string;
  error: string;
  badge: string;
  brandCall: string;
  brandDot: string;
};

export const dark: ThemeTokens = {
  bg: '#14181f',
  surface: '#1d232d',
  panel: '#252d39',
  raised: '#303b49',
  accent: '#8fe3b0',
  primary: '#8fe3b0',
  onPrimary: '#14181f',
  text: '#e8ecf2',
  muted: '#abb8c9',
  faint: '#93a0b1',
  line: '#364252',
  soft: '#263c35',
  success: '#8fe3b0',
  error: '#ff9cab',
  badge: '#c8203a',
  brandCall: '#4ee8a0',
  brandDot: '#31dded',
};

export const light: ThemeTokens = {
  bg: '#f3f8f5',
  surface: '#ffffff',
  panel: '#e8f2ec',
  raised: '#d9e8e0',
  accent: '#256e49',
  primary: '#8fe3b0',
  onPrimary: '#14181f',
  text: '#1d2935',
  muted: '#526575',
  faint: '#586c7d',
  line: '#c8d9d0',
  soft: '#def2e6',
  success: '#246b46',
  error: '#a52949',
  badge: '#c8203a',
  brandCall: '#1f7a52',
  brandDot: '#17798c',
};

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
