import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Auditoria de segurança (fase 1), achado ALTO: o 2FA só era cobrado na tela do app e nas rotas /api. Com a senha
// (sessão aal1, sem o código do app autenticador) dava para chamar o Supabase direto e ler/escrever mensagens, DMs e
// amigos. A migration 202611200001 exige aal2 no próprio banco para quem tem 2FA ativo; quem não usa 2FA não muda.
const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
const migration = (name: string) => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');

test('com 2FA ativo, sessão aal1 não lê nem escreve; aal2 funciona; sem 2FA nada muda', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create table auth.mfa_factors(id uuid primary key default gen_random_uuid(), user_id uuid not null, status text not null);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      grant usage on schema public,auth to authenticated,anon;
      grant execute on function auth.uid(), auth.jwt() to authenticated,anon;
      create publication supabase_realtime;`);
    await db.exec(await migration('202611020001_initial.sql'));
    await db.exec(await migration('202611200001_mfa_aal2_rls.sql'));
    await db.query('insert into auth.users(id) values($1),($2)', [a, b]);
    const as = async (id: string, aal: 'aal1' | 'aal2') => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
      await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: id, aal })]);
      await db.exec('set role authenticated');
    };
    const rows = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows.length;

    // a e b sem 2FA: tudo funciona em aal1, como hoje
    await as(a, 'aal1');
    await db.query('insert into public.friendships(sender_id,receiver_id) values($1,$2)', [a, b]);
    await as(b, 'aal1');
    await db.query("update public.friendships set status='accepted'");
    const dm = (await db.query<{ id: string }>('select public.open_dm($1) as id', [a])).rows[0].id;
    await db.query('insert into public.messages(dm_id,body) values($1,$2)', [dm, 'segredo']);
    assert.equal(await rows('select * from public.messages'), 1, 'sem 2FA: aal1 lê normalmente');

    // b ativa o 2FA
    await db.exec('reset role');
    await db.query("insert into auth.mfa_factors(user_id,status) values($1,'verified')", [b]);

    // atacante com a senha de b (aal1): não lê nem escreve
    await as(b, 'aal1');
    assert.equal(await rows('select * from public.messages'), 0, 'aal1 com 2FA não lê mensagens');
    assert.equal(await rows('select * from public.dms'), 0, 'aal1 com 2FA não vê DMs');
    assert.equal(await rows('select * from public.friendships'), 0, 'aal1 com 2FA não vê amigos');
    await assert.rejects(db.query('insert into public.messages(dm_id,body) values($1,$2)', [dm, 'invasor']), 'aal1 com 2FA não envia');

    // b de verdade, com o código confirmado (aal2): tudo volta
    await as(b, 'aal2');
    assert.equal(await rows('select * from public.messages'), 1, 'aal2 lê');
    await db.query('insert into public.messages(dm_id,body) values($1,$2)', [dm, 'oi']);
    assert.equal(await rows('select * from public.messages'), 2, 'aal2 envia');

    // a continua sem 2FA: aal1 segue funcionando e vê a mensagem nova
    await as(a, 'aal1');
    assert.equal(await rows('select * from public.messages'), 2, 'quem não usa 2FA não é afetado');
    // 2FA pendente (fator não verificado) não bloqueia
    await db.exec('reset role');
    await db.query("insert into auth.mfa_factors(user_id,status) values($1,'unverified')", [a]);
    await as(a, 'aal1');
    assert.equal(await rows('select * from public.messages'), 2, 'fator não verificado não bloqueia');
  } finally {
    await db.close();
  }
});
