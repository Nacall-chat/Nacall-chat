import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Auditoria Cloudflare (run-1), dois achados de storage (migration 202611220001):
// 1. Com só a senha (aal1) de uma conta com 2FA dava para subir, renomear ou apagar a foto e a capa da vítima.
// 2. Qualquer pessoa logada listava o bucket group-icons e descobria id e ícone de grupos em que não está.
// Roda em memória (PGlite) com as migrations reais em ordem e o schema storage simulado (mesmo setup de moderation-limits).
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
    '202611210001_mfa_aal2_rpcs.sql', '202611210002_moderacao_e_limites.sql', ...(withFix ? ['202611220001_storage_2fa_e_icones.sql'] : []),
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
  const { db, as, changed } = await setup(withFix);
  try {
    // a cria um grupo e sobe avatar, capa e ícone do grupo antes de ativar o 2FA
    await as(a);
    const server = (await db.query<{ id: string }>("select public.create_server('Turma') as id")).rows[0].id;
    await db.query(`insert into storage.objects(bucket_id,name) values('avatars','${a}/foto.webp'),('profile-covers','${a}/capa.webp'),('group-icons','${server}/icone.webp')`);
    await db.exec('reset role');
    await db.query("insert into auth.mfa_factors(user_id,status) values($1,'verified')", [a]);
    const out = { aal1: {} as Record<string, number | string>, aal2: {} as Record<string, number | string>, groupIconsForNonMember: 0, groupIconsForMember: 0 };
    // invasor com só a senha de a (aal1)
    await as(a, 'aal1');
    out.aal1.rename = await changed(`update storage.objects set name='${a}/pagina.html' where bucket_id='avatars' and name='${a}/foto.webp'`);
    out.aal1.deleteCover = await changed(`delete from storage.objects where bucket_id='profile-covers' and name='${a}/capa.webp'`);
    out.aal1.upload = await db.query(`insert into storage.objects(bucket_id,name) values('avatars','${a}/troca.webp')`).then(() => 'ok', () => 'recusado');
    // a de verdade (aal2)
    await as(a, 'aal2');
    out.aal2.upload = await db.query(`insert into storage.objects(bucket_id,name) values('avatars','${a}/nova.webp')`).then(() => 'ok', () => 'recusado');
    out.aal2.renameToHtml = await changed(`update storage.objects set name='${a}/pagina.html' where bucket_id='avatars' and name='${a}/nova.webp'`).then(String, () => 'recusado');
    out.aal2.deleteCover = await changed(`delete from storage.objects where bucket_id='profile-covers' and name='${a}/capa.webp'`);
    out.groupIconsForMember = (await db.query(`select name from storage.objects where bucket_id='group-icons'`)).rows.length;
    // c não é membro do grupo de a
    await as(c, 'aal1');
    out.groupIconsForNonMember = (await db.query(`select name from storage.objects where bucket_id='group-icons'`)).rows.length;
    return out;
  } finally {
    await db.close();
  }
}

test('sem a correção (como achou a auditoria): aal1 mexe no avatar/capa e quem não é membro lista os ícones', async () => {
  const r = await scenario(false);
  assert.equal(r.aal1.rename, 1, 'aal1 renomeava o avatar');
  assert.equal(r.aal1.deleteCover, 1, 'aal1 apagava a capa');
  assert.equal(r.groupIconsForNonMember, 1, 'quem não é membro via o ícone do grupo');
});

test('com 202611220001: avatar e capa exigem 2FA, avatar continua só .webp e ícones de grupo só para membros', async () => {
  const r = await scenario(true);
  assert.equal(r.aal1.rename, 0, 'aal1 não renomeia o avatar');
  assert.equal(r.aal1.deleteCover, 0, 'aal1 não apaga a capa');
  assert.equal(r.aal1.upload, 'recusado', 'aal1 não sobe avatar');
  assert.equal(r.aal2.upload, 'ok', 'com o código do 2FA a pessoa troca o avatar normalmente');
  assert.equal(r.aal2.renameToHtml, 'recusado', 'nem com aal2 o avatar vira .html');
  assert.equal(r.aal2.deleteCover, 1, 'com o código do 2FA a pessoa remove a capa normalmente');
  assert.equal(r.groupIconsForMember, 1, 'membro continua vendo o ícone do grupo');
  assert.equal(r.groupIconsForNonMember, 0, 'quem não é membro não lista o ícone');
});
