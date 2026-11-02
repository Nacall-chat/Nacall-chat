import { createClient } from '@supabase/supabase-js';
import { RoomServiceClient } from 'livekit-server-sdk';

const names = ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','LIVEKIT_URL','LIVEKIT_API_KEY','LIVEKIT_API_SECRET'];
if (names.some(name=>!process.env[name])) throw new Error('Preencha as cinco variáveis locais antes de verificar.');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
const { error } = await db.from('profiles').select('id').limit(1);
if (error?.code !== '42501') throw new Error(`Resultado inesperado no acesso anônimo: ${error?.code ?? 'leitura permitida'}`);
console.log('Supabase: conexão real confirmada; leitura anônima de perfis bloqueada por permissão.');
const settingsResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {headers:{apikey:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}});
if (!settingsResponse.ok) throw new Error('Não foi possível verificar as configurações de Auth.');
const settings = await settingsResponse.json();
console.log(JSON.stringify({emailLoginEnabled:settings.external?.email,signupsDisabled:settings.disable_signup,emailAutoConfirmed:settings.mailer_autoconfirm}));
const rooms = new RoomServiceClient(process.env.LIVEKIT_URL.replace(/^wss:/,'https:'),process.env.LIVEKIT_API_KEY,process.env.LIVEKIT_API_SECRET);
await rooms.listRooms();
console.log('LiveKit: autenticação real de servidor confirmada. Nenhuma sala ou sessão foi criada.');
