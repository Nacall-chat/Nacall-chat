import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {countViewers,parseWatching,viewersLabel,watchingValue,WATCH_ATTRIBUTE} from '../src/lib/stream';
import {needsThumb,THUMB_MAX_BASE64,THUMB_STEPS,thumbSize,thumbSrc,thumbValue} from '../src/lib/stream-thumb';

const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const person=(identity:string,watching:string,isLocal=false)=>({identity,isLocal,attributes:(watching?{[WATCH_ATTRIBUTE]:watching}:{}) as Record<string,string>});

// ---- contador de quem está assistindo ----
test('o contador soma só quem está assistindo àquela transmissão, não todos da sala',()=>{
 const room=[person('barbosa',''),person('ana','TR_1'),person('bia','TR_1,TR_2'),person('caio','TR_2'),person('dani','')];
 assert.equal(countViewers(room,'TR_1','barbosa'),2);
 assert.equal(countViewers(room,'TR_2','barbosa'),2);
 assert.equal(countViewers(room,'TR_9','barbosa'),0,'transmissão que ninguém abriu');
});

test('quem transmite não conta, nem a própria prévia',()=>{
 const room=[person('barbosa','TR_1',true),person('ana','TR_1')];
 assert.equal(countViewers(room,'TR_1','barbosa'),1);
 assert.equal(countViewers([person('eu','TR_1',true)],'TR_1','barbosa'),0,'o atributo local não entra: quem está na tela se conta por localWatching');
});

test('quem assiste se conta na hora, sem esperar o servidor devolver o atributo',()=>{
 const room=[person('barbosa',''),person('eu','',true),person('ana','TR_1')];
 assert.equal(countViewers(room,'TR_1','barbosa',true),2);
 assert.equal(countViewers(room,'TR_1','barbosa',false),1);
});

test('atualiza quando alguém entra e sai: o atributo some com quem desconecta ou deixa a transmissão',()=>{
 const before=[person('barbosa',''),person('ana','TR_1'),person('bia','TR_1')];
 assert.equal(countViewers(before,'TR_1','barbosa'),2);
 assert.equal(countViewers(before.filter(p=>p.identity!=='bia'),'TR_1','barbosa'),1,'bia saiu da sala');
 assert.equal(countViewers([person('barbosa',''),person('ana',''),person('bia','TR_1')],'TR_1','barbosa'),1,'ana saiu da transmissão (atributo vazio)');
 assert.equal(countViewers([person('barbosa','')],'TR_1','barbosa'),0,'caso de zero');
});

test('o valor publicado é estável, sem repetição e sem ids inválidos',()=>{
 assert.equal(watchingValue([]),'');
 assert.equal(watchingValue(['TR_2','TR_1','TR_2']),'TR_1,TR_2');
 assert.equal(watchingValue(['TR_1,TR_2','','TR_3']),'TR_3');
 assert.deepEqual(parseWatching(undefined),[]);
 assert.deepEqual(parseWatching(''),[]);
 assert.deepEqual(parseWatching('TR_1,,TR_2'),['TR_1','TR_2']);
});

test('o texto do contador trata o zero',()=>{
 assert.equal(viewersLabel(0),'Ninguém assistindo');
 assert.equal(viewersLabel(1),'1 assistindo');
 assert.equal(viewersLabel(12),'12 assistindo');
});

// ---- prévia ----
const b64=(len:number)=>'/9j/'+'A'.repeat(len);

test('o quadro da prévia mantém o formato da tela e nunca passa da largura pedida',()=>{
 assert.deepEqual(thumbSize(1920,1080,320),{width:320,height:180});
 assert.deepEqual(thumbSize(2560,1080,320),{width:320,height:135},'ultrawide continua ultrawide');
 assert.deepEqual(thumbSize(1080,1920,320),{width:320,height:569},'tela em pé');
 assert.deepEqual(thumbSize(200,100,320),{width:200,height:100},'não aumenta além do original');
 assert.equal(thumbSize(0,0,320),null,'vídeo ainda sem imagem');
 assert.equal(thumbSize(1920,1080,0),null);
});

test('os tamanhos tentados vão do melhor ao mais leve',()=>{
 for(let i=1;i<THUMB_STEPS.length;i++){assert.ok(THUMB_STEPS[i]!.width<THUMB_STEPS[i-1]!.width);assert.ok(THUMB_STEPS[i]!.quality<=THUMB_STEPS[i-1]!.quality);}
});

