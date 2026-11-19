import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {swipeIntent,SWIPE_MIN_DISTANCE,SWIPE_MAX_MS} from '../src/lib/swipe';

test('arrastar para a direita abre a gaveta e para a esquerda fecha',()=>{
 assert.equal(swipeIntent({dx:120,dy:8,ms:200}),'open');
 assert.equal(swipeIntent({dx:-120,dy:-5,ms:200}),'close');
});

test('arrasto curto, lento ou na diagonal não faz nada (rolar a tela não abre a gaveta)',()=>{
 assert.equal(swipeIntent({dx:SWIPE_MIN_DISTANCE-1,dy:0,ms:100}),null,'curto demais');
 assert.equal(swipeIntent({dx:200,dy:0,ms:SWIPE_MAX_MS+1}),null,'devagar demais');
 assert.equal(swipeIntent({dx:90,dy:80,ms:200}),null,'diagonal');
 assert.equal(swipeIntent({dx:20,dy:300,ms:200}),null,'rolagem vertical');
 assert.equal(swipeIntent({dx:SWIPE_MIN_DISTANCE,dy:0,ms:SWIPE_MAX_MS}),'open','no limite ainda vale');
});

const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('celular: a gaveta mostra a coluna de servidores e não há mais menu fixo embaixo',async()=>{
 const app=await read('src/components/app.tsx');
 assert.doesNotMatch(app,/mobile-bottom-nav/,'menu de baixo removido');
 assert.match(app,/servers\.map\(s=>|servers\.map\(s =>/,'todos os servidores da pessoa entram na coluna');
 assert.match(app,/useDrawerSwipe\(/,'arrastar abre e fecha');
 const css=await read('src/app/mobile-drawer.css');
 assert.match(css,/\.shell\.nav-open>\.rail\{display:flex!important/,'a coluna aparece com a gaveta aberta');
 assert.match(css,/\.mobile-bottom-nav\{display:none!important\}/);
});

test('amigos: as abas não rolam para o lado e "Adicionar amigo" é um botão à parte',async()=>{
 const panel=await read('src/components/friends-panel.tsx');
 assert.match(panel,/tabs: \[FriendTab,string\]\[\]=\[\['online','Online'\],\['available','Em call'\],\['all','Todos'\],\['pending','Pendente'\]\]/,'quatro abas');
 assert.match(panel,/className=\{`social-add/);
 const css=await read('src/app/social.css');
 const mobile=css.slice(css.lastIndexOf('@media(max-width:720px)'));
 assert.match(mobile,/\.social-tabs\{[^}]*flex-wrap:nowrap;overflow:visible/,'sem rolagem lateral');
 assert.doesNotMatch(mobile,/overflow-x:\s*(auto|scroll)/);
});
