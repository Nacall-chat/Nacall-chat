import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
const uuid=()=>crypto.randomUUID();
const migration=(name:string)=>readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8');

// Storage mínimo, com as mesmas funções auxiliares do Supabase (foldername devolve todas as pastas).
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
 await db.query('insert into auth.users values($1),($2),($3)',[a,b,c]);
 const as=async(id:string)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
 return {db,as};
}
const audioPath=(author:string,container:string,ext='webm')=>`${author}/${container}/${uuid()}.${ext}`;
const upload=(db:PGlite,bucket:string,path:string)=>db.query('insert into storage.objects(bucket_id,name) values($1,$2)',[bucket,path]);
const count=async(db:PGlite,sql:string,params:unknown[]=[])=>(await db.query(sql,params)).rows.length;

test('mídia no chat: mensagens antigas continuam, áudio exige o formato certo e a conversa certa',async()=>{
 const {db,as}=await setup();
 try{
  await as(a);
  const server=(await db.query<{id:string}>("select public.create_server('Turma') id")).rows[0].id;
  const channel=(await db.query<{id:string}>("select id from public.channels where kind='text'")).rows[0].id;
  await db.query("insert into public.messages(channel_id,body) values($1,'Mensagem antiga')",[channel]);
  await db.exec('reset role');
  await db.exec(await migration('202611190001_audio_e_figurinhas.sql'));
  await as(a);
  assert.equal((await db.query<{kind:string;media_path:string}>('select kind,media_path from public.messages')).rows[0].kind,'text','mensagem antiga vira texto');
  await db.query("insert into public.messages(channel_id,body) values($1,'Texto novo')",[channel]);
  await assert.rejects(db.query("insert into public.messages(channel_id,body) values($1,'   ')",[channel]),'texto vazio continua proibido');
  await assert.rejects(db.query("insert into public.messages(channel_id) values($1)",[channel]),'texto sem corpo é proibido');
  await db.query("insert into public.messages(channel_id,body) values($1,'😀🎉')",[channel]);

  // Áudio: upload só no próprio caminho e numa conversa onde a pessoa escreve.
  const path=audioPath(a,channel);
  await upload(db,'chat-audio',path);
  await assert.rejects(upload(db,'chat-audio',audioPath(b,channel)),'pasta de outro usuário');
  await assert.rejects(upload(db,'chat-audio',audioPath(a,uuid())),'conversa inexistente');
  await assert.rejects(upload(db,'chat-audio',audioPath(a,channel,'exe')),'extensão fora da lista');
  await assert.rejects(upload(db,'chat-audio',`${a}/${channel}/../${uuid()}.webm`),'caminho com ..');
  await assert.rejects(upload(db,'chat-audio',`${a}/${channel}/meu audio.webm`),'nome livre não é aceito');
  await assert.rejects(upload(db,'chat-audio',`${channel}/${uuid()}.webm`),'sem a pasta do autor');
  const send=(extra:Record<string,unknown>)=>db.query('insert into public.messages(channel_id,kind,body,media_path,media_duration_ms) values($1,$2,$3,$4,$5)',[channel,extra.kind??'audio',extra.body??'',extra.media_path??path,'media_duration_ms' in extra?extra.media_duration_ms:4200]);
  await send({});
  await assert.rejects(send({body:'texto junto'}),'áudio não carrega texto');
  await assert.rejects(send({media_duration_ms:100}),'curto demais');
  await assert.rejects(send({media_duration_ms:400000}),'longo demais');
  await assert.rejects(send({media_duration_ms:null}),'sem duração');
  await assert.rejects(send({media_path:audioPath(b,channel)}),'áudio de outro autor');
  await assert.rejects(send({media_path:audioPath(a,uuid())}),'áudio de outra conversa');
  await assert.rejects(send({media_path:`${a}/${channel}/${uuid()}.mp3`}),'extensão não permitida na mensagem');
  await assert.rejects(send({kind:'video'}),'tipo desconhecido');
  await assert.rejects(db.query("insert into public.messages(channel_id,kind,body,media_path) values($1,'text','oi',$2)",[channel,path]),'texto não carrega mídia');

  // Quem não é membro não ouve nada; o membro ouve; o arquivo sem mensagem só é do autor.
  const lonely=audioPath(a,channel);
  await upload(db,'chat-audio',lonely);
  const invite=(await db.query<{code:string}>('insert into public.invites(server_id) values($1) returning code',[server])).rows[0].code;
  await as(c);
  assert.equal(await count(db,"select 1 from storage.objects where bucket_id='chat-audio'"),0,'estranho não vê arquivos');
  assert.equal(await count(db,"select 1 from public.messages where kind='audio'"),0,'estranho não vê a mensagem');
  await assert.rejects(upload(db,'chat-audio',audioPath(c,channel)),'estranho não envia áudio ao canal');
  await db.query('select public.join_server($1)',[invite]);
  assert.equal(await count(db,"select 1 from storage.objects where bucket_id='chat-audio'"),1,'membro vê só o áudio que virou mensagem');
  assert.equal(await count(db,"select 1 from storage.objects where bucket_id='chat-audio' and name=$1",[lonely]),0,'arquivo sem mensagem não vaza');
  await upload(db,'chat-audio',audioPath(c,channel,'ogg'));
  // Excluir: só o dono da pasta.
  await as(b);
  assert.equal((await db.query("delete from storage.objects where bucket_id='chat-audio'")).affectedRows,0,'outro usuário não apaga');
  await as(a);
  assert.equal((await db.query("delete from storage.objects where bucket_id='chat-audio' and name=$1",[lonely])).affectedRows,1);

  // Limites de bucket (aplicados pelo serviço de Storage).
  await db.exec('reset role');
  const buckets=Object.fromEntries((await db.query<{id:string;public:boolean;file_size_limit:string;allowed_mime_types:string[]}>('select * from storage.buckets')).rows.map(r=>[r.id,r]));
  assert.equal(buckets['chat-audio'].public,false);assert.equal(Number(buckets['chat-audio'].file_size_limit),5*1024*1024);
  assert.deepEqual(buckets['chat-audio'].allowed_mime_types,['audio/webm','audio/ogg','audio/mp4']);
  assert.equal(buckets.stickers.public,false);assert.equal(Number(buckets.stickers.file_size_limit),1024*1024);
  assert.deepEqual(buckets.stickers.allowed_mime_types,['image/webp','image/png','image/jpeg','image/gif']);
 }finally{await db.close();}
});

