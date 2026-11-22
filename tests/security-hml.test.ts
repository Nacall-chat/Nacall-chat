import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import config,{CSP_ENFORCED,CSP_REPORT_ONLY} from '../next.config';
import {GET as musicInfo} from '../src/app/api/music/info/route';

// Achados do teste de segurança ao vivo no HML (.app), 22/11/2026.
const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('o site manda Content-Security-Policy: regras seguras aplicadas e a política completa em modo relatório',async()=>{
 const rules=await config.headers!();
 const headers=Object.fromEntries(rules[0].headers.map(h=>[h.key,h.value]));
 assert.equal(headers['Content-Security-Policy'],CSP_ENFORCED);
 for(const rule of ["object-src 'none'","base-uri 'self'","form-action 'self'","frame-ancestors 'none'"])assert.ok(CSP_ENFORCED.includes(rule),rule);
 assert.equal(headers['Content-Security-Policy-Report-Only'],CSP_REPORT_ONLY);
 assert.match(CSP_REPORT_ONLY,/default-src 'self'/);
 assert.match(CSP_REPORT_ONLY,/connect-src [^;]*wss:\/\/\*\.supabase\.co[^;]*wss:\/\/\*\.livekit\.cloud/,'call e tempo real liberados');
 assert.match(CSP_REPORT_ONLY,/frame-src https:\/\/www\.youtube\.com/,'música do YouTube liberada');
 assert.equal(headers['X-Frame-Options'],'DENY','os cabeçalhos que já existiam continuam');
});

test('usar o código de recuperação ou desativar o 2FA derruba as OUTRAS sessões (a desta pessoa continua)',async()=>{
 const src=await read('src/app/api/auth/mfa/route.ts');
 const remove=src.slice(src.indexOf('const removeFactors'),src.indexOf('try {'));
 assert.match(remove,/admin\.auth\.admin\.signOut\(session\.token, 'others'\)/,'sessões aal1 abertas em outro aparelho caem');
 assert.doesNotMatch(remove,/'global'/,'não derruba a própria sessão: o app renova logo depois do código (src/components/mfa.tsx)');
 assert.equal((src.match(/await removeFactors\(\)/g)??[]).length,2,'vale para use-code e para disable');
});

test('/api/music/info: limite por IP (antes qualquer um usava o servidor como proxy do YouTube)',async()=>{
 const saved={url:process.env.NEXT_PUBLIC_SUPABASE_URL,anon:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,service:process.env.SUPABASE_SERVICE_ROLE_KEY};
 const original=globalThis.fetch;const buckets=new Map<string,number>();let youtube=0;
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://qa.example.invalid';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='qa-anon';process.env.SUPABASE_SERVICE_ROLE_KEY='qa-service';
 globalThis.fetch=async(input,options)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.pathname==='/rest/v1/rpc/consume_rate_limit'){const body=JSON.parse(String(options?.body)) as {bucket_key:string;max_attempts:number};const n=(buckets.get(body.bucket_key)??0)+1;buckets.set(body.bucket_key,n);return Response.json(n<=body.max_attempts);}
  if(url.hostname==='www.youtube.com'){youtube++;return Response.json({title:'Música',author_name:'Artista'});}
  throw new Error(`chamada inesperada: ${url.href}`);
 };
 try{
  const get=(ip:string)=>musicInfo(new Request('https://qa.example.invalid/api/music/info?id=dQw4w9WgXcQ',{headers:{'x-forwarded-for':ip}}));
  const statuses:number[]=[];for(let i=0;i<61;i++)statuses.push((await get('203.0.113.5')).status);
  assert.deepEqual(statuses,[...Array(60).fill(200),429],'60 por 5 minutos por IP');
  assert.equal(youtube,60,'o pedido barrado não chega ao YouTube');
  assert.equal((await get('198.51.100.9')).status,200,'outra pessoa continua usando');
 }finally{
  globalThis.fetch=original;
  process.env.NEXT_PUBLIC_SUPABASE_URL=saved.url;process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY=saved.anon;process.env.SUPABASE_SERVICE_ROLE_KEY=saved.service;
 }
});
