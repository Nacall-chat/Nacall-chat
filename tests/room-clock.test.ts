import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextRoomStart,durationLabel} from '../src/lib/room-clock';
test('contador usa começo compartilhado, preserva sessão e reinicia após sala vazia',()=>{
 const a={sid:'a',joinedAt:1000};const b={sid:'b',joinedAt:5000};
 assert.equal(nextRoomStart({},[a],2000),1000);
 assert.equal(nextRoomStart({startedAt:1000,observedAt:6000,sids:['a','b']},[b],7000),1000);
 assert.equal(nextRoomStart({startedAt:1000,sids:['a']},[],8000),null);
 assert.equal(nextRoomStart({startedAt:1000,observedAt:6000,sids:['a']},[{sid:'c',joinedAt:9000}],10000),9000);
 assert.equal(durationLabel(1000,3662000),'01:01:01');assert.equal(durationLabel(null),'');
});

import {clockOffset,withLocalParticipant} from '../src/lib/room-clock';
import {rmsOf,speakingStep} from '../src/lib/speaking';

test('relógio do servidor: a diferença usa o meio da ida e volta e corrige o contador de um aparelho adiantado',()=>{
 assert.equal(clockOffset(10000,9000,9200),900,'servidor 900 ms à frente');
 assert.equal(clockOffset(10000,12000,12200),-2100,'aparelho adiantado: diferença negativa');
 // call que começou no servidor às 10:00:00 e o relógio do aparelho 5 min adiantado: sem a correção ficaria em 00:00:00
 const startedAt=Date.UTC(2026,10,18,10,0,0);const serverNow=startedAt+65000;const device=serverNow+300000;
 assert.equal(durationLabel(startedAt,device),'00:06:05','sem correção o aparelho adiantado mostra um tempo errado');
 const offset=clockOffset(serverNow,device,device);
 assert.equal(durationLabel(startedAt,device+offset),'00:01:05','com a correção mostra o tempo real da call');
});

test('sala com a própria pessoa já dentro, sem esperar o servidor listar',()=>{
 const me={id:'me',name:'Eu',avatar:''};
 const vazia=withLocalParticipant(undefined,'c1',me,5000);
 assert.deepEqual(vazia,{channelId:'c1',startedAt:5000,count:1,participants:[me]},'sala nova: eu e o começo da minha entrada');
 const outros={channelId:'c1',startedAt:1000,count:1,participants:[{id:'x',name:'X',avatar:''}]};
 const comigo=withLocalParticipant(outros,'c1',me,5000);
 assert.equal(comigo.count,2);assert.equal(comigo.startedAt,1000,'o começo da call é o do servidor');assert.deepEqual(comigo.participants.map(p=>p.id),['x','me']);
 const listado=withLocalParticipant({channelId:'c1',startedAt:1000,count:2,participants:[{id:'x',name:'X',avatar:''},{id:'me',name:'Eu',avatar:''}]},'c1',me,5000);
 assert.equal(listado.count,2,'já listado pelo servidor: sem duplicar');assert.equal(listado.participants.length,2);
});

test('fala medida no microfone: acende na hora e só apaga depois de um instante de silêncio',()=>{
 const silencio=new Uint8Array(512).fill(128);const voz=Uint8Array.from({length:512},(_,i)=>128+(i%2?40:-40));
 assert.equal(rmsOf(silencio),0);assert.ok(rmsOf(voz)>0.2);assert.equal(rmsOf([]),0);
 let s={on:false,lastLoud:0};
 s=speakingStep(s,rmsOf(voz),1000);assert.deepEqual(s,{on:true,lastLoud:1000},'acende no primeiro quadro com voz');
 s=speakingStep(s,0,1200);assert.equal(s.on,true,'pausa curta entre palavras: continua aceso');
 s=speakingStep(s,0,1340);assert.equal(s.on,true,'ainda dentro do instante de silêncio');
 s=speakingStep(s,0,1400);assert.equal(s.on,false,'depois do silêncio, apaga');
 s=speakingStep(s,0.001,1600);assert.equal(s.on,false,'ruído baixo não acende');
});
