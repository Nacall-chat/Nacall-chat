import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createBackSentinel} from '../src/lib/back-sentinel';

const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

// Auditoria de UX do site no celular, lote 3 (UXA-005, UXA-016, UXA-023).

function fake(){
 const log:string[]=[];
 const timers:(()=>void)[]=[];
 const history={pushState:()=>{log.push('push');},back:()=>{log.push('back');}};
 const sentinel=createBackSentinel(history,fn=>{timers.push(fn);});
 return {log,timers,sentinel};
}

test('UXA-005: abrir uma tela coloca uma entrada no histórico e Voltar fecha a tela, não o site',()=>{
 const {log,sentinel}=fake();
 sentinel.sync(false);assert.deepEqual(log,[],'nada aberto, nada no histórico');
 sentinel.sync(true);sentinel.sync(true);assert.deepEqual(log,['push'],'uma entrada só, mesmo com várias renderizações');
 assert.equal(sentinel.popped(),true,'Voltar da pessoa: o app deve fechar a tela de cima');
 assert.equal(sentinel.popped(),false,'sem entrada, o Voltar seguinte é do navegador');
});

test('UXA-005: se ainda sobra outra tela aberta depois do Voltar, a entrada é recolocada',()=>{
 const {log,sentinel}=fake();
 sentinel.sync(true);
 assert.equal(sentinel.popped(),true);   // Voltar fechou a gaveta
 sentinel.sync(true);                    // a conversa continua aberta
 assert.deepEqual(log,['push','push']);
 assert.equal(sentinel.popped(),true);   // o próximo Voltar fecha a conversa
 sentinel.sync(false);
 assert.deepEqual(log,['push','push'],'tudo fechado pelo Voltar: não mexe mais no histórico');
});

test('UXA-005: fechar pelo toque devolve a entrada e o popstate dessa devolução é ignorado',()=>{
 const {log,sentinel}=fake();
 sentinel.sync(true);
 sentinel.sync(false);
 assert.deepEqual(log,['push','back'],'devolve a entrada com history.back()');
 assert.equal(sentinel.popped(),false,'o popstate da devolução não fecha nada de novo');
 sentinel.sync(true);
 assert.equal(sentinel.popped(),true,'e o Voltar seguinte funciona normalmente');
});

test('UXA-005: se o navegador não avisar a devolução, o contador zera e não come um Voltar de verdade',()=>{
 const {sentinel,timers}=fake();
 sentinel.sync(true);sentinel.sync(false);
 timers.forEach(fn=>fn());
 sentinel.sync(true);
 assert.equal(sentinel.popped(),true);
});

test('UXA-005: o app liga o Voltar só no celular, na ordem gaveta, conversa, call',async()=>{
 const app=await read('src/components/app.tsx');
 assert.match(app,/useBackButton\(compactBar && \(mobileNavOpen \|\| Boolean\(target\) \|\| inCallView\), \(\) => \{ if \(mobileNavOpen\) setMobileNavOpen\(false\); else if \(target\) setTarget\(null\); else setCallView\(false\); \}\);/);
 const hook=await read('src/lib/use-back-button.ts');
 assert.match(hook,/addEventListener\('popstate'/);
 assert.match(hook,/useEffect\(\(\)=>\{sentinel\.current\?\.sync\(active\);\}\);/,'sem lista de dependências: recoloca a entrada depois de cada Voltar');
});

test('UXA-016: no celular, arrastar para baixo no topo ou no palco da call não recarrega a página',async()=>{
 const css=await read('src/app/theme-fixes.css');
 assert.match(css,/@media\(max-width:720px\)\{html,body\{overscroll-behavior-y:none\}\}/);
});

test('UXA-023: o arrasto da gaveta não dispara por baixo de janelas nem em cima do canvas da figurinha',async()=>{
 const swipe=await read('src/lib/swipe.ts');
 assert.match(swipe,/input,textarea,select,video,audio,canvas,/);
 const hook=await read('src/lib/use-drawer-swipe.ts');
 assert.match(hook,/document\.querySelector\('dialog\[open\]'\)/);
});
