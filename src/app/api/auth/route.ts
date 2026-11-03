import { authSchema } from '@/lib/auth-schema';
import { adminClient, allow, anonClient, clientIp, reply, resolveEmail, serverEnv } from '@/lib/auth-server';
export const runtime = 'nodejs';
const wrong = 'Usuário/email ou senha não conferem.';
const tooMany = 'Muitas tentativas. Dá uma pausa de alguns minutos e tenta de novo.';
export async function POST(request: Request) {
  const env = serverEnv();
  if (!env) return reply({ error: 'O login ainda não está configurado no servidor.' }, 503);
  const origin = request.headers.get('origin');
  if (origin) { try { const source = new URL(origin); const host = request.headers.get('host') ?? new URL(request.url).host; if (!['http:', 'https:'].includes(source.protocol) || source.host !== host) return reply({ error: 'Origem não permitida.' }, 403); } catch { return reply({ error: 'Origem não permitida.' }, 403); } }
  let raw = '';
  try { const reader = request.body?.getReader(); if (!reader) return reply({ error: 'Formulário vazio.' }, 400); let size = 0; const decoder = new TextDecoder(); for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 8192) { await reader.cancel(); return reply({ error: 'Formulário muito grande.' }, 413); } raw += decoder.decode(part.value, { stream: true }); } raw += decoder.decode(); } catch { return reply({ error: 'Não foi possível ler o formulário.' }, 400); }
  const parsed = authSchema.safeParse((() => { try { return JSON.parse(raw); } catch { return null; } })());
  if (!parsed.success) return reply({ error: parsed.error.issues[0]?.message ?? 'Confira os campos.' }, 400);
  const input = parsed.data, admin = adminClient(env), ip = clientIp(request);
  try {
    if (!(await allow(admin, env.secret, 'ip', ip, 60, 300))) return reply({ error: tooMany }, 429);
    switch (input.action) {
      case 'signup': {
        if (!(await allow(admin, env.secret, 'signup', ip, 5, 600))) return reply({ error: tooMany }, 429);
        await admin.rpc('purge_unconfirmed_accounts'); // libera nicks de cadastros abandonados há mais de um dia
        const taken = await admin.from('profiles').select('id').eq('username', input.username).maybeSingle();
        if (taken.error) return reply({ error: 'Não foi possível consultar o nome de usuário.' }, 503);
        if (taken.data) return reply({ error: 'Esse usuário já está na party. Escolha outro nome.' }, 409);
        // O Supabase cria a conta, envia o código e, se o email já tiver conta, responde igual (não revela quem existe).
        const { error } = await anonClient(env).auth.signUp({ email: input.email, password: input.password, options: { data: { username: input.username, display_name: input.displayName } } });
        if (error) {
          if (error.code === 'weak_password') return reply({ error: 'Essa senha é fraca demais. Escolha outra.' }, 400);
          if (error.status === 429 || error.code === 'over_email_send_rate_limit') return reply({ error: 'Muitos emails enviados. Aguarde alguns minutos e tente de novo.' }, 429);
          return reply({ error: 'Não foi possível criar a conta agora. Tente novamente em instantes.' }, 400);
        }
        return reply({ ok: true, email: input.email });
      }
      case 'verify': {
        if (!(await allow(admin, env.secret, 'verify', input.email, 6, 600))) return reply({ error: tooMany }, 429);
        const { error } = await anonClient(env).auth.verifyOtp({ email: input.email, token: input.code, type: 'signup' });
        if (error) return reply({ error: 'Código inválido ou expirado. Confira os 6 dígitos ou peça um novo.' }, 400);
        return reply({ ok: true });
      }
      case 'resend': {
        if (!(await allow(admin, env.secret, 'resend', input.email, 3, 600))) return reply({ error: 'Muitos pedidos de código. Aguarde alguns minutos.' }, 429);
        const { error } = await anonClient(env).auth.resend({ type: 'signup', email: input.email });
        if (error && (error.status === 429 || error.code === 'over_email_send_rate_limit')) return reply({ error: 'Aguarde um minuto antes de pedir outro código.' }, 429);
        return reply({ ok: true });
      }
      case 'login': {
        if (!(await allow(admin, env.secret, 'login', input.identifier, 10, 600))) return reply({ error: tooMany }, 429);
        const email = await resolveEmail(admin, input.identifier);
        if (!email) return reply({ error: wrong }, 401);
        const { data, error } = await anonClient(env).auth.signInWithPassword({ email, password: input.password });
        // email_not_confirmed só aparece com a senha correta, então não revela contas a quem não tem a senha.
        if (error?.code === 'email_not_confirmed') return reply({ error: 'Falta confirmar seu email com o código que enviamos.', needsVerification: true, email }, 403);
        if (error || !data.session) return reply({ error: wrong }, 401);
        return reply({ session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } });
      }
      case 'recover': {
        if (!(await allow(admin, env.secret, 'recover', input.email, 3, 600))) return reply({ error: 'Muitos pedidos de recuperação. Aguarde alguns minutos.' }, 429);
        await anonClient(env).auth.resetPasswordForEmail(input.email); // resposta única: não revela se o email tem conta
        return reply({ ok: true });
      }
      case 'recover-confirm': {
        if (!(await allow(admin, env.secret, 'recover-confirm', input.email, 6, 600))) return reply({ error: tooMany }, 429);
        const client = anonClient(env);
        const { data, error } = await client.auth.verifyOtp({ email: input.email, token: input.code, type: 'recovery' });
        if (error || !data.session) return reply({ error: 'Código inválido ou expirado. Peça um novo código de recuperação.' }, 400);
        const updated = await client.auth.updateUser({ password: input.password });
        if (updated.error) return reply({ error: updated.error.code === 'weak_password' ? 'Essa senha é fraca demais. Escolha outra.' : 'Não foi possível atualizar a senha. Tente de novo.' }, 400);
        await admin.auth.admin.signOut(data.session.access_token, 'global').catch(() => undefined); // derruba sessões antigas
        return reply({ ok: true });
      }
    }
  } catch {
    return reply({ error: 'O banco precisa da atualização de segurança do NACALL. Avise a equipe.' }, 503);
  }
}
