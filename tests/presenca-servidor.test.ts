import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { memberState, toServerStates, offlineInfo, type PresenceInfo } from '../src/lib/presence';

// Presença dentro dos servidores (server_presence): membros do mesmo servidor veem online/ausente sem serem amigos.
// Roda em memória (PGlite), com as migrations reais aplicadas em ordem e os papéis do Supabase simulados.
const [a, b, c, d] = [1, 2, 3, 4].map(n => `${n}${n}${n}${n}${n}${n}${n}${n}-${n}${n}${n}${n}-4${n}${n}${n}-8${n}${n}${n}-${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}`);
const migration = (name: string) => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');

async function setup() {
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
  for (const id of [a, b, c, d]) await db.query('insert into auth.users(id) values($1)', [id]);
  for (const name of [
    '202611020002_nacall.sql', '202611020004_groups.sql', '202611050001_global_identity.sql', '202611190001_audio_e_figurinhas.sql',
    '202611190002_leitura_de_dms.sql', '202611190003_presenca.sql', '202611200001_mfa_aal2_rls.sql',
    '202611210001_mfa_aal2_rpcs.sql', '202611210002_moderacao_e_limites.sql', '202611280001_presenca_no_servidor.sql',
  ]) await db.exec(await migration(name));
  const as = async (id: string, aal: 'aal1' | 'aal2' = 'aal1') => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: id, aal })]);
    await db.exec('set role authenticated');
  };
  const admin = async () => { await db.exec('reset role'); };
  // a cria um grupo; b entra; c fica de fora; d entra também. Ninguém é amigo de ninguém.
  await as(a);
  const server = (await db.query<{ id: string }>("select public.create_server('Squad') id")).rows[0].id;
  await admin();
  await db.query('insert into public.server_members(server_id,user_id) values($1,$2),($1,$3)', [server, b, d]);
  // todos dão sinal de vida
  for (const id of [a, b, c, d]) { await as(id); await db.query('select public.touch_presence(false)'); }
  return { db, as, admin, server };
}
type Row = { user_id: string; state: string };
const rows = async (db: PGlite, server: string) => (await db.query<Row>('select * from public.server_presence($1) order by user_id', [server])).rows;

test('presença no servidor: membros veem online e ausente uns dos outros, sem amizade e sem "visto por último"', async () => {
  const { db, as, server } = await setup();
  try {
    await as(a);
    assert.deepEqual(await rows(db, server), [{ user_id: b, state: 'online' }, { user_id: d, state: 'online' }], 'vê os outros membros, não a si mesmo nem quem está fora');
    const columns = (await db.query('select * from public.server_presence($1) limit 1', [server])).fields.map(f => f.name);
    assert.deepEqual(columns, ['user_id', 'state'], 'não entrega a hora do último acesso');
    await as(b); await db.query('select public.touch_presence(true)');
    await as(a); assert.equal((await rows(db, server)).find(r => r.user_id === b)?.state, 'away', 'ocioso aparece como ausente');
    await as(d); await db.query("select public.set_presence('away')");
    await as(a); assert.equal((await rows(db, server)).find(r => r.user_id === d)?.state, 'away', 'escolheu ausente');
  } finally { await db.close(); }
});

test('presença no servidor: quem não é membro não consulta; invisível, offline e bloqueio não aparecem', async () => {
  const { db, as, admin, server } = await setup();
  try {
    await as(c);
    assert.deepEqual(await rows(db, server), [], 'quem não é do grupo não vê ninguém');
    // invisível some, sem entregar que está ali
    await as(b); await db.query("select public.set_presence('invisible')");
    await as(a); assert.equal((await rows(db, server)).some(r => r.user_id === b), false, 'invisível não aparece');
    // sem sinal de vida há mais de 100 s: offline, não aparece
    await admin(); await db.query("update public.presence set online_until=now()-interval '1 second' where user_id=$1", [d]);
    await as(a); assert.deepEqual(await rows(db, server), [], 'offline não aparece');
    // bloqueio, em qualquer direção
    await as(d); await db.query('select public.touch_presence(false)');
    await as(d); await db.query('select public.block_user($1)', [a]);
    await as(a); assert.equal((await rows(db, server)).some(r => r.user_id === d), false, 'quem me bloqueou não aparece');
    await as(d); assert.equal((await rows(db, server)).some(r => r.user_id === a), false, 'quem eu bloqueei não aparece');
    // a tabela continua fechada
    await as(a); await assert.rejects(db.query('select * from public.presence'), /permission denied/);
  } finally { await db.close(); }
});

test('presença no servidor: anon não chama; conta com 2FA verificado precisa de aal2', async () => {
  const { db, as, admin, server } = await setup();
  try {
    await admin(); await db.exec('set role anon');
    await assert.rejects(db.query('select * from public.server_presence($1)', [server]), /permission denied/);
    await admin(); await db.query("insert into auth.mfa_factors(user_id,status) values($1,'verified')", [a]);
    await as(a, 'aal1'); assert.deepEqual(await rows(db, server), [], 'sem o código do 2FA, nada');
    await as(a, 'aal2'); assert.equal((await rows(db, server)).length, 2, 'com aal2, vê os membros');
  } finally { await db.close(); }
});

test('bolinha do membro: você usa o seu status, amigo usa a presença de amigos, os demais a do servidor', () => {
  const me = a;
  const friend: PresenceInfo = { ...offlineInfo, state: 'away' };
  const server = toServerStates([{ user_id: c, state: 'online' }, { user_id: d, state: 'bogus' as 'online' }]);
  assert.deepEqual(server, { [c]: 'online' }, 'valor inesperado é ignorado');
  assert.equal(memberState(me, me, 'invisible', {}, server), 'invisible');
  assert.equal(memberState(b, me, 'online', { [b]: friend }, { [b]: 'online' }), 'away', 'amigo segue a presença de amigos');
  assert.equal(memberState(c, me, 'online', {}, server), 'online');
  assert.equal(memberState(d, me, 'online', {}, server), 'offline', 'fora da lista: offline');
});
