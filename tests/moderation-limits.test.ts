import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Auditoria de segurança (SEC-001, 002, 005): contato indesejado, moderação e limites de escrita; e o 2FA (SEC-003) nas funções novas.
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
    '202611210001_mfa_aal2_rpcs.sql', '202611210002_moderacao_e_limites.sql',
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

test('SEC-001: DM só aceita mensagem nova entre amigos; o histórico continua; bloqueio e teto de pedidos', async () => {
  const { db, as, admin, count } = await setup();
  try {
    await friends(db, as, a, b);
    await as(a);
    const dm = (await db.query<{ id: string }>('select public.open_dm($1) as id', [b])).rows[0].id;
    await db.query('insert into public.messages(dm_id,body) values($1,$2)', [dm, 'oi']);
    await as(b);
    await db.query('insert into public.messages(dm_id,body) values($1,$2)', [dm, 'oi, a']);

    // a desfaz a amizade: o histórico segue legível para os dois, mas ninguém escreve mais (nem pelo REST direto)
    await as(a);
    await db.query('delete from public.friendships');
    assert.equal(await count('select * from public.messages where dm_id=$1', [dm]), 2, 'histórico continua legível');
    await assert.rejects(db.query('insert into public.messages(dm_id,body) values($1,$2)', [dm, 'ainda?']), 'ex-amigo não escreve');
    await as(b);
    await assert.rejects(db.query('insert into public.messages(dm_id,body) values($1,$2)', [dm, 'ainda?']), 'o outro lado também não');
    await assert.rejects(db.query('select public.open_dm($1)', [a]), 'sem amizade não abre DM');

    // voltam a ser amigos: a mesma DM volta a funcionar
    await friends(db, as, b, a);
    await db.query('insert into public.messages(dm_id,body) values($1,$2)', [dm, 'voltei']);

    // bloqueio: desfaz a amizade, só quem bloqueou vê a lista, ninguém escreve nem pede amizade
    await as(a);
    await db.query('select public.block_user($1)', [b]);
    assert.equal(await count('select * from public.friendships'), 0, 'bloquear desfaz a amizade');
    assert.equal(await count('select * from public.user_blocks'), 1, 'quem bloqueou vê o bloqueio');
    await assert.rejects(db.query('select public.block_user($1)', [a]), 'não bloqueia a si mesmo');
    await assert.rejects(db.query('insert into public.friendships(sender_id,receiver_id) values($1,$2)', [a, b]), 'quem bloqueou não pede amizade');
    await as(b);
    assert.equal(await count('select * from public.user_blocks'), 0, 'a pessoa bloqueada não vê quem a bloqueou');
    await assert.rejects(db.query('insert into public.friendships(sender_id,receiver_id) values($1,$2)', [b, a]), 'bloqueado não pede amizade');
    await assert.rejects(db.query('insert into public.messages(dm_id,body) values($1,$2)', [dm, 'oi?']), 'bloqueado não escreve');
    await as(a);
    await db.query('select public.unblock_user($1)', [b]);
    await db.query('insert into public.friendships(sender_id,receiver_id) values($1,$2)', [a, b]);

    // teto de 50 pedidos pendentes enviados por pessoa
    await as(c);
    for (const id of extra.slice(0, 50)) await db.query('insert into public.friendships(sender_id,receiver_id) values($1,$2)', [c, id]);
    await assert.rejects(db.query('insert into public.friendships(sender_id,receiver_id) values($1,$2)', [c, extra[50]]), /pedidos de amizade pendentes/);
    await admin();
  } finally { await db.close(); }
});

