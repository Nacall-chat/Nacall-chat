import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mobileTabFor} from '../src/lib/nav';

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
