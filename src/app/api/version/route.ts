import { versionId } from '@/lib/version-id';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Versão que está no ar agora. O app compara com a versão com que foi carregado e avisa no sino quando há uma nova.
 * Devolve uma impressão do commit (muda a cada deploy), não o commit: antes qualquer um via exatamente qual código
 * estava publicado (achado do teste de segurança no HML). */
export function GET() {
  return Response.json({ id: versionId(process.env.VERCEL_GIT_COMMIT_SHA ?? '') }, { headers: { 'Cache-Control': 'no-store' } });
}
