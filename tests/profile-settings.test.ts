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
 assert.match(cover,/className={`cover-actions /);
 assert.match(cover,/aria-label="Remover capa"/);
 const css=await read('src/app/profile-settings.css');
 assert.match(css,/\.hero-id\{[^}]*margin-top:-40px/,'foto sobe sobre a capa');
 assert.match(css,/\.save-bar\{position:sticky/,'botão de salvar fica à vista no celular');
});

test('botões da capa: mesma altura, lixeira quadrada e mão do mouse em todos',async()=>{
 const css=await read('src/app/profile-settings.css');
 assert.match(css,/\.cover-action\{[^}]*height:36px/,'altura fixa');
 assert.match(css,/\.cover-action\.icon-only\{width:36px/,'lixeira só com ícone, quadrada');
 assert.match(css,/\.cover-action,\.cover-action \*\{cursor:pointer\}/,'mão do mouse em todo o botão');
 assert.match(css,/\.cover-action input,\.avatar-edit-btn input\{[^}]*pointer-events:none/,'o campo escondido não rouba o cursor');
 assert.match(await read('src/components/profile-cover-editor.tsx'),/className="cover-action icon-only"/);
});

test('barra lateral: o avatar do perfil não divide a linha com o nome; lista da call à esquerda e com barra curta',async()=>{
 const css=await read('src/app/social.css');
 assert.match(css,/\.account>\.status-menu-wrap\{flex:0 0 auto/,'o avatar não ganha flex:1');
 assert.match(css,/\.voice-roster-person\{justify-content:flex-start/,'nomes à esquerda');
 assert.match(css,/\.voice-roster::before\{[^}]*top:9px;bottom:9px/,'barra verde mais curta, sem encostar na da sala de baixo');
});

test('capa: um lápis abre a câmera e a lixeira ao lado, só com ícones, e fecha ao tocar fora ou com Esc',async()=>{
 const tsx=await read('src/components/profile-cover-editor.tsx');
 assert.match(tsx,/aria-label="Editar capa" aria-expanded=\{open\}/,'o lápis é o botão que abre');
 assert.match(tsx,/inert=\{!open\}/,'fechado, os botões não recebem foco');
 assert.match(tsx,/pointerdown/,'fecha ao tocar fora');
 assert.match(tsx,/e\.key==='Escape'/,'fecha com Esc sem fechar os Ajustes');
 assert.doesNotMatch(tsx,/<span>\{profile\?\.cover_path\?'Trocar capa'/,'sem texto nos botões, só ícones');
 const css=await read('src/app/profile-settings.css');
 assert.match(css,/\.cover-actions\.open \.cover-tools\{opacity:1;visibility:visible;transform:none/,'cresce a partir do lápis');
 assert.match(css,/prefers-reduced-motion:reduce\)\{\.cover-tools\{transition:none/,'respeita movimento reduzido');
});
