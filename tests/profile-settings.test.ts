import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('ajustes no celular: tela toda, abas em grade sem rolagem lateral e rótulos curtos',async()=>{
 const css=await read('src/app/profile-settings.css');
 const mobile=css.slice(css.indexOf('@media(max-width:720px)'));
 assert.match(mobile,/dialog\.settings-panel\[open\]\{[^}]*width:100vw[^}]*height:100dvh/,'tela toda');
 assert.match(mobile,/\.settings-layout>nav\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)[^}]*overflow:visible/,'quatro abas na largura, sem rolar');
 assert.match(mobile,/\.tab-full\{display:none\}/);
 const tsx=await read('src/components/profile-settings.tsx');
 for(const short of ['Perfil','Voz'])assert.ok(tsx.includes(`'${short}']`)||tsx.includes(`'${short}'`),`rótulo curto ${short}`);
 assert.match(tsx,/aria-label=\{label\}/,'o nome completo continua acessível');
});

test('perfil: capa com a foto por cima, botões de trocar dentro da imagem e salvar fixo',async()=>{
 const tsx=await read('src/components/profile-settings.tsx');
 assert.match(tsx,/className="profile-hero"/);
 assert.match(tsx,/className="avatar-edit-btn"/);
 assert.match(tsx,/className="save-bar"/);
 const cover=await read('src/components/profile-cover-editor.tsx');
 assert.match(cover,/className="cover-actions"/);
 assert.match(cover,/aria-label="Remover capa"/);
 const css=await read('src/app/profile-settings.css');
 assert.match(css,/\.hero-id\{[^}]*margin-top:-40px/,'foto sobe sobre a capa');
 assert.match(css,/\.save-bar\{position:sticky/,'botão de salvar fica à vista no celular');
});
