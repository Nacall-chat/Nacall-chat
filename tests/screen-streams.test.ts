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
