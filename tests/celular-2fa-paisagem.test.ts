import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

// Auditoria de UX do site no celular, lote 2 (UXA-003, UXA-004, UXA-006).

test('UXA-003: no celular o 2FA começa pela chave com botão Copiar e o QR vira segunda opção',async()=>{
 const mfa=await read('src/components/mfa.tsx');
 assert.match(mfa,/const phone=useMediaQuery\('\(hover: none\) and \(pointer: coarse\)'\)/);
 assert.match(mfa,/async function copySecret\(\)\{[^}]*navigator\.clipboard\.writeText\(enrolling\.secret\)/,'copia a chave do autenticador');
 assert.match(mfa,/\{phone\?<>[\s\S]*Copiar chave[\s\S]*<details className="qr-alt">[\s\S]*<\/details><\/>:<>/,'celular: chave primeiro, QR dentro de um <details>');
 assert.match(mfa,/<strong>1\.<\/strong> Escaneie o QR Code com o app autenticador\./,'computador: o fluxo de sempre, QR primeiro');
 assert.match(mfa,/Sem câmera\? Digite esta chave no app:/,'computador: a chave manual continua como alternativa');
 assert.match(mfa,/challengeAndVerify\(\{factorId:enrolling\.id,code\}\)/,'a verificação do código não muda');
});

test('UXA-006: no celular a faixa de 2FA fica só com título e botões',async()=>{
 const css=await read('src/app/theme-fixes.css');
 assert.match(css,/@media\(max-width:720px\)\{\s*\.two-factor-prompt\{padding:10px 12px;margin:8px 12px 0;gap:8px 10px\}\s*\.two-factor-prompt p\{display:none\}/);
 const mfa=await read('src/components/mfa.tsx');
 assert.match(mfa,/<aside className="two-factor-prompt" role="region" aria-label="Proteja sua conta">/,'a faixa continua no lugar de sempre');
 assert.match(mfa,/Agora não/,'continua dando para dispensar');
});

test('UXA-004: celular deitado não deixa a faixa de 2FA empurrar o campo de digitar para fora da tela',async()=>{
 const css=await read('src/app/theme-fixes.css');
 assert.match(css,/@media\(max-height:480px\) and \(orientation:landscape\)\{[\s\S]*\.two-factor-prompt\{display:none\}[\s\S]*\.main>\.topbar\{min-height:52px\}/);
});
