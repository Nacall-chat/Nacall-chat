-- Dois achados baixos das revisões de segurança (ECC, 22/11/2026).
-- 1. member_rank(servidor, usuário) era chamável por qualquer pessoa logada e respondia o cargo de qualquer usuário em
--    qualquer grupo, mesmo sem ser membro (dava para descobrir quem é dono ou admin de grupos alheios). Agora só
--    responde para quem é membro do grupo (ou sobre si mesmo); para os outros devolve 0. As funções de cargo
--    (save_server_role, assign_server_role, remove_member...) chamam como membro e continuam iguais.
-- 2. Ícones de grupo sem limite: quem gerencia um grupo podia lotar o bucket group-icons. Agora no máximo 20 arquivos
--    por grupo (o app troca o ícone apagando o anterior, então o uso normal fica em 1 ou 2), como avatars/profile-covers.
-- Aditiva. Não muda nenhuma tabela.
begin;

create or replace function public.member_rank(s uuid,u uuid) returns integer language sql stable security definer set search_path='' as $$
 select case
  when not (u = auth.uid() or public.is_member(s)) then 0
  when exists(select 1 from public.servers where id=s and owner_id=u) then 1000
  else coalesce((select max(r.position) from public.server_roles r join public.member_roles m on m.role_id=r.id and m.server_id=r.server_id where m.server_id=s and m.user_id=u),0)
 end $$;

create or replace function public.group_icon_quota_ok(object_name text) returns boolean language sql stable security definer set search_path='' as $$
 select (select count(*) from storage.objects o where o.bucket_id='group-icons' and (storage.foldername(o.name))[1]=(storage.foldername(object_name))[1])<20; $$;
revoke all on function public.group_icon_quota_ok(text) from public,anon;
grant execute on function public.group_icon_quota_ok(text) to authenticated;

drop policy if exists group_icons_quota on storage.objects;
create policy group_icons_quota on storage.objects as restrictive for insert to authenticated
 with check (bucket_id <> 'group-icons' or public.group_icon_quota_ok(name));

commit;
