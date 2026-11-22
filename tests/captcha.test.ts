import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {POST} from '../src/app/api/auth/route';
import {authSchema,emailChangeSchema,mfaSchema,passwordChangeSchema} from '../src/lib/auth-schema';
import {CSP_REPORT_ONLY} from '../next.config';

// Teste ao vivo no HML (22/11/2026): com a chave pública dá para tentar senhas direto em …supabase.co/auth/v1/token,
// fora dos limites de /api/auth. O que fecha isso é o CAPTCHA do próprio Supabase; o app precisa mandar o token do
// Cloudflare Turnstile em toda chamada que confere senha ou dispara email, senão o login para quando o CAPTCHA ligar.
const url='https://qa.example.invalid';
const email='qa@exemplo.com';
const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

function fakeSupabase(sent:Record<string,unknown>,gotrue:(path:string)=>Response|undefined=()=>undefined){
 return async(input:RequestInfo|URL,options?:RequestInit)=>{
  const target=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);const path=target.pathname;
  if(path.startsWith('/auth/v1/')&&options?.body)sent[path]=JSON.parse(String(options.body));
  const custom=gotrue(path);if(custom)return custom;
  if(path==='/rest/v1/rpc/consume_rate_limit')return Response.json(true);
  if(path==='/rest/v1/rpc/purge_unconfirmed_accounts')return Response.json(0);
  if(path==='/rest/v1/rpc/email_status')return Response.json('confirmed');
  if(path==='/rest/v1/profiles')return Response.json([]);
  if(path==='/auth/v1/signup')return Response.json({id:'33333333-3333-4333-8333-333333333333',email,identities:[{id:'1'}],user_metadata:{}});
  if(path==='/auth/v1/token')return Response.json({access_token:'qa-a',refresh_token:'qa-r',token_type:'bearer',expires_in:3600,user:{id:'1',email}});
  if(path==='/auth/v1/recover'||path==='/auth/v1/resend')return Response.json({});
  throw new Error(`chamada inesperada: ${path}`);
 };
}
const post=(body:unknown)=>POST(new Request(`${url}/api/auth`,{method:'POST',headers:{'x-forwarded-for':'203.0.113.9'},body:JSON.stringify(body)}));
const captchaOf=(body:unknown)=>(body as {gotrue_meta_security?:{captcha_token?:string}}|undefined)?.gotrue_meta_security?.captcha_token;

test('o servidor repassa o token do CAPTCHA ao Supabase em login, cadastro, reenvio e recuperação',async t=>{
 const saved={url:process.env.NEXT_PUBLIC_SUPABASE_URL,anon:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,service:process.env.SUPABASE_SERVICE_ROLE_KEY};
 const original=globalThis.fetch;
 process.env.NEXT_PUBLIC_SUPABASE_URL=url;process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='qa-anon';process.env.SUPABASE_SERVICE_ROLE_KEY='qa-service';
 try{
  const cases:[string,unknown,string][]=[
   ['login',{action:'login',identifier:email,password:'Senha-Certa-123!',captchaToken:'tok-login'},'/auth/v1/token'],
   ['cadastro',{action:'signup',username:'nick_qa',displayName:'QA',email,password:'Tr0ca-Esta-Senha!',confirmPassword:'Tr0ca-Esta-Senha!',captchaToken:'tok-signup'},'/auth/v1/signup'],
   ['reenvio',{action:'resend',email,captchaToken:'tok-resend'},'/auth/v1/resend'],
   ['recuperação',{action:'recover',email,captchaToken:'tok-recover'},'/auth/v1/recover'],
  ];
  for(const [name,body,path] of cases)await t.test(name,async()=>{
   const sent:Record<string,unknown>={};globalThis.fetch=fakeSupabase(sent);
   const r=await post(body);assert.ok(r.status<300,`${name}: ${r.status}`);
   assert.equal(captchaOf(sent[path]),(body as {captchaToken:string}).captchaToken,`${name}: o token chega ao Supabase`);
  });
  await t.test('sem chave do Turnstile no site (sem token): continua funcionando como hoje',async()=>{
   const sent:Record<string,unknown>={};globalThis.fetch=fakeSupabase(sent);
   assert.equal((await post({action:'login',identifier:email,password:'Senha-Certa-123!'})).status,200);
   assert.equal(captchaOf(sent['/auth/v1/token']),undefined);
  });
  await t.test('Supabase recusa o CAPTCHA: a pessoa vê "não é um robô", não "senha errada"',async()=>{
   const refused=()=>new Response(JSON.stringify({code:400,error_code:'captcha_failed',msg:'captcha protection: request disallowed'}),{status:400});
   for(const [body,path] of [[{action:'login',identifier:email,password:'Senha-Certa-123!'},'/auth/v1/token'],[{action:'recover',email},'/auth/v1/recover'],[{action:'resend',email},'/auth/v1/resend']] as const){
    globalThis.fetch=fakeSupabase({},p=>p===path?refused():undefined);
    const r=await post(body);const data=await r.json() as {code?:string;error?:string};
    assert.equal(r.status,400);assert.equal(data.code,'captcha_failed',path);assert.match(String(data.error),/robô/);
   }
  });
 }finally{
  globalThis.fetch=original;
  process.env.NEXT_PUBLIC_SUPABASE_URL=saved.url;process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY=saved.anon;process.env.SUPABASE_SERVICE_ROLE_KEY=saved.service;
 }
});

