import { mfaSchema } from '@/lib/auth-schema';
import { adminClient, allow, anonClient, generateRecoveryCodes, hashRecoveryCode, needsSecondFactor, reply, serverEnv, sessionUser } from '@/lib/auth-server';
export const runtime = 'nodejs';
// O TOTP é do Supabase Auth (MFA nativo). Aqui ficam só os códigos de recuperação, que o Supabase não oferece.
export async function POST(request: Request) {
  const env = serverEnv();
  if (!env) return reply({ error: 'Segurança da conta ainda não configurada no servidor.' }, 503);
  const session = await sessionUser(request, env);
  if (!session) return reply({ error: 'Entre na sua conta.' }, 401);
  const parsed = mfaSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return reply({ error: parsed.error.issues[0]?.message ?? 'Pedido inválido.' }, 400);
  const input = parsed.data, admin = adminClient(env), uid = session.user.id;
  const removeFactors = async () => {
    for (const factor of session.user.factors ?? []) { const r = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: uid }); if (r.error) throw r.error; }
    const gone = await admin.from('mfa_recovery_codes').delete().eq('user_id', uid); if (gone.error) throw gone.error;
  };
  try {
    switch (input.action) {
      case 'status': {
        const left = await admin.from('mfa_recovery_codes').select('id', { count: 'exact', head: true }).eq('user_id', uid).is('used_at', null);
        return reply({ enabled: session.mfa, codesLeft: left.count ?? 0 });
      }
      case 'generate-codes': {
        if (!session.mfa) return reply({ error: 'Ative o 2FA antes de gerar códigos de recuperação.' }, 400);
        if (needsSecondFactor(session)) return reply({ error: 'Confirme o código do app autenticador primeiro.' }, 403);
        if (!(await allow(admin, env.secret, 'mfa-generate', uid, 5, 3600))) return reply({ error: 'Muitos pedidos. Tente de novo mais tarde.' }, 429);
        const codes = generateRecoveryCodes();
        const cleared = await admin.from('mfa_recovery_codes').delete().eq('user_id', uid); if (cleared.error) throw cleared.error; // o conjunto antigo deixa de valer
        const saved = await admin.from('mfa_recovery_codes').insert(codes.map(code => ({ user_id: uid, code_hash: hashRecoveryCode(code) }))); if (saved.error) throw saved.error;
        return reply({ codes }); // aparecem só agora; no banco fica apenas o hash
      }
      case 'use-code': {
        if (!session.mfa) return reply({ error: 'Esta conta não usa 2FA.' }, 400);
        if (!(await allow(admin, env.secret, 'mfa-code', uid, 5, 600))) return reply({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, 429);
        const claimed = await admin.from('mfa_recovery_codes').update({ used_at: new Date().toISOString() }).eq('user_id', uid).eq('code_hash', hashRecoveryCode(input.code)).is('used_at', null).select('id');
        if (claimed.error) throw claimed.error;
        if (!claimed.data?.length) return reply({ error: 'Código de recuperação inválido ou já usado.' }, 401);
        await removeFactors(); // sem o app autenticador, o 2FA é desfeito e deve ser configurado de novo
        return reply({ ok: true, twoFactorRemoved: true });
      }
      case 'disable': {
        if (!session.mfa) return reply({ ok: true });
        if (needsSecondFactor(session)) return reply({ error: 'Confirme o código do app autenticador primeiro.' }, 403);
        if (!(await allow(admin, env.secret, 'mfa-disable', uid, 5, 600))) return reply({ error: 'Muitas tentativas. Aguarde alguns minutos.' }, 429);
        const check = await anonClient(env).auth.signInWithPassword({ email: session.user.email ?? '', password: input.password });
        if (check.error) return reply({ error: 'Senha incorreta.' }, 401);
        await removeFactors();
        return reply({ ok: true });
      }
    }
  } catch {
    return reply({ error: 'Não foi possível concluir agora. Tente novamente.' }, 503);
  }
}
