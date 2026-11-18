import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=(name:string)=>readFile(new URL(`../src/components/${name}`,import.meta.url),'utf8');

// O LiveKit recria a lista de aparelhos (e pede o microfone de novo) sempre que o onError muda.
// Uma função criada na hora, a cada renderização, fazia a lista dos ajustes piscar sem parar.
test('listas de aparelhos da call recebem funções estáveis, nunca funções criadas na hora',async()=>{
 const voice=await source('voice.tsx');
 const tags=voice.match(/<MediaDeviceSelect\b[^>]*>/g)??[];
 assert.ok(tags.length>=2,'microfone e saída de áudio');
 for(const tag of tags)assert.ok(!tag.includes('=>'),`função criada na hora em ${tag.slice(0,90)}`);
 assert.match(voice,/useCallback\(\(e:Error\)=>reportRef\.current\(e\.message\),\[\]\)/,'onError estável');

 const bar=await source('voice-bar.tsx');
 const call=bar.match(/useMediaDeviceSelect\(\{[^}]*\}\)/)?.[0]??'';
 assert.ok(call.length>0,'chamada do hook encontrada');
 assert.ok(!call.includes('=>'),'a lista da barra de voz também usa onError estável');
});
