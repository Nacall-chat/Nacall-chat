import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildDeviceList,micConstraint,micStage,parseMicPrefs,pickDevice,toneWav,micPrefsDefault} from '../src/lib/mic';
import {brandTotpUri,TOTP_ISSUER} from '../src/lib/totp';

const prefs=(patch:Partial<typeof micPrefsDefault>={})=>({...micPrefsDefault,...patch});

test('microfone: a janela só aparece quando falta liberar ou escolher',()=>{
 assert.equal(micStage('granted',prefs({setupDone:true})),'skip','liberado e escolhido: entra direto na call e no áudio');
 assert.equal(micStage('granted',prefs()),'choose','liberado mas ainda não escolheu o aparelho');
 assert.equal(micStage('prompt',prefs({setupDone:true})),'ask','o navegador esqueceu a permissão: pergunta de novo');
 assert.equal(micStage('prompt',prefs()),'ask');
 assert.equal(micStage('denied',prefs({setupDone:true})),'blocked');
 assert.equal(micStage('unknown',prefs({setupDone:true})),'skip','sem Permissions API: confia no que foi salvo');
 assert.equal(micStage('unknown',prefs()),'ask');
});

test('microfone: preferência salva é lida com segurança',()=>{
 assert.deepEqual(parseMicPrefs(null),micPrefsDefault);
 assert.deepEqual(parseMicPrefs('isso não é json'),micPrefsDefault);
 assert.deepEqual(parseMicPrefs('{"inputId":"abc","outputId":"def","setupDone":true}'),{inputId:'abc',outputId:'def',setupDone:true});
 assert.deepEqual(parseMicPrefs('{"inputId":42,"outputId":null,"setupDone":"sim"}'),micPrefsDefault,'tipos errados são ignorados');
 assert.equal(parseMicPrefs(JSON.stringify({inputId:'x'.repeat(2000)})).inputId.length,512,'tamanho limitado');
 assert.deepEqual(parseMicPrefs('null'),micPrefsDefault);
});

test('microfone: lista de aparelhos legível, com padrão primeiro e sem duplicados do Chrome',()=>{
 const raw=[
  {kind:'audioinput',deviceId:'a1',label:'Headset USB'},
  {kind:'audioinput',deviceId:'communications',label:'Comunicações - Headset USB'},
  {kind:'audioinput',deviceId:'default',label:'Padrão - Headset USB'},
  {kind:'audioinput',deviceId:'b2',label:''},
  {kind:'audiooutput',deviceId:'o1',label:'Caixas de som'},
  {kind:'videoinput',deviceId:'v1',label:'Câmera'},
 ];
 const inputs=buildDeviceList(raw,'audioinput');
 assert.deepEqual(inputs.map(d=>d.id),['default','a1','b2']);
 assert.equal(inputs[2].label,'Microfone 3','sem permissão o nome vem vazio: usa um nome genérico');
 assert.deepEqual(buildDeviceList(raw,'audiooutput'),[{id:'o1',label:'Caixas de som'}]);
 assert.equal(buildDeviceList([{kind:'audioinput',deviceId:'default',label:''}],'audioinput')[0].label,'Padrão do sistema');
 assert.deepEqual(buildDeviceList([],'audioinput'),[]);
 assert.equal(pickDevice(inputs,'a1'),'a1','mantém o escolhido');
 assert.equal(pickDevice(inputs,'sumiu'),'default','aparelho desconectado: volta ao padrão');
 assert.equal(pickDevice([{id:'x',label:'X'}],''),'x');
 assert.equal(pickDevice([],'a1'),'');
 assert.deepEqual(micConstraint('a1'),{deviceId:{ideal:'a1'}});
 assert.deepEqual(micConstraint(''),{});
});

test('microfone: o tom de teste é um WAV válido',()=>{
 const wav=toneWav(100,440,8000);const view=new DataView(wav.buffer);
 const ascii=(o:number,n:number)=>String.fromCharCode(...wav.slice(o,o+n));
 assert.equal(ascii(0,4),'RIFF');assert.equal(ascii(8,4),'WAVE');assert.equal(ascii(36,4),'data');
 assert.equal(view.getUint32(40,true),800*2,'100 ms a 8 kHz = 800 amostras de 16 bits');
 assert.equal(wav.length,44+1600);
 const peak=Math.max(...Array.from({length:800},(_,i)=>Math.abs(view.getInt16(44+i*2,true))));
 assert.ok(peak>1000&&peak<20000,'tem som e não satura');
 assert.equal(view.getInt16(44,true),0,'começa em silêncio (sem estalo)');
});

test('autenticador: o nome vira NACALL + nick, sem localhost nem porta',()=>{
 const original='otpauth://totp/localhost%3A3000:pessoa%40email.com?algorithm=SHA1&digits=6&issuer=localhost%3A3000&period=30&secret=JBSWY3DPEHPK3PXP';
 const branded=brandTotpUri(original,'QaMidiaA');
 const url=new URL(branded);
 assert.equal(url.protocol,'otpauth:');
 assert.equal(decodeURIComponent(url.pathname),'/NACALL:QaMidiaA');
 assert.equal(url.searchParams.get('issuer'),TOTP_ISSUER);
 assert.equal(url.searchParams.get('secret'),'JBSWY3DPEHPK3PXP','segredo preservado');
 assert.equal(url.searchParams.get('digits'),'6');assert.equal(url.searchParams.get('period'),'30');assert.equal(url.searchParams.get('algorithm'),'SHA1');
 assert.ok(!/localhost/i.test(branded)&&!/3000/.test(branded.replace('3PXP','')),'nada do endereço antigo');
 assert.ok(!branded.includes('@'),'o email não aparece');
 assert.equal(decodeURIComponent(new URL(brandTotpUri(original,'Nick #1 !')).pathname),'/NACALL:Nick #1 !','caracteres especiais do nick ficam escapados');
 assert.equal(decodeURIComponent(new URL(brandTotpUri(original,'  ')).pathname),'/NACALL:conta','nick vazio: nome neutro');
 assert.throws(()=>brandTotpUri('https://exemplo.com/?secret=1','x'),/inválido/);
});
