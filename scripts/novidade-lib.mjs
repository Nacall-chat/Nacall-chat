// Regras da novidade escrita no PR (usadas por scripts/novidade.mjs e testadas em tests/novidades-banco.test.ts).
// O PR traz uma seção assim (opcional; sem ela, nada é publicado):
//
//   ## Novidade para quem usa
//   Título: Veja quem está em call
//   Texto: Passe o mouse no ícone de um servidor para ver quem está na call agora.
//
// O texto vai direto para o sino do site e do app, então é escrito para a pessoa que usa o NACALL, sem jargão técnico.

export const TITLE_MAX = 80;
export const TEXT_MAX = 400;
export const DEFAULT_DAYS = 3;

// Palavras que denunciam texto técnico. O texto precisa falar do que a pessoa vê e faz, não de como foi feito.
const JARGON = ['pr', 'pull request', 'commit', 'merge', 'branch', 'deploy', 'refactor', 'refatora', 'migration', 'migração', 'rls', 'rpc', 'api', 'endpoint', 'supabase', 'livekit', 'vercel', 'typescript', 'hook', 'componente', 'css', 'query', 'schema', 'backend', 'frontend', 'bugfix', 'hotfix', 'fix', 'feat', 'lint', 'build', 'ci'];

const clean = value => String(value ?? '').replace(/\r/g, '').replace(/<!--[\s\S]*?-->/g, '').trim();

/** Lê a seção "Novidade" do corpo do PR. Devolve null se não houver seção ou se ela estiver vazia. */
export function parseNovidade(body) {
  const text = clean(body);
  const heading = text.match(/^#{2,3}\s*novidade\b[^\n]*$/im);
  if (!heading) return null;
  const after = text.slice(heading.index + heading[0].length);
  const next = after.search(/^#{1,3}\s/m);
  const section = (next === -1 ? after : after.slice(0, next)).trim();
  const title = section.match(/^[ \t]*t[íi]tulo[ \t]*:[ \t]*(.*)$/im)?.[1]?.trim() ?? '';
  const textMatch = section.match(/^[ \t]*texto[ \t]*:[ \t]*([\s\S]*)$/im);
  const message = (textMatch?.[1] ?? '').split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim();
  if (!title && !message) return null;
  return { title, text: message };
}

/** Palavras técnicas encontradas (para recusar o texto e pedir uma versão simples). */
export function jargonIn(value) {
  const words = clean(value).toLowerCase();
  return JARGON.filter(term => new RegExp(String.raw`(^|[^\p{L}\p{N}])${term.replace(/\s+/g, String.raw`\s+`)}($|[^\p{L}\p{N}])`, 'u').test(words));
}

/** Confere título e texto. Devolve a lista de problemas (vazia = pode publicar). */
export function validateNovidade(novidade) {
  const problems = [];
  const title = clean(novidade?.title), text = clean(novidade?.text);
  if (title.length < 3 || title.length > TITLE_MAX) problems.push(`O título precisa ter de 3 a ${TITLE_MAX} caracteres.`);
  if (text.length < 10 || text.length > TEXT_MAX) problems.push(`O texto precisa ter de 10 a ${TEXT_MAX} caracteres.`);
  const jargon = [...new Set([...jargonIn(title), ...jargonIn(text)])];
  if (jargon.length) problems.push(`Troque os termos técnicos por palavras do dia a dia: ${jargon.join(', ')}.`);
  return problems;
}

/** Linha da tabela product_updates. A chave "pr-<número>" faz publicar de novo atualizar em vez de duplicar. */
/** @param {{ number: number | string, url?: string | null, title: string, text: string, days?: number, now?: Date }} input */
export function updateRow({ number, url = null, title, text, days = DEFAULT_DAYS, now = new Date() }) {
  const n = Number(number);
  if (!Number.isInteger(n) || n <= 0) throw new Error('Número do PR inválido.');
  const d = Number(days);
  if (!Number.isFinite(d) || d < 1 || d > 30) throw new Error('A validade precisa ser de 1 a 30 dias.');
  const prUrl = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/\d+$/.test(url ?? '') ? url : null;
  return {
    slug: `pr-${n}`,
    title: clean(title),
    body: clean(text),
    published_at: now.toISOString(),
    expires_at: new Date(now.getTime() + d * 86400000).toISOString(),
    pr_url: prUrl,
  };
}
