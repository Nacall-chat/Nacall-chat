import {createClient} from '@supabase/supabase-js';
import {randomBytes,createHash} from 'node:crypto';
export const runtime='nodejs';
export async function POST(request:Request){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key||!secret)return Response.json({error:'Recuperação ainda não configurada.'},{status:503});
 const token=request.headers.get('authorization')?.replace(/^Bearer /,'');if(!token)return Response.json({error:'Entre na conta.'},{status:401});
 const publicClient=createClient(url,key,{auth:{persistSession:false}});const{data:{user},error}=await publicClient.auth.getUser(token);
 if(error||!user)return Response.json({error:'Sessão inválida.'},{status:401});
 const admin=createClient(url,secret,{auth:{persistSession:false}});const code=randomBytes(24).toString('base64url');
 const result=await admin.from('account_recovery').upsert({user_id:user.id,code_hash:createHash('sha256').update(code).digest('hex'),updated_at:new Date().toISOString()});
 if(result.error)return Response.json({error:'Não foi possível gerar o código.'},{status:503});
 return Response.json({code},{headers:{'Cache-Control':'no-store'}});
}
