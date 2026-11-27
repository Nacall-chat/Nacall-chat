/**
 * Avisos do NACALL no sino: o que mudou em cada atualização. Vêm da tabela `product_updates` (migration 202611280002),
 * que só entrega o que já foi publicado e ainda não expirou (padrão: 3 dias). Para publicar uma novidade, escreva a seção
 * "Novidade" no PR (veja scripts/novidade.mjs) ou insira pelo painel do Supabase. Quem ainda não viu ganha a bolinha no sino.
 * `slides: true` mostra o botão que reabre o carrossel de novidades (src/lib/novidades.ts).
 */
export type Aviso = { id: string; date: string; title: string; text: string; expiresAt?: string; slides?: boolean };
export type ProductUpdateRow = { slug: string; title: string; body: string; published_at: string; expires_at: string };

/** Linhas da tabela viram avisos: os mais novos primeiro, e o que já expirou (com a aba aberta há dias) some na hora. */
export function toAvisos(rows: ProductUpdateRow[], now = Date.now()): Aviso[] {
  return rows
    .filter(row => row.slug && row.title && row.body && new Date(row.expires_at).getTime() > now)
    .sort((a, b) => b.published_at.localeCompare(a.published_at))
    .map(row => ({ id: row.slug, date: row.published_at, title: row.title, text: row.body, expiresAt: row.expires_at }));
}

/** Avisos que já expiraram saem da lista sem esperar a próxima consulta. */
export const liveAvisos = (list: Aviso[], now = Date.now()) => list.filter(aviso => !aviso.expiresAt || new Date(aviso.expiresAt).getTime() > now);

/** Busca as novidades no ar (o RLS já esconde as expiradas). Sem rede ou sem tabela, devolve lista vazia. */
/** O pedaço do cliente do Supabase que a consulta usa (serve para o cliente do site e o do app, que vêm de pacotes diferentes). */
type UpdatesReader = { from: (table: 'product_updates') => { select: (columns: string) => { order: (column: string, options: { ascending: boolean }) => { limit: (count: number) => PromiseLike<{ data: unknown; error: unknown }> } } } };

// Sem async/await de propósito: este arquivo também roda no app (Babel do Expo), e a conversão de async pede um pacote que só existe lá.
export function fetchAvisos(db: UpdatesReader): Promise<Aviso[]> {
  return Promise.resolve(db.from('product_updates').select('slug,title,body,published_at,expires_at').order('published_at', { ascending: false }).limit(20))
    .then(({ data, error }) => (error || !Array.isArray(data) ? [] : toAvisos(data as ProductUpdateRow[])), () => []);
}

/** Data da novidade em pt-BR ("27/11/2026"); aceita data com hora (do banco) ou só o dia. */
export function avisoDate(date: string): string {
  const value = new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00` : date);
  return Number.isNaN(value.getTime()) ? '' : value.toLocaleDateString('pt-BR');
}

export const avisosKey = (userId: string) => `nacall:avisos:${userId}`;

export function parseAvisosRead(raw: string | null): string[] {
  try {
    const value = JSON.parse(raw ?? '[]') as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 200) : [];
  } catch { return []; }
}

/** Avisos que a pessoa ainda não viu. */
export const unreadAvisos = (read: string[], list: Aviso[]) => list.filter(aviso => !read.includes(aviso.id));

export const withRead = (read: string[], ids: string[]) => [...new Set([...read, ...ids])].slice(-200);

/**
 * Acompanha a versão publicada em /api/version. A primeira resposta vira a versão desta aba; se uma resposta seguinte for diferente, saiu uma versão nova.
 * Não depende de variável de build: a Esteira publica com a CLI da Vercel, que não leva o hash do commit para dentro do app.
 * Resposta vazia (desenvolvimento, sem versão) nunca avisa.
 */
export function trackVersion(baseline: string, latest: string): { baseline: string; update: boolean } {
  if (!latest) return { baseline, update: false };
  if (!baseline) return { baseline: latest, update: false };
  return { baseline, update: latest !== baseline };
}

const SOUND_KEY = 'nacall:aviso-som';
/** O som de aviso vem ligado; só desliga se a pessoa desligou. */
export const parseSound = (raw: string | null) => raw !== '0';
export const soundKey = SOUND_KEY;