test('só um JPEG pequeno vira valor publicado',()=>{
 assert.equal(thumbValue(`data:image/jpeg;base64,${b64(500)}`),b64(500));
 assert.equal(thumbValue(`data:image/png;base64,${b64(500)}`),null,'não é JPEG');
 assert.equal(thumbValue(`data:image/jpeg;base64,${b64(THUMB_MAX_BASE64)}`),null,'grande demais: tenta um tamanho menor');
 assert.equal(thumbValue('data:image/jpeg;base64,iVBORw0KGgo'),null,'cabeçalho que não é de JPEG');
 assert.equal(thumbValue('lixo'),null);
});

test('o quadro de outra pessoa só vira imagem depois de conferido',()=>{
 assert.equal(thumbSrc(b64(300)),`data:image/jpeg;base64,${b64(300)}`);
 assert.equal(thumbSrc(undefined),null);
 assert.equal(thumbSrc(''),null);
 assert.equal(thumbSrc('<svg onload=alert(1)>'),null);
 assert.equal(thumbSrc('/9j/"onerror="x'),null,'nada de aspas ou espaços');
 assert.equal(thumbSrc('data:image/svg+xml;base64,PHN2Zz4='),null,'só o miolo base64 é aceito');
 assert.equal(thumbSrc(b64(THUMB_MAX_BASE64)),null,'tamanho limitado para não pesar na memória dos outros');
});

test('só gasta CPU e rede com a prévia quando alguém na sala ainda não está assistindo',()=>{
 assert.equal(needsThumb(0,0),false,'sala vazia');
 assert.equal(needsThumb(3,0),true);
 assert.equal(needsThumb(3,2),true,'um ainda vê o cartão');
 assert.equal(needsThumb(3,3),false,'todos já assistem');
});

// ---- interface ----
test('o cartão da transmissão entra na grade dos participantes, logo depois de quem transmite',async()=>{
 const voice=await read('src/components/voice.tsx');
 assert.doesNotMatch(voice,/stream-cards|stream-card"/,'a faixa larga saiu');
 assert.match(voice,/<StreamTile name=/);
 assert.match(voice,/<\/article>\{share\?\.publication&&<StreamTile/,'o cartão vem logo depois do cartão de quem transmite, dentro da mesma grade');
 assert.match(voice,/thumbSrc\(p\.attributes\[THUMB_ATTRIBUTE\]\)/);
 assert.match(voice,/className=\{`participants \$\{streamOpen\?'with-stream':''\}`\}/,'cartões só encolhem quando há transmissão aberta');
 const tile=await read('src/components/stream-tile.tsx');
 assert.match(tile,/className="participant stream-tile"/,'mesma base dos cartões dos participantes');
 assert.match(tile,/Assistir à transmissão de/);
 assert.match(tile,/<LiveBadge\/>/);
 assert.match(tile,/Carregando prévia…/,'estado de carregando');
 assert.match(tile,/viewersLabel\(viewers\)/);
 const css=await read('src/app/call-stage.css');
 assert.match(css,/\.participant>\.stream-tile-view\{[^}]*aspect-ratio:16\/9/,'mesma proporção da foto dos participantes');
 assert.match(css,/\.stream-tile-wait\{position:absolute;inset:0/,'o carregando ocupa o quadro e mantém a proporção');
});

test('cada participante publica o que assiste e quem transmite publica a prévia, sem canal de dados',async()=>{
 const voice=await read('src/components/voice.tsx');
 assert.match(voice,/setAttributes\(\{\[WATCH_ATTRIBUTE\]:watchingAttr\}\)/);
 assert.match(voice,/r\.publication\.isSubscribed&&isWatching\(/,'só conta quem está de fato inscrito na faixa');
 assert.match(voice,/useStreamThumbPublisher\(/);
 assert.match(voice,/viewersLabel\(viewersOf\(sid,ref\.participant\.identity\)\)/,'o número aparece na tela de assistir, para quem assiste e para quem transmite');
 const hook=await read('src/components/use-stream-thumb.ts');
 assert.match(hook,/setAttributes\(\{\[THUMB_ATTRIBUTE\]:value\}\)/);
 assert.match(hook,/setAttributes\(\{\[THUMB_ATTRIBUTE\]:''\}\)/,'a prévia some quando a transmissão acaba');
 assert.doesNotMatch(hook,/publishData|localStorage|sessionStorage|indexedDB|fetch\(|supabase/i,'nada em disco, banco ou canal de dados');
 const token=await read('src/app/api/livekit/token/route.ts');
 assert.match(token,/canPublishData: false/,'o token continua sem permitir mensagens de dados');
 assert.match(token,/canUpdateOwnMetadata: true/,'e permite atributos, que é por onde a prévia e o contador viajam');
});

test('a janela de compartilhar avisa que os outros veem uma prévia pequena antes de clicar em Assistir',async()=>{
 const dialog=await read('src/components/share-dialog.tsx');
 assert.match(dialog,/prévia/i);
 assert.match(dialog,/Assistir/);
});
