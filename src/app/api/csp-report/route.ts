import { adminClient, allow, clientIp, serverEnv } from '@/lib/auth-server';
import { summarizeCspReport } from '@/lib/csp-report';

export const runtime = 'nodejs';

/** Recebe os avisos da Content-Security-Policy em modo relatório (next.config.ts) e grava um resumo no log da Vercel.
 * Serve para ver o que a política completa bloquearia antes de ela passar a bloquear. Sem dados pessoais: só a
 * diretiva, a origem do recurso e a página (sem query string). Limite de tamanho e de pedidos por IP. */
export async function POST(request: Request) {
  const raw = await request.text().catch(() => '');
  if (raw.length > 16_384) return new Response(null, { status: 413 });
  const env = serverEnv();
  if (env && !(await allow(adminClient(env), env.secret, 'csp-report', clientIp(request), 30, 300).catch(() => false))) return new Response(null, { status: 429 });
  for (const line of summarizeCspReport(raw)) console.warn(line);
  return new Response(null, { status: 204 });
}
