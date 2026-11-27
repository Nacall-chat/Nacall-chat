import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ago,arrivedDms,badgeText,previewOf,sameUnread,unreadTotal,withoutOpen,type UnreadDm} from '../src/lib/unread';
import {avisoDate,fetchAvisos,liveAvisos,parseAvisosRead,parseSound,toAvisos,trackVersion,unreadAvisos,withRead,type ProductUpdateRow} from '../src/lib/avisos';

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

const row=(slug:string,published:string,expires:string):ProductUpdateRow=>({slug,title:`Título ${slug}`,body:'Texto simples da novidade.',published_at:published,expires_at:expires});
const rows=[row('pr-1','2026-11-25T10:00:00Z','2026-11-28T10:00:00Z'),row('pr-3','2026-11-27T10:00:00Z','2026-11-30T10:00:00Z'),row('pr-0','2026-11-20T10:00:00Z','2026-11-23T10:00:00Z')];

test('avisos: vêm do banco, mais novos primeiro, e o que expirou some sozinho',()=>{
 const now=Date.parse('2026-11-27T12:00:00Z');
 const list=toAvisos(rows,now);
 assert.deepEqual(list.map(a=>a.id),['pr-3','pr-1'],'expirado (pr-0) fica de fora');
 assert.equal(list[0].title,'Título pr-3');assert.equal(list[0].text,'Texto simples da novidade.');
 assert.deepEqual(liveAvisos(list,Date.parse('2026-11-29T00:00:00Z')).map(a=>a.id),['pr-3'],'com a aba aberta, expira sem nova consulta');
 assert.deepEqual(toAvisos([{...rows[1],title:''}],now),[],'linha incompleta é ignorada');
});

test('avisos: o que já foi visto some e ver é por conta',()=>{
 const list=toAvisos(rows,Date.parse('2026-11-27T12:00:00Z'));
 const ids=list.map(a=>a.id);
 assert.equal(unreadAvisos([],list).length,list.length,'quem nunca abriu o sino vê todos como novos');
 assert.deepEqual(unreadAvisos(ids,list).map(a=>a.id),[]);
 assert.deepEqual(unreadAvisos([ids[0]],list).map(a=>a.id),ids.slice(1));
 assert.deepEqual(withRead(['x'],['y','x']),['x','y'],'sem repetir');
});

test('avisos: data em pt-BR e consulta que falha vira lista vazia',async()=>{
 assert.match(avisoDate('2026-11-27T10:00:00Z'),/^\d{2}\/\d{2}\/2026$/);
 assert.equal(avisoDate('2026-11-19'),'19/11/2026');
 assert.equal(avisoDate('lixo'),'');
 const chain=(result:unknown)=>({select:()=>({order:()=>({limit:async()=>result})})});
 const failing={from:()=>chain({data:null,error:{message:'relation does not exist'}})};
 assert.deepEqual(await fetchAvisos(failing as never),[]);
 const ok={from:(table:string)=>{assert.equal(table,'product_updates');return chain({data:rows,error:null});}};
 assert.ok((await fetchAvisos(ok as never)).length<=rows.length);
});

test('avisos: leitura salva é lida com segurança',()=>{
 assert.deepEqual(parseAvisosRead(null),[]);
 assert.deepEqual(parseAvisosRead('lixo{'),[]);
 assert.deepEqual(parseAvisosRead('{"a":1}'),[]);
 assert.deepEqual(parseAvisosRead('["a",2,null,"b"]'),['a','b']);
});

test('versão: a primeira resposta vira a versão da aba e só uma resposta diferente avisa',()=>{
 let state={baseline:'',update:false};
 state=trackVersion(state.baseline,'abc');
 assert.deepEqual(state,{baseline:'abc',update:false},'a primeira resposta é a versão desta aba, sem aviso');
 state=trackVersion(state.baseline,'abc');
 assert.equal(state.update,false,'mesma versão: sem aviso');
 state=trackVersion(state.baseline,'def');
 assert.deepEqual(state,{baseline:'abc',update:true},'versão nova no ar: avisa e a versão da aba não muda');
 state=trackVersion(state.baseline,'ghi');
 assert.equal(state.update,true,'continua avisando enquanto a aba não recarrega');
 state=trackVersion(state.baseline,'abc');
 assert.equal(state.update,false,'voltou à versão da aba (rollback): o aviso some');
});

test('versão: resposta vazia (desenvolvimento) nunca avisa; som vem ligado',()=>{
 assert.deepEqual(trackVersion('','' ),{baseline:'',update:false});
 assert.deepEqual(trackVersion('abc',''),{baseline:'abc',update:false},'falha ou servidor sem versão não vira aviso');
 assert.ok(parseSound(null));assert.ok(parseSound('1'));assert.ok(!parseSound('0'));
});
