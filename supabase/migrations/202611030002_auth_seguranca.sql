begin;
-- Recomeço limpo do modelo de autenticação (decidido com o time): a identidade passa a ser o email real
-- confirmado por código no Supabase Auth, e o username fica só no perfil.
-- Remove contas do modelo antigo (email fictício), o email lateral e o sistema próprio de recuperação.
delete from auth.users where email like '%@accounts.nacall.invalid';
drop table if exists public.account_recovery;
drop table if exists public.account_emails;

-- Códigos de recuperação do 2FA (somente hash). Sem policies de cliente: só o servidor acessa.
create table public.mfa_recovery_codes(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles on delete cascade,
 code_hash text not null check(char_length(code_hash)=64),
 used_at timestamptz,
 created_at timestamptz not null default now(),
 unique(user_id,code_hash)
);
create index mfa_recovery_codes_user on public.mfa_recovery_codes(user_id) where used_at is null;
alter table public.mfa_recovery_codes enable row level security;
revoke all on public.mfa_recovery_codes from public,anon,authenticated;
grant all on public.mfa_recovery_codes to service_role;

-- Limite de tentativas com máximo e janela por chamada (login, código, reenvio, recuperação).
create function public.consume_rate_limit(bucket_key text, max_attempts integer, window_seconds integer) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if auth.role()<>'service_role' then return false; end if;
 if char_length(bucket_key)<>64 or max_attempts not between 1 and 1000 or window_seconds not between 1 and 86400 then return false; end if;
 insert into public.auth_attempts values(bucket_key,now(),1)
 on conflict(bucket) do update set
 attempts=case when public.auth_attempts.window_start<now()-make_interval(secs=>window_seconds) then 1 else public.auth_attempts.attempts+1 end,
 window_start=case when public.auth_attempts.window_start<now()-make_interval(secs=>window_seconds) then now() else public.auth_attempts.window_start end
 returning attempts into n;
 delete from public.auth_attempts where window_start<now()-interval '2 days';
 return n<=max_attempts;
end; $$;
revoke execute on function public.consume_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_rate_limit(text,integer,integer) to service_role;

-- Libera nicks de cadastros que nunca foram confirmados por código (o perfil é criado já no cadastro).
create function public.purge_unconfirmed_accounts() returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if auth.role()<>'service_role' then return 0; end if;
 with gone as (delete from auth.users where email_confirmed_at is null and created_at<now()-interval '1 day' returning 1)
 select count(*) into n from gone;
 return n;
end; $$;
revoke execute on function public.purge_unconfirmed_accounts() from public,anon,authenticated;
grant execute on function public.purge_unconfirmed_accounts() to service_role;
commit;
