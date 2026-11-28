import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { serverMenuItems, serverMenuSections } from '../src/lib/server-menu';

// Menu do grupo: só mostra o que a pessoa pode fazer, com as mesmas regras do banco (has_server_permission e leave_server).
const [owner, mod, member] = [1, 2, 3].map(n => `${n}${n}${n}${n}${n}${n}${n}${n}-${n}${n}${n}${n}-4${n}${n}${n}-8${n}${n}${n}-${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}`);
const migration = (name: string) => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const ids = (list: { id: string }[]) => list.map(item => item.id);

test('menu do grupo: dono vê tudo menos sair; membro comum só configurações (leitura), copiar ID e sair', () => {
  const server = { owner_id: owner, is_official: false };
  assert.deepEqual(ids(serverMenuItems(server, owner, () => true)), ['invite', 'settings', 'create-channel', 'roles', 'copy-id']);
  assert.deepEqual(ids(serverMenuItems(server, member, () => false)), ['settings', 'copy-id', 'leave']);
  assert.equal(serverMenuItems(server, member, () => false).find(i => i.id === 'settings')?.hint, 'Ver o perfil do grupo');
  const onlyInvites = (p: string) => p === 'manage_invites';
  assert.deepEqual(ids(serverMenuItems(server, mod, onlyInvites)), ['invite', 'settings', 'copy-id', 'leave']);
  const leave = serverMenuItems(server, member, () => false).at(-1);
  assert.equal(leave?.danger, true, 'sair fica em vermelho, no fim');
});

test('menu do grupo: comunidade oficial não tem configurações nem sair; app sem telas de configuração mostra só copiar e sair', () => {
  const official = { owner_id: null, is_official: true };
  assert.deepEqual(ids(serverMenuItems(official, member, () => false)), ['copy-id']);
  assert.deepEqual(ids(serverMenuItems(official, member, p => p === 'manage_invites')), ['invite', 'copy-id']);
  const server = { owner_id: owner, is_official: false };
  assert.deepEqual(ids(serverMenuItems(server, member, () => true, { manage: false })), ['copy-id', 'leave']);
  assert.deepEqual(serverMenuSections(serverMenuItems(server, member, () => false)).map(g => g.map(i => i.section)[0]), ['manage', 'info', 'danger']);
  assert.deepEqual(serverMenuSections(serverMenuItems(official, member, () => false)).length, 1, 'sem blocos vazios');
});

test('menu do grupo: as opções batem com o que o banco deixa fazer', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
      create function auth.role() returns text language sql stable as $$select 'authenticated'$$;
      create table auth.users(id uuid primary key);
      create table auth.mfa_factors(id uuid primary key default gen_random_uuid(), user_id uuid not null, status text not null);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      grant usage on schema public,auth to authenticated,anon; grant execute on function auth.uid(), auth.jwt() to authenticated,anon;
      create publication supabase_realtime;
      create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(bucket_id text,name text,created_at timestamptz not null default now()); alter table storage.objects enable row level security;
      create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
      create function storage.extension(name text) returns text language sql immutable as $$select reverse(split_part(reverse(name),'.',1))$$;
      grant usage on schema storage to authenticated; grant select,insert,update,delete on storage.objects to authenticated;`);
    await db.exec(await migration('202611020001_initial.sql'));
    for (const id of [owner, mod, member]) await db.query('insert into auth.users(id) values($1)', [id]);
    for (const name of ['202611020002_nacall.sql', '202611020004_groups.sql', '202611050001_global_identity.sql', '202611190003_presenca.sql',
      '202611200001_mfa_aal2_rls.sql', '202611210001_mfa_aal2_rpcs.sql', '202611210002_moderacao_e_limites.sql']) await db.exec(await migration(name));
    const as = async (id: string) => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
      await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: id, aal: 'aal1' })]);
      await db.exec('set role authenticated');
    };
    await as(owner);
    const s = (await db.query<{ id: string }>("select public.create_server('Squad') id")).rows[0].id;
    await db.exec('reset role');
    await db.query('insert into public.server_members(server_id,user_id) values($1,$2),($1,$3)', [s, mod, member]);
    const role = (await db.query<{ id: string }>("insert into public.server_roles(server_id,name,position,permissions) values($1,'Convites',10,array['manage_invites']) returning id", [s])).rows[0].id;
    await db.query('insert into public.member_roles(server_id,user_id,role_id) values($1,$2,$3)', [s, mod, role]);
    const server = (await db.query<{ owner_id: string; is_official: boolean }>('select owner_id,is_official from public.servers where id=$1', [s])).rows[0];

    for (const id of [owner, mod, member]) {
      await as(id);
      const perms: Record<string, boolean> = {};
      for (const p of ['manage_group', 'manage_channels', 'manage_roles', 'manage_invites']) perms[p] = (await db.query<{ ok: boolean }>('select public.has_server_permission($1,$2) ok', [s, p])).rows[0].ok;
      const items = ids(serverMenuItems(server, id, p => perms[p]));
      assert.equal(items.includes('invite'), perms.manage_invites, `convidar só com manage_invites (${id})`);
      assert.equal(items.includes('create-channel'), perms.manage_channels);
      assert.equal(items.includes('roles'), perms.manage_roles);
    }
    // Sair: o dono não pode (e o menu não oferece); o membro pode (e o menu oferece).
    await as(owner);
    assert.equal(ids(serverMenuItems(server, owner, () => true)).includes('leave'), false);
    await assert.rejects(db.query('select public.leave_server($1)', [s]), /dono não pode sair/);
    await as(member);
    assert.equal(ids(serverMenuItems(server, member, () => false)).includes('leave'), true);
    await db.query('select public.leave_server($1)', [s]);
    await db.exec('reset role');
    assert.equal((await db.query('select 1 from public.server_members where server_id=$1 and user_id=$2', [s, member])).rows.length, 0);
    // Comunidade oficial: ninguém sai (e o menu não oferece).
    const official = (await db.query<{ id: string }>('select id from public.servers where is_official limit 1')).rows[0];
    if (official) {
      await db.query('insert into public.server_members(server_id,user_id) values($1,$2) on conflict do nothing', [official.id, member]);
      await as(member);
      await assert.rejects(db.query('select public.leave_server($1)', [official.id]), /comunidade oficial/);
      assert.equal(ids(serverMenuItems({ owner_id: null, is_official: true }, member, () => false)).includes('leave'), false);
    }
  } finally { await db.close(); }
});
