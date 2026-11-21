import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Auditoria de segurança (fase 1): /api/livekit/rooms não tinha limite de chamadas. Um usuário logado podia chamar em
// loop e cada chamada consulta o LiveKit com o segredo do servidor (cota e calls de todos). E as duas rotas de call
// não barravam conta com email pendente, ao contrário das rotas de pagamento.
const route=(name:string)=>readFile(new URL(`../src/app/api/livekit/${name}/route.ts`,import.meta.url),'utf8');

test('lista de calls tem limite por usuário (60 por minuto) e responde 429 quando passa',async()=>{
 const rooms=await route('rooms');
 assert.match(rooms,/allow\(adminClient\(env\),env\.secret,'livekit-rooms',user\.data\.user\.id,60,60\)/);
 assert.match(rooms,/429/);
});

test('o limite vem antes de consultar o LiveKit',async()=>{
 const rooms=await route('rooms');
 const limit=rooms.indexOf("'livekit-rooms'"),livekit=rooms.indexOf('roomSnapshots(');
 assert.ok(limit>=0&&livekit>=0,'limite e consulta existem');
 assert.ok(limit<livekit,'limite antes do LiveKit');
});

test('conta com email pendente não entra nem lista calls',async()=>{
 for(const name of ['rooms','token']){
  const src=await route(name);
  assert.match(src,/emailPending\(/,`${name}: checa email pendente`);
 }
});
