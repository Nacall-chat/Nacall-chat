import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {clampVolume,focusStream,isWatching,openStreamSid,reconcileScreenSubscriptions,setWatching} from '../src/lib/stream';

// Ninguém é forçado a assistir a uma transmissão: ela aparece como um cartão "AO VIVO" e só abre no "Assistir".
// Sair da transmissão desliga o vídeo E o áudio da tela (era o áudio que continuava tocando) sem sair da call.
test('a transmissão dos outros só abre depois do Assistir; a sua prévia já vem aberta',()=>{
 assert.equal(isWatching({},'TR_1',false),false);
 assert.equal(isWatching({},'TR_1',true),true);
 assert.equal(isWatching(setWatching({},'TR_1',true),'TR_1',false),true);
 assert.equal(isWatching(setWatching({},'TR_1',false),'TR_1',true),false,'dá para ocultar a própria prévia');
});

test('a escolha vale para aquela transmissão: uma nova transmissão recomeça fechada',()=>{
 const state=setWatching({},'TR_1',true);
 assert.equal(isWatching(state,'TR_2',false),false);
});

function fake(subscribed:boolean){const pub={isSubscribed:subscribed,calls:[] as boolean[],setSubscribed(value:boolean){pub.calls.push(value);pub.isSubscribed=value;}};return pub;}

test('sem Assistir, o vídeo e o áudio da tela são desligados',()=>{
 const screen={...fake(true),trackSid:'TR_1'},audio=fake(true);
 reconcileScreenSubscriptions([{screen,audio}],{});
 assert.deepEqual(screen.calls,[false]);
 assert.deepEqual(audio.calls,[false],'o áudio da tela é outra faixa e também precisa parar');
});

test('com Assistir, vídeo e áudio da tela chegam',()=>{
 const screen={...fake(false),trackSid:'TR_1'},audio=fake(false);
 reconcileScreenSubscriptions([{screen,audio}],{TR_1:true});
 assert.deepEqual(screen.calls,[true]);
 assert.deepEqual(audio.calls,[true]);
});

test('é idempotente: só pede o que mudou e ignora quem não está transmitindo',()=>{
 const screen={...fake(true),trackSid:'TR_1'},audio=fake(true),other=fake(false);
 reconcileScreenSubscriptions([{screen,audio},{audio:other}],{TR_1:true});
 assert.deepEqual(screen.calls,[]);
 assert.deepEqual(audio.calls,[]);
 assert.deepEqual(other.calls,[],'áudio de tela sem vídeo publicado não é mexido');
});

test('transmissão sem áudio funciona',()=>{
 const screen={...fake(true),trackSid:'TR_1'};
 reconcileScreenSubscriptions([{screen}],{});
 assert.deepEqual(screen.calls,[false]);
});

test('o volume da transmissão fica entre 0 e 1',()=>{
 assert.equal(clampVolume(0.4),0.4);
 assert.equal(clampVolume(-2),0);
 assert.equal(clampVolume(7),1);
 assert.equal(clampVolume(Number.NaN),1);
});

test('a call mostra AO VIVO, o cartão de assistir e o volume da transmissão',async()=>{
 const voice=await readFile(new URL('../src/components/voice.tsx',import.meta.url),'utf8');
 const badge=await readFile(new URL('../src/components/live-badge.tsx',import.meta.url),'utf8');
 assert.match(badge,/function LiveBadge/);
 assert.match(voice,/import \{LiveBadge\} from '\.\/live-badge'/);
 assert.match(voice,/Sair da transmissão/);
 const tile=await readFile(new URL('../src/components/stream-tile.tsx',import.meta.url),'utf8');
 assert.match(tile,/Assistir à transmissão de/,'o cartão da grade é o botão de assistir');
 assert.match(voice,/Volume da transmissão de/);
 assert.match(voice,/setVolume\(v,Track\.Source\.ScreenShareAudio\)/,'o volume da transmissão mexe só no áudio da tela, não na voz');
 assert.doesNotMatch(voice,/EyeOff|hiddenScreens/,'o olho antigo (que não parava o áudio) saiu');
});

// Igual ao Discord: com 2 ou mais pessoas transmitindo, só uma tela fica aberta; a pessoa escolhe qual pelos cards.
test('só uma transmissão aberta por vez: escolher outra fecha a anterior e a própria prévia',()=>{
 const all=['minha','ana','bia','caio'];
 const streams=[{sid:'minha',isLocal:true},{sid:'ana',isLocal:false},{sid:'bia',isLocal:false},{sid:'caio',isLocal:false}];
 let s:Record<string,boolean>={};
 assert.equal(openStreamSid(s,streams),'minha','sem escolha: só a sua prévia abre (as dos outros viram cards)');
 s=focusStream(s,'ana',true,all);
 assert.equal(openStreamSid(s,streams),'ana');
 assert.deepEqual(Object.entries(s).filter(([,v])=>v).map(([k])=>k),['ana'],'a sua prévia e as outras ficam fechadas');
 s=focusStream(s,'bia',true,all);
 assert.equal(openStreamSid(s,streams),'bia','trocar de tela fecha a anterior');
 assert.equal(s.ana,false,'a anterior para de chegar (economiza internet)');
 s=focusStream(s,'bia',false,all);
 assert.equal(openStreamSid(s,streams),null,'sair não abre outra sozinha');
 s=focusStream(s,'minha',true,all);
 assert.equal(openStreamSid(s,streams),'minha','dá para voltar à própria prévia pelo card');
 assert.equal(openStreamSid({},[{sid:'ana',isLocal:false},{sid:'bia',isLocal:false}]),null,'ninguém é forçado a assistir');
});

test('só a transmissão escolhida recebe vídeo e áudio',()=>{
 const calls:string[]=[];
 const pub=(sid:string,on:boolean)=>({trackSid:sid,isSubscribed:on,setSubscribed:(v:boolean)=>calls.push(`${sid}:${v}`)});
 const s=focusStream(focusStream({},'ana',true,['ana','bia']),'bia',true,['ana','bia']);
 reconcileScreenSubscriptions([{screen:pub('ana',true)},{screen:pub('bia',false)}],s);
 assert.deepEqual(calls.sort(),['ana:false','bia:true']);
});
