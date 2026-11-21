import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {TrackSource} from 'livekit-server-sdk';
import {DEAF_ATTRIBUTE,TRACK_SOURCE,flagsKey,liveFlags,personFlags,shownFlags} from '../src/lib/room-people';
import {isCurrentCall} from '../src/lib/call-session';
import {canShareScreen} from '../src/lib/screen-share';

const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

// ---- lista de salas: AO VIVO, microfone fechado e fone mudo para quem está fora da call ----
test('os ids de origem das faixas batem com os do LiveKit',()=>{
 assert.equal(TRACK_SOURCE.CAMERA,TrackSource.CAMERA);
 assert.equal(TRACK_SOURCE.MICROPHONE,TrackSource.MICROPHONE);
 assert.equal(TRACK_SOURCE.SCREEN_SHARE,TrackSource.SCREEN_SHARE);
 assert.equal(TRACK_SOURCE.SCREEN_SHARE_AUDIO,TrackSource.SCREEN_SHARE_AUDIO);
});

test('o servidor lê transmissão, mic fechado e fone mudo de cada participante',()=>{
 assert.deepEqual(personFlags({}),{sharing:false,muted:true,deaf:false},'sem faixa de microfone = mic fechado');
 assert.deepEqual(personFlags({tracks:[{source:TRACK_SOURCE.MICROPHONE,muted:false}]}),{sharing:false,muted:false,deaf:false});
 assert.equal(personFlags({tracks:[{source:TRACK_SOURCE.MICROPHONE,muted:true}]}).muted,true);
 assert.equal(personFlags({tracks:[{source:TRACK_SOURCE.SCREEN_SHARE,muted:false}]}).sharing,true);
 assert.equal(personFlags({tracks:[{source:TRACK_SOURCE.SCREEN_SHARE_AUDIO,muted:false}]}).sharing,false,'só o áudio da tela não é transmissão');
 assert.equal(personFlags({attributes:{[DEAF_ATTRIBUTE]:'1'}}).deaf,true);
 assert.equal(personFlags({attributes:{[DEAF_ATTRIBUTE]:'0'}}).deaf,false);
});

test('quem está na sua call aparece na hora, sem esperar a consulta',()=>{
 const live=liveFlags({isScreenShareEnabled:true,isMicrophoneEnabled:false,attributes:{}});
 assert.deepEqual(live,{sharing:true,muted:true,deaf:false});
 assert.equal(liveFlags({isScreenShareEnabled:false,isMicrophoneEnabled:true,attributes:{deaf:'1'}}).deaf,true);
 assert.equal(liveFlags({isScreenShareEnabled:false,isMicrophoneEnabled:true,attributes:{}},true).deaf,true,'o seu fone mudo vem do estado local');
 assert.deepEqual(shownFlags({sharing:true},live),live,'o ao vivo vence a última consulta');
 assert.deepEqual(shownFlags({sharing:true,muted:false}),{sharing:true,muted:false,deaf:false});
 assert.deepEqual(shownFlags({}),{sharing:false,muted:false,deaf:false},'consulta antiga sem os campos não mostra ícone falso');
});

test('a chave só muda quando algum sinal muda',()=>{
 const a={x:{sharing:false,muted:true,deaf:false}};
 assert.equal(flagsKey(a),flagsKey({x:{sharing:false,muted:true,deaf:false}}));
 assert.notEqual(flagsKey(a),flagsKey({x:{sharing:true,muted:true,deaf:false}}));
 assert.notEqual(flagsKey(a),flagsKey({x:{sharing:false,muted:true,deaf:true}}));
});

