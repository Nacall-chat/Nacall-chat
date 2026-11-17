import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { createHash, createHmac, randomInt } from 'node:crypto';
export const reply = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
export type ServerEnv = { url: string; pub: string; secret: string };
export function serverEnv(): ServerEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, pub = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && pub && secret ? { url, pub, secret } : null;
}
const options = { auth: { persistSession: false, autoRefreshToken: false } };
/** Cliente administrativo. Só no servidor; nunca devolva dados dele sem filtrar. */
export const adminClient = (env: ServerEnv) => createClient(env.url, env.secret, options);
/** Cliente com a chave pública, opcionalmente agindo como o usuário do token. */
export const anonClient = (env: ServerEnv, token?: string) => createClient(env.url, env.pub, token ? { ...options, global: { headers: { Authorization: `Bearer ${token}` } } } : options);
export function clientIp(request: Request) { return (request.headers.get('x-vercel-forwarded-for') ?? request.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim(); }
/** O banco guarda só o HMAC do IP/email/usuário, nunca o valor puro. */
export const bucketKey = (secret: string, scope: string, value: string) => createHmac('sha256', secret).update(`nacall-${scope}:${value.toLowerCase()}`).digest('hex');
/** true se a tentativa ainda está dentro do limite. Lança se o banco não tem a função (migration pendente). */
export async function allow(admin: SupabaseClient, secret: string, scope: string, value: string, max: number, seconds: number) {
  const { data, error } = await admin.rpc('consume_rate_limit', { bucket_key: bucketKey(secret, scope, value), max_attempts: max, window_seconds: seconds });
  if (error) throw error;
  return data === true;
}
// Alfabeto sem I, L, O, 0 e 1 para não confundir na hora de digitar. 12 caracteres ≈ 59 bits por código.
const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => Array.from({ length: 12 }, () => alphabet[randomInt(alphabet.length)]).join('').replace(/(.{4})(?=.)/g, '$1-'));
}
export const normalizeRecoveryCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const hashRecoveryCode = (code: string) => createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex');
export function jwtClaims(token: string): { aal?: string; [key: string]: unknown } {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); } catch { return {}; }
}
export const hasVerifiedFactor = (user: Pick<User, 'factors'>) => !!user.factors?.some(f => f.status === 'verified');
export type SessionInfo = { token: string; user: User; aal: 'aal1' | 'aal2'; mfa: boolean };
/** Valida o Bearer no Supabase e informa o nível da sessão (aal2 = o 2FA já foi confirmado nela). */
export async function sessionUser(request: Request, env: ServerEnv): Promise<SessionInfo | null> {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const { data, error } = await anonClient(env, token).auth.getUser(token);
  if (error || !data.user) return null;
  return { token, user: data.user, aal: jwtClaims(token).aal === 'aal2' ? 'aal2' : 'aal1', mfa: hasVerifiedFactor(data.user) };
}
/** Conta com 2FA ativo só passa com sessão aal2. */
export const needsSecondFactor = (s: Pick<SessionInfo, 'mfa' | 'aal'>) => s.mfa && s.aal !== 'aal2';
export type MailError = 'rate' | 'delivery' | 'other';
/** O que fazer com o erro de um pedido que dispara email: esperar (limite de envio), avisar que o email não saiu (SMTP recusado, provedor fora, rede) ou tratar como erro de quem digitou. */
export function classifyMailError(error: { status?: number; code?: string }): MailError {
  const status = error.status ?? 0;
  if (status === 429 || error.code === 'over_email_send_rate_limit') return 'rate';
  if (status === 0 || status >= 500 || error.code === 'unexpected_failure' || error.code === 'email_address_not_authorized') return 'delivery';
  return 'other';
}
/** Com a confirmação de email ligada, cadastrar um email que já tem conta "funciona", mas o Supabase devolve um usuário sem identidades. */
export const emailAlreadyRegistered = (user: Pick<User, 'identities'> | null | undefined) => !!user && Array.isArray(user.identities) && user.identities.length === 0;
/** Log do servidor (Vercel) só com o essencial: nunca email, IP, senha ou o texto do erro. */
export function logAuthFailure(action: string, error: { status?: number; code?: string }) { console.error(`[auth] ${action} falhou: status=${error.status ?? '?'} code=${error.code ?? '?'}`); }
/** Email do login: o próprio email, ou o do dono do username. Nunca expõe tabelas administrativas ao navegador. */
export async function resolveEmail(admin: SupabaseClient, identifier: string): Promise<string | null> {
  if (identifier.includes('@')) return identifier;
  if (!/^[a-z0-9_]{3,24}$/.test(identifier)) return null;
  const profile = await admin.from('profiles').select('id').eq('username', identifier).maybeSingle();
  if (profile.error || !profile.data) return null;
  const account = await admin.auth.admin.getUserById(profile.data.id);
  return account.data.user?.email ?? null;
}