test('mídia no chat: áudio em DM só chega ao par e há limite por minuto',async()=>{
 const {db,as}=await setup();
 try{
  await db.exec(await migration('202611190001_audio_e_figurinhas.sql'));
  await as(b);await db.query('insert into public.friendships(sender_id,receiver_id) values($1,$2)',[b,a]);
  await as(a);await db.query("update public.friendships set status='accepted'");
  const dm=(await db.query<{id:string}>('select public.open_dm($1) as id',[b])).rows[0].id;
  const path=audioPath(a,dm,'m4a');
  await upload(db,'chat-audio',path);
  await db.query("insert into public.messages(dm_id,kind,body,media_path,media_duration_ms) values($1,'audio','',$2,9000)",[dm,path]);
  await as(b);
  assert.equal(await count(db,"select 1 from storage.objects where name=$1",[path]),1,'o par ouve');
  const reply=audioPath(b,dm,'ogg');await upload(db,'chat-audio',reply);
  await as(c);
  assert.equal(await count(db,'select 1 from storage.objects'),0);
  assert.equal(await count(db,'select 1 from public.messages'),0);
  await assert.rejects(upload(db,'chat-audio',audioPath(c,dm)),'terceiro não envia áudio na DM');
  await assert.rejects(db.query("insert into public.messages(dm_id,kind,body,media_path,media_duration_ms) values($1,'audio','',$2,3000)",[dm,audioPath(c,dm)]),'nem mensagem');
  // 20 uploads por minuto por pessoa (a figurinha enviada mais abaixo conta para o limite de mensagens).
  await as(a);
  for(let i=0;i<18;i++)await upload(db,'chat-audio',audioPath(a,dm));   // 1 anterior + 18 = 19
  await upload(db,'chat-audio',audioPath(a,dm));                      // 20º
  await assert.rejects(upload(db,'chat-audio',audioPath(a,dm)),'21º upload no mesmo minuto');
  await db.exec('reset role');await db.exec("update storage.objects set created_at=now()-interval '2 minutes'");await as(a);
  await upload(db,'chat-audio',audioPath(a,dm));
  // 20 mensagens de mídia por minuto.
  const sticker=`${a}/${uuid()}.webp`;
  for(let i=0;i<19;i++)await db.query("insert into public.messages(dm_id,kind,body,media_path) values($1,'sticker','',$2)",[dm,sticker]);
  await assert.rejects(db.query("insert into public.messages(dm_id,kind,body,media_path) values($1,'sticker','',$2)",[dm,sticker]),/Muitas mídias/);
  await db.query("insert into public.messages(dm_id,body) values($1,'texto não entra no limite')",[dm]);
 }finally{await db.close();}
});

