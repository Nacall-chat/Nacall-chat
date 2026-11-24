import type { NextConfig } from 'next';

// Content-Security-Policy (achado do teste de segurança no HML: o site não tinha nenhuma).
// ENFORCED: só regras que não quebram nada hoje (sem <object>, sem trocar a base das URLs, formulários só para o próprio site,
// nunca dentro de iframe de outro site).
export const CSP_ENFORCED = "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";
// REPORT-ONLY: a política completa. O navegador só avisa no console o que bloquearia, sem bloquear. Quando passar uns dias
// sem aviso em uso real (call, música do YouTube, figurinhas, pagamento), ela pode virar a ENFORCED.
export const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.livekit.cloud wss://*.livekit.cloud",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
  // Os avisos vão para /api/csp-report (log da Vercel), para ver o que a política bloquearia antes de aplicá-la.
  'report-uri /api/csp-report', 'report-to csp',
].join('; ');

const config: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/(.*)', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), display-capture=(self)' },
      { key: 'Content-Security-Policy', value: CSP_ENFORCED },
      { key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY },
      { key: 'Reporting-Endpoints', value: 'csp="/api/csp-report"' },
    ] }];
  },
};
export default config;
