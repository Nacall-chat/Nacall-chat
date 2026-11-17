import { passwordChangeSchema } from '@/lib/auth-schema';
import { adminClient, allow, anonClient, needsSecondFactor, reply, serverEnv, sessionUser } from '@/lib/auth-server';
export const runtime = 'nodejs';
// Troca de senha logado: exige a senha atual (reautenticação) e o 2FA confirmado, se a conta usa.
export async function POST(request: Request) {
  const env = serverEnv();
  if (!env) return reply({ error: 'Segurança da conta ainda não configurada no servidor.' }, 503);
  const session = await sessionUser(request, env);
  if (!session) return reply({ error: 'Entre na sua conta.' }, 401);
  if (needsSecondFactor(session)) return reply({ error: 'Confirme o código do app autenticador primeiro.' }, 403);
  const parsed = passwordChangeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return reply({ error: parsed.error.issues[0]?.message ?? 'Confira os campos.' }, 400);
  const admin = adminClient(env);
  try {
    if (!(await allow(admin, env.secret, 'pw-change', session.user.id, 5, 600))) return reply({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, 429);
    const check = await anonClient(env).auth.signInWithPassword({ email: session.user.email ?? '', password: parsed.data.current });
    if (check.error) return reply({ error: 'A senha atual não confere.' }, 401);
    const updated = await admin.auth.admin.updateUserById(session.user.id, { password: parsed.data.password });
    if (updated.error) return reply({ error: updated.error.code === 'weak_password' ? 'Essa senha é fraca demais. Escolha outra.' : 'Não foi possível atualizar a senha.' }, 400);
    return reply({ ok: true });
  } catch {
    return reply({ error: 'O banco precisa da atualização de segurança do NACALL. Avise a equipe.' }, 503);
  }
}
