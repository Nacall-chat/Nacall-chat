import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
const uuid=()=>crypto.randomUUID();
const migration=(name:string)=>readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8');

// Mesmo banco mínimo dos outros testes de chat (Storage simples, funções do Supabase e RLS de verdade).
async function setup(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to anon,authenticated;grant execute on all functions in schema auth to anon,authenticated;create publication supabase_realtime;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(bucket_id text,name text,created_at timestamptz not null default now());alter table storage.objects enable row level security;
 create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
 create function storage.extension(name text) returns text language sql immutable as $$select reverse(split_part(reverse(name),'.',1))$$;
 grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`);
 await db.exec(await migration('202611020001_initial.sql'));
 await db.exec(await migration('202611190001_audio_e_figurinhas.sql'));
 await db.query('insert into auth.users values($1),($2),($3)',[a,b,c]);
 const as=async(id:string)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
 const asAnon=async()=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub','',false)");await db.exec('set role anon');};
 const server=async()=>{await db.exec('reset role');};
 return {db,as,asAnon,server};
}
type Unread={dm_id:string;unread:number;last_kind:string;last_body:string};
const unread=async(db:PGlite)=>(await db.query<Unread>('select dm_id,unread,last_kind,last_body from public.unread_dms()')).rows;
const rows=async(db:PGlite,sql:string,params:unknown[]=[])=>(await db.query(sql,params)).rows.length;

// a e b são amigos e têm uma DM; c é de fora.
async function friendsWithDm(db:PGlite,as:(id:string)=>Promise<void>){
 await as(b);await db.query('insert into public.friendships(sender_id,receiver_id) values($1,$2)',[b,a]);
 await as(a);await db.query("update public.friendships set status='accepted'");
 return (await db.query<{id:string}>('select public.open_dm($1) as id',[b])).rows[0].id;
}

test('DMs: histórico antigo começa lido, mensagem nova do outro conta e marcar como lida zera',async()=>{
 const {db,as,server}=await setup();
 try{
  const dm=await friendsWithDm(db,as);
  await as(a);await db.query("insert into public.messages(dm_id,body) values($1,'Mensagem antiga 1'),($1,'Mensagem antiga 2')",[dm]);
  await as(b);await db.query("insert into public.messages(dm_id,body) values($1,'Resposta antiga')",[dm]);
  await server();
  await db.exec(await migration('202611190002_leitura_de_dms.sql'));

  await as(b);assert.deepEqual(await unread(db),[],'o histórico anterior à migration não vira não lido');
  await as(a);assert.deepEqual(await unread(db),[]);
  await server();assert.equal(await rows(db,'select 1 from public.dm_reads'),2,'as duas pessoas da DM existente ganharam a linha');

  // a manda texto e áudio: só b vê como não lido, com a mais recente na prévia
  await as(a);
  await db.query("insert into public.messages(dm_id,body) values($1,'Oi, tudo bem?')",[dm]);
  const path=`${a}/${dm}/${uuid()}.webm`;
  await db.query("insert into storage.objects(bucket_id,name) values('chat-audio',$1)",[path]);
  await db.query("insert into public.messages(dm_id,kind,body,media_path,media_duration_ms) values($1,'audio','',$2,4200)",[dm,path]);
  assert.deepEqual(await unread(db),[],'as mensagens que eu mando nunca contam para mim');
  await as(b);
  const [one]=await unread(db);
  assert.equal(one.dm_id,dm);assert.equal(one.unread,2);assert.equal(one.last_kind,'audio','a prévia é a mensagem mais recente');

  await db.query('select public.mark_dm_read($1)',[dm]);
  assert.deepEqual(await unread(db),[],'depois de ler, zera');
  await as(a);await db.query("insert into public.messages(dm_id,body) values($1,$2)",[dm,'x'.repeat(300)]);
  await as(b);
  const [again]=await unread(db);
  assert.equal(again.unread,1,'só o que chegou depois de ler');assert.equal(again.last_kind,'text');assert.equal(again.last_body.length,140,'a prévia é curta');

  // apagar a mensagem tira da conta
  await as(a);await db.query("delete from public.messages where body like 'xxx%'");
  await as(b);assert.deepEqual(await unread(db),[]);
 }finally{await db.close();}
});

test('DMs: DM nova depois da migration conta a primeira mensagem; cada DM tem a sua contagem',async()=>{
 const {db,as,server}=await setup();
 try{
  await server();await db.exec(await migration('202611190002_leitura_de_dms.sql'));
  const dm=await friendsWithDm(db,as);
  await as(a);await db.query("insert into public.messages(dm_id,body) values($1,'Primeira')",[dm]);
  await as(b);
  assert.equal((await unread(db))[0]?.unread,1,'sem linha em dm_reads, tudo do outro é não lido');
  // uma segunda DM (b com c): contagens separadas
  await as(c);await db.query('insert into public.friendships(sender_id,receiver_id) values($1,$2)',[c,b]);
  await as(b);await db.query("update public.friendships set status='accepted' where sender_id=$1",[c]);
  const other=(await db.query<{id:string}>('select public.open_dm($1) as id',[c])).rows[0].id;
  await as(c);await db.query("insert into public.messages(dm_id,body) values($1,'Oi b'),($1,'Oi de novo')",[other]);
  await as(b);
  const list=await unread(db);
  assert.equal(list.length,2);
  assert.equal(list.find(x=>x.dm_id===dm)?.unread,1);assert.equal(list.find(x=>x.dm_id===other)?.unread,2);
  await db.query('select public.mark_dm_read($1)',[other]);
  assert.deepEqual((await unread(db)).map(x=>x.dm_id),[dm],'marcar uma DM não mexe na outra');
 }finally{await db.close();}
});

test('DMs: ninguém lê nem marca a DM dos outros, e a tabela só escreve pela função',async()=>{
 const {db,as,asAnon,server}=await setup();
 try{
  await server();await db.exec(await migration('202611190002_leitura_de_dms.sql'));
  const dm=await friendsWithDm(db,as);
  await as(a);await db.query("insert into public.messages(dm_id,body) values($1,'Segredo entre a e b')",[dm]);
  await as(b);await db.query('select public.mark_dm_read($1)',[dm]);

  // c, de fora da conversa
  await as(c);
  assert.deepEqual(await unread(db),[],'não vê as mensagens de outra DM');
  await assert.rejects(db.query('select public.mark_dm_read($1)',[dm]),'não marca a DM dos outros');
  await assert.rejects(db.query('select public.mark_dm_read($1)',[uuid()]),'DM inexistente');
  assert.equal(await rows(db,'select 1 from public.dm_reads'),0,'não enxerga a leitura dos outros');
  await server();assert.equal(await rows(db,'select 1 from public.dm_reads where user_id=$1',[c]),0,'nada foi gravado para c');

  // cada um só vê a própria linha
  await as(b);assert.equal(await rows(db,'select 1 from public.dm_reads'),1);
  await as(a);assert.equal(await rows(db,'select 1 from public.dm_reads where user_id=$1',[b]),0,'a não enxerga a leitura de b');

  // escrita direta na tabela é negada, para ninguém adiantar nem atrasar a leitura de outra pessoa
  await as(a);
  await assert.rejects(db.query('insert into public.dm_reads(dm_id,user_id) values($1,$2)',[dm,b]));
  await assert.rejects(db.query("update public.dm_reads set read_at='2000-01-01'"));
  await assert.rejects(db.query('delete from public.dm_reads'));

  // sem login
  await asAnon();
  await assert.rejects(db.query('select public.mark_dm_read($1)',[dm]),'anon não executa');
  await assert.rejects(db.query('select * from public.unread_dms()'),'anon não executa');
  await as(a);await db.query("select set_config('request.jwt.claim.sub','',false)");
  await assert.rejects(db.query('select public.mark_dm_read($1)',[dm]),'sem usuário na sessão');
 }finally{await db.close();}
});

test('DMs: apagar a DM ou a conta leva as linhas de leitura junto',async()=>{
 const {db,as,server}=await setup();
 try{
  await server();await db.exec(await migration('202611190002_leitura_de_dms.sql'));
  const dm=await friendsWithDm(db,as);
  await as(b);await db.query('select public.mark_dm_read($1)',[dm]);
  await server();
  assert.equal(await rows(db,'select 1 from public.dm_reads'),1);
  await db.query('delete from public.dms where id=$1',[dm]);
  assert.equal(await rows(db,'select 1 from public.dm_reads'),0,'sem DM, sem linha');
 }finally{await db.close();}
});
