import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

// Auditoria de UX do site no celular, lote 1 (UXA-001, UXA-002, UXA-008).

test('UXA-001: o aviso também aparece por cima da call no celular (o <main> fica escondido ali)',async()=>{
 const app=await read('src/components/app.tsx');
 assert.match(app,/<\/main>\{notice&&inCallView&&<div className="notice notice-call" role="status">/,'cópia do aviso fora do <main>, só com a call em foco');
 const css=await read('src/app/theme-fixes.css');
 assert.match(css,/\.shell>\.notice-call\{display:none\}/,'escondida por padrão (no computador o aviso normal já aparece)');
 assert.match(css,/@media\(max-width:720px\)\{\s*\.shell\.call-focus>\.notice-call\{display:flex;position:fixed/,'visível só no celular com a call em foco');
 const jacall=await read('src/app/jacall.css');
 assert.match(jacall,/\.shell\.call-focus>\.main\{display:none!important\}/,'o motivo: o <main> some na call do celular');
});

test('UXA-002: sem teclado, "apertar para falar" não vale e não trava o microfone',async()=>{
 const hook=await read('src/components/use-media-query.ts');
 assert.match(hook,/export function useNoKeyboard\(\)/);
 assert.match(hook,/\(hover: none\) and \(pointer: coarse\)/);
 const voice=await read('src/components/voice.tsx');
 assert.equal((voice.match(/const pttOn=voice\.pushToTalk&&!noKeyboard;/g)??[]).length,2,'tanto a sala (audio inicial) quanto os controles usam pttOn');
 assert.match(voice,/disabled=\{busy\|\|pttOn\}/,'o botão de microfone só trava quando a tecla realmente vale');
 assert.match(voice,/pushToTalk=\{pttOn\}/,'a barra de voz também recebe o valor efetivo');
 assert.doesNotMatch(voice,/disabled=\{busy\|\|voice\.pushToTalk\}/);
 assert.match(voice,/\{!noKeyboard&&<><label className="toggle-setting"><div><strong>Apertar para falar<\/strong>[\s\S]*<PttKeyField\/>(<VoiceShortcuts\/>)?<\/>\}/,'o interruptor, o campo de tecla e os atalhos de microfone/fone somem nos ajustes da call');
 const profile=await read('src/components/profile-settings.tsx');
 assert.match(profile,/\.filter\(\(\[key\]\)=>!\(noKeyboard&&key==='pushToTalk'\)\)/,'e nos ajustes de voz do perfil');
});

test('UXA-008: o aviso de microfone bloqueado não presume mouse nem navegador de computador',async()=>{
 const gate=await read('src/components/mic-gate.tsx');
 assert.doesNotMatch(gate,/Clique no cadeado/);
 assert.match(gate,/toque no cadeado/);
 assert.match(gate,/No iPhone, use o botão <strong>aA<\/strong>/);
});
