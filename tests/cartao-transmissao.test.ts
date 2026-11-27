import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=(p:string)=>readFile(new URL(`../${p}`,import.meta.url),'utf8');

test('cartão da transmissão: a pílula sobre a imagem não vale para ele (o rodapé fica embaixo do botão)',async()=>{
 const css=await read('src/app/theme-fixes.css');
 assert.ok(css.includes('.call-dock .participant:not(.stream-tile)>.participant-label{position:relative'),'a pílula vale só para os cartões de pessoas');
 assert.ok(!css.includes('.call-dock .participant-label{position:relative'),'nenhuma regra de pílula sem exceção para a transmissão');
});

test('seu cartão de transmissão mostra a sua tela ao vivo quando não há prévia publicada (ex.: sozinho na sala)',async()=>{
 const tile=await read('src/components/stream-tile.tsx');
 assert.ok(tile.includes('isLocal&&localTrack?<LocalPreview track={localTrack}/>'),'sem prévia publicada, o seu cartão usa a sua tela ao vivo');
 assert.ok(tile.includes('video.srcObject=new MediaStream([track])'));
 assert.ok((await read('src/components/voice.tsx')).includes('localTrack={p.isLocal?share.publication.track?.mediaStreamTrack:undefined}'));
});
