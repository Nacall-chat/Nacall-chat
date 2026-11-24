import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Revisões de segurança (ECC, 22/11/2026), migration 202611240001:
// 1. member_rank respondia o cargo de qualquer pessoa em qualquer grupo, mesmo para quem não é membro.
// 2. group-icons não tinha limite de arquivos por grupo.
const [a, c] = [1, 3].map(n => `${n}${n}${n}${n}${n}${n}${n}${n}-${n}${n}${n}${n}-4${n}${n}${n}-8${n}${n}${n}-${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}`);
const migration = (name: string) => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');

async function setup(withFix: boolean) {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
    create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'authenticated')$$;
    create table auth.users(id uuid primary key);
    create table auth.mfa_factors(id uuid primary key default gen_random_uuid(), user_id uuid not null, status text not null);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    grant usage on schema public,auth to authenticated,anon;
    grant execute on function auth.uid(), auth.jwt() to authenticated,anon;
    create publication supabase_realtime;
    create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(bucket_id text,name text,created_at timestamptz not null default now()); alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1]$$;
    create function storage.extension(name text) returns text language sql immutable as $$select reverse(split_part(reverse(name),'.',1))$$;
    grant usage on schema storage to authenticated; grant select,insert,update,delete on storage.objects to authenticated;`);
  await db.exec(await migration('202611020001_initial.sql'));
  for (const id of [a, c]) await db.query('insert into auth.users(id) values($1)', [id]);
  for (const name of [
    '202611020002_nacall.sql', '202611020004_groups.sql', '202611020005_profile_covers.sql', '202611050001_global_identity.sql',
    '202611190001_audio_e_figurinhas.sql', '202611190002_leitura_de_dms.sql', '202611190003_presenca.sql', '202611200001_mfa_aal2_rls.sql',
    '202611210001_mfa_aal2_rpcs.sql', '202611210002_moderacao_e_limites.sql', '202611220001_storage_2fa_e_icones.sql', ...(withFix ? ['202611240001_rank_e_icones.sql'] : []),
  ]) await db.exec(await migration(name));
  const as = async (id: string, aal: 'aal1' | 'aal2' = 'aal1') => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: id, aal })]);
    await db.exec('set role authenticated');
  };
  const changed = async (sql: string) => (await db.query(sql)).affectedRows ?? 0;
  return { db, as, changed };
}

async function scenario(withFix: boolean) {
  const { db, as } = await setup(withFix);
  try {
    await as(a, 'aal2');
    const server = (await db.query<{ id: string }>("select public.create_server('Turma') as id")).rows[0].id;
    const rank = async (u: string) => (await db.query<{ r: number }>('select public.member_rank($1,$2) as r', [server, u])).rows[0].r;
    const ownerSeenByMember = await rank(a);
    await as(c, 'aal2');
    const ownerSeenByOutsider = await rank(a);
    const selfSeenByOutsider = await rank(c);
    await as(a, 'aal2');
    let uploaded = 0;
    for (let i = 0; i < 21; i++) {
      const ok = await db.query(`insert into storage.objects(bucket_id,name) values('group-icons','${server}/icone-${i}.webp')`).then(() => true, () => false);
      if (ok) uploaded++;
    }
    return { ownerSeenByMember, ownerSeenByOutsider, selfSeenByOutsider, uploaded };
  } finally {
    await db.close();
  }
}

test('sem a correção (como achou a revisão): quem não é membro vê o cargo do dono e o grupo aceita ícones sem limite', async () => {
  const r = await scenario(false);
  assert.equal(r.ownerSeenByOutsider, 1000, 'quem não é membro descobria que a é dona do grupo');
  assert.equal(r.uploaded, 21);
});

test('com 202611240001: cargo só para membros e no máximo 20 ícones por grupo', async () => {
  const r = await scenario(true);
  assert.equal(r.ownerSeenByMember, 1000, 'membro continua vendo o cargo (as funções de cargo dependem disso)');
  assert.equal(r.ownerSeenByOutsider, 0, 'quem não é membro não descobre mais o cargo');
  assert.equal(r.selfSeenByOutsider, 0, 'sobre si mesmo responde normalmente (0 = sem cargo)');
  assert.equal(r.uploaded, 20, 'o 21º ícone do mesmo grupo é recusado');
});
