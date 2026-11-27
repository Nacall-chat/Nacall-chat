import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Respostas e reações (202611270001): quem pode, mesma conversa, limites, bloqueio e 2FA.
// Roda em memória (PGlite), com as migrations reais aplicadas em ordem e os papéis anon/authenticated do Supabase simulados.
const [a, b, c, d, e] = [1, 2, 3, 4, 5].map(n => `${n}${n}${n}${n}${n}${n}${n}${n}-${n}${n}${n}${n}-4${n}${n}${n}-8${n}${n}${n}-${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}${n}`);
const extra = Array.from({ length: 55 }, () => crypto.randomUUID());
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
  // As contas existem antes das migrations seguintes, que também preenchem a comunidade oficial.
  for (const id of [a, b, c, d, e, ...extra]) await db.query('insert into auth.users(id) values($1)', [id]);
  for (const name of [
    '202611020002_nacall.sql', '202611020004_groups.sql', '202611050001_global_identity.sql', '202611190001_audio_e_figurinhas.sql',
    '202611190002_leitura_de_dms.sql', '202611190003_presenca.sql', '202611200001_mfa_aal2_rls.sql',
    '202611210001_mfa_aal2_rpcs.sql', '202611210002_moderacao_e_limites.sql', '202611270001_respostas_e_reacoes.sql',
  ]) await db.exec(await migration(name));
  const as = async (id: string, aal: 'aal1' | 'aal2' = 'aal1') => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: id, aal })]);
    await db.exec('set role authenticated');
  };
  const admin = async () => { await db.exec('reset role'); };
  const count = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows.length;
  return { db, as, admin, count };
}

const friends = async (db: PGlite, as: (id: string, aal?: 'aal1' | 'aal2') => Promise<void>, x: string, y: string) => {
  await as(x); await db.query('insert into public.friendships(sender_id,receiver_id) values($1,$2)', [x, y]);
  await as(y); await db.query("update public.friendships set status='accepted' where sender_id=$1 and receiver_id=$2", [x, y]);
};

test('respostas: só para mensagem da mesma conversa; apagar a original deixa a resposta sem citação', async () => {
  const { db, as } = await setup();
  try {
    await friends(db, as, a, b); await friends(db, as, a, c);
    await as(a);
    const dmAB = (await db.query<{ id: string }>('select public.open_dm($1) as id', [b])).rows[0].id;
    const dmAC = (await db.query<{ id: string }>('select public.open_dm($1) as id', [c])).rows[0].id;
    const orig = (await db.query<{ id: string }>('insert into public.messages(dm_id,body) values($1,$2) returning id', [dmAB, 'original'])).rows[0].id;
    await as(b);
    const reply = (await db.query<{ id: string }>('insert into public.messages(dm_id,body,reply_to) values($1,$2,$3) returning id', [dmAB, 'respondendo', orig])).rows[0].id;
    await as(a);
    await assert.rejects(db.query('insert into public.messages(dm_id,body,reply_to) values($1,$2,$3)', [dmAC, 'citando outra conversa', orig]), /mesma conversa/);
    await db.query('delete from public.messages where id=$1', [orig]);
    const left = (await db.query<{ reply_to: string | null }>('select reply_to from public.messages where id=$1', [reply])).rows[0];
    assert.equal(left.reply_to, null);
  } finally { await db.close(); }
});

test('reações: participantes reagem e tiram a própria; quem está fora não vê nem reage; bloqueio impede', async () => {
  const { db, as, admin, count } = await setup();
  try {
    await friends(db, as, a, b);
    await as(a);
    const dm = (await db.query<{ id: string }>('select public.open_dm($1) as id', [b])).rows[0].id;
    const msg = (await db.query<{ id: string }>('insert into public.messages(dm_id,body) values($1,$2) returning id', [dm, 'oi'])).rows[0].id;
    await as(b);
    await db.query('insert into public.message_reactions(message_id,emoji) values($1,$2)', [msg, '🔥']);
    await assert.rejects(db.query('insert into public.message_reactions(message_id,emoji) values($1,$2)', [msg, '🔥']), /duplicate|unique|chave/i);
    await as(a);
    assert.equal(await count('select 1 from public.message_reactions where message_id=$1', [msg]), 1, 'a outra pessoa da conversa vê');
    await db.query('delete from public.message_reactions where message_id=$1', [msg]);
    await admin(); assert.equal(await count('select 1 from public.message_reactions where message_id=$1', [msg]), 1, 'não tira a reação dos outros');
    await as(c);
    assert.equal(await count('select 1 from public.message_reactions where message_id=$1', [msg]), 0, 'quem não está na conversa não vê');
    await assert.rejects(db.query('insert into public.message_reactions(message_id,emoji) values($1,$2)', [msg, '👍']), /row-level security|policy/i);
    await as(a); await db.query('select public.block_user($1)', [b]);
    await as(b);
    await assert.rejects(db.query('insert into public.message_reactions(message_id,emoji) values($1,$2)', [msg, '😂']), /row-level security|policy/i, 'bloqueado não reage');
    await db.query('delete from public.message_reactions where message_id=$1 and user_id=$2', [msg, b]);
    await admin(); assert.equal(await count('select 1 from public.message_reactions where message_id=$1', [msg]), 0, 'mas tira a própria');
  } finally { await db.close(); }
});

test('reações: limite de 10 por pessoa e de 20 emojis por mensagem; com 2FA exige aal2', async () => {
  const { db, as, admin } = await setup();
  try {
    await friends(db, as, a, b);
    await as(a);
    const dm = (await db.query<{ id: string }>('select public.open_dm($1) as id', [b])).rows[0].id;
    const msg = (await db.query<{ id: string }>('insert into public.messages(dm_id,body) values($1,$2) returning id', [dm, 'oi'])).rows[0].id;
    for (let i = 0; i < 10; i++) await db.query('insert into public.message_reactions(message_id,emoji) values($1,$2)', [msg, 'e' + i]);
    await assert.rejects(db.query('insert into public.message_reactions(message_id,emoji) values($1,$2)', [msg, 'e10']), /reagiu bastante/);
    // terceira conta (via admin, só para encher) completa 20 emojis diferentes
    await admin();
    for (let i = 10; i < 20; i++) await db.query('insert into public.message_reactions(message_id,user_id,emoji) values($1,$2,$3)', [msg, c, 'e' + i]);
    await as(b);
    await assert.rejects(db.query('insert into public.message_reactions(message_id,emoji) values($1,$2)', [msg, 'novo']), /emojis demais/);
    await db.query('insert into public.message_reactions(message_id,emoji) values($1,$2)', [msg, 'e0']); // emoji que já existe continua valendo
    await admin(); await db.query("insert into auth.mfa_factors(user_id,status) values($1,'verified')", [b]);
    await as(b, 'aal1');
    await assert.rejects(db.query('delete from public.message_reactions where message_id=$1 and user_id=$2 and emoji=$3 returning 1', [msg, b, 'e0']).then(r => { if (!r.rows.length) throw new Error('row-level security: sem aal2'); }), /row-level security/);
    await as(b, 'aal2');
    assert.equal((await db.query('delete from public.message_reactions where message_id=$1 and user_id=$2 and emoji=$3 returning 1', [msg, b, 'e0'])).rows.length, 1);
  } finally { await db.close(); }
});
