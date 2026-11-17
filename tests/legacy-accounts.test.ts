import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const migration=(name:string)=>readFile(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8');
const id=(n:number)=>`${String(n).repeat(8)}-1111-4111-8111-111111111111`;
const fake=(name:string)=>`${name}@accounts.nacall.invalid`;
// Banco mínimo no formato do Supabase: auth.users, auth.identities (email gerado a partir do identity_data), perfis e as tabelas do modelo antigo.
async function newDb(withOldTables=true){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
  create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb,updated_at timestamptz default now(),created_at timestamptz not null default now());
  create unique index users_email_key on auth.users(email);
  create table auth.identities(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,provider text not null,provider_id text not null,identity_data jsonb not null,email text generated always as (lower(identity_data->>'email')) stored,updated_at timestamptz default now());
  create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;
  create table public.profiles(id uuid primary key references auth.users on delete cascade,username text);
  create table public.auth_attempts(bucket text primary key,window_start timestamptz not null,attempts integer not null);
  grant usage on schema public,auth to anon,authenticated,service_role;`);
 if(withOldTables)await db.exec(`create table public.account_recovery(user_id uuid primary key);create table public.account_emails(user_id uuid primary key references public.profiles on delete cascade,email text not null,created_at timestamptz not null default now());`);
 return db;
}
async function addUser(db:PGlite,n:number,username:string,email:string,realEmail?:string){
 await db.query('insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),$3)',[id(n),email,JSON.stringify({username})]);
 await db.query("insert into auth.identities(user_id,provider,provider_id,identity_data) values($1,'email',$2,$3)",[id(n),id(n),JSON.stringify({sub:id(n),email})]);
 await db.query('insert into public.profiles values($1,$2)',[id(n),username]);
 if(realEmail)await db.query('insert into public.account_emails(user_id,email) values($1,$2)',[id(n),realEmail]);
}
const users=async(db:PGlite)=>(await db.query<{username:string;email:string;confirmed:boolean;identity_email:string;provider_id:string}>(`select p.username,u.email,u.email_confirmed_at is not null as confirmed,i.email as identity_email,i.provider_id from auth.users u join public.profiles p on p.id=u.id join auth.identities i on i.user_id=u.id order by p.username`)).rows;
test('preservação: contas antigas passam para o email real, sem perder nada, e a migration de segurança não apaga ninguém',async()=>{
 const db=await newDb();
 try{
  await addUser(db,1,'kross',fake('kross'),'Kross@Exemplo.com');
  await addUser(db,2,'vexct',fake('vexct'),'vex@exemplo.com');
  await addUser(db,3,'nova',  'nova@exemplo.com');// conta já no modelo novo: não pode mudar
  await db.exec(await migration('202611170001_preservar_contas_antigas.sql'));
  assert.deepEqual(await users(db),[
   {username:'kross',email:'kross@exemplo.com',confirmed:true,identity_email:'kross@exemplo.com',provider_id:id(1)},
   {username:'nova',email:'nova@exemplo.com',confirmed:true,identity_email:'nova@exemplo.com',provider_id:id(3)},
   {username:'vexct',email:'vex@exemplo.com',confirmed:true,identity_email:'vex@exemplo.com',provider_id:id(2)},
  ]);// mesmo id e provider_id: a senha (hash) e o vínculo com perfil, grupos e DMs continuam
  const meta=(await db.query<{m:{email:string;email_verified:boolean;username:string}}>('select raw_user_meta_data as m from auth.users where id=$1',[id(1)])).rows[0].m;
  assert.equal(meta.email,'kross@exemplo.com');assert.equal(meta.email_verified,true);assert.equal(meta.username,'kross');
  await db.exec(await migration('202611030002_auth_seguranca.sql'));// o delete dela agora não encontra nada
  assert.equal((await users(db)).length,3);assert.equal((await db.query('select 1 from auth.users')).rows.length,3);
  await assert.rejects(db.query('select * from public.account_emails'));// tabelas do modelo antigo saíram
  await db.exec(await migration('202611170001_preservar_contas_antigas.sql'));// reaplicar (sem a tabela) não faz nada nem falha
  assert.equal((await users(db)).length,3);
 }finally{await db.close();}
});
test('preservação: reaplicar antes da migration de segurança é idempotente',async()=>{
 const db=await newDb();
 try{
  await addUser(db,1,'kross',fake('kross'),'kross@exemplo.com');
  const sql=await migration('202611170001_preservar_contas_antigas.sql');
  await db.exec(sql);const first=await users(db);await db.exec(sql);
  assert.deepEqual(await users(db),first);
 }finally{await db.close();}
});
test('preservação: se alguma conta antiga não puder ser convertida, aborta sem alterar nada (para a migration seguinte não apagá-la)',async()=>{
 const sql=await migration('202611170001_preservar_contas_antigas.sql');
 for(const [label,setup] of [
  ['sem email salvo',async(db:PGlite)=>{await addUser(db,1,'ok',fake('ok'),'ok@exemplo.com');await addUser(db,2,'orfa',fake('orfa'));}],
  ['email já usado por outra conta',async(db:PGlite)=>{await addUser(db,1,'ok',fake('ok'),'ok@exemplo.com');await addUser(db,2,'dupla',fake('dupla'),'OK@exemplo.com');}],
  ['email já pertence a uma conta nova',async(db:PGlite)=>{await addUser(db,1,'dona','dona@exemplo.com');await addUser(db,2,'velha',fake('velha'),'dona@exemplo.com');}],
 ] as const){
  const db=await newDb();
  try{
   await setup(db);
   const before=await users(db);
   await assert.rejects(db.exec(sql),/Ainda há \d+ conta/,label);
   await db.exec('rollback');
   assert.deepEqual(await users(db),before,label);// a conta boa também não foi convertida pela metade
  }finally{await db.close();}
 }
});
test('preservação: em bases sem contas antigas nem a tabela account_emails (HML, bases novas) não faz nada',async()=>{
 const db=await newDb(false);
 try{
  await addUser(db,1,'nova','nova@exemplo.com');
  const before=await users(db);
  await db.exec(await migration('202611170001_preservar_contas_antigas.sql'));
  assert.deepEqual(await users(db),before);
 }finally{await db.close();}
});
