import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const migration=(name:string)=>readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8');
const id=(n:number)=>`${String(n).repeat(8)}-1111-4111-8111-111111111111`;
async function newDb(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
  create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}',updated_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;
  grant usage on schema public,auth to anon,authenticated,service_role;grant execute on all functions in schema auth to anon,authenticated,service_role;create publication supabase_realtime;
  create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;
  create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
  create function storage.extension(text) returns text language sql immutable as $$select reverse(split_part(reverse($1),'.',1))$$;
  grant usage on schema storage to authenticated;grant all on storage.objects to authenticated;`);
 await db.exec(await migration('202611020001_initial.sql'));
 await db.exec(await migration('202611020002_nacall.sql'));
 return db;
}
const signup=(db:PGlite,n:number,username:string)=>db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[id(n),JSON.stringify({username,display_name:'Fulano'})]);
test('nick livre: maiúsculas e símbolos, único sem diferenciar maiúsculas, nicks antigos intactos',async()=>{
 const db=await newDb();
 try{
  await signup(db,1,'antigo_01');// conta que já existia, com nick minúsculo
  await db.exec(await migration('202611180001_nick_livre.sql'));
  assert.equal((await db.query<{username:string;username_key:string}>('select username,username_key from public.profiles')).rows[0].username_key,'antigo_01');
  await signup(db,2,'Gu$tavo_X');
  const novo=(await db.query<{username:string;username_key:string}>('select username,username_key from public.profiles where id=$1',[id(2)])).rows[0];
  assert.deepEqual(novo,{username:'Gu$tavo_X',username_key:'gu$tavo_x'});// guarda como digitado; a chave é minúscula
  await assert.rejects(signup(db,3,'gu$TAVO_x'),/unique|duplicate/i);// mesmo nick com outra caixa
  await assert.rejects(signup(db,4,'ANTIGO_01'),/unique|duplicate/i);// colide com o nick antigo
  await signup(db,5,'com espaço');// inválido no metadado: o trigger cai no nick automático em vez de falhar
  assert.match((await db.query<{username:string}>('select username from public.profiles where id=$1',[id(5)])).rows[0].username,/^u_[0-9a-f]{20}$/);
  for(const bad of ['ab','a'.repeat(25),'com espaco','@nick','nick%','nick/x'])await assert.rejects(db.query('update public.profiles set username=$1 where id=$2',[bad,id(2)]),/check|violates/i,bad);
  await db.query('update public.profiles set username=$1 where id=$2',['Ana.Paula-2',id(2)]);// edição de perfil também aceita a regra nova
  assert.equal((await db.query<{username_key:string}>('select username_key from public.profiles where id=$1',[id(2)])).rows[0].username_key,'ana.paula-2');
 }finally{await db.close();}
});
test('marca das contas antigas: só quem veio do modelo antigo recebe email_pending, e reaplicar é inofensivo',async()=>{
 const db=await newDb();
 try{
  await db.exec('create table public.account_emails(user_id uuid primary key references public.profiles on delete cascade,email text not null)');
  await db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3),($4,$5,$6),($7,$8,$9)',[
   id(1),'antiga@exemplo.com',JSON.stringify({username:'antiga'}),// converteu para o email real (tem linha em account_emails)
   id(2),'velha@accounts.nacall.invalid',JSON.stringify({username:'velha'}),// ainda com email fictício
   id(3),'nova@exemplo.com',JSON.stringify({username:'nova'})]);// conta nova
  await db.query("insert into public.account_emails values($1,'antiga@exemplo.com')",[id(1)]);
  const sql=await migration('202611180002_email_pendente_contas_antigas.sql');
  await db.exec(sql);await db.exec(sql);
  const flags=(await db.query<{username:string;pending:boolean}>("select p.username,coalesce((u.raw_app_meta_data->>'email_pending')::boolean,false) as pending from auth.users u join public.profiles p on p.id=u.id order by p.username")).rows;
  assert.deepEqual(flags,[{username:'antiga',pending:true},{username:'nova',pending:false},{username:'velha',pending:true}]);
  await db.exec('drop table public.account_emails');
  await db.exec(sql);// sem a tabela antiga (depois de 202611030002) continua sem erro
 }finally{await db.close();}
});
test('email_status: confirmada, pendente ou inexistente, e só o servidor pode chamar',async()=>{
 const db=await newDb();
 try{
  await db.exec('alter table auth.users add column email_confirmed_at timestamptz');
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now()),($3,$4,null)',[id(1),'ativa@exemplo.com',id(2),'pendente@exemplo.com']);
  await db.exec(await migration('202611180003_email_status.sql'));
  const status=async(email:string)=>(await db.query<{s:string}>('select public.email_status($1) as s',[email])).rows[0].s;
  assert.equal(await status('ativa@exemplo.com'),'confirmed');
  assert.equal(await status('  ATIVA@Exemplo.com '),'confirmed');// ignora caixa e espaços
  assert.equal(await status('pendente@exemplo.com'),'unconfirmed');
  assert.equal(await status('ninguem@exemplo.com'),'none');
  await db.exec('set role authenticated');
  await assert.rejects(db.query("select public.email_status('ativa@exemplo.com')"),/permission denied/i);// o navegador não consulta
  await db.exec('reset role');await db.exec('set role service_role');
  assert.equal(await status('ativa@exemplo.com'),'confirmed');
 }finally{await db.close();}
});
