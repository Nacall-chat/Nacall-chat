begin;
-- Marca as contas do modelo antigo (as que têm linha em public.account_emails ou ainda usam email @accounts.nacall.invalid) com
-- app_metadata.email_pending = true. O app segura essas contas numa tela que pede um email válido, confirmado por código, antes de
-- liberar o uso. A marca está em app_metadata, que a própria pessoa não consegue editar. Contas novas nunca recebem a marca.
--
-- ORDEM em produção, depois do deploy: 202611170001 (converte para o email real) -> esta -> o restante de 202611030002 (que apaga account_emails).
-- Depois que account_emails some, esta migration não faz nada (idempotente).
do $$
begin
 if to_regclass('public.account_emails') is not null then
  execute $q$
   update auth.users u set raw_app_meta_data=coalesce(u.raw_app_meta_data,'{}'::jsonb)||jsonb_build_object('email_pending',true),updated_at=now()
   where exists(select 1 from public.account_emails a where a.user_id=u.id)
  $q$;
 end if;
 update auth.users set raw_app_meta_data=coalesce(raw_app_meta_data,'{}'::jsonb)||jsonb_build_object('email_pending',true),updated_at=now()
 where email like '%@accounts.nacall.invalid';
end $$;
commit;
