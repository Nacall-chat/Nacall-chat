import test from 'node:test';
import assert from 'node:assert/strict';
import {GET} from '../src/app/api/community/route';

test('contador público entrega só o total, sem registros nem erros internos',async t=>{
 const previousUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const previousKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const originalFetch=globalThis.fetch;
 try{
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://qa.example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY='qa-not-a-real-secret';
  await t.test('consulta somente cabeçalho e devolve agregado sem cache',async()=>{
   globalThis.fetch=async(input,options)=>{
    assert.match(String(input),/\/rest\/v1\/profiles\?select=id$/);
    assert.equal(options?.method,'HEAD');
    return new Response(null,{status:200,headers:{'content-range':'*/42'}});
   };
   const response=await GET();
   assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
   assert.deepEqual(await response.json(),{count:42});
  });
  await t.test('falha não divulga erro interno nem inventa zero cadastros',async()=>{
   globalThis.fetch=async()=>new Response(JSON.stringify({message:'private internal database details'}),{status:403});
   const response=await GET();assert.equal(response.status,503);
   assert.deepEqual(await response.json(),{error:'Contagem temporariamente indisponível.'});
  });
  await t.test('sem configuração devolve indisponibilidade',async()=>{
   delete process.env.SUPABASE_SERVICE_ROLE_KEY;
   assert.equal((await GET()).status,503);
  });
 }finally{
  globalThis.fetch=originalFetch;
  if(previousUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=previousUrl;
  if(previousKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=previousKey;
 }
});
