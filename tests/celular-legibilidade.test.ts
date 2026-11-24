import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

// Auditoria de UX do site no celular, lote 5 (UXA-010, UXA-011, UXA-022).
async function mobileBlock(){
 const css=await read('src/app/theme-fixes.css');
 const start=css.indexOf('(lote 5): legibilidade, toque e login');
 assert.ok(start>0,'bloco do lote 5 presente');
 return css.slice(start);
}

test('UXA-011: no login do celular o mascote sai de cima do título e do texto',async()=>{
 const css=await mobileBlock();
 assert.match(css,/@media\(max-width:720px\)\{/);
 assert.match(css,/\.auth-story \.mascot-hero\{position:relative;right:auto;bottom:auto;width:100%;height:auto/,'em fluxo normal, não mais absoluto sobre o texto');
 const globals=await read('src/app/globals.css');
 assert.match(globals,/\.mascot-hero\{position:absolute;right:-5px;bottom:65px/,'o motivo: ele era absoluto e cobria o título');
 const auth=await read('src/components/auth.tsx');
 assert.match(auth,/<div className="mascot-hero" aria-hidden="true">/,'o mascote segue decorativo');
});

test('UXA-010: textos de 8 a 10px do login e da gaveta ganham tamanho de leitura no celular',async()=>{
 const css=await mobileBlock();
 assert.match(css,/\.story-features span\{font-size:11px\}/);
 assert.match(css,/\.auth-links \.link\{display:inline-flex;align-items:center;min-height:44px;font-size:13px\}/,'links "Crie sua conta" e "Esqueci a senha"');
 assert.match(css,/\.nav-item \.tiny\{font-size:10px;max-width:72px\}/,'"Entrar na call"');
});

test('UXA-022: alvos de toque de 44px onde estavam abaixo disso, só no celular',async()=>{
 const css=await mobileBlock();
 assert.match(css,/dialog \.icon-button\{width:44px;min-height:44px\}/);
 assert.match(css,/\.message \.link\{font-size:12px;min-height:40px/,'"Excluir" da mensagem');
 assert.match(css,/input\[type=range\]\{height:32px\}/);
 assert.match(css,/\.whatsnew-dots button::after\{content:"";position:absolute;inset:-17px -6px\}/,'pontos do carrossel: área de toque maior que o ponto');
 assert.ok(css.indexOf('@media(max-width:720px)')<css.indexOf('dialog .icon-button'),'tudo dentro do bloco do celular');
});
