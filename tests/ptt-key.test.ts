import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {APP_SHORTCUTS,DEFAULT_PTT_KEY,isDefaultPttKey,isTypingTarget,parsePttKey,pttKeyLabel,pttShouldOpen,validatePttKey} from '../src/lib/ptt-key';

const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const press=(code:string,extra:Record<string,unknown>={})=>validatePttKey({code,...extra});

// ---- nome da tecla ----
test('o nome da tecla é o que a pessoa lê: letra, número, setas, teclado numérico',()=>{
 assert.equal(pttKeyLabel('KeyV'),'V');
 assert.equal(pttKeyLabel('KeyV','v'),'V');
 assert.equal(pttKeyLabel('Semicolon','ç'),'Ç','usa o caractere que a tecla gera no teclado da pessoa');
 assert.equal(pttKeyLabel('Digit7'),'7');
 assert.equal(pttKeyLabel('Numpad3'),'Num 3');
 assert.equal(pttKeyLabel('NumpadAdd'),'Num +');
 assert.equal(pttKeyLabel('ArrowUp','ArrowUp'),'Seta ↑');
 assert.equal(pttKeyLabel('F8','F8'),'F8');
 assert.equal(pttKeyLabel('PageDown','PageDown'),'Page Down');
 assert.equal(pttKeyLabel('Backquote'),'`');
});

// ---- o que aceitar ----
test('teclas comuns são aceitas sem aviso',()=>{
 for(const [code,key,label] of [['KeyG','g','G'],['KeyV','v','V'],['Digit5','5','5'],['Numpad0','0','Num 0'],['Backquote','`','`'],['KeyQ','q','Q']]){
  const r=press(code,{key});
  assert.ok(r.ok,`${code} deveria ser aceita`);
  if(r.ok){assert.equal(r.key.code,code);assert.equal(r.key.label,label);assert.equal(r.warning,undefined,`${code} sem aviso`);}
 }
});

test('teclas que atrapalham a página são recusadas com o motivo',()=>{
 for(const code of ['Tab','Enter','NumpadEnter','Space','Escape']){
  const r=press(code);
  assert.equal(r.ok,false,`${code} deveria ser recusada`);
  if(!r.ok)assert.ok(r.reason.length>10,`${code} precisa de um motivo`);
 }
 const space=press('Space');
 assert.ok(!space.ok&&/Espaço/.test(space.reason));
});

test('modificadores sozinhos e teclas de sistema são recusados',()=>{
 for(const code of ['ShiftLeft','ShiftRight','ControlLeft','ControlRight','AltLeft','AltRight','MetaLeft','MetaRight','ContextMenu','PrintScreen','CapsLock','NumLock','ScrollLock','Pause','BrowserBack','MediaPlayPause','AudioVolumeUp']){
  assert.equal(press(code).ok,false,`${code} deveria ser recusada`);
 }
 const ctrl=press('ControlLeft');
 assert.ok(!ctrl.ok&&/Ctrl/.test(ctrl.reason));
});

test('combinações com Ctrl, Alt ou Windows/Command são recusadas; Shift junto é ignorado',()=>{
 assert.equal(press('KeyK',{ctrlKey:true}).ok,false);
 assert.equal(press('KeyK',{altKey:true}).ok,false);
 assert.equal(press('KeyK',{metaKey:true}).ok,false);
 assert.equal(press('KeyK',{key:'K',shiftKey:true} as never).ok,true);
});

test('código desconhecido ou estranho é recusado',()=>{
 assert.equal(press('').ok,false);
 assert.equal(press('Unidentified').ok,false);
 assert.equal(press('Key V').ok,false);
 assert.equal(press('x'.repeat(40)).ok,false);
});

// ---- avisos ----
test('as setas conflitam com os atalhos do app e rolam a página: aceitas, mas com aviso',()=>{
 const left=press('ArrowLeft');
 assert.ok(left.ok&&left.warning);
 if(left.ok&&left.warning)assert.match(left.warning,/novidades/);
 assert.ok(APP_SHORTCUTS.ArrowLeft&&APP_SHORTCUTS.ArrowRight);
 const up=press('ArrowUp');
 assert.ok(up.ok&&up.warning&&/rola/.test(up.warning));
 for(const code of ['PageUp','PageDown','Home','End']){const r=press(code);assert.ok(r.ok&&r.warning,`${code} avisa que rola a página`);}
});

test('F1 a F24 valem todas; F5, F11 e F12 com o aviso do que o navegador faz',()=>{
 for(let i=1;i<=24;i++)assert.equal(press(`F${i}`).ok,true,`F${i} aceita`);
 const f5=press('F5');assert.ok(f5.ok&&/recarga/.test(f5.warning??''),'F5: o NACALL bloqueia a recarga');
 for(const code of ['F11','F12']){const r=press(code);assert.ok(r.ok&&/app do NACALL para PC/.test(r.warning??''),`${code} avisa que no navegador pode abrir junto`);}
});
test('teclas F que o navegador também usa são aceitas com aviso; F13 em diante não precisa',()=>{
 for(const code of ['F1','F3','F8','F10']){const r=press(code);assert.ok(r.ok&&r.warning&&/navegador/.test(r.warning),`${code} avisa`);}
 const f13=press('F13');
 assert.ok(f13.ok&&!f13.warning);
});

