begin;
-- Email informado no cadastro. Sem policies de cliente: somente a chave de serviço do servidor acessa.
create table public.account_emails(user_id uuid primary key references public.profiles on delete cascade, email text not null check(char_length(email) between 3 and 254), created_at timestamptz not null default now());
alter table public.account_emails enable row level security;
revoke all on public.account_emails from public,anon,authenticated;
grant all on public.account_emails to service_role;
commit;