test('a barra lateral mostra AO VIVO e os ícones ao lado do nome, e o servidor envia os sinais',async()=>{
 const app=await read('src/components/app.tsx'),rooms=await read('src/lib/livekit-rooms.ts'),voice=await read('src/components/voice.tsx');
 assert.match(app,/<LiveBadge\/>/);
 assert.match(app,/<PersonStateIcons muted=\{flags\.muted\} deaf=\{flags\.deaf\}\/>/);
 assert.match(rooms,/personFlags\(/);
 assert.match(voice,/setAttributes\(\{\[DEAF_ATTRIBUTE\]/,'o fone mudo é publicado para os outros');
 assert.match(voice,/onPeople\?\.\(/);
});

// ---- trocar de call com um clique ----
test('o aviso de saída da call antiga não derruba a nova',()=>{
 assert.equal(isCurrentCall({channelId:'A'},'A'),true);
 assert.equal(isCurrentCall({channelId:'B'},'A'),false,'a call B já entrou no lugar da A');
 assert.equal(isCurrentCall(null,'A'),false);
});

test('clicar em outra sala de voz troca de call, em vez de pedir para sair antes',async()=>{
 const app=await read('src/components/app.tsx');
 assert.doesNotMatch(app,/Saia da chamada atual/);
 assert.match(app,/<Voice key=\{voice\.channelId\}/,'a sala nova monta uma conexão nova e desconecta a antiga');
 assert.match(app,/leave=\{\(\)=>leaveCall\(voice\.channelId\)\}/);
 assert.match(app,/isCurrentCall\(voiceRef\.current,\s*channelId\)/);
});

// ---- tela cheia com X e botões do topo ----
test('a tela cheia da transmissão vira X e sai da tela cheia',async()=>{
 const voice=await read('src/components/voice.tsx');
 assert.match(voice,/fullscreenchange/);
 assert.match(voice,/Sair da tela cheia/);
 assert.match(voice,/document\.exitFullscreen\(\)/);
 assert.match(voice,/fullscreenSid===sid\?<X size=\{18\}\/>:<Maximize2/);
});

test('os dois botões confusos do topo da call saíram',async()=>{
 const voice=await read('src/components/voice.tsx'),app=await read('src/components/app.tsx');
 assert.doesNotMatch(voice,/Minimizar a call|Recolher call|Expandir call/);
 assert.doesNotMatch(app,/minimizeCall/);
});

// ---- janela própria antes do seletor do navegador ----
test('compartilhar tela abre a janela do NACALL antes do seletor do navegador; parar é direto',async()=>{
 const voice=await read('src/components/voice.tsx'),dialog=await read('src/components/share-dialog.tsx');
 assert.match(voice,/const toggleScreen=\(\)=>\{if\(isScreenShareEnabled\)\{void action\(\(\)=>localParticipant\.setScreenShareEnabled\(false\)\);return;\}if\(!canShareScreen\(\)\)\{report\(SCREEN_UNSUPPORTED_MESSAGE\);return;\}setShareOpen\(true\);\}/);
 assert.match(voice,/const startScreen=\(\)=>\{setShareOpen\(false\);/);
 assert.match(voice,/<ShareDialog onClose=/);
 assert.match(dialog,/role="radiogroup"/);
 for(const word of ['Qualidade','Fluidez','Compartilhar o som','Escolher o que mostrar'])assert.match(dialog,new RegExp(word));
});

// ---- cartão no meio ----
test('o cartão de transmissão e os participantes ficam centralizados na área da call',async()=>{
 const css=await read('src/app/call-stage.css');
 assert.match(css,/\.call-stage>\.stream-cards:first-child,\.call-stage>\.participants:first-child\{margin-top:auto\}/);
 assert.match(css,/\.call-stage>\.participants:last-child\{margin-bottom:auto\}/);
 assert.match(css,/\.stream-card\{width:min\(100%,440px\);margin-inline:auto\}/);
});

test('compartilhar tela só é oferecido onde o navegador tem getDisplayMedia',()=>{
  assert.equal(canShareScreen({mediaDevices:{getDisplayMedia:async()=>new MediaStream()}} as unknown as Navigator),true);
  assert.equal(canShareScreen({mediaDevices:{}} as unknown as Navigator),false);
  assert.equal(canShareScreen({} as unknown as Navigator),false);
  assert.equal(canShareScreen(undefined),false);
});
