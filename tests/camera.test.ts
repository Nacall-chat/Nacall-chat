import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {liveCamera} from '../src/lib/camera';

// Desligar a câmera no LiveKit só deixa a faixa muda: a publicação continua na sala. Mostrar o vídeo de uma faixa
// muda deixava o card preto, sem voltar para a foto de perfil.
const ref=(identity:string,isMuted:boolean|null)=>({participant:{identity},publication:isMuted===null?undefined:{isMuted}});

test('câmera desligada (faixa muda) não é mostrada: o card volta para a foto',()=>{
 assert.equal(liveCamera([ref('ana',true)],'ana'),undefined);
});

test('câmera ligada é mostrada para a pessoa certa',()=>{
 const ana=ref('ana',false),bia=ref('bia',false);
 assert.equal(liveCamera([bia,ana],'ana'),ana);
 assert.equal(liveCamera([bia,ana],'caio'),undefined);
});

test('sem publicação não há câmera para mostrar',()=>{
 assert.equal(liveCamera([ref('ana',null)],'ana'),undefined);
});

test('o card da call usa liveCamera para escolher entre vídeo e foto',async()=>{
 const voice=await readFile(new URL('../src/components/voice.tsx',import.meta.url),'utf8');
 assert.match(voice,/const camera=liveCamera\(cameras,p\.identity\)/);
});
