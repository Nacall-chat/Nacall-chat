import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
/** Trecho de um job do workflow (do nome do job até o próximo job de mesmo nível). */
const job=(yaml:string,name:string)=>{const start=yaml.indexOf(`\n  ${name}:\n`);assert.ok(start>=0,`job ${name} existe`);const rest=yaml.slice(start+1);const next=rest.slice(1).search(/\n  [a-z]+:\n/);return next<0?rest:rest.slice(0,next+1);};

// Antes, o botão "Run workflow" sempre caía no job de produção: escolhendo a branch release, o PRD recusava (vermelho) e o HML era pulado.
test('o HML sobe por push na release e também pelo botão Run workflow na release',async()=>{
 const yaml=await read('.github/workflows/esteira.yml');
 assert.match(yaml,/push:\s*\n\s*branches: \[release, main\]/);
 assert.match(yaml,/\n  workflow_dispatch:/);
 const hml=job(yaml,'homologacao');
 assert.match(hml,/\n    if: github\.ref == 'refs\/heads\/release'\n/,'a regra é a branch, não o tipo de evento');
 assert.doesNotMatch(hml,/event_name/,'sem prender o HML ao push');
 assert.match(hml,/needs: verificar/);
 assert.match(hml,/secrets\.HML_VERCEL_TOKEN/);
 assert.doesNotMatch(hml,/PRD_/,'o HML nunca usa credencial de produção');
});

test('a produção só roda pelo botão e só na main; nunca sozinha nem em outra branch',async()=>{
 const yaml=await read('.github/workflows/esteira.yml');
 const prd=job(yaml,'producao');
 assert.match(prd,/\n    if: github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'\n/);
 assert.match(prd,/needs: verificar/);
 assert.match(prd,/GITHUB_REF" != "refs\/heads\/main"/,'a conferência dentro do job continua como segunda trava');
 assert.match(prd,/secrets\.PRD_VERCEL_TOKEN/);
});

test('a documentação diz como subir o HML à mão',async()=>{
 const doc=await read('docs/DEPLOY.md');
 assert.match(doc,/Como subir o HML à mão/);
 assert.match(doc,/escolha \*\*`release`\*\*/);
});

// Auditoria Cloudflare (run-1), CI: o site servia o APK mobile-teste-* mais novo de qualquer branch, e os secrets de
// produção ficavam ao alcance de qualquer workflow do repositório.
test('o APK do site só vem de um commit que já está na branch publicada (HML e PRD)',async()=>{
 const yaml=await read('.github/workflows/esteira.yml');
 for(const name of ['homologacao','producao']){
  const j=job(yaml,name);
  assert.match(j,/fetch-depth: 0/,`${name}: histórico completo para conferir o commit do APK`);
  assert.match(j,/git merge-base --is-ancestor "\$SHA" HEAD/,`${name}: confere se o commit do APK está na branch`);
  assert.doesNotMatch(j,/\]\[0\]\.tagName/,`${name}: não pega mais o mobile-teste-* mais novo às cegas`);
 }
});

test('o job de produção usa o ambiente "production" (para os secrets de PRD ficarem presos à main com aprovação)',async()=>{
 const prd=job(await read('.github/workflows/esteira.yml'),'producao');
 assert.match(prd,/\n    environment: production\n/);
 assert.doesNotMatch(job(await read('.github/workflows/esteira.yml'),'homologacao'),/environment: production/,'o HML não usa o ambiente de produção');
});
