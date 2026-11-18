import test from 'node:test';
import assert from 'node:assert/strict';
import {POST as authPost} from '../src/app/api/auth/route';
import {POST as emailPost} from '../src/app/api/auth/email/route';
// Rotas reais contra um Supabase de mentira (fetch trocado): login com nick livre e a confirmação de email das contas antigas.
const url='https://qa.example.invalid';
const me='44444444-4444-4444-8444-444444444444';
const other='55555555-5555-4555-8555-555555555555';
const authError=(status:number,code:string,msg:string)=>new Response(JSON.stringify({code:status,error_code:code,msg}),{status});
type World={appMeta?:Record<string,unknown>;userEmail?:string;putUser?:Response;otp?:Response;verifyUserId?:string;verify?:Response};
async function run(path:'auth'|'email',body:unknown,world:World={},token:string|null='a.b.c'){
 const calls:{method:string;path:string;query:string;body:string}[]=[];const original=globalThis.fetch;
 globalThis.fetch=async(input,options)=>{
  const target=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);const method=options?.method??'GET';
  calls.push({method,path:target.pathname,query:decodeURIComponent(target.search),body:typeof options?.body==='string'?options.body:''});
  const p=target.pathname;
  if(p==='/rest/v1/rpc/consume_rate_limit')return Response.json(true);
  if(p==='/rest/v1/profiles')return Response.json([{id:me}]);
  if(p===`/auth/v1/admin/users/${me}`&&method==='GET')return Response.json({id:me,email:world.userEmail??'dona@exemplo.com',email_confirmed_at:'2026-11-03T19:12:11Z'});
  if(p===`/auth/v1/admin/users/${me}`&&method==='PUT')return Response.json({id:me});
  if(p==='/auth/v1/token')return Response.json({access_token:'tok',refresh_token:'ref',token_type:'bearer',expires_in:3600,user:{id:me}});
  if(p==='/auth/v1/user'&&method==='GET')return Response.json({id:me,email:world.userEmail??'dona@exemplo.com',app_metadata:world.appMeta??{},factors:[]});
  if(p==='/auth/v1/user'&&method==='PUT')return world.putUser??Response.json({id:me});
  if(p==='/auth/v1/otp')return world.otp??Response.json({});
  if(p==='/auth/v1/verify')return world.verify??Response.json({access_token:'t',refresh_token:'r',token_type:'bearer',expires_in:3600,user:{id:world.verifyUserId??me}});
  throw new Error(`chamada inesperada: ${method} ${p}`);
 };
 try{
  const route=path==='auth'?authPost:emailPost;
  const headers:Record<string,string>={'x-forwarded-for':'203.0.113.9',...(token?{authorization:`Bearer ${token}`}:{})};
  const response=await route(new Request(`${url}/api/${path==='auth'?'auth':'auth/email'}`,{method:'POST',headers,body:JSON.stringify(body)}));
  return {status:response.status,data:await response.json() as Record<string,unknown>,calls};
 }finally{globalThis.fetch=original;}
}
const pending={email_pending:true};
test('nick livre e email das contas antigas',async t=>{
 const saved={url:process.env.NEXT_PUBLIC_SUPABASE_URL,anon:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,service:process.env.SUPABASE_SERVICE_ROLE_KEY};
 const originalError=console.error;
 try{
  process.env.NEXT_PUBLIC_SUPABASE_URL=url;process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='qa-anon';process.env.SUPABASE_SERVICE_ROLE_KEY='qa-service';
  console.error=()=>undefined;
  await t.test('login com nick com maiúsculas e símbolos procura pela chave minúscula',async()=>{
   const r=await run('auth',{action:'login',identifier:'Gu$tavo_X',password:'Tr0ca-Esta-Senha!'},{},null);
   assert.equal(r.status,200);assert.ok('session' in r.data);
   assert.ok(r.calls.some(c=>c.path==='/rest/v1/profiles'&&c.query.includes('username_key=eq.gu$tavo_x')));
  });
  await t.test('nick com caractere fora da regra não consulta o banco',async()=>{
   const r=await run('auth',{action:'login',identifier:'nick com espaço',password:'x'},{},null);
   assert.equal(r.status,401);assert.ok(!r.calls.some(c=>c.path==='/rest/v1/profiles'));
  });
  await t.test('cadastro procura o nick pela chave minúscula (Maria e maria são o mesmo nick)',async()=>{
   const r=await run('auth',{action:'signup',username:'Maria_X',displayName:'Maria',email:'maria@exemplo.com',password:'Tr0ca-Esta-Senha!',confirmPassword:'Tr0ca-Esta-Senha!'},{userEmail:'outra@exemplo.com'},null);
   assert.equal(r.status,409);assert.equal(r.data.code,'username_taken');
   assert.ok(r.calls.some(c=>c.path==='/rest/v1/profiles'&&c.query.includes('username_key=eq.maria_x')));
  });
  await t.test('sem sessão: 401',async()=>{assert.equal((await run('email',{action:'request',email:'a@b.com'},{},null)).status,401);});
  await t.test('conta nova (sem a marca) não usa a rota',async()=>{
   const r=await run('email',{action:'request',email:'novo@exemplo.com'},{appMeta:{}});assert.equal(r.status,409);assert.ok(!r.calls.some(c=>c.method==='PUT'));
  });
  await t.test('conta antiga com email novo: o Supabase envia o código ao endereço novo',async()=>{
   const r=await run('email',{action:'request',email:'Novo@Exemplo.com'},{appMeta:pending});
   assert.equal(r.status,200);assert.deepEqual(r.data,{ok:true,email:'novo@exemplo.com'});
   const put=r.calls.find(c=>c.method==='PUT'&&c.path==='/auth/v1/user');assert.ok(put);assert.deepEqual(JSON.parse(put.body),{email:'novo@exemplo.com'});
  });
  await t.test('conta antiga confirmando o mesmo email do cadastro: código de acesso ao endereço atual',async()=>{
   const r=await run('email',{action:'request',email:'dona@exemplo.com'},{appMeta:pending,userEmail:'dona@exemplo.com'});
   assert.equal(r.status,200);assert.ok(r.calls.some(c=>c.path==='/auth/v1/otp'));assert.ok(!r.calls.some(c=>c.method==='PUT'&&c.path==='/auth/v1/user'));
  });
  await t.test('email de uso de outra conta: avisa, sem dizer "enviado"',async()=>{
   const r=await run('email',{action:'request',email:'ocupado@exemplo.com'},{appMeta:pending,putUser:authError(422,'email_exists','A user with this email address has already been registered')});
   assert.equal(r.status,409);assert.equal(r.data.code,'email_exists');
  });
  await t.test('SMTP fora do ar: 503, nunca "enviado"',async()=>{
   const r=await run('email',{action:'request',email:'novo@exemplo.com'},{appMeta:pending,putUser:authError(500,'unexpected_failure','Error sending email change email')});
   assert.equal(r.status,503);assert.equal(r.data.code,'mail_failed');
  });
  await t.test('código certo: confirma o email e libera a conta',async()=>{
   const r=await run('email',{action:'confirm',email:'novo@exemplo.com',code:'123456'},{appMeta:pending});
   assert.equal(r.status,200);
   const verify=r.calls.find(c=>c.path==='/auth/v1/verify');assert.ok(verify);assert.equal(JSON.parse(verify.body).type,'email_change');
   const release=r.calls.find(c=>c.method==='PUT'&&c.path===`/auth/v1/admin/users/${me}`);assert.ok(release);assert.deepEqual(JSON.parse(release.body).app_metadata,{email_pending:false});
  });
  await t.test('código de outra conta ou inválido: não libera',async()=>{
   const foreign=await run('email',{action:'confirm',email:'novo@exemplo.com',code:'123456'},{appMeta:pending,verifyUserId:other});
   assert.equal(foreign.status,400);assert.ok(!foreign.calls.some(c=>c.method==='PUT'&&c.path===`/auth/v1/admin/users/${me}`));
   const wrong=await run('email',{action:'confirm',email:'novo@exemplo.com',code:'000000'},{appMeta:pending,verify:authError(403,'otp_expired','Token has expired or is invalid')});
   assert.equal(wrong.status,400);assert.ok(!wrong.calls.some(c=>c.method==='PUT'&&c.path===`/auth/v1/admin/users/${me}`));
  });
 }finally{
  console.error=originalError;
  for(const [key,value] of [['NEXT_PUBLIC_SUPABASE_URL',saved.url],['NEXT_PUBLIC_SUPABASE_ANON_KEY',saved.anon],['SUPABASE_SERVICE_ROLE_KEY',saved.service]] as const){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 }
});
