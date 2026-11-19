import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shellCallClass} from '../src/lib/nav';

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