test('SEC-002: sair do grupo, remover, banir e moderar mensagens, com hierarquia', async () => {
  const { db, as, admin, count } = await setup();
  try {
    await as(a);
    const s = (await db.query<{ id: string }>("select public.create_server('Grupo') as id")).rows[0].id;
    const invite = (await db.query<{ code: string }>('insert into public.invites(server_id) values($1) returning code', [s])).rows[0].code;
    const mod = (await db.query<{ id: string }>("select public.save_server_role($1,null,'Moderador','#F23041',10,array['manage_roles','manage_channels']) as id", [s])).rows[0].id;
    for (const id of [b, c, d]) { await as(id); await db.query('select public.join_server($1)', [invite]); }
    await as(a);
    await db.query('select public.assign_server_role($1,$2,$3,true)', [s, b, mod]);
    const text = (await db.query<{ id: string }>("select id from public.channels where server_id=$1 and kind='text'", [s])).rows[0].id;

    // sair do grupo: membro comum sai; dono e comunidade oficial não
    await as(d);
    await db.query('select public.leave_server($1)', [s]);
    assert.equal(await count('select * from public.servers where id=$1', [s]), 0, 'depois de sair não vê mais o grupo');
    await assert.rejects(db.query('select public.leave_server($1)', [s]), 'sair de novo falha');
    await as(a);
    await assert.rejects(db.query('select public.leave_server($1)', [s]), /dono/);
    await admin();
    const official = (await db.query<{ id: string }>('select id from public.servers where is_official')).rows[0].id;
    await as(c);
    await assert.rejects(db.query('select public.leave_server($1)', [official]), /oficial/);

    // remover: sem cargo não pode; moderador não remove o dono nem a si; remove quem está abaixo
    await assert.rejects(db.query('select public.remove_member($1,$2)', [s, b]), 'membro comum não remove');
    await as(b);
    await assert.rejects(db.query('select public.remove_member($1,$2)', [s, a]), 'moderador não remove o dono');
    await assert.rejects(db.query('select public.remove_member($1,$2)', [s, b]), 'não remove a si mesmo');
    await assert.rejects(db.query('select public.remove_member($1,$2)', [official, c]), 'ninguém remove na comunidade oficial');

    // moderar: c escreve, membro comum não apaga, moderador apaga
    await as(c);
    const msg = (await db.query<{ id: string }>('insert into public.messages(channel_id,body) values($1,$2) returning id', [text, 'spam'])).rows[0].id;
    await as(a); await db.query('select public.join_server($1)', [invite]); // dono já é membro: não muda nada
    await as(b);
    await db.query('select public.remove_member($1,$2)', [s, c]);
    await as(c);
    assert.equal(await count('select * from public.messages where id=$1', [msg]), 0, 'quem foi removido não lê mais o canal');
    await as(a);
    assert.equal((await db.query('delete from public.messages where id=$1', [msg])).affectedRows, 1, 'dono apaga a mensagem de quem foi removido');

    // banir: quem foi banido não volta pelo mesmo convite; desbanir libera
    await as(e); await db.query('select public.join_server($1)', [invite]);
    await as(b);
    await db.query('select public.remove_member($1,$2,true)', [s, e]);
    await as(e);
    await assert.rejects(db.query('select public.join_server($1)', [invite]), /não pode entrar/);
    await as(a);
    assert.equal(await count('select * from public.server_bans'), 1, 'quem gerencia vê a lista de banidos');
    await db.query('select public.unban_member($1,$2)', [s, e]);
    await as(e); await db.query('select public.join_server($1)', [invite]);

    // moderação de mensagem em canal: só quem tem manage_channels; na comunidade oficial ninguém
    await as(e);
    const m2 = (await db.query<{ id: string }>('insert into public.messages(channel_id,body) values($1,$2) returning id', [text, 'oi'])).rows[0].id;
    await as(b);
    assert.equal((await db.query('delete from public.messages where id=$1', [m2])).affectedRows, 1, 'moderador apaga a mensagem alheia');
    await admin();
    const officialText = (await db.query<{ id: string }>("select id from public.channels where server_id=$1 and kind='text' limit 1", [official])).rows[0].id;
    await as(c);
    const m4 = (await db.query<{ id: string }>('insert into public.messages(channel_id,body) values($1,$2) returning id', [officialText, 'olá geral'])).rows[0].id;
    await as(b);
    assert.equal((await db.query('delete from public.messages where id=$1', [m4])).affectedRows, 0, 'na comunidade oficial ninguém apaga mensagem alheia');
  } finally { await db.close(); }
});

