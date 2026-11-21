import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('landing: o botão do Android baixa o APK de teste e deixa claro que é uma versão de teste',async()=>{
 const landing=await read('src/components/landing.tsx');
 assert.match(landing,/<a className="download-ready" href="\/downloads\/nacall-android\.apk" download/);
 assert.match(landing,/Versão de teste/);
 assert.match(landing,/download-note/,'nota explicando o que o app já tem e o aviso de fonte desconhecida');
 assert.match(landing,/<button disabled aria-label="Download para Windows — em breve">/,'o Windows continua "em breve"');
 assert.doesNotMatch(landing,/Download para Android — em breve/);
});

test('esteira: HML e PRD baixam o APK mais recente antes do deploy, sem derrubar o deploy se faltar',async()=>{
 const esteira=await read('.github/workflows/esteira.yml');
 const steps=esteira.split('Baixar o APK de teste mais recente para o site');
 assert.equal(steps.length-1,2,'um passo no job de HML e outro no de PRD');
 for(const after of steps.slice(1)){
  const block=after.slice(0,900);
  assert.match(block,/continue-on-error: true/,'falha no download nunca bloqueia a publicação');
  assert.match(block,/mobile-teste-/);
  assert.match(block,/public\/downloads\/nacall-android\.apk/);
 }
 assert.match(esteira,/permissions:\s*\n\s*contents: read/,'só leitura (o download de release usa o token padrão)');
});

test('o APK baixado nunca entra no Git',async()=>{
 assert.match(await read('.gitignore'),/public\/downloads\/\*\.apk/);
});
