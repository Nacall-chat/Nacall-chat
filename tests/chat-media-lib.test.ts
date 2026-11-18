import {test} from 'node:test';
import assert from 'node:assert/strict';
import {audioStoragePath,formatClock,insertAtCursor,isEmojiOnly,pickAudioMime,sniffAudio,sniffImage,baseMime} from '../src/lib/chat-media';
import {searchEmojis,stripAccents,emojiCategories,type EmojiItem} from '../src/lib/emoji';
import data from '../src/lib/emoji-data.json';

const bytes=(...values:number[])=>new Uint8Array([...values,...new Array(16).fill(0)]);
const text=(value:string,offset=0)=>{const out=new Uint8Array(16);[...value].forEach((c,i)=>out[offset+i]=c.charCodeAt(0));return out;};

test('imagem é reconhecida pelos bytes, não pelo nome',()=>{
 assert.deepEqual(sniffImage(bytes(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a)),{mime:'image/png',ext:'png'});
 assert.deepEqual(sniffImage(bytes(0xff,0xd8,0xff,0xe0)),{mime:'image/jpeg',ext:'jpg'});
 assert.deepEqual(sniffImage(text('GIF89a')),{mime:'image/gif',ext:'gif'});
 assert.deepEqual(sniffImage(text('GIF87a')),{mime:'image/gif',ext:'gif'});
 const webp=text('RIFF');webp.set([87,69,66,80],8);assert.deepEqual(sniffImage(webp),{mime:'image/webp',ext:'webp'});
 const riffWav=text('RIFF');riffWav.set([87,65,86,69],8);assert.equal(sniffImage(riffWav),null,'RIFF de outro tipo');
 assert.equal(sniffImage(text('<svg xmlns=')),null,'SVG não entra (pode carregar script)');
 assert.equal(sniffImage(text('MZ')),null,'executável');
 assert.equal(sniffImage(new Uint8Array()),null);
});

test('áudio gravado é reconhecido por contêiner e o formato preferido é escolhido',()=>{
 assert.deepEqual(sniffAudio(bytes(0x1a,0x45,0xdf,0xa3)),{mime:'audio/webm',ext:'webm'});
 assert.deepEqual(sniffAudio(text('OggS')),{mime:'audio/ogg',ext:'ogg'});
 assert.deepEqual(sniffAudio(text('ftypM4A ',4)),{mime:'audio/mp4',ext:'m4a'});
 assert.equal(sniffAudio(text('MZ')),null);
 assert.equal(pickAudioMime(t=>t.startsWith('audio/webm')),'audio/webm;codecs=opus');
 assert.equal(pickAudioMime(t=>t==='audio/mp4'),'audio/mp4');
 assert.equal(pickAudioMime(()=>false),'','sem suporte declarado: usa o padrão do navegador');
 assert.equal(pickAudioMime(()=>{throw new Error('x');}),'');
 assert.equal(baseMime('audio/webm;codecs=opus'),'audio/webm');
 const p=audioStoragePath('u','c','webm');assert.match(p,/^u\/c\/[0-9a-f-]{36}\.webm$/);
});

test('cronômetro mm:ss',()=>{
 assert.equal(formatClock(0),'0:00');assert.equal(formatClock(999),'0:00');assert.equal(formatClock(1000),'0:01');
 assert.equal(formatClock(65_000),'1:05');assert.equal(formatClock(300_000),'5:00');assert.equal(formatClock(NaN),'0:00');assert.equal(formatClock(-5),'0:00');
});

test('emoji entra no cursor, troca a seleção e respeita o limite',()=>{
 assert.deepEqual(insertAtCursor('oi mundo',3,3,'😀'),{value:'oi 😀mundo',cursor:5,inserted:true});
 assert.deepEqual(insertAtCursor('oi mundo',3,8,'😀'),{value:'oi 😀',cursor:5,inserted:true},'seleção é substituída');
 assert.deepEqual(insertAtCursor('',null,null,'🎉'),{value:'🎉',cursor:2,inserted:true},'campo vazio');
 assert.deepEqual(insertAtCursor('abc',null,null,'😀'),{value:'abc😀',cursor:5,inserted:true},'sem cursor: no fim');
 const full='a'.repeat(4000);assert.equal(insertAtCursor(full,4000,4000,'😀').inserted,false,'estourou o limite');
 let v='';let c=0;for(const e of['😀','😂','🎉']){const r=insertAtCursor(v,c,c,e);v=r.value;c=r.cursor;}assert.equal(v,'😀😂🎉','vários por mensagem');
});

test('mensagem só de emojis é reconhecida (até 8)',()=>{
 assert.equal(isEmojiOnly('😀'),true);assert.equal(isEmojiOnly('😀 😂🎉'),true);assert.equal(isEmojiOnly('👩‍👩‍👧‍👦'),true);assert.equal(isEmojiOnly('🇧🇷'),true);assert.equal(isEmojiOnly('👍🏽'),true);
 assert.equal(isEmojiOnly('oi 😀'),false);assert.equal(isEmojiOnly('123'),false);assert.equal(isEmojiOnly(''),false);assert.equal(isEmojiOnly('😀'.repeat(9)),false);
});

test('biblioteca de emojis: categorias, busca sem acento e sem duplicar',()=>{
 const groups=(data as [string,string,string][][]).map(g=>g.map(([emoji,label,words])=>({emoji,label,haystack:`${stripAccents(label)} ${words}`})) as EmojiItem[]);
 assert.equal(groups.length,emojiCategories.length);
 assert.ok(groups.flat().length>1500,'biblioteca ampla');
 for(const g of groups)assert.ok(g.length>50);
 const found=searchEmojis(groups,'coracao');assert.ok(found.length>5);assert.ok(found.some(e=>e.emoji==='❤️'));
 assert.ok(searchEmojis(groups,'CORAÇÃO vermelho').some(e=>e.emoji==='❤️'),'acento e maiúsculas');
 assert.deepEqual(searchEmojis(groups,''),[]);assert.deepEqual(searchEmojis(groups,'zzzzqqq'),[]);
 assert.ok(searchEmojis(groups,'gato').some(e=>e.emoji==='🐱'||e.emoji==='🐈'));
 assert.equal(new Set(groups.flat().map(e=>e.emoji)).size,groups.flat().length,'sem repetição');
});