test('SEC-005: limites de mensagens, grupos, canais, convites e arquivos públicos', async () => {
  const { db, as, admin } = await setup();
  try {
    await as(a);
    const s = (await db.query<{ id: string }>("select public.create_server('G1') as id")).rows[0].id;
    const text = (await db.query<{ id: string }>("select id from public.channels where server_id=$1 and kind='text'", [s])).rows[0].id;

    for (let i = 0; i < 40; i++) await db.query('insert into public.messages(channel_id,body) values($1,$2)', [text, `m${i}`]);
    await assert.rejects(db.query('insert into public.messages(channel_id,body) values($1,$2)', [text, 'm40']), /Muitas mensagens/);
    const code = (await db.query<{ code: string }>('insert into public.invites(server_id) values($1) returning code', [s])).rows[0].code;
    await as(b); await db.query('select public.join_server($1)', [code]);
    await db.query('insert into public.messages(channel_id,body) values($1,$2)', [text, 'outra pessoa não é afetada']);

    await as(c);
    for (let i = 0; i < 10; i++) await db.query('select public.create_server($1)', [`g${i}`]);
    await assert.rejects(db.query("select public.create_server('g11')"), /limite de grupos/);

    await as(a);
    for (let i = 0; i < 48; i++) await db.query("insert into public.channels(server_id,name,kind) values($1,$2,'text')", [s, `canal-${i}`]);
    await assert.rejects(db.query("insert into public.channels(server_id,name,kind) values($1,'canal-extra','text')", [s]), 'o 51º canal é recusado');

    for (let i = 0; i < 49; i++) await db.query('insert into public.invites(server_id) values($1)', [s]); // 1 já criado acima
    await assert.rejects(db.query('insert into public.invites(server_id) values($1)', [s]), /convites demais/);

    await as(d);
    for (let i = 0; i < 20; i++) await db.query('insert into storage.objects(bucket_id,name) values($1,$2)', ['avatars', `${d}/${crypto.randomUUID()}.webp`]);
    await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values($1,$2)', ['avatars', `${d}/${crypto.randomUUID()}.webp`]), 'o 21º arquivo no bucket de avatars é recusado');
    await as(e);
    await db.query('insert into storage.objects(bucket_id,name) values($1,$2)', ['avatars', `${e}/${crypto.randomUUID()}.webp`]);
    await admin();
  } finally { await db.close(); }
});

test('SEC-003: as funções de moderação e as redefinidas aqui exigem aal2 de quem tem 2FA; sem 2FA nada muda', async () => {
  const { db, as, admin } = await setup();
  try {
    await friends(db, as, a, b);
    await as(a);
    const s = (await db.query<{ id: string }>("select public.create_server('Grupo') as id")).rows[0].id;
    const invite = (await db.query<{ code: string }>('insert into public.invites(server_id) values($1) returning code', [s])).rows[0].code;
    await admin();
    await db.query("insert into auth.mfa_factors(user_id,status) values($1,'verified')", [b]);

    // b com só a senha (aal1): tudo recusado, com a mensagem de 2FA
    await as(b, 'aal1');
    const blocked: Array<[string, unknown[]]> = [
      ["select public.set_presence('away')", []], ['select public.touch_presence(false)', []], ["select public.create_server('x')", []],
      ['select public.join_server($1)', [invite]], ['select public.open_dm($1)', [a]], ['select public.block_user($1)', [c]],
      ['select public.unblock_user($1)', [c]], ['select public.leave_server($1)', [s]], ['select public.remove_member($1,$2)', [s, a]],
      ['select public.unban_member($1,$2)', [s, a]], ['select public.mark_dm_read($1)', [s]], ["select public.save_server($1,'x','','')", [s]],
    ];
    // A leitura de presença (friends_presence, my_presence, leave_presence) não dá erro: devolve vazio. Isso é testado em tests/mfa-aal2-rpcs.test.ts.
    for (const [sql, params] of blocked) await assert.rejects(db.query(sql, params), /2FA/, sql);

    // b com o código confirmado (aal2): funciona
    await as(b, 'aal2');
    await db.query("select public.set_presence('away')");
    assert.equal((await db.query<{ my_presence: string }>('select public.my_presence()')).rows[0].my_presence, 'away');
    await db.query('select public.join_server($1)', [invite]);
    await db.query('select public.open_dm($1)', [a]);

    // a, sem 2FA, em aal1: segue funcionando
    await as(a, 'aal1');
    await db.query("select public.set_presence('online')");
    await db.query('select * from public.friends_presence()');
  } finally { await db.close(); }
});
