type Violation = { directive: string; blocked: string; page: string };

/** Só a origem (ou a palavra-chave: inline, eval, data, blob), nunca caminho nem query: o relatório pode trazer tokens na URL. */
function origin(value: unknown): string {
  const text = typeof value === 'string' ? value : '';
  if (!text) return '-';
  if (/^(inline|eval|wasm-eval|trusted-types-sink|data|blob|self)$/.test(text)) return text;
  try { const url = new URL(text); return url.protocol === 'data:' || url.protocol === 'blob:' ? url.protocol.slice(0, -1) : url.origin; } catch { return text.slice(0, 40); }
}
/** Só o caminho da página, sem query string. */
function path(value: unknown): string {
  try { return new URL(String(value)).pathname.slice(0, 80); } catch { return '-'; }
}
const clean = (value: unknown) => (typeof value === 'string' ? value.replace(/[^a-z-]/gi, '').slice(0, 40) : '') || '-';

/** Linhas de log de um relatório de CSP (formato antigo `report-uri` ou Reporting API). No máximo 10 por pedido. */
export function summarizeCspReport(raw: string): string[] {
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return []; }
  const found: Violation[] = [];
  const legacy = (data as { 'csp-report'?: Record<string, unknown> } | null)?.['csp-report'];
  if (legacy) found.push({ directive: clean(legacy['effective-directive'] ?? legacy['violated-directive']), blocked: origin(legacy['blocked-uri']), page: path(legacy['document-uri']) });
  if (Array.isArray(data)) for (const item of data.slice(0, 10)) {
    const body = (item as { type?: string; body?: Record<string, unknown> })?.body;
    if ((item as { type?: string })?.type === 'csp-violation' && body) found.push({ directive: clean(body.effectiveDirective), blocked: origin(body.blockedURL), page: path(body.documentURL) });
  }
  return found.slice(0, 10).map(v => `csp-report: diretiva=${v.directive} bloqueado=${v.blocked} página=${v.page}`);
}
