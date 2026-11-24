import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {checkBind,parseOptionalKey,shortcutPressed,toggleDeafen,toggleMicrophone,type VoiceState} from '../src/lib/voice-binds';

// Pedido do usuário (24/11/2026): desligar o fone não fechava o microfone (perigoso: a pessoa não ouve a call e continua
// falando sem perceber) e não havia atalho para microfone e fone.
const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const s=(deaf:boolean,mic:boolean,micBeforeDeaf=false):VoiceState=>({deaf,mic,micBeforeDeaf});

test('desligar o fone fecha o microfone e religar devolve como estava',()=>{
 const off=toggleDeafen(s(false,true),{pushToTalk:false});
 assert.deepEqual(off,s(true,false,true),'fone desligado: microfone fecha e o estado anterior fica guardado');
 assert.deepEqual(toggleDeafen(off,{pushToTalk:false}),s(false,true),'religou o fone: microfone volta aberto');
 const muted=toggleDeafen(s(false,false),{pushToTalk:false});
 assert.deepEqual(toggleDeafen(muted,{pushToTalk:false}),s(false,false),'estava mudo antes: continua mudo');
 assert.deepEqual(toggleDeafen(off,{pushToTalk:true}),s(false,false),'no apertar para falar o microfone volta fechado (abre pela tecla)');
});

test('abrir o microfone com o fone desligado religa o fone; fechar o microfone não mexe no fone',()=>{
 assert.deepEqual(toggleMicrophone(s(true,false,true)),s(false,true));
 assert.deepEqual(toggleMicrophone(s(false,true)),s(false,false));
 assert.deepEqual(toggleMicrophone(s(true,false)).deaf,false);
});

test('atalhos: mesmas regras do apertar para falar e nunca a mesma tecla de outro atalho',()=>{
 const ok=checkBind({code:'KeyM',key:'m'},'muteKey',{pushToTalkKey:{code:'KeyV',label:'V'},deafenKey:null});
 assert.ok(ok.ok&&ok.key.code==='KeyM'&&ok.key.label==='M');
 const taken=checkBind({code:'KeyV',key:'v'},'deafenKey',{pushToTalkKey:{code:'KeyV',label:'V'},muteKey:null});
 assert.ok(!taken.ok&&/apertar para falar/.test(taken.reason),'tecla do apertar para falar é recusada');
 const taken2=checkBind({code:'KeyM',key:'m'},'deafenKey',{muteKey:{code:'KeyM',label:'M'}});
 assert.ok(!taken2.ok&&/microfone/.test(taken2.reason));
 assert.equal(checkBind({code:'Escape'},'muteKey',{}).ok,false,'Esc continua recusado');
 assert.equal(checkBind({code:'KeyM',ctrlKey:true},'muteKey',{}).ok,false,'combinação com Ctrl recusada');
});

test('atalho salvo inválido vira "sem atalho" (nunca um atalho que a pessoa não escolheu)',()=>{
 assert.equal(parseOptionalKey(undefined),null);
 assert.equal(parseOptionalKey({code:'Escape',label:'Esc'}),null);
 assert.equal(parseOptionalKey('KeyM'),null);
 assert.deepEqual(parseOptionalKey({code:'KeyM',label:'M'}),{code:'KeyM',label:'M'});
 assert.deepEqual(parseOptionalKey({code:'F8'}),{code:'F8',label:'F8'});
});

test('o atalho só dispara fora de campos de texto e sem repetição',()=>{
 const key={code:'KeyM',label:'M'};const plain={closest:()=>null};const input={closest:()=>({})};
 assert.equal(shortcutPressed({code:'KeyM',target:plain},key),true);
 assert.equal(shortcutPressed({code:'KeyM',target:input},key),false,'digitando no chat não muta');
 assert.equal(shortcutPressed({code:'KeyM',repeat:true,target:plain},key),false);
 assert.equal(shortcutPressed({code:'KeyM',target:plain},null),false,'sem atalho configurado não faz nada');
});

test('a call usa as regras: botões e barra de voz passam por toggleDeaf, a tecla do apertar para falar respeita o fone e os atalhos estão nos ajustes',async()=>{
 const voice=await read('src/components/voice.tsx');
 assert.doesNotMatch(voice,/setDeaf\(!deaf\)/,'nenhum botão desliga só o fone');
 assert.match(voice,/onDeaf=\{\(\)=>toggleDeaf\(\)\}/);
 assert.match(voice,/if\(!pttShouldOpen\(e,key\)\|\|deafRef\.current\)return;/,'com o fone desligado a tecla não abre o microfone');
 assert.match(voice,/shortcutPressed\(e,voice\.muteKey\)/);assert.match(voice,/shortcutPressed\(e,voice\.deafenKey\)/);
 assert.match(voice,/<PttKeyField\/><VoiceShortcuts\/>/);
 assert.match(await read('src/components/profile-settings.tsx'),/<PttKeyField\/><VoiceShortcuts\/>/);
 const prefs=await read('src/components/preferences.tsx');
 assert.match(prefs,/muteKey:null,deafenKey:null/,'sem atalho por padrão');
});
