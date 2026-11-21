import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Auditoria Cloudflare (run-1), achado MÉDIO: as funções SECURITY DEFINER (RPCs) não passam por RLS, então a política
// mfa_aal2_required da 202611200001 não valia para elas. Com só a senha (aal1) de uma conta com 2FA dava para ver a
// presença dos amigos, abrir DM, marcar como lida e, num grupo administrado pela vítima, criar um cargo de admin e dá-lo
// a outra conta. A migration 202611210001 faz cada RPC conferir o 2FA. Quem não usa 2FA não muda nada.
const a = '11111111-1111-4111-8111-111111111111'; // dona do grupo, vai ativar o 2FA
const b = '22222222-2222-4222-8222-222222222222'; // amigo, sem 2FA
const c = '33333333-3333-4333-8333-333333333333'; // conta do invasor, membro do grupo
const migration = (name: string) => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');

test('com 2FA ativo, sessão aal1 não usa as RPCs; aal2 usa; sem 2FA nada muda', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
      create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}', updated_at timestamptz default now());
      create table auth.mfa_factors(id uuid primary key default gen_random_uuid(), user_id uuid not null, status text not null);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      grant usage on schema public,auth to authenticated,anon;
      grant execute on all functions in schema auth to authenticated,anon;
      create publication supabase_realtime;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(bucket_id text,name text,created_at timestamptz not null default now()); alter table storage.objects enable row level security;
      create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
      create function storage.extension(name text) returns text language sql immutable as $$select reverse(split_part(reverse(name),'.',1))$$;
      grant usage on schema storage to authenticated; grant select,insert,update,delete on storage.objects to authenticated;`);
    for (const name of ['202611020001_initial.sql', '202611020002_nacall.sql', '202611020003_server_profile_lookup.sql', '202611020004_groups.sql',
      '202611190001_audio_e_figurinhas.sql', '202611190002_leitura_de_dms.sql', '202611190003_presenca.sql', '202611200001_mfa_aal2_rls.sql',
      '202611210001_mfa_aal2_rpcs.sql']) await db.exec(await migration(name));
    await db.query("insert into auth.users(id,raw_user_meta_data) values($1,'{\"username\":\"ana\"}'),($2,'{\"username\":\"bia\"}'),($3,'{\"username\":\"caio\"}')", [a, b, c]);
    const as = async (id: string, aal: 'aal1' | 'aal2') => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
      await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: id, aal })]);
      await db.exec('set role authenticated');
    };
    const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
    const blocked = (sql: string, params: unknown[] = []) => assert.rejects(db.query(sql, params), /2FA/, sql);

    // Antes do 2FA: a cria o grupo, c entra pelo convite, a e b viram amigos, abrem DM e ficam online
    await as(a, 'aal1');
    const server = (await one<{ id: string }>("select public.create_server('Turma') as id")).id;
    const voice = (await one<{ id: string }>("select id from public.channels where kind='voice'")).id;
    const invite = (await one<{ code: string }>('insert into public.invites(server_id) values($1) returning code', [server])).code;
    await db.query('insert into public.friendships(sender_id,receiver_id) values($1,$2)', [a, b]);
    await as(c, 'aal1');
    await db.query('select public.join_server($1)', [invite]);
    await as(b, 'aal1');
    await db.query("update public.friendships set status='accepted'");
    const dm = (await one<{ id: string }>('select public.open_dm($1) as id', [a])).id;
    await db.query('select public.touch_presence(false)');

    // a ativa o 2FA
    await db.exec('reset role');
    await db.query("insert into auth.mfa_factors(user_id,status) values($1,'verified')", [a]);

    // Invasor com só a senha de a (aal1): nenhuma RPC funciona
    await as(a, 'aal1');
    await blocked("select public.create_server('Outro')");
    await blocked('select public.join_server($1)', [invite]);
    await blocked('select public.open_dm($1)', [b]);
    await blocked('select public.mark_dm_read($1)', [dm]);
    await blocked("select public.set_room_media($1,'dQw4w9WgXcQ',true,0)", [voice]);
    await blocked("select public.save_server($1,'Hackeado','','')", [server]);
    await blocked("select public.save_server_role($1,null,'Admin','#ff0000',999,array['manage_group','manage_roles','manage_channels','manage_invites'])", [server]);
    await blocked('select public.touch_presence(false)');
    await blocked("select public.set_presence('invisible')");
    assert.equal((await db.query('select * from public.friends_presence()')).rows.length, 0, 'aal1 não vê a presença dos amigos');
    assert.equal((await one<{ s: string | null }>('select public.my_presence() as s')).s, null, 'aal1 não lê o próprio status');
    assert.equal((await one<{ ok: boolean }>('select public.allow_voice_token() as ok')).ok, false, 'aal1 não ganha token de voz');
    await db.query('select public.leave_presence()'); // continua silencioso
    await db.exec('reset role');
    assert.equal((await one<{ name: string }>('select name from public.servers where id=$1', [server])).name, 'Turma', 'grupo intacto');
    assert.equal((await one<{ n: number }>('select count(*)::int as n from public.server_roles')).n, 0, 'nenhum cargo criado');
    assert.equal((await one<{ n: number }>('select count(*)::int as n from public.dm_reads')).n, 0, 'nada marcado como lido');

    // a de verdade, com o código confirmado (aal2): tudo funciona
    await as(a, 'aal2');
    assert.equal((await db.query('select * from public.friends_presence()')).rows.length, 1, 'aal2 vê a presença de b');
    assert.equal((await one<{ s: string }>('select public.my_presence() as s')).s, 'online');
    assert.equal((await one<{ id: string }>('select public.open_dm($1) as id', [b])).id, dm);
    await db.query('select public.mark_dm_read($1)', [dm]);
    await db.query("select public.save_server($1,'Turma nova','','')", [server]);
    const role = (await one<{ id: string }>("select public.save_server_role($1,null,'Mod','#00ff00',10,array['manage_invites']) as id", [server])).id;
    await db.query('select public.assign_server_role($1,$2,$3,true)', [server, c, role]);
    await db.query('select public.touch_presence(false)');
    await db.query("select public.set_room_media($1,'dQw4w9WgXcQ',true,0)", [voice]);
    assert.equal((await one<{ ok: boolean }>('select public.allow_voice_token() as ok')).ok, true);

    // b continua sem 2FA: aal1 segue funcionando
    await as(b, 'aal1');
    assert.equal((await db.query('select * from public.friends_presence()')).rows.length, 1, 'quem não usa 2FA não é afetado');
    assert.equal((await one<{ id: string }>('select public.open_dm($1) as id', [a])).id, dm);
    await db.query('select public.mark_dm_read($1)', [dm]);
    await db.query("select public.set_presence('away')");
  } finally {
    await db.close();
  }
});
