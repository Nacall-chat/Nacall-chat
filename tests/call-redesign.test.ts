import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=(p:string)=>readFile(new URL(`../${p}`,import.meta.url),'utf8');

test('site: estado da conexão colorido, aviso de reconexão e barra de controles também no computador',async()=>{
 const voice=await read('src/components/voice.tsx');
 assert.match(voice,/className=\{`connection-state \$\{tone\}`\}/);
 assert.match(voice,/connection!==ConnectionState\.Connected&&<div className=\{`call-conn-banner \$\{tone\}`\} role="status">/);
 const css=await read('src/app/theme-fixes.css');
 assert.match(css,/@media\(min-width:721px\)\{\s*\.call-dock \.call-toolbar\{display:flex/,'a barra volta no computador');
 assert.match(css,/\.call-dock \.voice-heading time\{display:inline/,'o tempo aparece também no celular');
 assert.match(css,/prefers-reduced-motion:reduce\)\{\.call-dock \.participant\{animation:none\}/);
});

test('app: grade de cartões com pílula de nome, aviso de reconexão e microfone ligado em destaque',async()=>{
 const screen=await read('apps/mobile/src/features/call/call-screen.tsx');
 assert.match(screen,/function PersonTile\(/);
 assert.match(screen,/live\.connection === 'reconnecting'/);
 assert.match(screen,/styles\.dock/);
 const controls=await read('apps/mobile/src/features/call/call-controls.tsx');
 assert.match(controls,/filled=\{!muted\}/);
});
