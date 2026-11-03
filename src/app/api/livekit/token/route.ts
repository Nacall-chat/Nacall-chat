import { createClient } from '@supabase/supabase-js';
import { AccessToken, TrackSource } from 'livekit-server-sdk';
import {roomSnapshots} from '@/lib/livekit-rooms';
import { tokenSchema } from '@/lib/validation';
import { hasVerifiedFactor, jwtClaims } from '@/lib/auth-server';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const host = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  const fail = (error: string, status: number) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
  if (!url || !anon || !host || !key || !secret || host.includes('YOUR_PROJECT') || key.startsWith('YOUR_')) return fail('Chamadas indisponíveis: configure Supabase e LiveKit no servidor.', 503);
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return fail('Entre na sua conta.', 401);
  const db = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await db.auth.getUser(auth.slice(7));
  if (error || !user) return fail('Sessão inválida.', 401);
  // Conta com 2FA só entra em call com a sessão que confirmou o código do app autenticador.
  if (hasVerifiedFactor(user) && jwtClaims(auth.slice(7)).aal !== 'aal2') return fail('Confirme o 2FA para entrar nas calls.', 401);
  const parsed = tokenSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('Canal inválido.', 400);
  // SELECT runs with the caller JWT and RLS: membership is checked by PostgreSQL.
  const { data: channel } = await db.from('channels').select('id,kind').eq('id', parsed.data.channelId).eq('kind', 'voice').single();
  if (!channel) return fail('Você não tem acesso a este canal de voz.', 403);
  const { data: allowed, error: limitError } = await db.rpc('allow_voice_token');
  if (limitError) return fail('Não foi possível validar o limite de chamadas.', 503);
  if (!allowed) return fail('Aguarde um minuto antes de reconectar.', 429);
  const { data: profile } = await db.from('profiles').select('display_name,avatar_path').eq('id', user.id).single();
  const avatar = profile?.avatar_path ? db.storage.from('avatars').getPublicUrl(profile.avatar_path).data.publicUrl : '';
  let startedAt:number|null=null;try{startedAt=(await roomSnapshots([channel.id]))[0]?.startedAt??null;}catch{}
  const token = new AccessToken(key, secret, { identity: user.id, name: profile?.display_name ?? 'Jogador', metadata: JSON.stringify({avatar}), ttl: '5m' });
  token.addGrant({ roomJoin: true, room: `channel-${channel.id}`, canPublish: true, canSubscribe: true, canPublishData: false, canUpdateOwnMetadata: true, canPublishSources: [TrackSource.MICROPHONE,TrackSource.CAMERA,TrackSource.SCREEN_SHARE,TrackSource.SCREEN_SHARE_AUDIO] });
  return Response.json({ token: await token.toJwt(), serverUrl: host, startedAt }, { headers: { 'Cache-Control': 'no-store' } });
}