test('figurinhas: coleção por usuário, nome gerado pelo banco, limite e organização',async()=>{
 const {db,as}=await setup();
 try{
  await db.exec(await migration('202611190001_audio_e_figurinhas.sql'));
  await as(a);
  const mk=async(ext='webp')=>(await db.query<{id:string;path:string;position:number}>('insert into public.stickers(ext) values($1) returning id,path,position',[ext])).rows[0];
  const s1=await mk(),s2=await mk('gif'),s3=await mk('png');
  assert.equal(s1.path,`${a}/${s1.id}.webp`,'nome gerado pelo banco');
  assert.deepEqual([s1.position,s2.position,s3.position],[1,2,3]);
  await assert.rejects(db.query("insert into public.stickers(ext) values('exe')"));
  await assert.rejects(db.query("insert into public.stickers(ext,path) values('webp','x/y.webp')"),'path é gerado, não editável');
  await assert.rejects(db.query("insert into public.stickers(ext,owner_id) values('webp',$1)",[b]),'não cria figurinha em nome de outro');
  await assert.rejects(db.query('update public.stickers set ext=\'png\' where id=$1',[s1.id]),'ext não é editável');
  // Arquivo: só no caminho de uma figurinha que o banco criou para a pessoa.
  await upload(db,'stickers',s1.path);
  await assert.rejects(upload(db,'stickers',`${a}/${uuid()}.webp`),'nome inventado');
  await assert.rejects(upload(db,'stickers',`${b}/${uuid()}.webp`),'pasta alheia');
  // Organizar: favoritar e reordenar.
  await db.query('update public.stickers set favorite=true where id=$1',[s3.id]);
  await db.query('select public.reorder_stickers($1)',[[s3.id,s1.id,s2.id]]);
  const order=(await db.query<{id:string}>('select id from public.stickers order by favorite desc,position')).rows.map(r=>r.id);
  assert.deepEqual(order,[s3.id,s1.id,s2.id]);
  // Isolamento.
  await as(b);
  assert.equal(await count(db,'select 1 from public.stickers'),0);
  assert.equal(await count(db,'select 1 from storage.objects'),0,'figurinha alheia não é lida sem mensagem');
  await db.query('select public.reorder_stickers($1)',[[s1.id,s2.id,s3.id]]);
  assert.equal((await db.query('update public.stickers set favorite=true')).affectedRows,0);
  assert.equal((await db.query('delete from public.stickers')).affectedRows,0);
  await assert.rejects(upload(db,'stickers',s2.path),'não envia arquivo para a figurinha de outro');
  await as(a);
  assert.deepEqual((await db.query<{id:string}>('select id from public.stickers order by favorite desc,position')).rows.map(r=>r.id),[s3.id,s1.id,s2.id],'reordenar do outro não afeta');
  // Limite de 200.
  for(let i=0;i<197;i++)await mk();
  await assert.rejects(mk(),/limite de 200/);
  await db.query('delete from public.stickers where id=$1',[s2.id]);await mk();
 }finally{await db.close();}
});

test('figurinhas: o destinatário vê a figurinha enviada e ela não some quando a original é excluída',async()=>{
 const {db,as}=await setup();
 try{
  await db.exec(await migration('202611190001_audio_e_figurinhas.sql'));
  await as(b);await db.query('insert into public.friendships(sender_id,receiver_id) values($1,$2)',[b,a]);
  await as(a);await db.query("update public.friendships set status='accepted'");
  const dm=(await db.query<{id:string}>('select public.open_dm($1) as id',[b])).rows[0].id;
  const st=(await db.query<{id:string;path:string}>("insert into public.stickers(ext) values('webp') returning id,path")).rows[0];
  const other=(await db.query<{id:string;path:string}>("insert into public.stickers(ext) values('png') returning id,path")).rows[0];
  await upload(db,'stickers',st.path);await upload(db,'stickers',other.path);
  await assert.rejects(db.query("insert into public.messages(dm_id,kind,body,media_path) values($1,'sticker','',$2)",[dm,`${b}/${uuid()}.webp`]),'não envia figurinha de outro autor');
  await assert.rejects(db.query("insert into public.messages(dm_id,kind,body,media_path,media_duration_ms) values($1,'sticker','',$2,1000)",[dm,st.path]),'figurinha sem duração');
  await db.query("insert into public.messages(dm_id,kind,body,media_path) values($1,'sticker','',$2)",[dm,st.path]);
  await as(b);
  assert.deepEqual((await db.query<{name:string}>('select name from storage.objects')).rows.map(r=>r.name),[st.path],'o par vê só a figurinha enviada');
  await as(c);
  assert.equal(await count(db,'select 1 from storage.objects'),0);
  await as(a);
  // Excluir da coleção: a linha some, o arquivo em uso permanece; o que não foi enviado sai do Storage.
  await db.query('delete from public.stickers where id=$1 or id=$2',[st.id,other.id]);
  assert.equal((await db.query('delete from storage.objects where name=$1',[st.path])).affectedRows,0,'em uso: fica');
  assert.equal((await db.query('delete from storage.objects where name=$1',[other.path])).affectedRows,1,'sem uso: sai');
  await as(b);
  assert.equal(await count(db,'select 1 from storage.objects where name=$1',[st.path]),1,'o par continua vendo');
 }finally{await db.close();}
});
