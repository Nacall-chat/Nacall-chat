begin;
-- Diz se um email já tem conta: 'confirmed' (conta ativa), 'unconfirmed' (cadastro que ficou sem confirmar) ou 'none'.
-- Usada pelo servidor (service_role) para avisar no cadastro que o email já existe e para só enviar o código de
-- "esqueci a senha" quando existe conta. Nunca é chamada pelo navegador.
create or replace function public.email_status(p_email text) returns text language sql stable security definer set search_path='' as $$
 select coalesce((select case when u.email_confirmed_at is not null then 'confirmed' else 'unconfirmed' end from auth.users u where u.email=lower(trim(p_email)) limit 1),'none');
$$;
revoke all on function public.email_status(text) from public,anon,authenticated;
grant execute on function public.email_status(text) to service_role;
commit;
