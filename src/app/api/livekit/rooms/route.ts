import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {roomSnapshots} from '@/lib/livekit-rooms';
export const runtime='nodejs';
export async function POST(request:Request){
 const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
 if(!process.env.LIVEKIT_API_SECRET||!process.env.NEXT_PUBLIC_SUPABASE_URL)return reply({error:'Chamadas não configuradas'},503);
 const auth=request.headers.get('authorization');if(!auth?.startsWith('Bearer '))return reply({error:'Entre na sua conta'},401);
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
 const user=await db.auth.getUser(auth.slice(7));if(user.error||!user.data.user)return reply({error:'Sessão inválida'},401);
 if(Number(request.headers.get('content-length')||0)>4096)return reply({error:'Pedido muito grande'},413);
 const parsed=z.object({channelIds:z.array(z.uuid()).max(30)}).safeParse(await request.json().catch(()=>null));if(!parsed.success)return reply({error:'Canais inválidos'},400);
 if(!parsed.data.channelIds.length)return reply({rooms:[],serverNow:Date.now()});
 const channels=await db.from('channels').select('id').in('id',parsed.data.channelIds).eq('kind','voice');if(channels.error)return reply({error:'Não foi possível validar os canais'},503);
 try{return reply({rooms:await roomSnapshots((channels.data??[]).map(c=>c.id)),serverNow:Date.now()});}catch{return reply({error:'Não foi possível consultar as chamadas agora'},503);}
}
