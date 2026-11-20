import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {coverNotice} from '../src/lib/cover-notice';

// Pinterest, Google Imagens e afins entregam prévias paradas (JPEG/PNG) com nome .gif. A capa era salva parada sem
// aviso e parecia bug do NACALL. Agora quem escolhe um ".gif" que não é animado fica sabendo na hora.
const ok='Capa atualizada. Seu perfil entrou no clima.';

test('arquivo com nome .gif que na verdade é JPEG avisa que a capa ficou parada',()=>{
 const text=coverNotice('pin.gif','image/gif','jpg',false);
 assert.match(text,/não é animado/);
 assert.match(text,/JPEG/);
 assert.match(text,/GIF original/);
});

test('o aviso vale para PNG e WebP parado e ignora maiúsculas no nome',()=>{
 assert.match(coverNotice('FOTO.GIF','','png',false),/PNG/);
 assert.match(coverNotice('x.gif','image/gif','webp',false),/WebP/);
});

test('GIF de verdade, WebP animado e imagens comuns não mostram aviso',()=>{
 assert.equal(coverNotice('anim.gif','image/gif','gif',false),ok);
 assert.equal(coverNotice('anim.gif','image/gif','webp',true),ok,'WebP animado com nome .gif');
 assert.equal(coverNotice('foto.jpg','image/jpeg','jpg',false),ok);
 assert.equal(coverNotice('foto.png','image/png','png',false),ok);
});

test('o editor da capa usa coverNotice depois de salvar',async()=>{
 const editor=await readFile(new URL('../src/components/profile-cover-editor.tsx',import.meta.url),'utf8');
 assert.match(editor,/report\(coverNotice\(file\.name,file\.type,kind\.ext,/);
});