// ---- leitura do que foi salvo ----
test('o que foi salvo é lido com segurança; o resto volta ao padrão',()=>{
 assert.deepEqual(parsePttKey({code:'KeyG',label:'G'}),{code:'KeyG',label:'G'});
 assert.deepEqual(parsePttKey({code:'Semicolon',label:'Ç'}),{code:'Semicolon',label:'Ç'});
 assert.deepEqual(parsePttKey({code:'KeyG'}),{code:'KeyG',label:'G'},'sem rótulo salvo, calcula pelo código');
 for(const bad of [undefined,null,'KeyG',42,{},{code:5},{code:'Tab',label:'Tab'},{code:'Space'},{code:'ShiftLeft'},{code:'Key G'},{code:'<script>'}]){
  assert.deepEqual(parsePttKey(bad),DEFAULT_PTT_KEY,`${JSON.stringify(bad)} volta ao padrão`);
 }
 assert.equal(parsePttKey({code:'KeyG',label:'x'.repeat(200)}).label.length,16,'rótulo limitado');
});

test('a escolha sobrevive ao ciclo salvar → recarregar (localStorage)',()=>{
 const chosen=press('KeyG',{key:'g'});
 assert.ok(chosen.ok);
 if(!chosen.ok)return;
 const stored=JSON.stringify({pushToTalk:true,pushToTalkKey:chosen.key});
 const back=parsePttKey(JSON.parse(stored).pushToTalkKey);
 assert.deepEqual(back,{code:'KeyG',label:'G'});
 assert.equal(isDefaultPttKey(back),false);
 assert.equal(isDefaultPttKey(DEFAULT_PTT_KEY),true);
 assert.equal(DEFAULT_PTT_KEY.code,'KeyV','o padrão continua sendo o V');
});

// ---- quando dispara ----
const field={closest:(s:string)=>s.includes('input')?{}:null,isContentEditable:false};
const div={closest:()=>null,isContentEditable:false};
test('a tecla escolhida abre o microfone fora de campos de texto',()=>{
 const key={code:'KeyG',label:'G'};
 assert.equal(pttShouldOpen({code:'KeyG',target:div},key),true);
 assert.equal(pttShouldOpen({code:'KeyV',target:div},key),false,'só a tecla escolhida: o V não dispara mais');
 assert.equal(pttShouldOpen({code:'KeyG',repeat:true,target:div},key),false,'repetição automática não conta');
 assert.equal(pttShouldOpen({code:'KeyG',ctrlKey:true,target:div},key),false,'Ctrl+G é atalho do navegador');
 assert.equal(pttShouldOpen({code:'KeyG',altKey:true,target:div},key),false);
 assert.equal(pttShouldOpen({code:'KeyG',metaKey:true,target:div},key),false);
});

test('digitando em campo de texto, a tecla nunca dispara',()=>{
 const key={code:'KeyG',label:'G'};
 assert.equal(pttShouldOpen({code:'KeyG',target:field},key),false);
 assert.equal(pttShouldOpen({code:'KeyG',target:{closest:()=>null,isContentEditable:true}},key),false,'editor de texto rico');
 assert.equal(isTypingTarget(null),false);
 assert.equal(isTypingTarget(div),false);
 assert.equal(isTypingTarget(field),true);
});

// ---- ligações na interface ----
test('a tecla escolhida é usada na call, na barra de voz, nos ajustes de perfil e nas preferências',async()=>{
 const voice=await read('src/components/voice.tsx');
 assert.match(voice,/pttShouldOpen\(e,key\)/);
 assert.match(voice,/e\.code===key\.code/,'soltar a tecla escolhida fecha o microfone');
 assert.doesNotMatch(voice,/KeyV/,'sem tecla V fixa na call');
 assert.match(voice,/<PttKeyField\/>/,'campo de escolher a tecla nos ajustes da call');
 assert.match(voice,/Segure \{voice\.pushToTalkKey\.label\} na aba ativa\. Não funciona sobre campos de texto\./);
 assert.match(voice,/pushToTalkKey=\{voice\.pushToTalkKey\.label\}/);
 const bar=await read('src/components/voice-bar.tsx');
 assert.match(bar,/segure \$\{p\.pushToTalkKey\}/);
 assert.doesNotMatch(bar,/segure V/);
 const profile=await read('src/components/profile-settings.tsx');
 assert.match(profile,/<PttKeyField\/>/);
 assert.match(profile,/Segure \$\{voice\.pushToTalkKey\.label\} na aba ativa/);
 const prefs=await read('src/components/preferences.tsx');
 assert.match(prefs,/pushToTalkKey=parsePttKey\(raw\.pushToTalkKey\)/,'lida com validação do localStorage');
 assert.match(prefs,/localStorage\.setItem\('nacall-voice',JSON\.stringify\(voice\)\)/,'salva junto das outras preferências de voz');
});

test('o campo captura a próxima tecla, recusa as problemáticas, deixa trocar e voltar ao padrão',async()=>{
 const field=await read('src/components/ptt-key-field.tsx');
 assert.match(field,/validatePttKey\(e\)/);
 assert.match(field,/window\.addEventListener\('keydown',onKey,true\)/,'captura antes dos outros atalhos');
 assert.match(field,/stopImmediatePropagation/,'a tecla capturada não dispara mais nada');
 assert.match(field,/e\.code==='Escape'/,'Esc cancela');
 assert.match(field,/Voltar ao padrão/);
 assert.match(field,/Pressione uma tecla/);
 assert.match(field,/role=\{message\?\.tone==='error'\?'alert':'status'\}/,'leitores de tela ouvem o erro e o aviso');
});
