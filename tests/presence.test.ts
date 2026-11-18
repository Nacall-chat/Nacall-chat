import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
const migration=(name:string)=>readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8');

async function setup(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to anon,authenticated;grant execute on all functions in schema auth to anon,authenticated;create publication supabase_realtime;`);
 await db.exec(await migration('202611020001_initial.sql'));
 await db.exec(await migration('202611190003_presenca.sql'));
 await db.query('insert into auth.users values($1),($2),($3)',[a,b,c]);
 const as=async(id:string)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
 const server=async()=>{await db.exec('reset role');};
 // a e b são amigos (aceita); c pediu amizade a a e ainda está pendente
 await as(b);await db.query('insert into public.friendships(sender_id,receiver_id) values($1,$2)',[b,a]);
 await as(a);await db.query("update public.friendships set status='accepted'");
 await as(c);await db.query('insert into public.friendships(sender_id,receiver_id) values($1,$2)',[c,a]);
 return {db,as,server};
}
type Row={user_id:string;state:string;last_seen_at:string|null;server_now:string};
const friends=async(db:PGlite)=>(await db.query<Row>('select * from public.friends_presence()')).rows;
const seen=async(db:PGlite,id:string)=>(await db.query<{t:string}>('select last_seen_at::text t from public.presence where user_id=$1',[id])).rows[0]?.t;

test('presença: só amigos veem; online, ausente e offline vêm calculados no servidor',async()=>{
 const {db,as,server}=await setup();
 try{
  await as(b);await db.query('select public.touch_presence(false)');
  await as(a);
  const [online]=await friends(db);
  assert.equal(online.user_id,b);assert.equal(online.state,'online');assert.ok(online.last_seen_at&&online.server_now);
  // inativo por um tempo: ausente
  await as(b);await db.query('select public.touch_presence(true)');
  await as(a);assert.equal((await friends(db))[0].state,'away','ocioso conta como ausente');
  // escolheu ausente
  await as(b);await db.query("select public.set_presence('away')");
  await as(a);assert.equal((await friends(db))[0].state,'away');
  // voltou a online
  await as(b);await db.query("select public.set_presence('online')");
  await as(a);assert.equal((await friends(db))[0].state,'online');
  // sem sinal de vida por mais de 100 s: offline, mantendo a hora do último sinal
  await server();await db.query("update public.presence set online_until=now()-interval '1 second',last_seen_at=now()-interval '30 minutes' where user_id=$1",[b]);
  await as(a);const [off]=await friends(db);assert.equal(off.state,'offline');
  const minutes=(new Date(off.server_now).getTime()-new Date(off.last_seen_at!).getTime())/60000;
  assert.ok(minutes>=29.9&&minutes<=30.2,'visto pela última vez há ~30 min, pelo relógio do servidor');
 }finally{await db.close();}
});

test('presença: invisível aparece como offline e não entrega a hora real; fechar a aba deixa offline na hora',async()=>{
 const {db,as,server}=await setup();
 try{
  await as(b);await db.query("select public.set_presence('online')");
  await server();await db.query("update public.presence set last_seen_at=now()-interval '2 hours' where user_id=$1",[b]);
  const antes=await (async()=>{await db.exec('reset role');return seen(db,b);})();
  await as(b);await db.query("select public.set_presence('invisible')");
  await db.query('select public.touch_presence(false)');
  await as(a);
  const [row]=await friends(db);
  assert.equal(row.state,'offline','invisível parece offline mesmo com o app aberto');
  await server();assert.equal(await seen(db,b),antes,'invisível não atualiza o "visto por último"');
  await as(b);assert.equal((await db.query<{s:string}>('select public.my_presence() s')).rows[0].s,'invisible','a própria pessoa vê a sua escolha');
  // fechar a aba
  await db.query("select public.set_presence('online')");await db.query('select public.leave_presence()');
  await server();const kept=await seen(db,b);
  await as(a);assert.equal((await friends(db))[0].state,'offline','saiu: offline na hora');
  await server();assert.equal(await seen(db,b),kept,'o último sinal continua registrado');
 }finally{await db.close();}
});

test('presença: quem não é amigo (ou ainda é pedido) não vê nada, e a tabela é fechada',async()=>{
 const {db,as}=await setup();
 try{
  await as(a);await db.query('select public.touch_presence(false)');
  await as(b);await db.query('select public.touch_presence(false)');
  await as(c);await db.query('select public.touch_presence(false)');
  assert.deepEqual(await friends(db),[],'c só tem um pedido pendente com a: não vê ninguém');
  await as(a);
  assert.deepEqual((await friends(db)).map(r=>r.user_id),[b],'a vê só o amigo b, nunca c (pendente) nem ela mesma');
  assert.equal((await db.query('select * from public.my_presence()')).rows.length,1);
  // acesso direto à tabela é negado
  await assert.rejects(db.query('select * from public.presence'));
  await assert.rejects(db.query("insert into public.presence(user_id,status) values($1,'online')",[b]));
  await assert.rejects(db.query("update public.presence set status='invisible'"));
  // dados inválidos
  await assert.rejects(db.query("select public.set_presence('dormindo')"),'status fora da lista');
 }finally{await db.close();}
});

test('presença: sem login nada funciona, e apagar a conta leva a linha junto',async()=>{
 const {db,as,server}=await setup();
 try{
  await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");await db.exec('set role anon');
  await assert.rejects(db.query('select public.touch_presence(false)'));
  await assert.rejects(db.query('select * from public.friends_presence()'));
  await as(a);await db.query("select set_config('request.jwt.claim.sub','',false)");
  await assert.rejects(db.query('select public.touch_presence(false)'),'sessão sem usuário');
  assert.deepEqual(await friends(db),[],'sem usuário na sessão não lista ninguém');
  await as(b);await db.query('select public.touch_presence(false)');
  await server();assert.equal((await db.query('select 1 from public.presence')).rows.length,1);
  await db.query('delete from public.profiles where id=$1',[b]);
  assert.equal((await db.query('select 1 from public.presence')).rows.length,0);
 }finally{await db.close();}
});
