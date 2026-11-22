import test from 'node:test';
import assert from 'node:assert/strict';
import {POST} from '../src/app/api/auth/route';

// Auditoria Cloudflare (run-1), achado BAIXO: o limite de login contava só o usuário/email digitado. Um anônimo que
// soubesse o email da vítima errava a senha 11 vezes e a vítima, com a senha certa e de qualquer IP, levava 429.
// Agora o limite apertado é por IP + usuário; o teto por conta só é atingido por quem já passou do primeiro limite.
// Esta rota real roda contra um Supabase de mentira com um contador de verdade no lugar do consume_rate_limit.
const url='https://qa.example.invalid';
const victim='vitima@exemplo.com';
const goodPassword='Senha-Certa-123!';

function fakeSupabase(){
 const buckets=new Map<string,number>();
 return async(input:RequestInfo|URL,options?:RequestInit)=>{
  const target=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(target.pathname==='/rest/v1/rpc/consume_rate_limit'){
   const body=JSON.parse(String(options?.body)) as {bucket_key:string;max_attempts:number};
   const used=(buckets.get(body.bucket_key)??0)+1;buckets.set(body.bucket_key,used);
   return Response.json(used<=body.max_attempts);
  }
  if(target.pathname==='/auth/v1/token'){
   const body=JSON.parse(String(options?.body)) as {password:string};
   if(body.password!==goodPassword)return new Response(JSON.stringify({code:400,error_code:'invalid_credentials',msg:'Invalid login credentials'}),{status:400});
   return Response.json({access_token:'qa-access',refresh_token:'qa-refresh',token_type:'bearer',expires_in:3600,user:{id:'11111111-1111-4111-8111-111111111111',email:victim}});
  }
  if(target.pathname==='/rest/v1/rpc/email_status')return Response.json('confirmed');
  if(target.pathname==='/auth/v1/recover'||target.pathname==='/auth/v1/resend')return Response.json({});
  throw new Error(`chamada inesperada: ${target.pathname}`);
 };
}
const post=(ip:string,body:unknown)=>POST(new Request(`${url}/api/auth`,{method:'POST',headers:{'x-forwarded-for':ip},body:JSON.stringify(body)}));
const login=(ip:string,password:string)=>post(ip,{action:'login',identifier:victim,password});

test('login: quem erra trava só o próprio IP; a vítima entra de outro lugar',async t=>{
 const saved={url:process.env.NEXT_PUBLIC_SUPABASE_URL,anon:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,service:process.env.SUPABASE_SERVICE_ROLE_KEY};
 const original=globalThis.fetch;
 process.env.NEXT_PUBLIC_SUPABASE_URL=url;process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='qa-anon';process.env.SUPABASE_SERVICE_ROLE_KEY='qa-service';
 try{
  await t.test('o ataque da auditoria (11 senhas erradas de um IP) não tira mais a vítima da conta',async()=>{
   globalThis.fetch=fakeSupabase();
   const statuses:number[]=[];
   for(let i=0;i<11;i++)statuses.push((await login('203.0.113.66','chute-errado')).status);
   assert.deepEqual(statuses,[...Array(10).fill(401),429],'o atacante é barrado no 11º chute');
   assert.equal((await login('198.51.100.7',goodPassword)).status,200,'a vítima entra com a senha certa de outro IP');
  });
  await t.test('o teto por conta ainda segura um ataque espalhado, mas exige muitos IPs',async()=>{
   globalThis.fetch=fakeSupabase();
   for(let n=1;n<=9;n++)for(let i=0;i<12;i++)await login(`203.0.113.${n}`,'chute-errado');
   assert.equal((await login('198.51.100.7',goodPassword)).status,200,'9 IPs x 10 chutes ainda não travam a conta');
   for(let i=0;i<10;i++)await login('203.0.113.10','chute-errado');
   assert.equal((await login('198.51.100.8',goodPassword)).status,429,'com ~10 IPs o teto de 100 por conta segura a força bruta');
  });
  await t.test('reenvio de código e recuperação de senha: o mesmo esquema (IP + email, com teto por email)',async()=>{
   globalThis.fetch=fakeSupabase();
   for(const action of ['resend','recover']){
    const statuses:number[]=[];
    for(let i=0;i<4;i++)statuses.push((await post('203.0.113.66',{action,email:victim})).status);
    assert.deepEqual(statuses,[200,200,200,429],`${action}: o atacante para no 4º pedido`);
    assert.equal((await post('198.51.100.7',{action,email:victim})).status,200,`${action}: a vítima ainda pede o próprio código`);
   }
  });
 }finally{
  globalThis.fetch=original;
  process.env.NEXT_PUBLIC_SUPABASE_URL=saved.url;process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY=saved.anon;process.env.SUPABASE_SERVICE_ROLE_KEY=saved.service;
 }
});
