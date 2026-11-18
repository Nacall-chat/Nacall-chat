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

const call=(patch:Partial<{voice:boolean;isMobile:boolean;callView:boolean;target:boolean}>)=>shellCallClass({voice:true,isMobile:false,callView:false,target:false,...patch});

test('call: sem call não muda o layout',()=>{
 assert.equal(shellCallClass({voice:false,isMobile:true,callView:true,target:false}),'');
 assert.equal(shellCallClass({voice:false,isMobile:false,callView:false,target:true}),'');
});

test('call no celular: tela cheia só quando aberta; senão janela flutuante, inclusive com um chat aberto',()=>{
 assert.equal(call({isMobile:true,callView:true}),'has-call call-focus');
 assert.equal(call({isMobile:true,callView:false}),'call-float','outra tela: janela flutuante');
 assert.equal(call({isMobile:true,callView:false,target:true}),'call-float','chat em tela cheia, call flutuando (antes a tela era dividida)');
 assert.equal(call({isMobile:true,callView:true,target:true}),'call-float','abrir um chat tira a call da tela cheia');
});

test('call no desktop: continua ao lado do chat, em foco ou escondida',()=>{
 assert.equal(call({target:true}),'has-call call-chat');
 assert.equal(call({callView:true}),'has-call call-focus');
 assert.equal(call({callView:false}),'call-away');
});
