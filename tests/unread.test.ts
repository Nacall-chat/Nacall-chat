import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ago,arrivedDms,badgeText,previewOf,sameUnread,unreadTotal,withoutOpen,type UnreadDm} from '../src/lib/unread';
import {avisos,parseAvisosRead,parseSound,unreadAvisos,updateAvailable,withRead} from '../src/lib/avisos';
import {UPDATE_ID} from '../src/lib/novidades';

const item=(dm_id:string,unread:number,last_kind='text',last_body='oi',last_at='2026-11-19T12:00:00Z'):UnreadDm=>({dm_id,unread,last_at,last_kind,last_body});

test('bolinha: número cabe e passa de 99 vira 99+',()=>{
 assert.equal(badgeText(1),'1');assert.equal(badgeText(99),'99');assert.equal(badgeText(100),'99+');assert.equal(badgeText(-3),'0');
});

test('prévia: áudio e figurinha ganham rótulo, texto fica curto e em uma linha',()=>{
 assert.equal(previewOf('audio',''),'Mensagem de áudio');
 assert.equal(previewOf('sticker',''),'Figurinha');
 assert.equal(previewOf('text','  oi\n\n tudo   bem?  '),'oi tudo bem?');
 assert.equal(previewOf('text',''),'Nova mensagem');
 const long=previewOf('text','a'.repeat(200));
 assert.equal(long.length,80);assert.ok(long.endsWith('…'));
});

test('contagem: soma todas as DMs e a conversa aberta e em foco não conta',()=>{
 const list=[item('a',2),item('b',3)];
 assert.equal(unreadTotal(list),5);assert.equal(unreadTotal([]),0);
 assert.deepEqual(withoutOpen(list,'a',true).map(x=>x.dm_id),['b'],'olhando a DM a: ela já foi vista');
 assert.deepEqual(withoutOpen(list,'a',false).map(x=>x.dm_id),['a','b'],'aba em segundo plano: continua não lida');
 assert.deepEqual(withoutOpen(list,null,true).map(x=>x.dm_id),['a','b']);
});

test('som: toca quando chega mensagem nova e nunca na primeira carga',()=>{
 assert.deepEqual(arrivedDms(null,[item('a',4)]),[],'primeira carga com não lidas antigas fica em silêncio');
 assert.deepEqual(arrivedDms([],[item('a',1)]),['a'],'DM sem nada antes passou a ter uma');
 assert.deepEqual(arrivedDms([item('a',1)],[item('a',2)]),['a'],'mais uma na mesma DM');
 assert.deepEqual(arrivedDms([item('a',2)],[item('a',2)]),[],'nada mudou');
 assert.deepEqual(arrivedDms([item('a',3)],[item('a',1)]),[],'diminuiu (leu em outro aparelho): sem som');
 assert.deepEqual(arrivedDms([item('a',1),item('b',1)],[item('b',1)]),[],'lida: sem som');
 assert.deepEqual(arrivedDms([item('a',1)],[item('a',1),item('b',2)]),['b']);
});

test('lista igual não renderiza de novo',()=>{
 assert.ok(sameUnread([item('a',1)],[item('a',1)]));
 assert.ok(!sameUnread([item('a',1)],[item('a',2)]));
 assert.ok(!sameUnread([item('a',1)],[item('a',1,'text','oi','2026-11-19T13:00:00Z')]));
 assert.ok(!sameUnread([item('a',1)],[]));
});

test('há quanto tempo: agora, minutos, horas e a data',()=>{
 const now=new Date('2026-11-19T12:00:00Z').getTime();
 assert.equal(ago('2026-11-19T11:59:40Z',now),'agora');
 assert.equal(ago('2026-11-19T11:55:00Z',now),'há 5 min');
 assert.equal(ago('2026-11-19T09:00:00Z',now),'há 3 h');
 assert.match(ago('2026-11-10T09:00:00Z',now),/\d{2}\/\d{2}\/\d{4}/);
 assert.equal(ago('2026-11-19T12:05:00Z',now),'agora','relógio adiantado não vira número negativo');
});

test('avisos: ids únicos, o que já foi visto some e ver é por conta',()=>{
 const ids=avisos.map(a=>a.id);
 assert.equal(new Set(ids).size,ids.length,'ids únicos');
 assert.ok(avisos.every(a=>a.title&&a.text&&/^\d{4}-\d{2}-\d{2}$/.test(a.date)));
 assert.ok(ids.includes(UPDATE_ID)&&avisos.find(a=>a.id===UPDATE_ID)?.slides,'o carrossel de novidades tem aviso com o botão');
 assert.equal(unreadAvisos([]).length,avisos.length,'quem nunca abriu o sino vê todos como novos');
 assert.deepEqual(unreadAvisos(ids).map(a=>a.id),[]);
 assert.deepEqual(unreadAvisos([ids[0]]).map(a=>a.id),ids.slice(1));
 assert.deepEqual(withRead(['x'],['y','x']),['x','y'],'sem repetir');
});

test('avisos: leitura salva é lida com segurança',()=>{
 assert.deepEqual(parseAvisosRead(null),[]);
 assert.deepEqual(parseAvisosRead('lixo{'),[]);
 assert.deepEqual(parseAvisosRead('{"a":1}'),[]);
 assert.deepEqual(parseAvisosRead('["a",2,null,"b"]'),['a','b']);
});

test('versão: só avisa quando as duas são conhecidas e diferentes; som vem ligado',()=>{
 assert.ok(updateAvailable('abc','def'));
 assert.ok(!updateAvailable('abc','abc'));
 assert.ok(!updateAvailable('','def'),'em desenvolvimento não avisa');
 assert.ok(!updateAvailable('abc',''),'servidor sem versão não avisa');
 assert.ok(parseSound(null));assert.ok(parseSound('1'));assert.ok(!parseSound('0'));
});
