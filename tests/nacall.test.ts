import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {youtubeId,musicPosition} from '../src/lib/youtube';
import {authSchema} from '../src/lib/auth-schema';
test('YouTube aceita apenas hosts e IDs conhecidos, nunca URLs arbitrárias',()=>{
 for(const link of ['https://youtu.be/dQw4w9WgXcQ','https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=4','https://music.youtube.com/watch?v=dQw4w9WgXcQ'])assert.equal(youtubeId(link),'dQw4w9WgXcQ');
 for(const link of ['javascript:alert(1)','https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ','https://example.com/video','https://youtu.be/curto'])assert.equal(youtubeId(link),null);
});
test('posição compartilhada avança ao tocar e fica estável ao pausar',()=>{
 const state={channel_id:'a',video_id:'dQw4w9WgXcQ',playing:true,position_seconds:12,updated_at:'2026-11-02T12:00:00Z',updated_by:null,revision:1};
 assert.equal(musicPosition(state,Date.parse('2026-11-02T12:00:05Z')),17);
 assert.equal(musicPosition({...state,playing:false},Date.parse('2026-11-02T12:00:05Z')),12);
});
test('login por usuário ou email normaliza o identificador e preserva a senha como digitada',()=>{
 const result=authSchema.parse({action:'login',identifier:' Nick_01 ',password:' senha com espaço '});
 assert.ok(result.action==='login');assert.equal(result.identifier,'nick_01');assert.equal(result.password,' senha com espaço ');
 assert.equal(authSchema.parse({action:'login',identifier:'Nick@Exemplo.COM',password:'x'}).action,'login');
 assert.equal(authSchema.safeParse({action:'signup',username:'abc',displayName:'Teste',password:'123'}).success,false);
});
test('migração NACALL preserva dados, protege recuperação e isola música e avatar',async()=>{
 const db=new PGlite();const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   create function auth.role() returns text language sql stable as $$select current_setting('request.jwt.claim.role',true)$$;
   grant usage on schema public,auth to anon,authenticated,service_role;grant execute on all functions in schema auth to anon,authenticated,service_role;create publication supabase_realtime;
   create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;
   create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
   create function storage.extension(text) returns text language sql immutable as $$select reverse(split_part(reverse($1),'.',1))$$;
   grant usage on schema storage to authenticated;grant all on storage.objects to authenticated;`);
  await db.exec(await readFile(new URL('../supabase/migrations/202611020001_initial.sql',import.meta.url),'utf8'));
  await db.query('insert into auth.users(id) values($1)',[a]);
  const as=async(id:string,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.role',$2,false)",[id,role]);await db.exec(`set role ${role}`);};
  await as(a);const server=(await db.query<{id:string}>("select public.create_server('Lobby antigo') as id")).rows[0].id;
  const text=(await db.query<{id:string}>("select id from public.channels where kind='text'")).rows[0].id;
  await db.query("insert into public.messages(channel_id,body) values($1,'Histórico preservado')",[text]);
  await db.exec('reset role');await db.exec(await readFile(new URL('../supabase/migrations/202611020002_nacall.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/202611020005_profile_covers.sql',import.meta.url),'utf8'));
  await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2),($3,$4)',[b,{username:'player_b',display_name:'Player B'},c,{username:'player_c',display_name:'Player C'}]);
  await as(a);assert.equal((await db.query('select * from public.messages')).rows.length,1);
  const voice=(await db.query<{id:string}>("select id from public.channels where kind='voice'")).rows[0].id;
  const media=(await db.query<{revision:number}>("select revision from public.set_room_media($1,'dQw4w9WgXcQ',true,0)",[voice])).rows[0];assert.equal(Number(media.revision),1);
  await assert.rejects(db.query("select public.set_room_media($1,'bad',true,0)",[voice]));
  await assert.rejects(db.query("select public.set_room_media($1,'dQw4w9WgXcQ',false,0,99)",[voice]));
  await assert.rejects(db.query('select * from public.account_recovery'));
  await assert.rejects(db.query('select public.consume_auth_attempt($1)',['a'.repeat(64)]));
  await db.query('update public.profiles set avatar_path=$1 where id=$2',[`${a}/avatar.webp`,a]);
  await assert.rejects(db.query('update public.profiles set avatar_path=$1 where id=$2',[`${b}/avatar.webp`,a]));
  await db.query("insert into storage.objects values('avatars',$1)",[`${a}/avatar.webp`]);
  await assert.rejects(db.query("insert into storage.objects values('avatars',$1)",[`${b}/avatar.webp`]));
  await db.query('update public.profiles set cover_path=$1 where id=$2',[`${a}/a.gif`,a]);
  await assert.rejects(db.query('update public.profiles set cover_path=$1 where id=$2',[`${b}/a.gif`,a]));
  await db.query("insert into storage.objects values('profile-covers',$1)",[`${a}/a.gif`]);
  await assert.rejects(db.query("insert into storage.objects values('profile-covers',$1)",[`${b}/a.gif`]));
  await assert.rejects(db.query("insert into storage.objects values('profile-covers',$1)",[`${a}/evil.svg`]));
  await as(b);assert.equal((await db.query<{username:string}>('select username from public.profiles where id=$1',[b])).rows[0].username,'player_b');
  assert.equal((await db.query('select * from public.room_media')).rows.length,0);
  await assert.rejects(db.query("select public.set_room_media($1,'dQw4w9WgXcQ',true,0)",[voice]));
  await as('', 'anon');await assert.rejects(db.query('select * from public.account_recovery'));
  await as('', 'service_role');for(let i=0;i<30;i++)assert.equal((await db.query<{ok:boolean}>('select public.consume_auth_attempt($1) as ok',['a'.repeat(64)])).rows[0].ok,true);
  assert.equal((await db.query<{ok:boolean}>('select public.consume_auth_attempt($1) as ok',['a'.repeat(64)])).rows[0].ok,false);
 }finally{await db.close();}
});

