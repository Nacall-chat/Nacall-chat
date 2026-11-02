import { createClient } from '@supabase/supabase-js';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { authSchema, usernameAlias } from '@/lib/auth-schema';
export const runtime='nodejs';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL, pub=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!pub||!secret)return reply({error:'Login por usuário ainda não configurado no servidor.'},503);
 const origin=request.headers.get('origin');
 if(origin){try{const source=new URL(origin);const host=request.headers.get('host')??new URL(request.url).host;if(!['http:','https:'].includes(source.protocol)||source.host!==host)return reply({error:'Origem não permitida.'},403);}catch{return reply({error:'Origem não permitida.'},403);}}
 let raw='';
 try{const reader=request.body?.getReader();if(!reader)return reply({error:'Formulário vazio.'},400);let size=0;const decoder=new TextDecoder();for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>8192){await reader.cancel();return reply({error:'Formulário muito grande.'},413);}raw+=decoder.decode(part.value,{stream:true});}raw+=decoder.decode();}catch{return reply({error:'Não foi possível ler o formulário.'},400);}
 const parsed=authSchema.safeParse((()=>{try{return JSON.parse(raw)}catch{return null}})());
 if(!parsed.success)return reply({error:parsed.error.issues[0]?.message??'Confira os campos.'},400);
 const input=parsed.data;
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const client=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
 // Vercel supplies the proxy address; never store raw IP or passwords in the database.
 const ip=(request.headers.get('x-vercel-forwarded-for')??request.headers.get('x-forwarded-for')??'local').split(',')[0].trim();
 const bucket=createHmac('sha256',secret).update(`nacall-auth:${ip}`).digest('hex');
 const {data:allowed,error:limitError}=await admin.rpc('consume_auth_attempt',{bucket_key:bucket});
 if(limitError)return reply({error:'O banco precisa da atualização NACALL. Consulte a configuração.'},503);
 if(!allowed)return reply({error:'Muitas tentativas. Dá uma pausa de cinco minutos e tenta de novo.'},429);
 const {data:profile,error:lookupError}=await admin.from('profiles').select('id').eq('username',input.username).maybeSingle();
 if(lookupError)return reply({error:'Não foi possível consultar a conta.'},503);
 let email:string|undefined, userId=profile?.id as string|undefined, recoveryCode:string|undefined;
 if(input.action==='signup'){
  if(profile)return reply({error:'Esse usuário já está na party. Escolha outro nome.'},409);
  const {data,error}=await admin.auth.admin.createUser({email:usernameAlias(input.username),password:input.password,email_confirm:true,user_metadata:{username:input.username,display_name:input.displayName}});
  if(error||!data.user)return reply({error:'Não foi possível criar a conta. O nome pode estar reservado; tente outro.'},400);
  userId=data.user.id;email=data.user.email;recoveryCode=randomBytes(24).toString('base64url');
  const saved=await admin.from('account_recovery').insert({user_id:userId,code_hash:hash(recoveryCode)});
  if(saved.error){await admin.auth.admin.deleteUser(userId);return reply({error:'Não foi possível preparar a recuperação. Tente novamente.'},503);}
 }else{
  if(!userId)return reply({error:'Usuário, senha ou código não conferem.'},401);
  const account=await admin.auth.admin.getUserById(userId);email=account.data.user?.email;
  if(!email)return reply({error:'Usuário, senha ou código não conferem.'},401);
  if(input.action==='recover'){
   const recovery=await admin.from('account_recovery').select('code_hash').eq('user_id',userId).maybeSingle();
   const stored=recovery.data?.code_hash as string|undefined;const supplied=hash(input.recoveryCode);
   if(!stored||stored.length!==supplied.length||!timingSafeEqual(Buffer.from(stored),Buffer.from(supplied)))return reply({error:'Usuário, senha ou código não conferem.'},401);
   recoveryCode=randomBytes(24).toString('base64url');const nextHash=hash(recoveryCode);
   const consumed=await admin.from('account_recovery').update({code_hash:nextHash,updated_at:new Date().toISOString()}).eq('user_id',userId).eq('code_hash',supplied).select('user_id').maybeSingle();
   if(consumed.error||!consumed.data)return reply({error:'Esse código já foi usado. Tente o código mais recente.'},409);
   const changed=await admin.auth.admin.updateUserById(userId,{password:input.password});
   if(changed.error){await admin.from('account_recovery').update({code_hash:supplied}).eq('user_id',userId).eq('code_hash',nextHash);return reply({error:'Não foi possível atualizar sua senha.'},503);}
  }
 }
 const {data,error}=await client.auth.signInWithPassword({email:email!,password:input.password});
 if(error||!data.session){if(input.action==='signup'&&userId)await admin.auth.admin.deleteUser(userId);return reply({error:'Usuário ou senha não conferem. Confira o nome e tente de novo.'},401);}
 // The public response contains tokens only; the account email stays on the server.
 return reply({session:{access_token:data.session.access_token,refresh_token:data.session.refresh_token},recoveryCode});
}
