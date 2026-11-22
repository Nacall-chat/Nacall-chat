import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// A área da call centralizava as transmissões com justify-content:center e rolagem. Quando duas telas não cabiam,
// esse layout cortava o topo da primeira e não deixava rolar até ele. Margens automáticas centralizam só quando cabe.
const css=()=>readFile(new URL('../src/app/call-stage.css',import.meta.url),'utf8');

test('transmissões centralizam sem cortar o topo quando não cabem',async()=>{
 const c=await css();
 assert.match(c,/\.call-stage\{[^}]*justify-content:flex-start/,'a área começa do topo');
 assert.match(c,/\.call-stage>\.screen-stream:first-child\{margin-top:auto\}/,'centraliza com margem automática');
 assert.match(c,/\.call-stage>\.screen-stream:last-child\{margin-bottom:auto\}/);
});

test('as telas continuam empilhadas: lado a lado ficaria estreito demais na coluna lateral da call',async()=>{
 const c=await css();
 assert.doesNotMatch(c,/\.call-stage:has\(>\.screen-stream\+\.screen-stream\)/);
});

// Mac (16:10), celular em pé ou janela estreita: o vídeo já se ajustava à proporção, mas o cartão ocupava a largura
// toda do palco e o fundo preto dele virava faixas pretas dos lados. O cartão precisa ter a largura do vídeo.
test('o cartão da transmissão tem a largura do vídeo (sem faixas pretas dos lados), menos em tela cheia',async()=>{
 const c=await css();
 const rule=c.match(/\.call-stage>\.screen-stream:not\(:fullscreen\)\{([^}]*)\}/);
 assert.ok(rule,'regra do cartão fora da tela cheia');
 assert.match(rule[1],/width:fit-content/,'acompanha a largura do vídeo');
 assert.match(rule[1],/max-width:100%/,'nunca passa da largura do palco');
 assert.match(rule[1],/min-width:min\(100%,360px\)/,'cabeçalho continua cabendo');
});
