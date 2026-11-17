begin;
-- Preserva as contas do modelo antigo (email fictício @accounts.nacall.invalid). Em vez de apagá-las, cada uma passa a usar
-- o email real que a pessoa informou no cadastro (public.account_emails): mesmo id, usuário, senha, grupos, amizades e DMs.
--
-- ORDEM: em bases que ainda têm essas contas (produção), aplique esta migration ANTES de 202611030002, que apaga qualquer
-- conta com email fictício. Onde não há contas antigas ou a tabela account_emails já foi removida (HML, bases novas), não faz nada.
--
-- Decisão de produto: o email salvo no cadastro antigo vale como confirmado, para ninguém perder o acesso enquanto o envio de
-- código por SMTP não está no ar. Se um email estiver errado, a pessoa só conseguirá recuperar a senha depois que um
-- administrador corrigir o email em Authentication > Users.
do $$
declare restantes integer;
begin
 if to_regclass('public.account_emails') is not null then
  execute $q$
   update auth.users u set
    email=lower(a.email),
    email_confirmed_at=coalesce(u.email_confirmed_at,now()),
    raw_user_meta_data=coalesce(u.raw_user_meta_data,'{}'::jsonb)||jsonb_build_object('email',lower(a.email),'email_verified',true),
    updated_at=now()
   from public.account_emails a
   where a.user_id=u.id and u.email like '%@accounts.nacall.invalid'
    and not exists(select 1 from auth.users o where o.id<>u.id and lower(o.email)=lower(a.email))
    and not exists(select 1 from public.account_emails b where b.user_id<>a.user_id and lower(b.email)=lower(a.email))
  $q$;
  execute $q$
   update auth.identities i set
    identity_data=coalesce(i.identity_data,'{}'::jsonb)||jsonb_build_object('email',lower(u.email),'email_verified',true),
    updated_at=now()
   from auth.users u
   where i.user_id=u.id and i.provider='email' and u.email not like '%@accounts.nacall.invalid'
    and lower(coalesce(i.identity_data->>'email',''))<>lower(u.email)
    and exists(select 1 from public.account_emails a where a.user_id=u.id and lower(a.email)=lower(u.email))
  $q$;
 end if;
 select count(*) into restantes from auth.users where email like '%@accounts.nacall.invalid';
 if restantes>0 then
  raise exception 'Ainda há % conta(s) do modelo antigo sem email real utilizável (sem email salvo ou com email repetido ou já usado por outra conta). Nada foi alterado. Revise antes de aplicar 202611030002, que as apagaria.',restantes;
 end if;
end $$;
commit;
