import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path:string)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

// Auditoria de UX do site no celular, lote 4 (UXA-007): lista de membros na gaveta.

test('UXA-007: a lista de membros também aparece na gaveta, com a mesma linha da coluna da direita',async()=>{
 const app=await read('src/components/app.tsx');
 assert.match(app,/const memberRow = \(id: string\) => <div className="member" key=\{id\}>/,'uma linha só, reaproveitada');
 assert.equal((app.match(/<div className="member" key=/g)??[]).length,1,'a linha não foi duplicada');
 assert.match(app,/<aside className="members">[\s\S]*\.map\(memberRow\)\}/,'a coluna da direita usa a mesma linha');
 assert.match(app,/<div className="side-members"><div className="section-label">MEMBROS · \{members\.length\}<\/div>\{members\.map\(memberRow\)\}<\/div>/,'a gaveta ganha a seção de membros');
 assert.match(app,/onClick=\{\(\)=>setInspectedProfile\(profiles\[id\]\)\}/,'tocar no avatar abre o perfil');
 assert.match(app,/'Proprietário'[\s\S]*'Você'[\s\S]*'Membro'/,'papéis iguais aos de antes');
});

test('UXA-007: a seção da gaveta só aparece onde a coluna da direita some (até 1300px)',async()=>{
 const css=await read('src/app/theme-fixes.css');
 assert.match(css,/@media\(min-width:1301px\)\{\.side-members\{display:none\}\}/);
 const globals=await read('src/app/globals.css');
 assert.match(globals,/@media\(max-width:1300px\)\{[^@]*\.members\{display:none\}/,'o motivo: a coluna some até 1300px');
 assert.match(css,/\.side-members \.member\{min-height:48px/,'linha com altura de dedo');
});
