import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GET} from '../src/app/api/version/route';
import {versionId} from '../src/lib/version-id';

test('/api/version devolve a versão do deploy, sem cache, e vazio quando não há versão',async()=>{
 const before=process.env.VERCEL_GIT_COMMIT_SHA;
 try{
  process.env.VERCEL_GIT_COMMIT_SHA='abc1234';
  const ok=GET();
  const body=await ok.json() as {id:string};
  assert.match(body.id,/^[0-9a-f]{16}$/,'impressão do commit');assert.equal(body.id,versionId('abc1234'));
  assert.ok(!body.id.includes('abc1234'),'não revela o commit publicado');
  assert.notEqual(versionId('abc1234'),versionId('abc1235'),'muda a cada deploy (o sino detecta a versão nova)');
  assert.equal(ok.headers.get('cache-control'),'no-store');
  delete process.env.VERCEL_GIT_COMMIT_SHA;
  assert.deepEqual(await GET().json(),{id:''},'em desenvolvimento não há versão, e o app não avisa de atualização');
 }finally{if(before===undefined)delete process.env.VERCEL_GIT_COMMIT_SHA;else process.env.VERCEL_GIT_COMMIT_SHA=before;}
});
