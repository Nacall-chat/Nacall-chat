import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GROUP_WINDOW_MS,dayLabel,messageLayout} from '../src/lib/message-groups';

const at=(iso:string,author='a')=>({author_id:author,created_at:iso});
const read=(p:string)=>readFile(new URL(`../${p}`,import.meta.url),'utf8');

test('agrupa mensagens seguidas da mesma pessoa em menos de 5 minutos',()=>{
 const first=at('2026-11-22T10:00:00');
 assert.deepEqual(messageLayout(undefined,first),{newDay:true,grouped:false});
 assert.equal(messageLayout(first,at('2026-11-22T10:03:00')).grouped,true);
 assert.equal(messageLayout(first,at('2026-11-22T10:06:00')).grouped,false,'passou da janela');
 assert.equal(messageLayout(first,at('2026-11-22T10:01:00','b')).grouped,false,'outra pessoa');
 assert.equal(GROUP_WINDOW_MS,300000);
});

test('o dia que muda abre separador e quebra o grupo',()=>{
 const last=at('2026-11-21T23:59:00');
 assert.deepEqual(messageLayout(last,at('2026-11-22T00:01:00')),{newDay:true,grouped:false});
});

test('rótulo do dia: hoje, ontem, data por extenso e ano só quando não é o atual',()=>{
 const now=new Date(2026,10,22,15,0,0);
 assert.equal(dayLabel('2026-11-22T08:00:00',now),'Hoje');
 assert.equal(dayLabel('2026-11-21T20:00:00',now),'Ontem');
 assert.equal(dayLabel('2026-03-04T12:00:00',now),'4 de março');
 assert.equal(dayLabel('2025-12-31T12:00:00',now),'31 de dezembro de 2025');
});

test('site e app usam a mesma regra, com esqueleto de carregamento no site',async()=>{
 assert.match(await read('src/components/app.tsx'),/messageLayout\(messages\[i - 1\], m\)/);
 assert.match(await read('apps/mobile/src/features/chat/chat-screen.tsx'),/@nacall\/core\/message-groups/);
 assert.match(await read('src/components/app.tsx'),/className="msg-skeleton-list" role="status"/);
});
