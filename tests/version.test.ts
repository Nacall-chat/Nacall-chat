import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GET} from '../src/app/api/version/route';

test('/api/version devolve a versão do deploy, sem cache, e vazio quando não há versão',async()=>{
 const before=process.env.VERCEL_GIT_COMMIT_SHA;
 try{
  process.env.VERCEL_GIT_COMMIT_SHA='abc1234';
  const ok=GET();
  assert.deepEqual(await ok.json(),{id:'abc1234'});
  assert.equal(ok.headers.get('cache-control'),'no-store');
  delete process.env.VERCEL_GIT_COMMIT_SHA;
  assert.deepEqual(await GET().json(),{id:''},'em desenvolvimento não há versão, e o app não avisa de atualização');
 }finally{if(before===undefined)delete process.env.VERCEL_GIT_COMMIT_SHA;else process.env.VERCEL_GIT_COMMIT_SHA=before;}
});
