import { emailChangeSchema } from '@/lib/auth-schema';
import { adminClient, allow, anonClient, classifyMailError, emailPending, isPlaceholderEmail, logAuthFailure, needsSecondFactor, reply, serverEnv, sessionUser } from '@/lib/auth-server';
export const runtime = 'nodejs';
const mailDown = 'Não conseguimos enviar o email agora. Tente de novo em alguns minutos; se continuar, avise a equipe.';
// Contas do modelo antigo (marcadas com email_pending) só liberam o app depois de confirmar um email que a pessoa realmente recebe.
// Email novo: o Supabase envia o código ao endereço novo (email_change). Mesmo email do cadastro: código de acesso (OTP) ao endereço atual.
export async function POST(request: Request) {
  const env = serverEnv();
  if (!env) return reply({ error: 'Segurança da conta ainda não configurada no servidor.' }, 503);
  const session = await sessionUser(request, env);
  if (!session) return reply({ error: 'Entre na sua conta.' }, 401);
  if (needsSecondFactor(session)) return reply({ error: 'Confirme o código do app autenticador primeiro.' }, 403);
  if (!emailPending(session.user)) return reply({ error: 'Esta conta já tem um email confirmado.' }, 409);
  const parsed = emailChangeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return reply({ error: parsed.error.issues[0]?.message ?? 'Confira os campos.' }, 400);
  const input = parsed.data, admin = adminClient(env), current = session.user.email?.toLowerCase() ?? '';
  const sameEmail = input.email === current && !isPlaceholderEmail(current);
  try {
    if (input.action === 'request') {
      if (!(await allow(admin, env.secret, 'email-change', session.user.id, 4, 600))) return reply({ error: 'Muitos pedidos de código. Aguarde alguns minutos.' }, 429);
      const failure = sameEmail ? (await anonClient(env).auth.signInWithOtp({ email: input.email, options: { shouldCreateUser: false, captchaToken: input.captchaToken } })).error : await changeEmail(env, session.token, input.email);
      if (failure?.code === 'captcha_failed') return reply({ error: 'Confirme que você não é um robô e tente de novo.', code: 'captcha_failed' }, 400);
      if (failure) {
        logAuthFailure('email-change', failure);
        const kind = classifyMailError(failure);
        if (kind === 'rate') return reply({ error: 'Aguarde um minuto antes de pedir outro código.', code: 'rate_limited' }, 429);
        if (kind === 'delivery') return reply({ error: mailDown, code: 'mail_failed' }, 503);
        if (failure.code === 'email_exists') return reply({ error: 'Esse email já está em uso por outra conta. Informe outro.', code: 'email_exists' }, 409);
        return reply({ error: 'Não foi possível enviar o código agora. Tente novamente em instantes.' }, 400);
      }
      return reply({ ok: true, email: input.email });
    }
    if (!(await allow(admin, env.secret, 'email-confirm', session.user.id, 6, 600))) return reply({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, 429);
    const verified = await anonClient(env).auth.verifyOtp({ email: input.email, token: input.code, type: sameEmail ? 'email' : 'email_change' });
    if (verified.error || verified.data.user?.id !== session.user.id) return reply({ error: 'Código inválido ou expirado. Confira os 6 dígitos ou peça um novo.' }, 400);
    const done = await admin.auth.admin.updateUserById(session.user.id, { app_metadata: { email_pending: false } });
    if (done.error) return reply({ error: 'O email foi confirmado, mas não conseguimos liberar a conta agora. Tente de novo.' }, 503);
    return reply({ ok: true, email: input.email });
  } catch {
    return reply({ error: 'O banco precisa da atualização de segurança do NACALL. Avise a equipe.' }, 503);
  }
}
/** Troca o email da própria conta (PUT /auth/v1/user com o token da pessoa). Com "Secure email change" desligado, só o endereço novo recebe o código. */
async function changeEmail(env: { url: string; pub: string }, token: string, email: string): Promise<{ status?: number; code?: string } | null> {
  try {
    const response = await fetch(`${env.url}/auth/v1/user`, { method: 'PUT', headers: { 'Content-Type': 'application/json', apikey: env.pub, Authorization: `Bearer ${token}` }, body: JSON.stringify({ email }) });
    if (response.ok) return null;
    const body = await response.json().catch(() => ({})) as { error_code?: string; code?: string | number };
    return { status: response.status, code: body.error_code ?? (typeof body.code === 'string' ? body.code : undefined) };
  } catch { return { status: 0 }; }
}
