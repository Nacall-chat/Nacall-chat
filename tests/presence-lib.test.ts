import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isIdle,isPresenceStatus,presenceLine,presenceOrder,sinceLabel,toInfo,offlineInfo} from '../src/lib/presence';

const server='2026-11-19T12:00:00.000Z';
const info=(minAgo:number,state:'online'|'away'|'offline'='offline',fetchedAt=1000)=>toInfo({user_id:'x',state,last_seen_at:new Date(new Date(server).getTime()-minAgo*60000).toISOString(),server_now:server},fetchedAt);

test('visto por último: usa a hora do servidor e só soma o tempo que passou aqui',()=>{
 assert.equal(sinceLabel(info(0.2),1000),'agora há pouco');
 assert.equal(sinceLabel(info(30),1000),'há 30 min');
 assert.equal(sinceLabel(info(30),1000+10*60000),'há 40 min','10 min depois da consulta, no relógio do aparelho');
 assert.equal(sinceLabel(info(3*60),1000),'há 3 h');
 assert.equal(sinceLabel(info(30*60),1000),'ontem');
 assert.equal(sinceLabel(info(3*24*60),1000),'há 3 dias');
 assert.match(sinceLabel(info(40*24*60),1000),/\d{2}\/\d{2}\/\d{4}/);
 assert.equal(sinceLabel(offlineInfo,1000),'ainda não entrou');
 assert.equal(sinceLabel({...info(5),lastSeenAt:new Date(new Date(server).getTime()+60000).toISOString()},1000),'agora há pouco','sinal "do futuro" não vira número negativo');
});

test('linha do cartão: online agora, ausente ou visto pela última vez',()=>{
 assert.equal(presenceLine(info(0,'online'),1000),'Online agora');
 assert.equal(presenceLine(info(2,'away'),1000),'Ausente');
 assert.equal(presenceLine(info(30),1000),'Visto pela última vez há 30 min');
 assert.equal(presenceLine(offlineInfo,1000),'Ainda não entrou');
});

test('ociosidade, ordem e validação do status',()=>{
 assert.ok(!isIdle(0,4*60000));assert.ok(isIdle(0,5*60000));assert.ok(isIdle(1000,1000+10*60000));
 assert.ok(presenceOrder('online')<presenceOrder('away')&&presenceOrder('away')<presenceOrder('offline'));
 assert.ok(isPresenceStatus('invisible')&&isPresenceStatus('away')&&isPresenceStatus('online'));
 assert.ok(!isPresenceStatus('offline')&&!isPresenceStatus(null)&&!isPresenceStatus('dormindo'));
});
