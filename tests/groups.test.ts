import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('grupos: hierarquia, permissões, convite limitado e isolamento de ícone',async()=>{
 const db=new PGlite();const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333',d='44444444-4444-4444-8444-444444444444';
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to anon,authenticated;grant execute on all functions in schema auth to anon,authenticated;create publication supabase_realtime;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:1]$$;
 create function storage.extension(text) returns text language sql immutable as $$select reverse(split_part(reverse($1),'.',1))$$;
 grant usage on schema storage to authenticated;grant all on storage.objects to authenticated;`);
 await db.exec(await readFile(new URL('../supabase/migrations/202611020001_initial.sql',import.meta.url),'utf8'));
 await db.query('insert into auth.users values($1),($2),($3),($4)',[a,b,c,d]);
 const as=async(id:string,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec(`set role ${role}`);};
 await as(a);const s=(await db.query<{id:string}>("select public.create_server('Grupo antigo') id")).rows[0].id;
 await db.exec('reset role');await db.exec(await readFile(new URL('../supabase/migrations/202611020004_groups.sql',import.meta.url),'utf8'));
 await as(a);const invite=(await db.query<{code:string}>('insert into public.invites(server_id,max_uses) values($1,2) returning code',[s])).rows[0].code;
 const admin=(await db.query<{id:string}>("select public.save_server_role($1,null,'Admin','#BF0413',100,array['manage_roles','manage_channels','manage_invites']) id",[s])).rows[0].id;
 const low=(await db.query<{id:string}>("select public.save_server_role($1,null,'Moderador','#F23041',10,array['manage_channels']) id",[s])).rows[0].id;
 await as(b);await db.query('select public.join_server($1)',[invite]);await as(c);await db.query('select public.join_server($1)',[invite]);await as(d);await assert.rejects(db.query('select public.join_server($1)',[invite]));
 await as(b);await db.query('select public.join_server($1)',[invite]); // retry does not consume an extra use
 await assert.rejects(db.query("select public.save_server($1,'Hijack','','')",[s]));
 await assert.rejects(db.query("insert into public.channels(server_id,name,kind) values($1,'Hack','text')",[s]));
 await as(a);await db.query('select public.assign_server_role($1,$2,$3,true)',[s,b,admin]);
 await as(b);await db.query("insert into public.channels(server_id,name,kind) values($1,'Canal delegado','voice')",[s]);
 await assert.rejects(db.query("select public.save_server_role($1,null,'Escalada','#BF0413',101,'{}')",[s]));
 await assert.rejects(db.query("select public.save_server_role($1,null,'Escalada','#BF0413',50,array['manage_group'])",[s]));
 await assert.rejects(db.query('select public.assign_server_role($1,$2,$3,true)',[s,b,low]));
 await assert.rejects(db.query('select public.assign_server_role($1,$2,$3,true)',[s,a,low]));
 await db.query('select public.assign_server_role($1,$2,$3,true)',[s,c,low]);
 await as(c);await db.query("insert into public.channels(server_id,name,kind) values($1,'Call nova','voice')",[s]);await assert.rejects(db.query('insert into public.member_roles values($1,$2,$3)',[s,c,admin]));
 await as(a);await db.query("select public.save_server($1,'Novo nome','História do grupo',$2)",[s,`${s}/${s}.webp`]);await db.query("insert into storage.objects values('group-icons',$1)",[`${s}/${s}.webp`]);
 await as(c);await assert.rejects(db.query("insert into storage.objects values('group-icons',$1)",[`${s}/${c}.webp`]));
 await as(a);const second=(await db.query<{id:string}>("select public.create_server('Outro grupo') id")).rows[0].id;await assert.rejects(db.query('select public.assign_server_role($1,$2,$3,true)',[second,c,low]));
 const open=(await db.query<{code:string}>('insert into public.invites(server_id) values($1) returning code',[s])).rows[0].code;
 await as('','anon');const preview=await db.query<{name:string}>('select * from public.preview_invite($1)',[open]);assert.equal(preview.rows[0].name,'Novo nome');assert.equal((await db.query('select * from public.preview_invite($1)',[invite])).rows.length,0);await assert.rejects(db.query('select * from public.server_roles'));await assert.rejects(db.query('select public.join_server($1)',[open]));
 }finally{await db.close();}
});
