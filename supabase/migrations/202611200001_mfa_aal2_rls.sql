-- 2FA exigido no próprio banco (auditoria de segurança, fase 1, achado ALTO).
-- Antes: o 2FA só era cobrado na tela do app e nas rotas /api. Com a senha (sessão aal1, sem o código do app
-- autenticador) dava para chamar o Supabase direto (REST/Realtime) e ler ou escrever mensagens, DMs e amigos.
-- Agora: para quem tem 2FA verificado, toda leitura e escrita nas tabelas privadas exige sessão aal2.
-- Quem não usa 2FA (ou só tem fator não verificado) não muda nada.
-- Aditiva: só cria uma função e políticas RESTRICTIVE, que se somam às permissivas que já existem.
-- Funções SECURITY DEFINER (RPCs) não passam por RLS; as que expõem dados privados ficam como pendência.
begin;

create or replace function public.mfa_satisfied() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
        where f.user_id = (select auth.uid()) and f.status = 'verified'
      );
$$;
revoke all on function public.mfa_satisfied() from public, anon;
grant execute on function public.mfa_satisfied() to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'messages','dms','dm_reads','friendships','profiles',
    'servers','server_members','channels','invites','server_roles','member_roles',
    'room_media','stickers','store_orders'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists mfa_aal2_required on public.%I', t);
      execute format(
        'create policy mfa_aal2_required on public.%I as restrictive for all to authenticated '
        'using ((select public.mfa_satisfied())) with check ((select public.mfa_satisfied()))', t);
    end if;
  end loop;

  -- Arquivos privados (áudios do chat e figurinhas). Buckets públicos (avatars, group-icons, profile-covers) não mudam.
  if to_regclass('storage.objects') is not null then
    drop policy if exists mfa_aal2_private_media on storage.objects;
    create policy mfa_aal2_private_media on storage.objects as restrictive for all to authenticated
      using (bucket_id not in ('chat-audio', 'stickers') or (select public.mfa_satisfied()))
      with check (bucket_id not in ('chat-audio', 'stickers') or (select public.mfa_satisfied()));
  end if;
end $$;

commit;
