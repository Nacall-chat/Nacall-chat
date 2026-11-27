import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { jargonIn, parseNovidade, updateRow, validateNovidade } from '../scripts/novidade-lib.mjs';

// Novidades do sino vindas do banco (product_updates): leitura só do que está no ar, escrita só pelo service_role.
const a = '11111111-1111-4111-8111-111111111111';
const migration = (name: string) => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');

async function setup() {
  const db = new PGlite();
  // service_role do Supabase ignora RLS (BYPASSRLS); aqui o papel é criado do mesmo jeito.
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role; grant execute on all functions in schema auth to anon,authenticated;
    create publication supabase_realtime;`);
  await db.exec(await migration('202611020001_initial.sql'));
  await db.exec(await migration('202611280002_novidades.sql'));
  await db.query('insert into auth.users values($1)', [a]);
  const as = async (role: 'authenticated' | 'anon' | 'service_role') => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [role === 'authenticated' ? a : '']);
    await db.exec(`set role ${role}`);
  };
  return { db, as };
}
const slugs = async (db: PGlite) => (await db.query<{ slug: string }>('select slug from public.product_updates order by published_at desc')).rows.map(r => r.slug);

test('novidades: quem está logado vê só o que está no ar; expirado e agendado somem sozinhos', async () => {
  const { db, as } = await setup();
  try {
    await as('service_role');
    await db.query("insert into public.product_updates(slug,title,body) values('pr-10','Popover de call','Passe o mouse no servidor para ver quem está na call.')");
    await db.query("insert into public.product_updates(slug,title,body,published_at,expires_at) values('pr-1','Antiga','Esta já passou dos três dias.',now()-interval '4 days',now()-interval '1 day')");
    await db.query("insert into public.product_updates(slug,title,body,published_at,expires_at) values('pr-20','Amanhã','Esta só aparece amanhã.',now()+interval '1 day',now()+interval '4 days')");
    const [row] = (await db.query<{ days: number }>("select extract(epoch from expires_at-published_at)/86400 as days from public.product_updates where slug='pr-10'")).rows;
    assert.equal(Math.round(Number(row.days)), 3, 'validade padrão: 3 dias');
    await as('authenticated');
    assert.deepEqual(await slugs(db), ['pr-10'], 'só a que está no ar');
    await as('anon');
    await assert.rejects(db.query('select * from public.product_updates'), /permission denied/, 'sem login, nada');
  } finally { await db.close(); }
});

test('novidades: escrita só pelo service_role; regras de tamanho, slug e link', async () => {
  const { db, as } = await setup();
  try {
    await as('authenticated');
    await assert.rejects(db.query("insert into public.product_updates(slug,title,body) values('pr-99','Falsa','Novidade inventada por alguém.')"), /permission denied/);
    await as('service_role');
    await db.query("insert into public.product_updates(slug,title,body) values('pr-5','Título ok','Texto com tamanho ok.')");
    await as('authenticated');
    await assert.rejects(db.query("update public.product_updates set title='Hackeado'"), /permission denied/);
    await assert.rejects(db.query('delete from public.product_updates'), /permission denied/);
    await as('service_role');
    await assert.rejects(db.query("insert into public.product_updates(slug,title,body) values('pr-5','Outra','Mesmo slug não duplica.')"), /duplicate key/);
    await assert.rejects(db.query("insert into public.product_updates(slug,title,body) values('PR 6','Título','Slug com espaço e maiúscula.')"), /check/);
    await assert.rejects(db.query("insert into public.product_updates(slug,title,body) values('pr-7','Ti','Título curto demais.')"), /check/);
    await assert.rejects(db.query("insert into public.product_updates(slug,title,body,pr_url) values('pr-8','Título','Link que não é do GitHub.','https://evil.example/pull/1')"), /check/);
    await assert.rejects(db.query("insert into public.product_updates(slug,title,body,published_at,expires_at) values('pr-9','Título','Expira antes de publicar.',now(),now()-interval '1 hour')"), /check/);
    await db.query("insert into public.product_updates(slug,title,body,pr_url) values('pr-11','Título','Com link do PR.','https://github.com/Nacall-chat/Nacall-chat/pull/11')");
  } finally { await db.close(); }
});

test('novidade do PR: lê a seção, recusa jargão e monta a linha com 3 dias', () => {
  const body = '## O que mudou\nCoisas técnicas: RLS, RPC.\n\n## Novidade para quem usa\n<!-- comentário -->\nTítulo: Veja quem está em call\nTexto: Passe o mouse no ícone de um servidor\npara ver quem está na call agora.\n\n## Outra seção\nTexto: não é daqui';
  const novidade = parseNovidade(body);
  assert.deepEqual(novidade, { title: 'Veja quem está em call', text: 'Passe o mouse no ícone de um servidor para ver quem está na call agora.' });
  assert.deepEqual(validateNovidade(novidade), []);
  assert.equal(parseNovidade('## O que mudou\nnada'), null, 'sem a seção, nada a publicar');
  assert.equal(parseNovidade('## Novidade para quem usa\nTítulo:\nTexto:\n'), null, 'modelo em branco, nada a publicar');
  assert.deepEqual(jargonIn('Corrigimos o deploy e a API do PR'), ['pr', 'deploy', 'api']);
  assert.deepEqual(jargonIn('Agora dá para prever quem aprendeu'), [], 'palavras comuns que contêm os termos passam');
  assert.match(validateNovidade({ title: 'Fix no backend', text: 'Refatora a migration de RLS.' }).join(' '), /termos técnicos/);
  assert.match(validateNovidade({ title: 'Ok', text: 'curto' }).join(' '), /título.*texto/s);
  const now = new Date('2026-11-27T12:00:00Z');
  const row = updateRow({ number: 142, url: 'https://github.com/Nacall-chat/Nacall-chat/pull/142', title: ' Veja ', text: 'Texto simples aqui.', now });
  assert.deepEqual(row, { slug: 'pr-142', title: 'Veja', body: 'Texto simples aqui.', published_at: '2026-11-27T12:00:00.000Z', expires_at: '2026-11-30T12:00:00.000Z', pr_url: 'https://github.com/Nacall-chat/Nacall-chat/pull/142' });
  assert.equal(updateRow({ number: 1, url: 'https://evil.example/x', title: 'abc', text: 'abcdefghijk', now }).pr_url, null);
  assert.throws(() => updateRow({ number: 'x', title: 'abc', text: 'abcdefghijk' }), /PR inválido/);
  assert.throws(() => updateRow({ number: 1, title: 'abc', text: 'abcdefghijk', days: 90 }), /1 a 30/);
});