test('os schemas aceitam o token (opcional e com tamanho limitado) em todas as ações que pedem CAPTCHA',()=>{
 const tok={captchaToken:'tok'};
 assert.equal((authSchema.parse({action:'login',identifier:email,password:'x',...tok}) as {captchaToken?:string}).captchaToken,'tok');
 assert.equal((authSchema.parse({action:'recover',email,...tok}) as {captchaToken?:string}).captchaToken,'tok');
 assert.equal((authSchema.parse({action:'resend',email,...tok}) as {captchaToken?:string}).captchaToken,'tok');
 assert.equal((emailChangeSchema.parse({action:'request',email,...tok}) as {captchaToken?:string}).captchaToken,'tok');
 assert.equal(passwordChangeSchema.parse({current:'x',password:'Tr0ca-Esta-Senha!',confirmPassword:'Tr0ca-Esta-Senha!',...tok}).captchaToken,'tok');
 assert.equal((mfaSchema.parse({action:'disable',password:'x',...tok}) as {captchaToken?:string}).captchaToken,'tok');
 assert.equal(authSchema.safeParse({action:'login',identifier:email,password:'x',captchaToken:'a'.repeat(5000)}).success,false,'token gigante recusado');
});

test('as telas mandam o token nas 7 ações e as rotas de senha/2FA/email repassam ao Supabase',async()=>{
 const auth=await read('src/components/auth.tsx'),mfa=await read('src/components/mfa.tsx'),mail=await read('src/components/email-update.tsx');
 for(const action of ['login','signup','recover','resend'])assert.match(auth,new RegExp(`action:'${action}'[^)]*captchaToken:await captcha\\.token\\(\\)`),action);
 assert.match(mfa,/'\/api\/auth\/password',\{[^}]*captchaToken:await captcha\.token\(\)/);
 assert.match(mfa,/action:'disable',[^}]*captchaToken:await captcha\.token\(\)/);
 assert.match(mail,/action:'request',[^}]*captchaToken:await captcha\.token\(\)/);
 for(const file of [auth,mfa,mail])assert.match(file,/\{captcha\.slot\}/,'o espaço do desafio está na tela');
 assert.match(await read('src/app/api/auth/password/route.ts'),/signInWithPassword\([^)]*captchaToken: parsed\.data\.captchaToken/);
 assert.match(await read('src/app/api/auth/mfa/route.ts'),/signInWithPassword\([^)]*captchaToken: input\.captchaToken/);
 assert.match(await read('src/app/api/auth/email/route.ts'),/signInWithOtp\([^)]*captchaToken: input\.captchaToken/);
});

test('a CSP (modo relatório) libera o script e o iframe do Turnstile',()=>{
 assert.match(CSP_REPORT_ONLY,/script-src [^;]*https:\/\/challenges\.cloudflare\.com/);
 assert.match(CSP_REPORT_ONLY,/frame-src [^;]*https:\/\/challenges\.cloudflare\.com/);
});
