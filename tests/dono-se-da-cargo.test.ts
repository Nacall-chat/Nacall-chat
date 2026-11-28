import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// O dono do grupo pode se dar um cargo (202611290001); mais ninguém pode se promover.
const dono = '11111111-1111-4111-8111-111111111111';
const admin = '22222222-2222-4222-8222-222222222222'; // tem "gerenciar cargos", mas não é dono
const membro = '33333333-3333-4333-8333-333333333333';
const migration = (name: string) => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');

test('cargos: o dono se dá e se tira um cargo; admin não se promove; hierarquia continua valendo', async () => {
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
      '202611210001_mfa_aal2_rpcs.sql', '202611290001_dono_se_da_cargo.sql']) await db.exec(await migration(name));
    await db.query("insert into auth.users(id,raw_user_meta_data) values($1,'{\"username\":\"dono\"}'),($2,'{\"username\":\"admin\"}'),($3,'{\"username\":\"membro\"}')", [dono, admin, membro]);
    const as = async (id: string) => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
      await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: id, aal: 'aal1' })]);
      await db.exec('set role authenticated');
    };
    const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
    const roles = async (s: string, u: string) => (await db.query('select role_id from public.member_roles where server_id=$1 and user_id=$2', [s, u])).rows.length;

    await as(dono);
    const s = (await one<{ id: string }>("select public.create_server('Turma') as id")).id;
    const invite = (await one<{ code: string }>('insert into public.invites(server_id) values($1) returning code', [s])).code;
    const adm = (await one<{ id: string }>("select public.save_server_role($1,null,'Admin','#00ff00',50,array['manage_roles']) as id", [s])).id;
    const mod = (await one<{ id: string }>("select public.save_server_role($1,null,'Mod','#0000ff',10,'{}') as id", [s])).id;
    for (const u of [admin, membro]) { await as(u); await db.query('select public.join_server($1)', [invite]); }

    // o dono se dá o cargo e tira de novo
    await as(dono);
    await db.query('select public.assign_server_role($1,$2,$3,true)', [s, dono, adm]);
    assert.equal(await roles(s, dono), 1, 'o dono ganhou o cargo');
    await db.query('select public.assign_server_role($1,$2,$3,false)', [s, dono, adm]);
    assert.equal(await roles(s, dono), 0, 'o dono tirou o cargo');
    await db.query('select public.assign_server_role($1,$2,$3,true)', [s, admin, adm]);

    // admin (gerenciar cargos, posição 50) não se promove nem mexe em si mesmo; continua gerenciando quem está abaixo
    await as(admin);
    await assert.rejects(db.query('select public.assign_server_role($1,$2,$3,true)', [s, admin, mod]), /abaixo do seu cargo/);
    await assert.rejects(db.query('select public.assign_server_role($1,$2,$3,true)', [s, dono, mod]), /abaixo do seu cargo/);
    await assert.rejects(db.query('select public.assign_server_role($1,$2,$3,true)', [s, membro, adm]), /fora da sua hierarquia/);
    await db.query('select public.assign_server_role($1,$2,$3,true)', [s, membro, mod]);
    assert.equal(await roles(s, membro), 1);

    // membro comum não atribui nada, nem para si
    await as(membro);
    await assert.rejects(db.query('select public.assign_server_role($1,$2,$3,true)', [s, membro, mod]), /Sem permissão/);
  } finally {
    await db.close();
  }
});

test('tela: o dono vê "Atribuir cargos" na própria linha', async () => {
  const src = await readFile(new URL('../src/components/group-settings.tsx', import.meta.url), 'utf8');
  assert.match(src, /can\('manage_roles'\)&&\(memberRank<rank\|\|\(id===me&&me===server\.owner_id\)\)&&<details>/);
});
