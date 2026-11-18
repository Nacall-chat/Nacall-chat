export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Versão que está no ar agora (hash do commit na Vercel). O app compara com a versão com que foi carregado e avisa no sino quando há uma nova. */
export function GET() {
  return Response.json({ id: process.env.VERCEL_GIT_COMMIT_SHA ?? '' }, { headers: { 'Cache-Control': 'no-store' } });
}
