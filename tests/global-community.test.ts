import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('GLOBAL: preservação, cadastro sequencial, permissões e isolamento das DMs',async()=>{
 const db=new PGlite();
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
 const migrate=async(name:string)=>db.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 const as=async(id:string,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+role);};
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to anon,authenticated;grant execute on all functions in schema auth to anon,authenticated;
 create publication supabase_realtime;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:1]$$;
 create function storage.extension(text) returns text language sql immutable as $$select reverse(split_part(reverse($1),'.',1))$$;`);
 await migrate('202611020001_initial.sql');
 await migrate('202611020004_groups.sql');
 await db.query('insert into auth.users values($1),($2)',[a,b]);
 await db.query("update public.profiles set display_name='Never',created_at='2026-01-01' where id=$1",[a]);
 await as(a);const old=(await db.query<{id:string}>("select public.create_server('Grupo existente') id")).rows[0].id;
 await db.exec('reset role');await migrate('202611050001_global_identity.sql');
 const official=(await db.query<{id:string;owner_id:null}>('select * from public.servers where is_official')).rows[0];
 assert.equal(official.owner_id,null);
 assert.equal((await db.query('select * from public.servers where id=$1',[old])).rows.length,1);
 assert.deepEqual((await db.query<{n:string}>('select user_number::text n from public.profiles order by user_number')).rows.map(r=>r.n),['1','2']);
 await db.query('insert into auth.users values($1)',[c]);
 assert.equal((await db.query<{n:string}>('select user_number::text n from public.profiles where id=$1',[c])).rows[0].n,'3');
 assert.equal((await db.query('select * from public.server_members where server_id=$1',[official.id])).rows.length,3);
 const channels=(await db.query<{name:string;kind:string}>('select name,kind from public.channels where server_id=$1',[official.id])).rows;
 assert.deepEqual(channels.filter(x=>x.kind==='voice').map(x=>x.name).sort(),['BRASIL 01 - GERAL','BRASIL 02 - GERAL','BRASIL 03 - GERAL','RCM GROUP']);
 assert.deepEqual(channels.filter(x=>x.kind==='text').map(x=>x.name).sort(),['chat-geral','dicas-e-instruções']);
 for(const id of [a,b,c]){
 await as(id);
 assert.equal((await db.query('select * from public.servers where is_official')).rows.length,1);
 await assert.rejects(db.query("select public.save_server($1,'Hack','','')",[official.id]));
 await assert.rejects(db.query("insert into public.channels(server_id,name,kind) values($1,'Hack','voice')",[official.id]));
 await assert.rejects(db.query('update public.profiles set user_number=999 where id=$1',[id]));
 await assert.rejects(db.query("select nextval('public.profile_number_seq')"));
 }
 await as(a);await db.query("update public.profiles set display_name='Outro nome' where id=$1",[a]);
 assert.equal((await db.query<{n:string}>('select user_number::text n from public.profiles where id=$1',[a])).rows[0].n,'1');
 await assert.rejects(db.query('select public.open_dm($1)',[b]));
 const friendship=(await db.query<{id:string}>('insert into public.friendships(sender_id,receiver_id) values($1,$2) returning id',[a,b])).rows[0].id;
 assert.equal((await db.query("update public.friendships set status='accepted' where id=$1 returning id",[friendship])).rows.length,0);
 await as(b);await db.query("update public.friendships set status='accepted' where id=$1",[friendship]);
 const dm=(await db.query<{id:string}>('select public.open_dm($1) id',[a])).rows[0].id;
 await db.query("insert into public.messages(dm_id,body) values($1,'Mensagem privada')",[dm]);
 await as(a);assert.equal((await db.query('select * from public.messages where dm_id=$1',[dm])).rows.length,1);
 await as(c);assert.equal((await db.query('select * from public.dms where id=$1',[dm])).rows.length,0);
 assert.equal((await db.query('select * from public.messages where dm_id=$1',[dm])).rows.length,0);
 await assert.rejects(db.query("insert into public.messages(dm_id,body) values($1,'Invasão')",[dm]));
 await as('','anon');await assert.rejects(db.query('select * from public.servers'));
 }finally{await db.close();}
});
