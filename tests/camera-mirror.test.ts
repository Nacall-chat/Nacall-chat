import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// A própria câmera aparece como num espelho (olhar para a esquerda vai para a esquerda da tela), como nos apps de
// chamada. Só a sua prévia é espelhada: os outros continuam vendo a imagem real, com textos e lados no lugar.
// O <VideoTrack> do LiveKit marca o <video> com data-lk-local-participant e data-lk-source; o card do NACALL não usa
// o ParticipantTile, então a regra de espelho do LiveKit não vale aqui e precisa existir no nosso CSS.
test('a prévia da própria câmera é espelhada, e só ela',async()=>{
 const css=await readFile(new URL('../src/app/jacall.css',import.meta.url),'utf8');
 const rule=css.match(/([^{}]*)\{[^{}]*transform:scaleX\(-1\)[^{}]*\}/);
 assert.ok(rule,'existe uma regra com transform:scaleX(-1)');
 const selector=rule[1];
 assert.match(selector,/\.camera-view video/,'vale para o vídeo do card');
 assert.match(selector,/\[data-lk-local-participant="true"\]/,'só para quem é você');
 assert.match(selector,/\[data-lk-source="camera"\]/,'só para câmera, nunca para a tela compartilhada');
});
