import test from 'node:test';
import assert from 'node:assert/strict';
import {POST} from '../src/app/api/auth/route';
// Roda a rota real contra um Supabase de mentira (fetch trocado): confere o que a pessoa vê quando o email já existe ou quando o envio falha.
const url='https://qa.example.invalid';
const ownerId='22222222-2222-4222-8222-222222222222';
const email='dona@exemplo.com';
type Stub={profile?:string|null;owner?:{email:string;confirmed:boolean}|null;signup?:Response;recover?:Response;resend?:Response};
const authError=(status:number,code:string,msg:string)=>new Response(JSON.stringify({code:status,error_code:code,msg}),{status});
const newUser=(identities:unknown[])=>Response.json({id:'33333333-3333-4333-8333-333333333333',email,identities,user_metadata:{}});
async function call(body:unknown,stub:Stub={}){
 const calls:string[]=[];const original=globalThis.fetch;
 globalThis.fetch=async(input,options)=>{
  const target=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);const path=target.pathname;calls.push(`${options?.method??'GET'} ${path}`);
  if(path==='/rest/v1/rpc/consume_rate_limit')return Response.json(true);
  if(path==='/rest/v1/rpc/purge_unconfirmed_accounts')return Response.json(0);
  if(path==='/rest/v1/profiles')return Response.json(stub.profile?[{id:stub.profile}]:[]);
  if(path===`/auth/v1/admin/users/${ownerId}`)return stub.owner?Response.json({id:ownerId,email:stub.owner.email,email_confirmed_at:stub.owner.confirmed?'2026-11-03T19:12:11Z':null}):authError(404,'user_not_found','User not found');
  if(path==='/auth/v1/signup')return stub.signup??newUser([{id:'1'}]);
  if(path==='/auth/v1/recover')return stub.recover??Response.json({});
  if(path==='/auth/v1/resend')return stub.resend??Response.json({});
  throw new Error(`chamada inesperada: ${path}`);
 };
 try{
  const response=await POST(new Request(`${url}/api/auth`,{method:'POST',headers:{'x-forwarded-for':'203.0.113.9'},body:JSON.stringify(body)}));
  return {status:response.status,data:await response.json() as Record<string,unknown>,calls};
 }finally{globalThis.fetch=original;}
}
const signup={action:'signup',username:'nick_01',displayName:'Nick',email,password:'Tr0ca-Esta-Senha!',confirmPassword:'Tr0ca-Esta-Senha!'};
test('rota de auth: avisa email/usuário já existentes e nunca diz "enviado" quando o email não sai',async t=>{
 const saved={url:process.env.NEXT_PUBLIC_SUPABASE_URL,anon:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,service:process.env.SUPABASE_SERVICE_ROLE_KEY};
 const logs:string[]=[];const originalError=console.error;
 try{
  process.env.NEXT_PUBLIC_SUPABASE_URL=url;process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='qa-anon';process.env.SUPABASE_SERVICE_ROLE_KEY='qa-service';
  console.error=(...args:unknown[])=>{logs.push(args.join(' '));};
  await t.test('cadastro novo segue e o Supabase envia o código',async()=>{
   const r=await call(signup);assert.equal(r.status,200);assert.deepEqual(r.data,{ok:true,email});
  });
  await t.test('email que já tem conta: avisa com código email_exists (Supabase devolve usuário sem identidades)',async()=>{
   const r=await call(signup,{signup:newUser([])});assert.equal(r.status,409);assert.equal(r.data.code,'email_exists');assert.match(String(r.data.error),/já tem uma conta/);
  });
  await t.test('usuário em uso por outro email: avisa o nick, sem chamar o cadastro',async()=>{
   const r=await call(signup,{profile:ownerId,owner:{email:'outra@exemplo.com',confirmed:true}});
   assert.equal(r.status,409);assert.equal(r.data.code,'username_taken');assert.ok(!r.calls.includes('POST /auth/v1/signup'));
  });
  await t.test('usuário em uso pelo mesmo email já confirmado: diz que o email tem conta',async()=>{
   const r=await call(signup,{profile:ownerId,owner:{email,confirmed:true}});
   assert.equal(r.status,409);assert.equal(r.data.code,'email_exists');assert.ok(!r.calls.includes('POST /auth/v1/signup'));
  });
  await t.test('cadastro que ficou sem confirmar (mesmo usuário e email) refaz o envio do código em vez de travar',async()=>{
   const r=await call(signup,{profile:ownerId,owner:{email,confirmed:false}});
   assert.equal(r.status,200);assert.ok(r.calls.includes('POST /auth/v1/signup'));
  });
  await t.test('SMTP recusado no cadastro: erro claro, nunca sucesso',async()=>{
   logs.length=0;const r=await call(signup,{signup:authError(500,'unexpected_failure','Error sending confirmation email')});
   assert.equal(r.status,503);assert.equal(r.data.code,'mail_failed');assert.match(String(r.data.error),/não conseguimos enviar/i);
   assert.ok(logs.some(l=>l.includes('signup falhou')&&l.includes('status=500')));// o auth-js não traz o code em respostas 500; o status basta
   assert.ok(logs.every(l=>!l.includes(email)));// o log não carrega o email
  });
  await t.test('esqueci a senha: com SMTP recusado NÃO responde ok (o bug do código que nunca chegava)',async()=>{
   logs.length=0;const r=await call({action:'recover',email},{recover:authError(500,'unexpected_failure','Error sending recovery email')});
   assert.equal(r.status,503);assert.equal(r.data.code,'mail_failed');assert.equal(r.data.ok,undefined);
   assert.ok(logs.some(l=>l.includes('recover falhou')&&l.includes('status=500')));assert.ok(logs.every(l=>!l.includes(email)));
  });
  await t.test('esqueci a senha: envio normal responde ok; limite de envio pede para aguardar',async()=>{
   assert.deepEqual((await call({action:'recover',email})).data,{ok:true});
   const wait=await call({action:'recover',email},{recover:authError(429,'over_email_send_rate_limit','For security purposes, you can only request this after 45 seconds.')});
   assert.equal(wait.status,429);assert.equal(wait.data.code,'rate_limited');
  });
  await t.test('reenviar código: falha de envio aparece; limite pede para aguardar; ok segue',async()=>{
   assert.equal((await call({action:'resend',email})).status,200);
   assert.equal((await call({action:'resend',email},{resend:authError(500,'unexpected_failure','Error sending confirmation email')})).status,503);
   assert.equal((await call({action:'resend',email},{resend:authError(429,'over_email_send_rate_limit','wait')})).status,429);
  });
 }finally{
  console.error=originalError;
  for(const [key,value] of [['NEXT_PUBLIC_SUPABASE_URL',saved.url],['NEXT_PUBLIC_SUPABASE_ANON_KEY',saved.anon],['SUPABASE_SERVICE_ROLE_KEY',saved.service]] as const){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 }
});
