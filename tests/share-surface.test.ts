import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SHARE_SURFACES} from '../src/lib/screen-share';

const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

// O seletor de telas é do navegador e não dá para trocá-lo; a janela do NACALL escolhe o tipo e o navegador já abre nele.
test('a janela do NACALL oferece tela inteira, janela e aba, e passa a escolha ao navegador',async()=>{
 assert.deepEqual(SHARE_SURFACES.map(s=>s.id).sort(),['browser','monitor','window']);
 const voice=await read('src/components/voice.tsx'),dialog=await read('src/components/share-dialog.tsx');
 assert.match(voice,/const startScreen=\(surface:ShareSurface\)=>/);
 assert.match(voice,/video:\{displaySurface:surface\}/);
 assert.match(dialog,/onClick=\{\(\)=>onStart\(o\.id\)\}/,'escolher o tipo já inicia, sem botão extra');
});
