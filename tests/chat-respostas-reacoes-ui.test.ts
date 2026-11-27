import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {QUICK_REACTIONS,groupReactions,replySnippet} from '../src/lib/message-extras';

const read=(p:string)=>readFile(new URL(`../${p}`,import.meta.url),'utf8');

test('reações agrupadas por mensagem e emoji, com contagem e "mine"',()=>{
 const g=groupReactions([
  {message_id:'m1',user_id:'a',emoji:'👍'},{message_id:'m1',user_id:'b',emoji:'👍'},
  {message_id:'m1',user_id:'b',emoji:'🔥'},{message_id:'m2',user_id:'a',emoji:'😂'},
 ],'a');
 assert.deepEqual(g.m1,[{emoji:'👍',count:2,mine:true},{emoji:'🔥',count:1,mine:false}]);
 assert.deepEqual(g.m2,[{emoji:'😂',count:1,mine:true}]);
 assert.equal(QUICK_REACTIONS.length,6);
});

test('trecho da citação: texto curto numa linha, áudio e figurinha com rótulo',()=>{
 assert.equal(replySnippet({body:'oi\n\n  tudo bem?'}),'oi tudo bem?');
 assert.equal(replySnippet({body:'x'.repeat(200)},20).length,20);
 assert.equal(replySnippet({body:'',kind:'audio'}),'Áudio');
 assert.equal(replySnippet({body:'',kind:'sticker'}),'Figurinha');
});

test('site e app: responder envia reply_to, mostram citação, chips e ações',async()=>{
 const app=await read('src/components/app.tsx');
 assert.match(app,/reply_to: replyTo\.id/,'o site envia a resposta');
 assert.match(app,/<ReplyQuote /);assert.match(app,/<ReactionBar /);assert.match(app,/<MessageActions /);assert.match(app,/<ReplyBar /);
 const mobile=await read('apps/mobile/src/features/chat/chat-screen.tsx');
 assert.match(mobile,/send\(text, replyTo\?\.id\)/,'o app envia a resposta');
 assert.match(mobile,/onLongPress=\{\(\) => setActionsFor\(item\)\}/,'toque longo abre as ações');
 assert.match(mobile,/@nacall\/core\/message-extras/,'mesma regra do site');
 assert.match(await read('apps/mobile/src/features/chat/use-messages.ts'),/reply_to: replyTo/);
 const css=await read('src/app/theme-fixes.css');
 assert.match(css,/@media\(hover:none\)\{[\s\S]*\.msg-actions-more\{display:inline-flex/,'no toque, o botão "mais" abre as ações');
});
