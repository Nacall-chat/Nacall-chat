import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mobileTabFor,shellCallClass} from '../src/lib/nav';

const base={navOpen:false,serverId:null as string|null,target:null as {type:'channel'|'dm'}|null,inCallView:false};
const tab=(patch:Partial<typeof base>)=>mobileTabFor({...base,...patch});

test('menu de baixo: sem nada aberto, Início',()=>{
 assert.equal(tab({}),'home');
 assert.equal(tab({serverId:'s'}),'servers','servidor aberto sem conversa');
});

test('menu de baixo: Mensagens fica verde mesmo sem amigos nem conversas',()=>{
 assert.equal(tab({navOpen:true}),'messages','barra lateral aberta mostrando mensagens diretas');
 assert.equal(tab({target:{type:'dm'}}),'messages','lendo uma DM');
});

test('menu de baixo: Servidores continua verde com um canal aberto e ao tocar de novo em Servidores',()=>{
 assert.equal(tab({target:{type:'channel'},serverId:'s'}),'servers','lendo um canal');
 assert.equal(tab({navOpen:true,serverId:'s',target:{type:'channel'}}),'servers','canal aberto e barra lateral aberta: segue verde');
 assert.equal(tab({navOpen:true,serverId:'s'}),'servers');
});

test('menu de baixo: Call só é a aba ativa quando a call está em primeiro plano',()=>{
 assert.equal(tab({inCallView:true}),'call');
 assert.equal(tab({inCallView:true,serverId:'s'}),'call');
 assert.equal(tab({inCallView:false}),'home','em call, mas na tela inicial: Início fica verde, não a Call');
 assert.equal(tab({inCallView:true,navOpen:true,serverId:'s'}),'servers','barra lateral aberta por cima da call: vale a barra');
});

const call=(patch:Partial<{voice:boolean;callView:boolean;target:boolean}>)=>shellCallClass({voice:true,callView:false,target:false,...patch});

test('call: sem call não muda o layout',()=>{
 assert.equal(shellCallClass({voice:false,callView:true,target:false}),'');
 assert.equal(shellCallClass({voice:false,callView:false,target:true}),'');
});

test('call: a barra de voz aparece em toda tela enquanto há call (has-voice)',()=>{
 for(const callView of [true,false]) for(const target of [true,false]) assert.ok(call({callView,target}).split(' ').includes('has-voice'),'callView='+callView+' target='+target);
});

test('call: o painel só ocupa a tela quando a pessoa o abre e não há conversa aberta',()=>{
 assert.equal(call({callView:true}),'has-voice has-call call-focus');
 assert.equal(call({callView:false}),'has-voice call-away','outra tela: painel escondido, call conectada');
});

test('call: abrir uma conversa tira o painel da tela e não divide mais o espaço (acabou o modo ao lado do chat)',()=>{
 assert.equal(call({callView:false,target:true}),'has-voice call-away');
 assert.equal(call({callView:true,target:true}),'has-voice call-away','chat aberto vence');
 for(const callView of [true,false]) assert.doesNotMatch(call({callView,target:true}),/call-chat|call-float/);
});
