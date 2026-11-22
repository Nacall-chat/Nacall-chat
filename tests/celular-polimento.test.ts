import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

// Auditoria de UX do site no celular, lote 6: polimento (QA-006, QA-007, RSP-017, RSP-019).

test('QA-006: /login tem título de aba próprio, diferente da página inicial',async()=>{
 const login=await read('src/app/login/page.tsx');
 assert.match(login,/export const metadata: Metadata = \{title: 'Entrar · NACALL'\};/);
 const layout=await read('src/app/layout.tsx');
 assert.match(layout,/title: 'NACALL · A call é sua\. A resenha é nossa\.'/,'a página inicial mantém o título de sempre');
});

test('QA-007: links do menu da landing com pelo menos 24px de altura',async()=>{
 const css=await read('src/app/theme-fixes.css');
 assert.match(css,/\.jacall-nav>nav a\{display:inline-flex;align-items:center;min-height:24px\}/);
});

test('RSP-017: as 5 abas das configurações do grupo cabem a 320px',async()=>{
 const css=await read('src/app/theme-fixes.css');
 assert.match(css,/@media\(max-width:360px\)\{\s*\.group-settings \.settings-layout>nav button\{font-size:10px;overflow-wrap:anywhere/);
});

test('RSP-019: o desafio do CAPTCHA usa o tamanho compacto no celular, para não passar da borda do cartão',async()=>{
 const captcha=await read('src/components/use-captcha.tsx');
 assert.match(captcha,/appearance:'interaction-only',size:window\.matchMedia\('\(max-width:720px\)'\)\.matches\?'compact':'normal'/);
});
