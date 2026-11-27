-- Novidades do NACALL no sino, vindas do banco (antes eram uma lista fixa no código).
-- Cada novidade tem título e texto em linguagem simples, data de publicação e data de expiração (padrão: 3 dias).
-- O que expirou some sozinho: a política de leitura só deixa ver o que já foi publicado e ainda não expirou.
-- Escrita só pelo service_role (script/workflow do GitHub a partir do PR mesclado, ou pelo painel do Supabase).
-- Aditiva: cria uma tabela nova; nada que já existe muda.
begin;

create table public.product_updates(
 id uuid primary key default gen_random_uuid(),
 -- Chave estável e única (ex.: "pr-142"): publicar de novo a mesma novidade atualiza a linha em vez de duplicar.
 slug text not null unique check(slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
 title text not null check(char_length(btrim(title)) between 3 and 80),
 body text not null check(char_length(btrim(body)) between 10 and 400),
 published_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '3 days',
 -- Link opcional do PR do GitHub que trouxe a novidade (para rastrear; o app não mostra).
 pr_url text check(pr_url is null or pr_url ~ '^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/pull/[0-9]+$'),
 created_at timestamptz not null default now(),
 check(expires_at>published_at)
);
create index product_updates_live on public.product_updates(expires_at,published_at desc);

alter table public.product_updates enable row level security;
revoke all on public.product_updates from public,anon,authenticated;
grant select on public.product_updates to authenticated;
grant select,insert,update,delete on public.product_updates to service_role;

-- Quem está logado lê só o que está no ar: já publicado e ainda não expirado.
create policy product_updates_read on public.product_updates for select to authenticated
 using(published_at<=now() and expires_at>now());

commit;
