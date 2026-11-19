import {z} from 'zod';
import {adminClient,reply,serverEnv,sessionUser,needsSecondFactor,emailPending} from '@/lib/auth-server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const env=serverEnv();if(!env)return reply({error:'Indisponível'},503);
 const s=await sessionUser(request,env);if(!s||needsSecondFactor(s)||emailPending(s.user))return reply({error:'Sessão inválida'},401);
 const id=z.string().uuid().safeParse(new URL(request.url).searchParams.get('user'));
 if(!id.success)return reply({error:'Perfil inválido'},400);
 // Only public cosmetic benefits; never expose order or payment identifiers.
 const {data,error}=await adminClient(env).from('store_orders').select('product,expires_at').eq('user_id',id.data).eq('status','paid').gt('expires_at',new Date().toISOString());
 if(error)return reply({benefits:[]});
 return reply({benefits:data??[]});
}
