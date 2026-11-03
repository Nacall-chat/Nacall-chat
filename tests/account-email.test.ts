import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('tabela de emails só é acessível pelo servidor, nunca por usuários nem anônimos',async()=>{
 const db=new PGlite();const a='11111111-1111-4111-8111-111111111111';
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create table public.profiles(id uuid primary key);grant usage on schema public to anon,authenticated,service_role;
   grant select on public.profiles to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/migrations/202611030001_account_email.sql',import.meta.url),'utf8'));
  await db.query('insert into public.profiles values($1)',[a]);
  await db.exec('set role service_role');
  await db.query("insert into public.account_emails(user_id,email) values($1,'nick@exemplo.com')",[a]);
  assert.equal((await db.query('select * from public.account_emails')).rows.length,1);
  await assert.rejects(db.query("insert into public.account_emails(user_id,email) values($1,'x')",[a]));
  for(const role of ['authenticated','anon']){
   await db.exec('reset role');await db.exec(`set role ${role}`);
   await assert.rejects(db.query('select * from public.account_emails'));
   await assert.rejects(db.query("insert into public.account_emails(user_id,email) values($1,'outro@exemplo.com')",[a]));
  }
  await db.exec('reset role');await db.query('delete from public.profiles where id=$1',[a]);
  assert.equal((await db.query('select * from public.account_emails')).rows.length,0);
 }finally{await db.close();}
});
