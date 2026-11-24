import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {z} from 'zod';
import config,{CSP_REPORT_ONLY} from '../next.config';
import {summarizeCspReport} from '../src/lib/csp-report';
import {POST as cspReport} from '../src/app/api/csp-report/route';
import {POST as auth} from '../src/app/api/auth/route';
import '../src/lib/validation';

// Lote 3 das correções das revisões de segurança (ECC + teste ao vivo no HML, 22/11/2026).
const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('CSP: os avisos do modo relatório vão para /api/csp-report',async()=>{
 assert.match(CSP_REPORT_ONLY,/report-uri \/api\/csp-report/);
 assert.match(CSP_REPORT_ONLY,/report-to csp/);
 const headers=Object.fromEntries((await config.headers!())[0].headers.map(h=>[h.key,h.value]));
 assert.equal(headers['Reporting-Endpoints'],'csp="/api/csp-report"');
});

test('relatório de CSP: guarda só diretiva, origem e caminho (sem query, sem token), nos dois formatos',()=>{
 const legacy=JSON.stringify({'csp-report':{'document-uri':'https://nacall.site/app?token=segredo','violated-directive':'script-src-elem','effective-directive':'script-src-elem','blocked-uri':'https://evil.example/x.js?k=1'}});
 assert.deepEqual(summarizeCspReport(legacy),['csp-report: diretiva=script-src-elem bloqueado=https://evil.example página=/app']);
 const modern=JSON.stringify([{type:'csp-violation',body:{documentURL:'https://nacall.site/login?a=1',effectiveDirective:'script-src',blockedURL:'eval'}},{type:'deprecation',body:{}}]);
 assert.deepEqual(summarizeCspReport(modern),['csp-report: diretiva=script-src bloqueado=eval página=/login']);
 assert.deepEqual(summarizeCspReport('não é json'),[]);
 assert.equal(summarizeCspReport(JSON.stringify(Array.from({length:50},()=>({type:'csp-violation',body:{effectiveDirective:'img-src',blockedURL:'https://x.example/a.png',documentURL:'https://nacall.site/'}})))).length,10,'no máximo 10 linhas por pedido');
});

test('/api/csp-report: aceita, recusa corpo gigante e não precisa de login',async()=>{
 const logs:string[]=[];const original=console.warn;console.warn=(...a:unknown[])=>{logs.push(a.join(' '));};
 const saved=process.env.SUPABASE_SERVICE_ROLE_KEY;delete process.env.SUPABASE_SERVICE_ROLE_KEY;
 try{
  const ok=await cspReport(new Request('https://qa.example.invalid/api/csp-report',{method:'POST',body:JSON.stringify({'csp-report':{'document-uri':'https://nacall.site/app','effective-directive':'connect-src','blocked-uri':'wss://outro.example/x'}})}));
  assert.equal(ok.status,204);assert.deepEqual(logs,['csp-report: diretiva=connect-src bloqueado=wss://outro.example página=/app']);
  const big=await cspReport(new Request('https://qa.example.invalid/api/csp-report',{method:'POST',body:'x'.repeat(20000)}));
  assert.equal(big.status,413);
 }finally{console.warn=original;if(saved!==undefined)process.env.SUPABASE_SERVICE_ROLE_KEY=saved;}
});

test('zod sem eval (jitless): a CSP não precisa liberar unsafe-eval',()=>{
 assert.equal((z.config() as {jitless?:boolean}).jitless,true);
 assert.doesNotMatch(CSP_REPORT_ONLY,/unsafe-eval/);
});

test('workflows: actions fixadas por commit (SHA) e o APK só é publicado da release ou da main',async()=>{
 for(const f of (await readdir(new URL('../.github/workflows/',import.meta.url))).filter(f=>f.endsWith('.yml'))){
  const yaml=await read(`.github/workflows/${f}`);
  assert.doesNotMatch(yaml,/uses: actions\/[a-z-]+@v\d/,`${f}: nenhuma action por tag móvel`);
  for(const m of yaml.matchAll(/uses: (actions\/[a-z-]+)@([^\s#]+)/g))assert.match(m[2],/^[0-9a-f]{40}$/,`${f}: ${m[1]} fixada por SHA`);
 }
 const apk=await read('.github/workflows/mobile-apk.yml');
 assert.match(apk,/if: github\.event_name == 'workflow_dispatch' && \(github\.ref == 'refs\/heads\/release' \|\| github\.ref == 'refs\/heads\/main'\)/);
});

test('login: entrar com email ou com nick soma no mesmo limite da conta',async()=>{
 const saved={url:process.env.NEXT_PUBLIC_SUPABASE_URL,anon:process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,service:process.env.SUPABASE_SERVICE_ROLE_KEY};
 const original=globalThis.fetch;const buckets=new Map<string,number>();const keysByCall:string[]=[];
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://qa.example.invalid';process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY='qa-anon';process.env.SUPABASE_SERVICE_ROLE_KEY='qa-service';
 const id='44444444-4444-4444-8444-444444444444';
 globalThis.fetch=async(input,options)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  if(url.pathname==='/rest/v1/rpc/consume_rate_limit'){const b=JSON.parse(String(options?.body)) as {bucket_key:string;max_attempts:number};keysByCall.push(`${b.max_attempts}:${b.bucket_key}`);const n=(buckets.get(b.bucket_key)??0)+1;buckets.set(b.bucket_key,n);return Response.json(n<=b.max_attempts);}
  if(url.pathname==='/rest/v1/profiles')return Response.json({id});
  if(url.pathname===`/auth/v1/admin/users/${id}`)return Response.json({id,email:'vitima@exemplo.com'});
  if(url.pathname==='/auth/v1/token')return new Response(JSON.stringify({code:400,error_code:'invalid_credentials',msg:'Invalid login credentials'}),{status:400});
  throw new Error(`chamada inesperada: ${url.pathname}`);
 };
 try{
  const login=(identifier:string)=>auth(new Request('https://qa.example.invalid/api/auth',{method:'POST',headers:{'x-forwarded-for':'203.0.113.7'},body:JSON.stringify({action:'login',identifier,password:'errada'})}));
  const statuses:number[]=[];
  for(let i=0;i<6;i++){statuses.push((await login('vitima@exemplo.com')).status);statuses.push((await login('vitima_nick')).status);}
  assert.deepEqual(statuses,[...Array(10).fill(401),429,429],'10 tentativas no total, somando email e nick (antes eram 10 + 10)');
  const accountKeys=new Set(keysByCall.filter(k=>k.startsWith('100:')).map(k=>k.slice(4)));
  assert.equal(accountKeys.size,1,'um só balde por conta, seja pelo email ou pelo nick');
 }finally{
  globalThis.fetch=original;
  process.env.NEXT_PUBLIC_SUPABASE_URL=saved.url;process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY=saved.anon;process.env.SUPABASE_SERVICE_ROLE_KEY=saved.service;
 }
});
