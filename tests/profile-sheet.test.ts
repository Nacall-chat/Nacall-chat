import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {memberSinceLabel} from '../src/lib/profile-info';

const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('membro desde: data da conta em português, vazia quando falta ou é inválida',()=>{
 assert.equal(memberSinceLabel('2019-10-25T12:00:00Z','America/Sao_Paulo'),'25 de out. de 2019');
 assert.equal(memberSinceLabel('2026-01-02T03:00:00Z','UTC'),'2 de jan. de 2026');
 assert.equal(memberSinceLabel('2026-01-01T01:00:00Z','America/Sao_Paulo'),'31 de dez. de 2025','usa o fuso informado (de madrugada em UTC ainda é o dia anterior em Brasília)');
 assert.equal(memberSinceLabel(undefined),'');
 assert.equal(memberSinceLabel(''),'');
 assert.equal(memberSinceLabel('não é data'),'');
});

test('perfil: seções Em voz, Sobre mim e Membro desde, com entrar na chamada e editar o próprio perfil',async()=>{
 const card=await read('src/components/profile-card.tsx');
 assert.match(card,/Membro do NACALL desde/);
 assert.match(card,/<h3>Em voz<\/h3>/);
 assert.match(card,/Entrar na chamada de voz/);
 assert.match(card,/call\.join&&/,'sem botão de entrar quando a pessoa já está na mesma sala que você');
 assert.match(card,/Editar perfil/);
 const app=await read('src/components/app.tsx');
 assert.match(app,/call=\{callOf\(inspectedProfile\.id\)\}/);
 assert.match(app,/edit=\{\(\)=>\{setInspectedProfile\(null\);setSettingsTab\('profile'\)/);
 assert.match(await read('src/components/friends-panel.tsx'),/cover_path,created_at'\)/,'a busca de perfis também traz a data de criação');
});

test('perfil no celular: folha que sobe de baixo, sem cobrir a tela toda, fecha arrastando ou tocando fora',async()=>{
 const css=await read('src/app/profile-sheet.css');
 const mobile=css.slice(css.indexOf('@media(max-width:720px)'));
 assert.match(mobile,/dialog\.profile-card-dialog\{[^}]*max-height:88dvh;margin:auto 0 0[^}]*animation:sheet-up/);
 assert.match(css,/@keyframes sheet-up\{from\{transform:translateY\(100%\)\}\}/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 const card=await read('src/components/profile-card.tsx');
 assert.match(card,/e\.target===e\.currentTarget\)e\.currentTarget\.close\(\)/,'tocar no fundo fecha');
 assert.match(card,/d\.dy>110/,'arrastar para baixo fecha');
});
